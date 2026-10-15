package scope

import (
	"scopematch/internal/library"
	"scopematch/internal/store"
)

const (
	StatusSame          = "same_answer"
	StatusDiscussion    = "needs_discussion"
	StatusClarification = "needs_clarification"
)

type Comparison struct {
	CardID string `json:"cardId"`
	Status string `json:"status"`
}

type Counts struct {
	Total         int `json:"total"`
	Decided       int `json:"decided"`
	Same          int `json:"same"`
	Discussion    int `json:"discussion"`
	Clarification int `json:"clarification"`
}

func compareAnswers(ids []string, mine, theirs []store.Answer) ([]Comparison, *Counts) {
	byMe, byOther := map[string]string{}, map[string]string{}
	for _, a := range mine {
		byMe[a.CardID] = a.OptionID
	}
	for _, a := range theirs {
		byOther[a.CardID] = a.OptionID
	}
	counts := &Counts{Total: len(ids)}
	out := make([]Comparison, 0, len(ids))
	unclear := func(id string) bool { return id == "" || id == library.OptionOther || id == library.OptionUnsure }
	for _, id := range ids {
		a, b := byMe[id], byOther[id]
		status := StatusDiscussion
		if unclear(a) || unclear(b) {
			status = StatusClarification
			counts.Clarification++
		} else if a == b {
			status = StatusSame
			counts.Same++
		} else {
			counts.Discussion++
		}
		out = append(out, Comparison{CardID: id, Status: status})
	}
	return out, counts
}
