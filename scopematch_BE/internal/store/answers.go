package store

import "context"

type Answer struct {
	CardID     string `json:"cardId"`
	OptionID   string `json:"optionId"`
	CustomText string `json:"customText,omitempty"`
}

func Answers(ctx context.Context, q Q, projectID, role string) ([]Answer, error) {
	rows, err := q.QueryContext(ctx, `SELECT card_id, option_id, COALESCE(custom_text, '') FROM answers WHERE project_id = ? AND role = ? ORDER BY card_id`, projectID, role)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Answer{}
	for rows.Next() {
		var a Answer
		if err := rows.Scan(&a.CardID, &a.OptionID, &a.CustomText); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func Submitted(ctx context.Context, q Q, projectID, role string) (bool, error) {
	var submitted bool
	err := q.QueryRowContext(ctx, `SELECT submitted_at IS NOT NULL FROM participants WHERE project_id = ? AND role = ?`, projectID, role).Scan(&submitted)
	return submitted, err
}

func SaveAnswer(ctx context.Context, q Q, projectID, role string, a Answer) error {
	_, err := q.ExecContext(ctx, `INSERT INTO answers (project_id, role, card_id, option_id, custom_text, updated_at)
		VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (project_id, role, card_id)
		DO UPDATE SET option_id = excluded.option_id, custom_text = excluded.custom_text, updated_at = excluded.updated_at`,
		projectID, role, a.CardID, a.OptionID, a.CustomText, Now())
	return err
}
