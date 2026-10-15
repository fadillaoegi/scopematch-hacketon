package scope

import (
	"context"
	"time"

	"scopematch/internal/domain"
)

// Repository is the application-owned persistence port. Its methods describe
// operations needed by use cases, never SQL or a database driver's API.
// WithinTransaction passes a repository scoped to one atomic unit of work;
// every rule read and its resulting writes must use that same instance.
type Repository interface {
	WithinTransaction(context.Context, func(Repository) error) error
	LookupToken(context.Context, string) (projectID, role string, err error)
	InsertProject(context.Context, domain.Project) error
	GetProject(context.Context, string) (domain.Project, error)
	InsertToken(context.Context, string, string, string) error
	ListCards(context.Context, string) ([]string, error)
	ReplaceCards(context.Context, string, []string) error
	LockProject(context.Context, string, string) error
	Answers(context.Context, string, string) ([]domain.Answer, error)
	Submitted(context.Context, string, string) (bool, error)
	SaveAnswer(context.Context, string, string, domain.Answer) error
	SealAnswers(context.Context, string, string, string) error
	ActiveProposals(context.Context, string) ([]domain.Proposal, error)
	GetActiveProposal(context.Context, string, string) (domain.Proposal, error)
	InsertProposal(context.Context, string, domain.Proposal) error
	DeactivateProposals(context.Context, string, string) error
	ConfirmProposal(context.Context, string, string, string, string) error
	Versions(context.Context, string) ([]domain.VersionRecord, error)
	NextVersion(context.Context, string) (int, error)
	InsertVersion(context.Context, string, domain.VersionRecord) error
	ConfirmVersion(context.Context, string, int, string, string, string) error
	MarkAgreed(context.Context, string, int) error
}

func now() string { return time.Now().UTC().Format(time.RFC3339Nano) }
