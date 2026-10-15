package store

import (
	"context"
	"errors"

	"scopematch/internal/domain"
	"scopematch/internal/scope"
)

// repository adapts the application's persistence port to SQLite. Its q is
// either the database or the current transaction; the use cases never see it.
type repository struct {
	st            *Store
	q             Q
	transactional bool
}

var _ scope.Repository = (*repository)(nil)

func NewRepository(st *Store) scope.Repository { return &repository{st: st, q: st.DB} }
func (r *repository) WithinTransaction(ctx context.Context, fn func(scope.Repository) error) error {
	if r.transactional {
		return errors.New("nested repository transaction")
	}
	return r.st.Tx(ctx, func(q Q) error { return fn(&repository{st: r.st, q: q, transactional: true}) })
}
func (r *repository) LookupToken(ctx context.Context, hash string) (string, string, error) {
	return LookupToken(ctx, r.q, hash)
}
func (r *repository) InsertProject(ctx context.Context, p domain.Project) error {
	return InsertProject(ctx, r.q, p)
}
func (r *repository) GetProject(ctx context.Context, id string) (domain.Project, error) {
	return GetProject(ctx, r.q, id)
}
func (r *repository) InsertToken(ctx context.Context, hash, pid, role string) error {
	return InsertToken(ctx, r.q, hash, pid, role)
}
func (r *repository) ListCards(ctx context.Context, pid string) ([]string, error) {
	return ListCards(ctx, r.q, pid)
}
func (r *repository) ReplaceCards(ctx context.Context, pid string, ids []string) error {
	return ReplaceCards(ctx, r.q, pid, ids)
}
func (r *repository) Answers(ctx context.Context, pid, role string) ([]domain.Answer, error) {
	return Answers(ctx, r.q, pid, role)
}
func (r *repository) Submitted(ctx context.Context, pid, role string) (bool, error) {
	return Submitted(ctx, r.q, pid, role)
}
func (r *repository) SaveAnswer(ctx context.Context, pid, role string, a domain.Answer) error {
	return SaveAnswer(ctx, r.q, pid, role, a)
}
func (r *repository) ActiveProposals(ctx context.Context, pid string) ([]domain.Proposal, error) {
	return ActiveProposals(ctx, r.q, pid)
}
func (r *repository) GetActiveProposal(ctx context.Context, pid, id string) (domain.Proposal, error) {
	return GetActiveProposal(ctx, r.q, pid, id)
}
func (r *repository) InsertProposal(ctx context.Context, pid string, p domain.Proposal) error {
	return InsertProposal(ctx, r.q, pid, p)
}
func (r *repository) Versions(ctx context.Context, pid string) ([]domain.VersionRecord, error) {
	return Versions(ctx, r.q, pid)
}
func (r *repository) LockProject(ctx context.Context, pid, at string) error {
	_, err := r.q.ExecContext(ctx, `UPDATE projects SET locked_at=? WHERE id=?`, at, pid)
	return err
}
func (r *repository) SealAnswers(ctx context.Context, pid, role, at string) error {
	_, err := r.q.ExecContext(ctx, `UPDATE participants SET submitted_at=? WHERE project_id=? AND role=?`, at, pid, role)
	return err
}
func (r *repository) DeactivateProposals(ctx context.Context, pid, card string) error {
	_, err := r.q.ExecContext(ctx, `UPDATE proposals SET active=0 WHERE project_id=? AND card_id=? AND active=1`, pid, card)
	return err
}
func confirmationColumns(role string) (at, name string, err error) {
	switch role {
	case scope.RoleOwner:
		return "confirmed_by_owner_at", "owner_confirm_name", nil
	case scope.RoleClient:
		return "confirmed_by_client_at", "client_confirm_name", nil
	default:
		return "", "", errors.New("invalid participant role")
	}
}
func (r *repository) ConfirmProposal(ctx context.Context, pid, id, role, at string) error {
	column, _, err := confirmationColumns(role)
	if err != nil {
		return err
	}
	_, err = r.q.ExecContext(ctx, `UPDATE proposals SET `+column+`=? WHERE id=? AND project_id=? AND active=1`, at, id, pid)
	return err
}
func (r *repository) NextVersion(ctx context.Context, pid string) (int, error) {
	var n int
	err := r.q.QueryRowContext(ctx, `SELECT COALESCE(MAX(version),0)+1 FROM scope_versions WHERE project_id=?`, pid).Scan(&n)
	return n, err
}
func (r *repository) InsertVersion(ctx context.Context, pid string, v domain.VersionRecord) error {
	_, err := r.q.ExecContext(ctx, `INSERT INTO scope_versions(project_id,version,summary_json,created_at) VALUES (?,?,?,?)`, pid, v.Number, v.SnapshotJSON, v.CreatedAt)
	return err
}
func (r *repository) ConfirmVersion(ctx context.Context, pid string, n int, role, name, at string) error {
	_, nameColumn, err := confirmationColumns(role)
	if err != nil {
		return err
	}
	atColumn := "owner_confirmed_at"
	if role == scope.RoleClient {
		atColumn = "client_confirmed_at"
	}
	_, err = r.q.ExecContext(ctx, `UPDATE scope_versions SET `+atColumn+`=?,`+nameColumn+`=? WHERE project_id=? AND version=?`, at, name, pid, n)
	return err
}
func (r *repository) MarkAgreed(ctx context.Context, pid string, n int) error {
	_, err := r.q.ExecContext(ctx, `UPDATE projects SET agreed_version=? WHERE id=?`, n, pid)
	return err
}
