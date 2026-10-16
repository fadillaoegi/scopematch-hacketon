package scope

import (
	"context"

	"scopematch/internal/domain"
	"scopematch/internal/library"
)

// Stages, derived from stored rows on every read.
const (
	StageSetup     = "setup"
	StageAnswering = "answering"
	StageCompare   = "compare"
	StageReview    = "review"
	StageAgreed    = "agreed"
)

type ProjectView struct {
	Name           string `json:"name"`
	Brief          string `json:"brief"`
	FreelancerName string `json:"freelancerName"`
	ClientName     string `json:"clientName"`
	Locked         bool   `json:"locked"`
}

type CardRef struct {
	ID    string         `json:"id"`
	Match *library.Match `json:"match"`
}

type PartyView struct {
	Name      string           `json:"name"`
	Submitted bool             `json:"submitted"`
	Answers   *[]domain.Answer `json:"answers,omitempty"`
}

// SessionView is everything one role may see about its project. This is the
// single place that decides visibility.
type SessionView struct {
	Role    string      `json:"role"`
	Stage   string      `json:"stage"`
	Project ProjectView `json:"project"`
	Cards   []CardRef   `json:"cards"`
	// Matches lists where every library card matched the brief, selected or
	// not, so the setup screen can show provenance for unselected cards.
	Matches []library.Match `json:"matches"`
	// CustomCards are this project's own questions (AI-suggested, accepted by
	// the freelancer), in the same shape as library cards.
	CustomCards []library.Card `json:"customCards"`
	// AISuggestions tells the freelancer's screen whether it can offer AI
	// question suggestions. Never set for the client.
	AISuggestions bool         `json:"aiSuggestions,omitempty"`
	Me            PartyView    `json:"me"`
	Other         PartyView    `json:"other"`
	Compare       []Comparison `json:"compare,omitempty"`
	Counts        *Counts      `json:"counts,omitempty"`
	Scope         *ScopeState  `json:"scope,omitempty"`
}

func (s *Service) Session(ctx context.Context, a Actor) (SessionView, error) {
	var v SessionView
	err := s.repo.WithinTransaction(ctx, func(q Repository) error {
		var err error
		v, err = buildSession(ctx, q, a)
		return err
	})
	v.AISuggestions = err == nil && a.Role == RoleOwner && s.suggester != nil
	return v, err
}

func buildSession(ctx context.Context, q Repository, a Actor) (SessionView, error) {
	p, err := q.GetProject(ctx, a.ProjectID)
	if err != nil {
		return SessionView{}, err
	}
	ids, err := q.ListCards(ctx, p.ID)
	if err != nil {
		return SessionView{}, err
	}
	_, custom, err := projectCards(ctx, q, p.ID)
	if err != nil {
		return SessionView{}, err
	}
	matches := library.MatchBrief(p.Brief)
	all := make([]library.Match, 0, len(matches))
	for _, c := range library.All() {
		if m, ok := matches[c.ID]; ok {
			all = append(all, m)
		}
	}
	cards := make([]CardRef, 0, len(ids))
	for _, id := range ids {
		ref := CardRef{ID: id}
		if m, ok := matches[id]; ok {
			ref.Match = &m
		}
		cards = append(cards, ref)
	}

	me, other := PartyView{Name: p.FreelancerName}, PartyView{Name: p.ClientName}
	if a.Role == RoleClient {
		me, other = other, me
	}
	otherRole := RoleClient
	if a.Role == RoleClient {
		otherRole = RoleOwner
	}
	me.Submitted, err = q.Submitted(ctx, p.ID, a.Role)
	if err != nil {
		return SessionView{}, err
	}
	other.Submitted, err = q.Submitted(ctx, p.ID, otherRole)
	if err != nil {
		return SessionView{}, err
	}
	answers, err := q.Answers(ctx, p.ID, a.Role)
	if err != nil {
		return SessionView{}, err
	}
	me.Answers = &answers
	// Do not even query the other role's answers until both have sealed.
	if me.Submitted && other.Submitted {
		answers, err := q.Answers(ctx, p.ID, otherRole)
		if err != nil {
			return SessionView{}, err
		}
		other.Answers = &answers
	}

	stage := StageSetup
	if p.LockedAt != "" {
		stage = StageAnswering
	}
	var comparisons []Comparison
	var counts *Counts
	if me.Submitted && other.Submitted {
		stage = StageCompare
		comparisons, counts = compareAnswers(ids, *me.Answers, *other.Answers)
		proposals, err := q.ActiveProposals(ctx, p.ID)
		if err != nil {
			return SessionView{}, err
		}
		replaced, err := q.ReplacedProposals(ctx, p.ID)
		if err != nil {
			return SessionView{}, err
		}
		for i := range comparisons {
			for _, old := range replaced {
				if old.CardID == comparisons[i].CardID {
					comparisons[i].History = append(comparisons[i].History, old)
				}
			}
		}
		for i := range comparisons {
			for _, proposal := range proposals {
				if proposal.CardID != comparisons[i].CardID {
					continue
				}
				comparisons[i].Proposal = &proposal
				if proposal.Decided() {
					switch comparisons[i].Status {
					case StatusSame:
						counts.Same--
					case StatusDiscussion:
						counts.Discussion--
					case StatusClarification:
						counts.Clarification--
					}
					comparisons[i].Status = "decided"
					counts.Decided++
				}
			}
		}
		if counts.Decided == counts.Total {
			stage = StageReview
		}
		if p.AgreedVersion > 0 {
			stage = StageAgreed
		}
	}

	var scopeState *ScopeState
	if me.Submitted && other.Submitted {
		scope, err := scopeView(ctx, q, p)
		if err != nil {
			return SessionView{}, err
		}
		scopeState = &scope.ScopeState
	}
	return SessionView{
		Scope: scopeState,
		Role:  a.Role,
		Stage: stage,
		Project: ProjectView{
			Name: p.Name, Brief: p.Brief, FreelancerName: p.FreelancerName,
			ClientName: p.ClientName, Locked: p.LockedAt != "",
		},
		Cards:       cards,
		Matches:     all,
		CustomCards: custom,
		Me:          me,
		Other:       other,
		Compare:     comparisons,
		Counts:      counts,
	}, nil
}
