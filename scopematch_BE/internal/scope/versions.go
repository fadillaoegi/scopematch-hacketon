package scope

import (
	"context"
	"encoding/json"
	"strings"

	"scopematch/internal/domain"
	"scopematch/internal/library"
)

type Summary struct {
	Included               []string `json:"included"`
	Excluded               []string `json:"excluded"`
	ClientResponsibilities []string `json:"clientResponsibilities"`
	AcceptanceCriteria     []string `json:"acceptanceCriteria"`
	OpenQuestions          []string `json:"openQuestions"`
}
type Decision struct {
	CardID     string `json:"cardId"`
	Number     int    `json:"number"`
	Title      string `json:"title"`
	Label      string `json:"label"`
	ProposalID string `json:"proposalId"`
}
type Snapshot struct {
	Summary   Summary    `json:"summary"`
	Decisions []Decision `json:"decisions"`
}
type Confirmation struct {
	Name string `json:"name"`
	At   string `json:"at"`
}
type ScopeVersion struct {
	Version int `json:"version"`
	Snapshot
	CreatedAt          string        `json:"createdAt"`
	OwnerConfirmation  *Confirmation `json:"ownerConfirmation,omitempty"`
	ClientConfirmation *Confirmation `json:"clientConfirmation,omitempty"`
}
type ScopeState struct {
	LatestVersion     int    `json:"latestVersion"`
	AgreedVersion     int    `json:"agreedVersion"`
	Current           bool   `json:"current"`
	OwnerConfirmedAt  string `json:"ownerConfirmedAt,omitempty"`
	ClientConfirmedAt string `json:"clientConfirmedAt,omitempty"`
}
type ScopeView struct {
	ScopeState
	Versions []ScopeVersion `json:"versions"`
}

