package store

import (
	"context"

	"scopematch/internal/domain"
)

func CustomCards(ctx context.Context, q Q, pid string) ([]domain.CustomCardRecord, error) {
	rows, err := q.QueryContext(ctx, `SELECT card_id, card_json, created_at FROM project_custom_cards WHERE project_id=? ORDER BY created_at, card_id`, pid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.CustomCardRecord{}
	for rows.Next() {
		var r domain.CustomCardRecord
		if err := rows.Scan(&r.CardID, &r.CardJSON, &r.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func InsertCustomCard(ctx context.Context, q Q, pid string, r domain.CustomCardRecord) error {
	_, err := q.ExecContext(ctx, `INSERT INTO project_custom_cards (project_id, card_id, card_json, created_at) VALUES (?,?,?,?)`, pid, r.CardID, r.CardJSON, r.CreatedAt)
	return err
}
