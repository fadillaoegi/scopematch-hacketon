package api

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"testing"

	"scopematch/internal/library"
	"scopematch/internal/scope"
)

// fakeSuggester stands in for the Gemini adapter.
type fakeSuggester struct {
	cards []library.Card
	err   error
	brief string
}

func (f *fakeSuggester) SuggestQuestions(_ context.Context, brief string, _ []string) ([]library.Card, error) {
	f.brief = brief
	return f.cards, f.err
}

func option(label string) library.Option {
	return library.Option{Label: label, Included: []string{label + " included"}, Excluded: []string{}, ClientResponsibilities: []string{}, AcceptanceCriteria: []string{label + " works"}}
}

var goodDraft = library.Card{Title: "Allergens", Question: "How should allergen information appear on the menu?", Options: []library.Option{option("Icons on every dish"), option("A separate allergen page"), option("Ask staff in person")}}

func TestSuggestionsUnavailableWithoutKey(t *testing.T) {
	c := newClient(t)
	owner := c.createSalon()
	if s := c.expect("GET", "/api/session", owner, nil, 200); s["aiSuggestions"] != nil {
		t.Fatalf("aiSuggestions advertised without a suggester: %v", s["aiSuggestions"])
	}
	c.expect("POST", "/api/project/suggestions", owner, nil, http.StatusServiceUnavailable)
}

func TestSuggestionsAreValidatedDraftsForTheOwnerOnly(t *testing.T) {
	bad := library.Card{Title: "Broken", Question: "Only two options?", Options: []library.Option{option("A"), option("B")}}
	f := &fakeSuggester{cards: []library.Card{goodDraft, bad}}
	c := newClient(t, scope.WithSuggester(f))
	owner := c.createSalon()
	if s := c.expect("GET", "/api/session", owner, nil, 200); s["aiSuggestions"] != true {
		t.Fatal("owner should see aiSuggestions")
	}
	out := c.expect("POST", "/api/project/suggestions", owner, nil, 200)
	drafts := out["suggestions"].([]any)
	if len(drafts) != 1 {
		t.Fatalf("malformed draft not dropped: %v", drafts)
	}
	d := drafts[0].(map[string]any)
	ids := []string{}
	for _, o := range d["options"].([]any) {
		ids = append(ids, o.(map[string]any)["id"].(string))
	}
	if strings.Join(ids, ",") != "a,b,c" || !strings.HasPrefix(d["id"].(string), "draft-") {
		t.Fatalf("draft not normalized: %v", d)
	}
	if !strings.Contains(f.brief, "salon") {
		t.Fatal("brief not passed to suggester")
	}
	// Drafts are not stored.
	if s := c.expect("GET", "/api/session", owner, nil, 200); len(s["customCards"].([]any)) != 0 {
		t.Fatal("suggestions must not be stored")
	}
	invite := c.lock(owner)
	if s := c.expect("GET", "/api/session", invite, nil, 200); s["aiSuggestions"] != nil {
		t.Fatal("client must never see aiSuggestions")
	}
	c.expect("POST", "/api/project/suggestions", invite, nil, http.StatusForbidden)
	c.expect("POST", "/api/project/suggestions", owner, nil, http.StatusConflict)
}

func TestSuggesterFailureAndLimit(t *testing.T) {
	f := &fakeSuggester{err: errors.New("quota")}
	c := newClient(t, scope.WithSuggester(f))
	owner := c.createSalon()
	status, out, raw := c.do("POST", "/api/project/suggestions", owner, nil)
	if status != http.StatusBadGateway || out["error"] != "ai_failed" || strings.Contains(string(raw), "quota") {
		t.Fatalf("provider error leaked or wrong code: %d %s", status, raw)
	}
	for i := 0; i < 4; i++ {
		c.expect("POST", "/api/project/suggestions", owner, nil, http.StatusBadGateway)
	}
	c.expect("POST", "/api/project/suggestions", owner, nil, http.StatusTooManyRequests)
}

func TestAcceptedAICardWorksThroughTheWholeFlow(t *testing.T) {
	c := newClient(t, scope.WithSuggester(&fakeSuggester{}))
	owner := c.createSalon()
	c.expect("POST", "/api/project/custom-cards", owner, map[string]any{"card": map[string]any{"title": "", "question": "x", "options": []any{}}}, http.StatusUnprocessableEntity)
	s := c.expect("POST", "/api/project/custom-cards", owner, map[string]any{"card": goodDraft}, 200)
	custom := s["customCards"].([]any)
	if len(custom) != 1 {
		t.Fatalf("custom card not stored: %v", s)
	}
	card := custom[0].(map[string]any)
	id := card["id"].(string)
	if !strings.HasPrefix(id, "ai-") || card["source"] != "ai" || card["number"] != float64(len(library.All())+1) {
		t.Fatalf("custom card fields: %v", card)
	}
	if ids := cardIDs(s); ids[len(ids)-1] != id {
		t.Fatalf("custom card not selected: %v", ids)
	}
	// Another project cannot select this project's custom card.
	other := c.createSalon()
	c.expect("PUT", "/api/project/cards", other, map[string]any{"cardIds": []string{id}}, http.StatusUnprocessableEntity)

	c.expect("PUT", "/api/project/cards", owner, map[string]any{"cardIds": []string{id}}, 200)
	invite := c.lock(owner)
	c.expect("POST", "/api/project/custom-cards", owner, map[string]any{"card": goodDraft}, http.StatusConflict)
	if s := c.expect("GET", "/api/session", invite, nil, 200); len(s["customCards"].([]any)) != 1 {
		t.Fatal("client must see the project's custom card to answer it")
	}
	c.expect("PUT", "/api/answers", owner, answerBody(id, "a", ""), 200)
	c.expect("PUT", "/api/answers", invite, answerBody(id, "b", ""), 200)
	c.expect("PUT", "/api/answers", invite, answerBody(id, "d", ""), http.StatusUnprocessableEntity)
	c.expect("POST", "/api/answers/submit", owner, nil, 200)
	s = c.expect("POST", "/api/answers/submit", invite, nil, 200)
	if s["compare"].([]any)[0].(map[string]any)["status"] != "needs_discussion" {
		t.Fatal("custom card compare status")
	}
	p := proposal(c.expect("POST", "/api/cards/"+id+"/proposals", owner, map[string]string{"optionId": "b"}, 200))
	c.expect("POST", "/api/proposals/"+p["id"].(string)+"/confirm", invite, nil, 200)
	draft := c.expect("GET", "/api/scope/draft", owner, nil, 200)
	c.expect("POST", "/api/scope/versions", owner, map[string]any{"summary": draft["summary"]}, http.StatusCreated)
	c.expect("POST", "/api/scope/versions/1/confirm", owner, map[string]string{"name": "Dimas"}, 200)
	c.expect("POST", "/api/scope/versions/1/confirm", invite, map[string]string{"name": "Maya"}, 200)
	_, _, md := c.do("GET", "/api/scope/export.md", owner, nil)
	if !strings.Contains(string(md), "Allergens") || !strings.Contains(string(md), "A separate allergen page included") {
		t.Fatalf("export missing custom card text:\n%s", md)
	}
}
