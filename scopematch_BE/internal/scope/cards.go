package scope

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"strings"
	"sync"

	"scopematch/internal/domain"
	"scopematch/internal/library"
)

// QuestionSuggester is the application-owned port for an AI model that
// proposes extra scenario questions for a brief. It only suggests: the
// freelancer reviews every card before it joins a project, and nothing the
// model returns decides an answer, price, time, or approval.
type QuestionSuggester interface {
	SuggestQuestions(ctx context.Context, brief string, existingQuestions []string) ([]library.Card, error)
}

// ErrSuggesterFailed wraps any failure from the suggester so callers can
// report it without leaking provider details.
var ErrSuggesterFailed = errors.New("question suggester failed")

// Option configures a Service.
type Option func(*Service)

// WithSuggester enables AI question suggestions.
func WithSuggester(q QuestionSuggester) Option { return func(s *Service) { s.suggester = q } }

const (
	maxSuggestionsPerCall        = 3
	maxSuggestionCallsPerProject = 5 // per server run; protects the free-tier quota
	maxCustomCardsPerProject     = 6
	customCardPrefix             = "ai-"
)

type suggestionLimiter struct {
	mu    sync.Mutex
	calls map[string]int
}

func (l *suggestionLimiter) take(projectID string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.calls == nil {
		l.calls = map[string]int{}
	}
	if l.calls[projectID] >= maxSuggestionCallsPerProject {
		return false
	}
	l.calls[projectID]++
	return true
}

// AISuggestionsEnabled reports whether a suggester is configured.
func (s *Service) AISuggestionsEnabled() bool { return s.suggester != nil }

// cardSet resolves a card id to a curated card or one of the project's own.
type cardSet map[string]library.Card

func (c cardSet) get(id string) (library.Card, bool) { card, ok := c[id]; return card, ok }

func projectCards(ctx context.Context, q Repository, pid string) (cardSet, []library.Card, error) {
	set := cardSet{}
	for _, c := range library.All() {
		set[c.ID] = c
	}
	records, err := q.CustomCards(ctx, pid)
	if err != nil {
		return nil, nil, err
	}
	custom := make([]library.Card, 0, len(records))
	for _, r := range records {
		var c library.Card
		if err := json.Unmarshal([]byte(r.CardJSON), &c); err != nil {
			return nil, nil, err
		}
		set[c.ID] = c
		custom = append(custom, c)
	}
	return set, custom, nil
}

// SuggestCards asks the configured model for draft questions. Drafts are
// validated and returned; nothing is stored until the freelancer adds one.
func (s *Service) SuggestCards(ctx context.Context, a Actor) ([]library.Card, error) {
	if a.Role != RoleOwner {
		return nil, forbidden("owner_only")
	}
	if s.suggester == nil {
		return nil, unavailable("ai_unavailable")
	}
	var brief string
	var existing []string
	err := s.repo.WithinTransaction(ctx, func(q Repository) error {
		p, err := q.GetProject(ctx, a.ProjectID)
		if err != nil {
			return err
		}
		if p.LockedAt != "" {
			return conflict("locked")
		}
		set, _, err := projectCards(ctx, q, p.ID)
		if err != nil {
			return err
		}
		for _, c := range set {
			existing = append(existing, c.Question)
		}
		brief = p.Brief
		return nil
	})
	if err != nil {
		return nil, err
	}
	if !s.limiter.take(a.ProjectID) {
		return nil, tooMany("suggestion_limit")
	}
	raw, err := s.suggester.SuggestQuestions(ctx, brief, existing)
	if err != nil {
		log.Printf("AI question suggestions failed: %v", err)
		return nil, upstream("ai_failed")
	}
	out := []library.Card{}
	for i, c := range raw {
		if len(out) == maxSuggestionsPerCall {
			break
		}
		clean, err := validateCustomCard(c)
		if err != nil {
			continue // drop malformed drafts instead of failing the whole request
		}
		clean.ID = "draft-" + string(rune('1'+i))
		out = append(out, clean)
	}
	return out, nil
}

// AddCustomCard stores a reviewed card for this project and selects it.
// The card content comes from the browser, so it is validated again here.
func (s *Service) AddCustomCard(ctx context.Context, a Actor, in library.Card) error {
	if a.Role != RoleOwner {
		return forbidden("owner_only")
	}
	card, err := validateCustomCard(in)
	if err != nil {
		return err
	}
	return s.repo.WithinTransaction(ctx, func(q Repository) error {
		p, err := q.GetProject(ctx, a.ProjectID)
		if err != nil {
			return err
		}
		if p.LockedAt != "" {
			return conflict("locked")
		}
		_, custom, err := projectCards(ctx, q, p.ID)
		if err != nil {
			return err
		}
		if len(custom) >= maxCustomCardsPerProject {
			return conflict("custom_card_limit")
		}
		card.ID = customCardPrefix + newID()[:12]
		card.Number = len(library.All()) + len(custom) + 1
		card.Source = "ai"
		body, err := json.Marshal(card)
		if err != nil {
			return err
		}
		if err := q.InsertCustomCard(ctx, p.ID, domain.CustomCardRecord{CardID: card.ID, CardJSON: string(body), CreatedAt: now()}); err != nil {
			return err
		}
		ids, err := q.ListCards(ctx, p.ID)
		if err != nil {
			return err
		}
		return q.ReplaceCards(ctx, p.ID, append(ids, card.ID))
	})
}

// validateCustomCard normalizes a project-specific card: exactly three
// concrete options with ids a–c, bounded text, no previews or keywords.
func validateCustomCard(c library.Card) (library.Card, error) {
	clip := func(s string) string { return strings.Join(strings.Fields(s), " ") }
	fields := map[string]string{}
	out := library.Card{Title: clip(c.Title), Question: clip(c.Question), Keywords: []string{}}
	if n := len([]rune(out.Title)); n == 0 || n > 40 {
		fields["title"] = "Give the question a short title (1–40 characters)."
	}
	if n := len([]rune(out.Question)); n < 5 || n > 160 {
		fields["question"] = "Write the question in 5–160 characters."
	}
	if len(c.Options) != 3 {
		fields["options"] = "A question needs exactly three options."
	}
	list := func(items []string) ([]string, bool) {
		clean := []string{}
		for _, item := range items {
			if item = clip(item); item != "" {
				if len([]rune(item)) > 160 {
					return nil, false
				}
				clean = append(clean, item)
			}
		}
		return clean, len(clean) <= 4
	}
	for i, o := range c.Options {
		if i >= 3 {
			break
		}
		opt := library.Option{ID: string(rune('a' + i)), Label: clip(o.Label)}
		if n := len([]rune(opt.Label)); n == 0 || n > 100 {
			fields["options"] = "Each option needs a label of 1–100 characters."
		}
		var ok1, ok2, ok3, ok4 bool
		opt.Included, ok1 = list(o.Included)
		opt.Excluded, ok2 = list(o.Excluded)
		opt.ClientResponsibilities, ok3 = list(o.ClientResponsibilities)
		opt.AcceptanceCriteria, ok4 = list(o.AcceptanceCriteria)
		if !ok1 || !ok2 || !ok3 || !ok4 {
			fields["options"] = "Keep each list to at most four items of up to 160 characters."
		}
		out.Options = append(out.Options, opt)
	}
	if len(fields) > 0 {
		return library.Card{}, invalid(fields)
	}
	return out, nil
}
