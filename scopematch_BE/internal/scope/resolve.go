package scope

import (
	"context"
	"scopematch/internal/library"
	"scopematch/internal/store"
	"strings"
)

type ProposalInput struct {
	OptionID   string `json:"optionId"`
	CustomText string `json:"customText"`
	Why        string `json:"why"`
}

func requireCompare(ctx context.Context, q store.Q, a Actor) error {
	p, err := store.GetProject(ctx, q, a.ProjectID)
	if err != nil {
		return err
	}
	if p.AgreedVersion.Valid {
		return conflict("agreed")
	}
	for _, role := range []string{RoleOwner, RoleClient} {
		yes, err := store.Submitted(ctx, q, p.ID, role)
		if err != nil {
			return err
		}
		if !yes {
			return conflict("not_revealed")
		}
	}
	return nil
}
func seedSameAnswers(ctx context.Context, q store.Q, pid string) error {
	mine, err := store.Answers(ctx, q, pid, RoleOwner)
	if err != nil {
		return err
	}
	theirs, err := store.Answers(ctx, q, pid, RoleClient)
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
		if err := store.InsertProposal(ctx, q, pid, store.Proposal{ID: newID(), CardID: a.CardID, ProposedBy: "system", OptionID: a.OptionID, CreatedAt: store.Now()}); err != nil {
			return err
		}
	}
	return nil
}
func (s *Service) Propose(ctx context.Context, a Actor, cardID string, in ProposalInput) error {
	return s.st.Tx(ctx, func(q store.Q) error {
		if err := requireCompare(ctx, q, a); err != nil {
			return err
		}
		ids, err := store.ListCards(ctx, q, a.ProjectID)
		if err != nil {
			return err
		}
		selected := false
		for _, id := range ids {
			if id == cardID {
				selected = true
			}
		}
		card, ok := library.Get(cardID)
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
		if _, err := q.ExecContext(ctx, `UPDATE proposals SET active=0 WHERE project_id=? AND card_id=? AND active=1`, a.ProjectID, cardID); err != nil {
			return err
		}
		p := store.Proposal{ID: newID(), CardID: cardID, ProposedBy: a.Role, OptionID: in.OptionID, CustomText: in.CustomText, Why: in.Why, CreatedAt: store.Now()}
		if a.Role == RoleOwner {
			p.OwnerAt = p.CreatedAt
		} else {
			p.ClientAt = p.CreatedAt
		}
		return store.InsertProposal(ctx, q, a.ProjectID, p)
	})
}
func (s *Service) ConfirmProposal(ctx context.Context, a Actor, id string) error {
	return s.st.Tx(ctx, func(q store.Q) error {
		if err := requireCompare(ctx, q, a); err != nil {
			return err
		}
		p, err := store.GetActiveProposal(ctx, q, a.ProjectID, id)
		if err != nil {
			return err
		}
		column := "confirmed_by_owner_at"
		at := p.OwnerAt
		if a.Role == RoleClient {
			column = "confirmed_by_client_at"
			at = p.ClientAt
		}
		if at != "" {
			return conflict("already_confirmed")
		}
		_, err = q.ExecContext(ctx, `UPDATE proposals SET `+column+`=? WHERE id=? AND project_id=? AND active=1`, store.Now(), id, a.ProjectID)
		return err
	})
}
