package scope

import (
	"context"
	"strings"

	"scopematch/internal/domain"
	"scopematch/internal/library"
)

type ProposalInput struct {
	OptionID   string `json:"optionId"`
	CustomText string `json:"customText"`
	Why        string `json:"why"`
}

func requireCompare(ctx context.Context, q Repository, a Actor) error {
	p, err := q.GetProject(ctx, a.ProjectID)
	if err != nil {
		return err
	}
	if p.AgreedVersion > 0 {
		return conflict("agreed")
	}
	for _, role := range []string{RoleOwner, RoleClient} {
		yes, err := q.Submitted(ctx, p.ID, role)
		if err != nil {
			return err
		}
		if !yes {
			return conflict("not_revealed")
		}
	}
	return nil
}
func seedSameAnswers(ctx context.Context, q Repository, pid string) error {
	mine, err := q.Answers(ctx, pid, RoleOwner)
	if err != nil {
		return err
	}
	theirs, err := q.Answers(ctx, pid, RoleClient)
	if err != nil {
		return err
	}
	byOther := map[string]string{}
	for _, a := range theirs {
		byOther[a.CardID] = a.OptionID
	}
	for _, a := range mine {
		if a.OptionID == library.OptionOther || a.OptionID == library.OptionUnsure || byOther[a.CardID] != a.OptionID {
			continue
		}
		if err := q.InsertProposal(ctx, pid, domain.Proposal{ID: newID(), CardID: a.CardID, ProposedBy: "system", OptionID: a.OptionID, CreatedAt: now()}); err != nil {
			return err
		}
	}
	return nil
}
func (s *Service) Propose(ctx context.Context, a Actor, cardID string, in ProposalInput) error {
	return s.repo.WithinTransaction(ctx, func(q Repository) error {
		if err := requireCompare(ctx, q, a); err != nil {
			return err
		}
		ids, err := q.ListCards(ctx, a.ProjectID)
		if err != nil {
			return err
		}
		selected := false
		for _, id := range ids {
			if id == cardID {
				selected = true
			}
		}
		set, _, err := projectCards(ctx, q, a.ProjectID)
		if err != nil {
			return err
		}
		card, ok := set.get(cardID)
		if !ok || !selected {
			return notFound("card_not_found")
		}
		in.CustomText = strings.TrimSpace(in.CustomText)
		in.Why = strings.TrimSpace(in.Why)
		if in.OptionID == "" && in.CustomText != "" {
			in.OptionID = library.OptionOther
		}
		if in.OptionID == library.OptionUnsure || !card.ValidAnswer(in.OptionID) {
			return invalid(map[string]string{"optionId": "Choose a concrete decision."})
		}
		if len([]rune(in.Why)) > 1000 {
			return invalid(map[string]string{"why": "Keep the explanation under 1,000 characters."})
		}
		if in.OptionID == library.OptionOther {
			if in.CustomText == "" || len([]rune(in.CustomText)) > 2000 {
				return invalid(map[string]string{"customText": "Describe the decision in 1–2,000 characters."})
			}
		} else {
			in.CustomText = ""
		}
		if err := q.DeactivateProposals(ctx, a.ProjectID, cardID); err != nil {
			return err
		}
		p := domain.Proposal{ID: newID(), CardID: cardID, ProposedBy: a.Role, OptionID: in.OptionID, CustomText: in.CustomText, Why: in.Why, CreatedAt: now()}
		if a.Role == RoleOwner {
			p.OwnerAt = p.CreatedAt
		} else {
			p.ClientAt = p.CreatedAt
		}
		return q.InsertProposal(ctx, a.ProjectID, p)
	})
}
func (s *Service) ConfirmProposal(ctx context.Context, a Actor, id string) error {
	return s.repo.WithinTransaction(ctx, func(q Repository) error {
		if err := requireCompare(ctx, q, a); err != nil {
			return err
		}
		p, err := q.GetActiveProposal(ctx, a.ProjectID, id)
		if err != nil {
			return err
		}
		at := p.OwnerAt
		if a.Role == RoleClient {
			at = p.ClientAt
		}
		if at != "" {
			return conflict("already_confirmed")
		}
		return q.ConfirmProposal(ctx, a.ProjectID, id, a.Role, now())
	})
}
