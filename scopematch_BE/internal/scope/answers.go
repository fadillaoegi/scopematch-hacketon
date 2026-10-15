package scope

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"strings"

	"scopematch/internal/library"
	"scopematch/internal/store"
)

// Derive the invite from the authenticated owner's secret so retries return
// the same link without ever storing a plaintext token in the database.
func (s *Service) Lock(ctx context.Context, a Actor, ownerToken string) (string, error) {
	if a.Role != RoleOwner {
		return "", forbidden("owner_only")
	}
	mac := hmac.New(sha256.New, []byte(ownerToken))
	mac.Write([]byte("scopematch/client-invite/v1"))
	token := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	err := s.st.Tx(ctx, func(q store.Q) error {
		p, err := store.GetProject(ctx, q, a.ProjectID)
		if err != nil {
			return err
		}
		if p.LockedAt.Valid {
			return nil
		}
		ids, err := store.ListCards(ctx, q, p.ID)
		if err != nil {
			return err
		}
		if len(ids) == 0 {
			return conflict("no_questions")
		}
		if err := store.InsertToken(ctx, q, HashToken(token), p.ID, RoleClient); err != nil {
			return err
		}
		_, err = q.ExecContext(ctx, `UPDATE projects SET locked_at = ? WHERE id = ?`, store.Now(), p.ID)
		return err
	})
	return token, err
}

func answerable(ctx context.Context, q store.Q, a Actor) ([]string, error) {
	p, err := store.GetProject(ctx, q, a.ProjectID)
	if err != nil {
		return nil, err
	}
	if p.AgreedVersion.Valid {
		return nil, conflict("agreed")
	}
	if !p.LockedAt.Valid {
		return nil, conflict("not_locked")
	}
	submitted, err := store.Submitted(ctx, q, p.ID, a.Role)
	if err != nil {
		return nil, err
	}
	if submitted {
		return nil, conflict("sealed")
	}
	return store.ListCards(ctx, q, p.ID)
}

func (s *Service) SaveAnswers(ctx context.Context, a Actor, answers []store.Answer) error {
	return s.st.Tx(ctx, func(q store.Q) error {
		ids, err := answerable(ctx, q, a)
		if err != nil {
			return err
		}
		selected := map[string]bool{}
		for _, id := range ids {
			selected[id] = true
		}
		seen := map[string]bool{}
		for _, answer := range answers {
			card, ok := library.Get(answer.CardID)
			if !ok || !selected[answer.CardID] || seen[answer.CardID] {
				return invalid(map[string]string{"answers": "Choose each selected question at most once."})
			}
			seen[answer.CardID] = true
			if !card.ValidAnswer(answer.OptionID) {
				return invalid(map[string]string{answer.CardID: "Choose a listed option."})
			}
			answer.CustomText = strings.TrimSpace(answer.CustomText)
			if answer.OptionID == library.OptionOther {
				if answer.CustomText == "" || len([]rune(answer.CustomText)) > 2000 {
					return invalid(map[string]string{answer.CardID: "Describe your answer in 1–2,000 characters."})
				}
			} else {
				answer.CustomText = ""
			}
			if err := store.SaveAnswer(ctx, q, a.ProjectID, a.Role, answer); err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *Service) Submit(ctx context.Context, a Actor) error {
	return s.st.Tx(ctx, func(q store.Q) error {
		ids, err := answerable(ctx, q, a)
		if err != nil {
			return err
		}
		answers, err := store.Answers(ctx, q, a.ProjectID, a.Role)
		if err != nil {
			return err
		}
		if len(answers) != len(ids) {
			return invalid(map[string]string{"answers": "Answer every question before sealing."})
		}
		_, err = q.ExecContext(ctx, `UPDATE participants SET submitted_at = ? WHERE project_id = ? AND role = ?`, store.Now(), a.ProjectID, a.Role)
		if err != nil {
			return err
		}
		otherRole := RoleClient
		if a.Role == RoleClient {
			otherRole = RoleOwner
		}
		otherSubmitted, err := store.Submitted(ctx, q, a.ProjectID, otherRole)
		if err != nil {
			return err
		}
		if otherSubmitted {
			return seedSameAnswers(ctx, q, a.ProjectID)
		}
		return nil
	})
}
