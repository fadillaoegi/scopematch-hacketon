package scope

import (
	"context"

	"scopematch/internal/library"
	"scopematch/internal/store"
)

// Stages, derived from stored rows on every read.
const (
	StageSetup     = "setup"
	StageAnswering = "answering"
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
	Name      string          `json:"name"`
	Submitted bool            `json:"submitted"`
	Answers   *[]store.Answer `json:"answers,omitempty"`
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
	Me      PartyView       `json:"me"`
	Other   PartyView       `json:"other"`
}

func (s *Service) Session(ctx context.Context, a Actor) (SessionView, error) {
	var v SessionView
	err := s.st.Tx(ctx, func(q store.Q) error {
		var err error
		v, err = buildSession(ctx, q, a)
		return err
	})
	return v, err
}

func buildSession(ctx context.Context, q store.Q, a Actor) (SessionView, error) {
	p, err := store.GetProject(ctx, q, a.ProjectID)
	if err != nil {
		return SessionView{}, err
	}
	ids, err := store.ListCards(ctx, q, p.ID)
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
	me.Submitted, err = store.Submitted(ctx, q, p.ID, a.Role)
	if err != nil {
		return SessionView{}, err
	}
	other.Submitted, err = store.Submitted(ctx, q, p.ID, otherRole)
	if err != nil {
		return SessionView{}, err
	}
	answers, err := store.Answers(ctx, q, p.ID, a.Role)
	if err != nil {
		return SessionView{}, err
	}
	me.Answers = &answers
	// Do not even query the other role's answers until both have sealed.
	if me.Submitted && other.Submitted {
		answers, err := store.Answers(ctx, q, p.ID, otherRole)
		if err != nil {
			return SessionView{}, err
		}
		other.Answers = &answers
	}

	stage := StageSetup
	if p.LockedAt.Valid {
		stage = StageAnswering
	}

	return SessionView{
		Role:  a.Role,
		Stage: stage,
		Project: ProjectView{
			Name: p.Name, Brief: p.Brief, FreelancerName: p.FreelancerName,
			ClientName: p.ClientName, Locked: p.LockedAt.Valid,
		},
		Cards:   cards,
		Matches: all,
		Me:      me,
		Other:   other,
	}, nil
}
