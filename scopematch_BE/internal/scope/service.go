package scope

import (
	"context"
	"strings"

	"scopematch/internal/library"
	"scopematch/internal/store"
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

type Service struct{ st *store.Store }

func NewService(st *store.Store) *Service { return &Service{st: st} }

// Authenticate resolves a link token to an Actor.
func (s *Service) Authenticate(ctx context.Context, token string) (Actor, error) {
	if token == "" {
		return Actor{}, store.ErrNotFound
	}
	pid, role, err := store.LookupToken(ctx, s.st.DB, HashToken(token))
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
	p := store.Project{
		ID: newID(), Name: in.Name, FreelancerName: in.FreelancerName,
		ClientName: in.ClientName, Brief: in.Brief, CreatedAt: store.Now(),
	}
	err = s.st.Tx(ctx, func(q store.Q) error {
		if err := store.InsertProject(ctx, q, p); err != nil {
			return err
		}
		if err := store.InsertToken(ctx, q, hash, p.ID, RoleOwner); err != nil {
			return err
		}
		return store.ReplaceCards(ctx, q, p.ID, library.Suggested(p.Brief))
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
	seen := map[string]bool{}
	var ids []string
	for _, id := range cardIDs {
		if _, ok := library.Get(id); !ok {
			return invalid(map[string]string{"cardIds": "Unknown question: " + id})
		}
		if !seen[id] {
			seen[id] = true
			ids = append(ids, id)
		}
	}
	return s.st.Tx(ctx, func(q store.Q) error {
		p, err := store.GetProject(ctx, q, a.ProjectID)
		if err != nil {
			return err
		}
		if p.LockedAt.Valid {
			return conflict("locked")
		}
		return store.ReplaceCards(ctx, q, p.ID, ids)
	})
}