func decidedSnapshot(ctx context.Context, q Repository, pid string) (Snapshot, error) {
	ids, err := q.ListCards(ctx, pid)
	if err != nil {
		return Snapshot{}, err
	}
	proposals, err := q.ActiveProposals(ctx, pid)
	if err != nil {
		return Snapshot{}, err
	}
	byCard := map[string]domain.Proposal{}
	for _, p := range proposals {
		byCard[p.CardID] = p
	}
	v := Snapshot{Summary: Summary{Included: []string{}, Excluded: []string{}, ClientResponsibilities: []string{}, AcceptanceCriteria: []string{}, OpenQuestions: []string{}}, Decisions: []Decision{}}
	if len(ids) == 0 {
		return v, conflict("undecided")
	}
	set, _, err := projectCards(ctx, q, pid)
	if err != nil {
		return v, err
	}
	for _, id := range ids {
		p, ok := byCard[id]
		if !ok || !p.Decided() {
			return v, conflict("undecided")
		}
		card, ok := set.get(id)
		if !ok {
			return v, notFound("card_not_found")
		}
		label := p.CustomText
		if p.OptionID == library.OptionOther {
			v.Summary.Included = append(v.Summary.Included, p.CustomText)
		} else {
			option, ok := card.Option(p.OptionID)
			if !ok {
				return v, conflict("undecided")
			}
			label = option.Label
			v.Summary.Included = append(v.Summary.Included, option.Included...)
			v.Summary.Excluded = append(v.Summary.Excluded, option.Excluded...)
			v.Summary.ClientResponsibilities = append(v.Summary.ClientResponsibilities, option.ClientResponsibilities...)
			v.Summary.AcceptanceCriteria = append(v.Summary.AcceptanceCriteria, option.AcceptanceCriteria...)
		}
		v.Decisions = append(v.Decisions, Decision{CardID: id, Number: card.Number, Title: card.Title, Label: label, ProposalID: p.ID})
	}
	normalizeSummary(&v.Summary)
	return v, nil
}
func normalizeSummary(s *Summary) {
	for _, list := range []*[]string{&s.Included, &s.Excluded, &s.ClientResponsibilities, &s.AcceptanceCriteria, &s.OpenQuestions} {
		out := []string{}
		seen := map[string]bool{}
		for _, line := range *list {
			line = strings.TrimSpace(line)
			if line != "" && !seen[line] {
				out = append(out, line)
				seen[line] = true
			}
		}
		*list = out
	}
}
func sameDecisions(a, b []Decision) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i].CardID != b[i].CardID || a[i].ProposalID != b[i].ProposalID {
			return false
		}
	}
	return true
}
func scopeView(ctx context.Context, q Repository, p domain.Project) (ScopeView, error) {
	rows, err := q.Versions(ctx, p.ID)
	if err != nil {
		return ScopeView{}, err
	}
	out := ScopeView{Versions: []ScopeVersion{}}
	if p.AgreedVersion > 0 {
		out.AgreedVersion = p.AgreedVersion
	}
	for _, row := range rows {
		v := ScopeVersion{Version: row.Number, CreatedAt: row.CreatedAt}
		if err := json.Unmarshal([]byte(row.SnapshotJSON), &v.Snapshot); err != nil {
			return out, err
		}
		if row.OwnerAt != "" {
			v.OwnerConfirmation = &Confirmation{Name: row.OwnerName, At: row.OwnerAt}
		}
		if row.ClientAt != "" {
			v.ClientConfirmation = &Confirmation{Name: row.ClientName, At: row.ClientAt}
		}
		out.Versions = append(out.Versions, v)
	}
	if len(out.Versions) > 0 {
		out.LatestVersion = out.Versions[0].Version
		if c := out.Versions[0].OwnerConfirmation; c != nil {
			out.OwnerConfirmedAt = c.At
		}
		if c := out.Versions[0].ClientConfirmation; c != nil {
			out.ClientConfirmedAt = c.At
		}
		current, err := decidedSnapshot(ctx, q, p.ID)
		if err != nil {
			if e, ok := err.(*Error); !ok || e.Kind != Conflict {
				return out, err
			}
		} else {
			out.Current = sameDecisions(out.Versions[0].Decisions, current.Decisions)
		}
	}
	return out, nil
}
func (s *Service) Scope(ctx context.Context, a Actor) (ScopeView, error) {
	var out ScopeView
	err := s.repo.WithinTransaction(ctx, func(q Repository) error {
		p, err := q.GetProject(ctx, a.ProjectID)
		if err != nil {
			return err
		}
		out, err = scopeView(ctx, q, p)
		return err
	})
	return out, err
}
func (s *Service) Draft(ctx context.Context, a Actor) (Summary, error) {
	if a.Role != RoleOwner {
		return Summary{}, forbidden("owner_only")
	}
	var v Snapshot
	err := s.repo.WithinTransaction(ctx, func(q Repository) error {
		if err := requireCompare(ctx, q, a); err != nil {
			return err
		}
		var err error
		v, err = decidedSnapshot(ctx, q, a.ProjectID)
		return err
	})
	return v.Summary, err
}
func (s *Service) SaveVersion(ctx context.Context, a Actor, summary Summary) (int, error) {
	if a.Role != RoleOwner {
		return 0, forbidden("owner_only")
	}
	normalizeSummary(&summary)
	for _, list := range [][]string{summary.Included, summary.Excluded, summary.ClientResponsibilities, summary.AcceptanceCriteria, summary.OpenQuestions} {
		if len(list) > 100 {
			return 0, invalid(map[string]string{"summary": "Use at most 100 items in each section."})
		}
		for _, line := range list {
			if len([]rune(line)) > 2000 {
				return 0, invalid(map[string]string{"summary": "Keep each item under 2,000 characters."})
			}
		}
	}
	version := 0
	err := s.repo.WithinTransaction(ctx, func(q Repository) error {
		if err := requireCompare(ctx, q, a); err != nil {
			return err
		}
		snapshot, err := decidedSnapshot(ctx, q, a.ProjectID)
		if err != nil {
			return err
		}
		snapshot.Summary = summary
		data, err := json.Marshal(snapshot)
		if err != nil {
			return err
		}
		version, err = q.NextVersion(ctx, a.ProjectID)
		if err != nil {
			return err
		}
		return q.InsertVersion(ctx, a.ProjectID, domain.VersionRecord{Number: version, SnapshotJSON: string(data), CreatedAt: now()})
	})
	return version, err
}
func (s *Service) ConfirmVersion(ctx context.Context, a Actor, n int, name string) (bool, error) {
	name = strings.TrimSpace(name)
	if name == "" || len([]rune(name)) > 120 {
		return false, invalid(map[string]string{"name": "Enter your name in 1–120 characters."})
	}
	agreed := false
	err := s.repo.WithinTransaction(ctx, func(q Repository) error {
		if err := requireCompare(ctx, q, a); err != nil {
			return err
		}
		p, err := q.GetProject(ctx, a.ProjectID)
		if err != nil {
			return err
		}
		v, err := scopeView(ctx, q, p)
		if err != nil {
			return err
		}
		if n <= 0 || n != v.LatestVersion {
			return conflict("not_latest")
		}
		if !v.Current {
			return conflict("decisions_changed")
		}
		latest := v.Versions[0]
		if (a.Role == RoleOwner && latest.OwnerConfirmation != nil) || (a.Role == RoleClient && latest.ClientConfirmation != nil) {
			return conflict("already_confirmed")
		}
		if err := q.ConfirmVersion(ctx, a.ProjectID, n, a.Role, name, now()); err != nil {
			return err
		}
		agreed = (a.Role == RoleOwner && latest.ClientConfirmation != nil) || (a.Role == RoleClient && latest.OwnerConfirmation != nil)
		if agreed {
			err = q.MarkAgreed(ctx, a.ProjectID, n)
		}
		return err
	})
	return agreed, err
}
