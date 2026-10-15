package scope

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"scopematch/internal/domain"
)

func (s *Service) Export(ctx context.Context, a Actor) (content, filename string, err error) {
	err = s.repo.WithinTransaction(ctx, func(q Repository) error {
		p, e := q.GetProject(ctx, a.ProjectID)
		if e != nil {
			return e
		}
		if p.AgreedVersion <= 0 {
			return notFound("not_agreed")
		}
		rows, e := q.Versions(ctx, p.ID)
		if e != nil {
			return e
		}
		var saved *ScopeVersion
		for _, row := range rows {
			if row.Number != p.AgreedVersion {
				continue
			}
			v := ScopeVersion{Version: row.Number, CreatedAt: row.CreatedAt}
			if e := json.Unmarshal([]byte(row.SnapshotJSON), &v.Snapshot); e != nil {
				return e
			}
			v.OwnerConfirmation = &Confirmation{Name: row.OwnerName, At: row.OwnerAt}
			v.ClientConfirmation = &Confirmation{Name: row.ClientName, At: row.ClientAt}
			saved = &v
			break
		}
		if saved == nil {
			return domain.ErrNotFound
		}
		content = renderMarkdown(p, *saved)
		var slug strings.Builder
		for _, r := range strings.ToLower(p.Name) {
			if r >= 'a' && r <= 'z' || r >= '0' && r <= '9' {
				slug.WriteRune(r)
			} else if slug.Len() > 0 && !strings.HasSuffix(slug.String(), "-") {
				slug.WriteByte('-')
			}
		}
		name := strings.Trim(slug.String(), "-")
		if name == "" {
			name = "scope"
		}
		filename = fmt.Sprintf("scopematch-%s-v%d.md", name, saved.Version)
		return nil
	})
	return
}
func renderMarkdown(p domain.Project, v ScopeVersion) string {
	var b strings.Builder
	fmt.Fprintf(&b, "# %s\n\nAGREED · v%d\n\nFreelancer: %s\nClient: %s\n\n## Original brief\n\n%s\n\n## Decisions\n\n", p.Name, v.Version, p.FreelancerName, p.ClientName, p.Brief)
	for _, d := range v.Decisions {
		fmt.Fprintf(&b, "- § %d %s: %s\n", d.Number, d.Title, d.Label)
	}
	for _, section := range []struct {
		title string
		items []string
	}{
		{"Included", v.Summary.Included}, {"Excluded", v.Summary.Excluded}, {"Client responsibilities", v.Summary.ClientResponsibilities}, {"Acceptance criteria", v.Summary.AcceptanceCriteria}, {"Open questions", v.Summary.OpenQuestions},
	} {
		fmt.Fprintf(&b, "\n## %s\n\n", section.title)
		if len(section.items) == 0 {
			b.WriteString("None recorded.\n")
		} else {
			for _, line := range section.items {
				fmt.Fprintf(&b, "- %s\n", line)
			}
		}
	}
	b.WriteString("\n## Confirmation records\n\nRecorded, not identity-verified.\n\n")
	if v.OwnerConfirmation != nil {
		fmt.Fprintf(&b, "- Freelancer: %s · %s\n", v.OwnerConfirmation.Name, v.OwnerConfirmation.At)
	}
	if v.ClientConfirmation != nil {
		fmt.Fprintf(&b, "- Client: %s · %s\n", v.ClientConfirmation.Name, v.ClientConfirmation.At)
	}
	return b.String()
}
