// Package store is the SQLite access layer. It knows tables and rows, not
// product rules; those live in package scope.
package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

var ErrNotFound = errors.New("not found")

// Q is satisfied by both *sql.DB and *sql.Tx, so every query helper works
// inside or outside a transaction.
type Q interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

type Store struct{ DB *sql.DB }

// Open opens (creating if needed) the database file and applies the schema.
func Open(path string) (*Store, error) {
	if dir := filepath.Dir(path); dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, err
		}
	}
	dsn := fmt.Sprintf("file:%s?_pragma=busy_timeout(5000)&_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)", path)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	// One connection: SQLite allows a single writer, and this keeps every
	// rule check + write inside a transaction strictly serialized.
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, fmt.Errorf("apply schema: %w", err)
	}
	return &Store{DB: db}, nil
}

func (s *Store) Close() error { return s.DB.Close() }

// Tx runs fn in a transaction, committing only if fn returns nil.
func (s *Store) Tx(ctx context.Context, fn func(q Q) error) error {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	if err := fn(tx); err != nil {
		tx.Rollback()
		return err
	}
	return tx.Commit()
}

// Now is the timestamp format stored everywhere.
func Now() string { return time.Now().UTC().Format(time.RFC3339Nano) }

type Project struct {
	ID             string
	Name           string
	FreelancerName string
	ClientName     string
	Brief          string
	LockedAt       sql.NullString
	AgreedVersion  sql.NullInt64
	CreatedAt      string
}

func InsertProject(ctx context.Context, q Q, p Project) error {
	_, err := q.ExecContext(ctx,
		`INSERT INTO projects (id, name, freelancer_name, client_name, brief, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
		p.ID, p.Name, p.FreelancerName, p.ClientName, p.Brief, p.CreatedAt)
	if err != nil {
		return err
	}
	for _, role := range []string{"owner", "client"} {
		if _, err := q.ExecContext(ctx, `INSERT INTO participants (project_id, role) VALUES (?, ?)`, p.ID, role); err != nil {
			return err
		}
	}
	return nil
}

func GetProject(ctx context.Context, q Q, id string) (Project, error) {
	var p Project
	err := q.QueryRowContext(ctx,
		`SELECT id, name, freelancer_name, client_name, brief, locked_at, agreed_version, created_at FROM projects WHERE id = ?`, id).
		Scan(&p.ID, &p.Name, &p.FreelancerName, &p.ClientName, &p.Brief, &p.LockedAt, &p.AgreedVersion, &p.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return p, ErrNotFound
	}
	return p, err
}

func InsertToken(ctx context.Context, q Q, hash, projectID, role string) error {
	_, err := q.ExecContext(ctx, `INSERT INTO access_tokens (token_hash, project_id, role) VALUES (?, ?, ?)`, hash, projectID, role)
	return err
}

// LookupToken resolves a token hash to its project and role.
func LookupToken(ctx context.Context, q Q, hash string) (projectID, role string, err error) {
	err = q.QueryRowContext(ctx, `SELECT project_id, role FROM access_tokens WHERE token_hash = ?`, hash).Scan(&projectID, &role)
	if errors.Is(err, sql.ErrNoRows) {
		return "", "", ErrNotFound
	}
	return projectID, role, err
}

func ListCards(ctx context.Context, q Q, projectID string) ([]string, error) {
	rows, err := q.QueryContext(ctx, `SELECT card_id FROM project_cards WHERE project_id = ? ORDER BY position`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func ReplaceCards(ctx context.Context, q Q, projectID string, cardIDs []string) error {
	if _, err := q.ExecContext(ctx, `DELETE FROM project_cards WHERE project_id = ?`, projectID); err != nil {
		return err
	}
	for i, id := range cardIDs {
		if _, err := q.ExecContext(ctx, `INSERT INTO project_cards (project_id, card_id, position) VALUES (?, ?, ?)`, projectID, id, i); err != nil {
			return err
		}
	}
	return nil
}
