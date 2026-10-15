package store

import (
	"context"

	"scopematch/internal/domain"
)

func Versions(ctx context.Context, q Q, pid string) ([]domain.VersionRecord, error) {
	rows, err := q.QueryContext(ctx, `SELECT version,summary_json,created_at,COALESCE(owner_confirm_name,''),COALESCE(owner_confirmed_at,''),COALESCE(client_confirm_name,''),COALESCE(client_confirmed_at,'') FROM scope_versions WHERE project_id=? ORDER BY version DESC`, pid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.VersionRecord{}
	for rows.Next() {
		var v domain.VersionRecord
		if err := rows.Scan(&v.Number, &v.SnapshotJSON, &v.CreatedAt, &v.OwnerName, &v.OwnerAt, &v.ClientName, &v.ClientAt); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}
