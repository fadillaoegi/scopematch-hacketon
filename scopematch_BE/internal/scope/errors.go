// Package scope holds ScopeMatch's product rules: who sees what, when answers
// are revealed, how decisions and scope versions are confirmed.
package scope

import "fmt"

type Kind int

const (
	Invalid   Kind = iota // input failed validation (422)
	Conflict              // action not allowed in the current state (409)
	NotFound              // no such thing for this project (404)
	Forbidden             // role may not do this (403)
)

// Error is a rule violation the API reports to the user as-is.
type Error struct {
	Kind   Kind
	Code   string
	Fields map[string]string
}

func (e *Error) Error() string { return fmt.Sprintf("%s (%v)", e.Code, e.Fields) }

func invalid(fields map[string]string) error {
	return &Error{Kind: Invalid, Code: "validation", Fields: fields}
}

func conflict(code string) error { return &Error{Kind: Conflict, Code: code} }

func notFound(code string) error { return &Error{Kind: NotFound, Code: code} }

func forbidden(code string) error { return &Error{Kind: Forbidden, Code: code} }
