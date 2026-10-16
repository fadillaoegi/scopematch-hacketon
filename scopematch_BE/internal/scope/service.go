package scope

import (
	"context"
	"strings"

	"scopematch/internal/domain"
	"scopematch/internal/library"
)

const (
	RoleOwner  = "owner"
	RoleClient = "client"
)

// Actor is who is making a request, resolved from their link token.
type Actor struct {
	ProjectID string
	Role      string
}

type Service struct {
	repo      Repository
	suggester QuestionSuggester
	limiter   suggestionLimiter
}

func NewService(repo Repository, opts ...Option) *Service {
	s := &Service{repo: repo}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// Authenticate resolves a link token to an Actor.
func (s *Service) Authenticate(ctx context.Context, token string) (Actor, error) {
	if token == "" {
		return Actor{}, domain.ErrNotFound
	}
	pid, role, err := s.repo.LookupToken(ctx, HashToken(token))
	return Actor{ProjectID: pid, Role: role}, err
}

type NewProject struct {
	Name           string `json:"name"`
	FreelancerName string `json:"freelancerName"`
	ClientName     string `json:"clientName"`
	Brief          string `json:"brief"`
}

const (
	maxNameLen  = 120
	maxBriefLen = 5000
)

// CreateProject validates input, stores the project with the cards its brief
// suggests, and returns the owner link token.
func (s *Service) CreateProject(ctx context.Context, in NewProject) (ownerToken string, err error) {
	in.Name = strings.TrimSpace(in.Name)
	in.FreelancerName = strings.TrimSpace(in.FreelancerName)
	in.ClientName = strings.TrimSpace(in.ClientName)
	in.Brief = strings.TrimSpace(in.Brief)

	fields := map[string]string{}
	required := func(key, val, msg string) {
		if val == "" {
			fields[key] = msg
		} else if len([]rune(val)) > maxNameLen {
			fields[key] = "Keep this under 120 characters."
		}
	}
	required("name", in.Name, "Give the project a name.")
	required("freelancerName", in.FreelancerName, "Add your name so your client knows who's asking.")
	required("clientName", in.ClientName, "Add your client's name.")
	if in.Brief == "" {
		fields["brief"] = "Paste the client's brief — the questions come from it."
	} else if len([]rune(in.Brief)) > maxBriefLen {
		fields["brief"] = "Keep the brief under 5,000 characters."
	}
	if len(fields) > 0 {
		return "", invalid(fields)
	}

	token, hash := NewToken()
	p := domain.Project{
		ID: newID(), Name: in.Name, FreelancerName: in.FreelancerName,
		ClientName: in.ClientName, Brief: in.Brief, CreatedAt: now(),
	}
	err = s.repo.WithinTransaction(ctx, func(q Repository) error {
		if err := q.InsertProject(ctx, p); err != nil {
			return err
		}
		if err := q.InsertToken(ctx, hash, p.ID, RoleOwner); err != nil {
			return err
		}
		return q.ReplaceCards(ctx, p.ID, library.Suggested(p.Brief))
	})
	if err != nil {
		return "", err
	}
	return token, nil
}

// SetCards replaces the project's selected cards. Owner only, before lock.
func (s *Service) SetCards(ctx context.Context, a Actor, cardIDs []string) error {
	if a.Role != RoleOwner {
		return forbidden("owner_only")
	}
	if len(cardIDs) == 0 {
		return invalid(map[string]string{"cardIds": "Keep at least one question."})
	}
	return s.repo.WithinTransaction(ctx, func(q Repository) error {
		p, err := q.GetProject(ctx, a.ProjectID)
		if err != nil {
			return err
		}
		if p.LockedAt != "" {
			return conflict("locked")
		}
		// Curated cards plus this project's own; another project's custom
		// card id is unknown here.
		set, _, err := projectCards(ctx, q, p.ID)
		if err != nil {
			return err
		}
		seen := map[string]bool{}
		var ids []string
		for _, id := range cardIDs {
			if _, ok := set.get(id); !ok {
				return invalid(map[string]string{"cardIds": "Unknown question: " + id})
			}
			if !seen[id] {
				seen[id] = true
				ids = append(ids, id)
			}
		}
		return q.ReplaceCards(ctx, p.ID, ids)
	})
}
