package store

import (
	"context"
	"database/sql"
	"errors"
)

type Proposal struct {
	ID         string `json:"id"`
	CardID     string `json:"cardId"`
	ProposedBy string `json:"proposedBy"`
	OptionID   string `json:"optionId"`
	CustomText string `json:"customText,omitempty"`
	Why        string `json:"why,omitempty"`
	OwnerAt    string `json:"ownerConfirmedAt,omitempty"`
	ClientAt   string `json:"clientConfirmedAt,omitempty"`
	CreatedAt  string `json:"createdAt"`
}

func (p Proposal) Decided() bool { return p.OwnerAt != "" && p.ClientAt != "" }

const proposalColumns = `id, card_id, proposed_by, COALESCE(option_id,''), COALESCE(custom_text,''), COALESCE(why,''), COALESCE(confirmed_by_owner_at,''), COALESCE(confirmed_by_client_at,''), created_at`

func scanProposal(row interface{ Scan(...any) error }) (p Proposal, err error) {
	err = row.Scan(&p.ID, &p.CardID, &p.ProposedBy, &p.OptionID, &p.CustomText, &p.Why, &p.OwnerAt, &p.ClientAt, &p.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		err = ErrNotFound
	}
	return
}
func ActiveProposals(ctx context.Context, q Q, pid string) ([]Proposal, error) {
	rows, err := q.QueryContext(ctx, `SELECT `+proposalColumns+` FROM proposals WHERE project_id=? AND active=1 ORDER BY created_at,id`, pid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Proposal{}
	for rows.Next() {
		p, err := scanProposal(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}
func GetActiveProposal(ctx context.Context, q Q, pid, id string) (Proposal, error) {
	return scanProposal(q.QueryRowContext(ctx, `SELECT `+proposalColumns+` FROM proposals WHERE project_id=? AND id=? AND active=1`, pid, id))
}
func InsertProposal(ctx context.Context, q Q, pid string, p Proposal) error {
	_, err := q.ExecContext(ctx, `INSERT INTO proposals (id,project_id,card_id,proposed_by,option_id,custom_text,why,active,confirmed_by_owner_at,confirmed_by_client_at,created_at) VALUES (?,?,?,?,?,?,?,1,NULLIF(?,''),NULLIF(?,''),?)`, p.ID, pid, p.CardID, p.ProposedBy, p.OptionID, p.CustomText, p.Why, p.OwnerAt, p.ClientAt, p.CreatedAt)
	return err
}
