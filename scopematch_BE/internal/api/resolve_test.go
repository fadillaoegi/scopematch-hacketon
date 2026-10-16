package api

import "testing"

func (c *client) revealed(a, b string) (string, string) {
	c.t.Helper()
	owner := c.createSalon()
	c.expect("PUT", "/api/project/cards", owner, map[string]any{"cardIds": []string{"booking"}}, 200)
	invite := c.lock(owner)
	c.expect("PUT", "/api/answers", owner, answerBody("booking", a, "custom"), 200)
	c.expect("PUT", "/api/answers", invite, answerBody("booking", b, "custom"), 200)
	c.expect("POST", "/api/answers/submit", owner, nil, 200)
	c.expect("POST", "/api/answers/submit", invite, nil, 200)
	return owner, invite
}
func proposal(s map[string]any) map[string]any {
	return s["compare"].([]any)[0].(map[string]any)["proposal"].(map[string]any)
}
func TestProposalReplaceAndConfirm(t *testing.T) {
	c := newClient(t)
	owner, invite := c.revealed("a", "c")
	c.expect("POST", "/api/cards/booking/proposals", owner, map[string]string{"optionId": "unsure"}, 422)
	c.expect("POST", "/api/cards/booking/proposals", invite, map[string]string{"optionId": "other", "customText": " "}, 422)
	c.expect("POST", "/api/cards/editable/proposals", owner, map[string]string{"optionId": "a"}, 404)
	s := c.expect("POST", "/api/cards/booking/proposals", owner, map[string]string{"optionId": "b", "why": "Staff can review requests"}, 200)
	old := proposal(s)
	oldID := old["id"].(string)
	if old["ownerConfirmedAt"] == nil || old["clientConfirmedAt"] != nil {
		t.Fatal("proposer confirmation wrong")
	}
	c.expect("POST", "/api/proposals/"+oldID+"/confirm", owner, nil, 409)
	s = c.expect("POST", "/api/cards/booking/proposals", invite, map[string]string{"optionId": "c"}, 200)
	next := proposal(s)
	nextID := next["id"].(string)
	if nextID == oldID || next["ownerConfirmedAt"] != nil || next["clientConfirmedAt"] == nil {
		t.Fatal("old confirmations carried over")
	}
	c.expect("POST", "/api/proposals/"+oldID+"/confirm", owner, nil, 404)
	foreign, _ := c.revealed("a", "b")
	c.expect("POST", "/api/proposals/"+nextID+"/confirm", foreign, nil, 404)
	s = c.expect("POST", "/api/proposals/"+nextID+"/confirm", owner, nil, 200)
	if s["stage"] != "review" || s["counts"].(map[string]any)["decided"] != float64(1) {
		t.Fatal("not decided after both confirmed")
	}
	s = c.expect("POST", "/api/cards/booking/proposals", owner, map[string]string{"customText": "Use a callback request form"}, 200)
	if s["stage"] != "compare" || proposal(s)["optionId"] != "other" {
		t.Fatal("reopen did not reset decision")
	}
}
func TestSharedAnswerNeedsTwoConfirmations(t *testing.T) {
	c := newClient(t)
	owner, invite := c.revealed("a", "a")
	s := c.expect("GET", "/api/session", owner, nil, 200)
	p := proposal(s)
	if p["proposedBy"] != "system" || p["ownerConfirmedAt"] != nil || p["clientConfirmedAt"] != nil {
		t.Fatal("shared answer auto-confirmed")
	}
	id := p["id"].(string)
	s = c.expect("POST", "/api/proposals/"+id+"/confirm", invite, nil, 200)
	if s["stage"] != "compare" {
		t.Fatal("one confirmation decided a system proposal")
	}
	s = c.expect("POST", "/api/proposals/"+id+"/confirm", owner, nil, 200)
	if s["stage"] != "review" {
		t.Fatal("both confirmations did not decide")
	}
}

func history(s map[string]any) []map[string]any {
	raw, _ := s["compare"].([]any)[0].(map[string]any)["history"].([]any)
	out := make([]map[string]any, len(raw))
	for i, h := range raw {
		out[i] = h.(map[string]any)
	}
	return out
}

func TestProposalHistoryShowsTheNegotiation(t *testing.T) {
	c := newClient(t)
	owner, invite := c.revealed("a", "c")
	if s := c.expect("GET", "/api/session", owner, nil, 200); len(history(s)) != 0 {
		t.Fatal("history before any proposal")
	}
	c.expect("POST", "/api/cards/booking/proposals", owner, map[string]string{"optionId": "a", "why": "Cheapest to build"}, 200)
	c.expect("POST", "/api/cards/booking/proposals", invite, map[string]string{"optionId": "c", "why": "Tourists book at night"}, 200)
	s := c.expect("POST", "/api/cards/booking/proposals", owner, map[string]string{"optionId": "b", "why": "Staff confirm each slot"}, 200)
	// Both parties see the same history: the two replaced proposals, oldest first.
	for _, token := range []string{owner, invite} {
		h := history(c.expect("GET", "/api/session", token, nil, 200))
		if len(h) != 2 || h[0]["proposedBy"] != "owner" || h[0]["optionId"] != "a" || h[0]["why"] != "Cheapest to build" ||
			h[1]["proposedBy"] != "client" || h[1]["optionId"] != "c" || h[1]["why"] != "Tourists book at night" {
			t.Fatalf("history = %v", h)
		}
	}
	if proposal(s)["optionId"] != "b" {
		t.Fatal("active proposal must not appear twice")
	}
}
