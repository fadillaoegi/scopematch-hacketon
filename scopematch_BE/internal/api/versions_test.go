package api

import (
	"bytes"
	"fmt"
	"testing"
)

func (c *client) decided() (string, string) {
	c.t.Helper()
	owner, invite := c.revealed("a", "c")
	s := c.expect("POST", "/api/cards/booking/proposals", owner, map[string]string{"optionId": "b"}, 200)
	c.expect("POST", "/api/proposals/"+proposal(s)["id"].(string)+"/confirm", invite, nil, 200)
	return owner, invite
}
func scopeBody(text string) map[string]any {
	return map[string]any{"summary": map[string]any{"included": []string{text}, "excluded": []string{"Payments"}, "clientResponsibilities": []string{"Review requests"}, "acceptanceCriteria": []string{"Requests begin Pending"}, "openQuestions": []string{}}}
}
func TestVersionedConfirmationAndExport(t *testing.T) {
	c := newClient(t)
	owner, invite := c.decided()
	c.expect("GET", "/api/scope/export.md", owner, nil, 404)
	c.expect("GET", "/api/scope/draft", invite, nil, 403)
	draft := c.expect("GET", "/api/scope/draft", owner, nil, 200)
	if len(draft["summary"].(map[string]any)["included"].([]any)) == 0 {
		t.Fatal("empty assembled draft")
	}
	c.expect("POST", "/api/scope/versions", invite, scopeBody("Forbidden"), 403)
	c.expect("POST", "/api/scope/versions", owner, scopeBody("OLD v1 text"), 201)
	c.expect("POST", "/api/scope/versions/1/confirm", owner, map[string]string{"name": " "}, 422)
	c.expect("POST", "/api/scope/versions/1/confirm", owner, map[string]string{"name": "Dimas"}, 200)
	c.expect("POST", "/api/scope/versions/1/confirm", owner, map[string]string{"name": "Again"}, 409)
	c.expect("POST", "/api/scope/versions", owner, scopeBody("EXACT stored v2 scope"), 201)
	c.expect("POST", "/api/scope/versions/1/confirm", invite, map[string]string{"name": "Maya"}, 409)
	v := c.expect("GET", "/api/scope", owner, nil, 200)
	latest := v["versions"].([]any)[0].(map[string]any)
	if latest["ownerConfirmation"] != nil || latest["clientConfirmation"] != nil {
		t.Fatal("new version inherited confirmations")
	}
	c.expect("POST", "/api/scope/versions/2/confirm", invite, map[string]string{"name": "Maya"}, 200)
	c.expect("GET", "/api/scope/export.md", invite, nil, 404)
	result := c.expect("POST", "/api/scope/versions/2/confirm", owner, map[string]string{"name": "Dimas"}, 200)
	if result["agreed"] != true {
		t.Fatal("same-version confirmations did not agree")
	}
	s := c.expect("GET", "/api/session", invite, nil, 200)
	if s["stage"] != "agreed" {
		t.Fatal("stage not agreed")
	}
	status, _, export := c.do("GET", "/api/scope/export.md", owner, nil)
	if status != 200 || !bytes.Contains(export, []byte("EXACT stored v2 scope")) || bytes.Contains(export, []byte("OLD v1 text")) {
		t.Fatalf("export does not match agreed snapshot: %s", export)
	}
	for _, text := range []string{"AGREED · v2", "Submit a request for staff approval", "Recorded, not identity-verified.", "Freelancer: Dimas", "Client: Maya"} {
		if !bytes.Contains(export, []byte(text)) {
			t.Errorf("missing %q", text)
		}
	}
	_, _, clientExport := c.do("GET", "/api/scope/export.md", invite, nil)
	if !bytes.Equal(export, clientExport) {
		t.Fatal("roles received different export")
	}
	view := c.expect("GET", "/api/scope", owner, nil, 200)
	if len(view["versions"].([]any)) != 2 {
		t.Fatal("version history lost")
	}
	for _, action := range []struct {
		method, path string
		body         any
	}{
		{"POST", "/api/scope/versions", scopeBody("Changed")},
		{"POST", "/api/scope/versions/2/confirm", map[string]string{"name": "Again"}},
		{"POST", "/api/cards/booking/proposals", map[string]string{"optionId": "a"}},
		{"PUT", "/api/answers", answerBody("booking", "a", "")},
		{"PUT", "/api/project/cards", map[string]any{"cardIds": []string{"booking"}}},
	} {
		c.expect(action.method, action.path, owner, action.body, 409)
	}
	_, _, again := c.do("GET", "/api/scope/export.md", owner, nil)
	if !bytes.Equal(export, again) {
		t.Fatal("agreed export mutated")
	}
}
func TestUndecidedOrReplacedDecisionsCannotBeAgreed(t *testing.T) {
	c := newClient(t)
	owner, invite := c.revealed("a", "c")
	c.expect("GET", "/api/scope/draft", owner, nil, 409)
	c.expect("POST", "/api/scope/versions", owner, scopeBody("Too early"), 409)
	s := c.expect("POST", "/api/cards/booking/proposals", owner, map[string]string{"optionId": "b"}, 200)
	c.expect("POST", "/api/proposals/"+proposal(s)["id"].(string)+"/confirm", invite, nil, 200)
	c.expect("POST", "/api/scope/versions", owner, scopeBody("Scope for B"), 201)
	c.expect("POST", "/api/scope/versions/1/confirm", owner, map[string]string{"name": "Dimas"}, 200)
	s = c.expect("POST", "/api/cards/booking/proposals", invite, map[string]string{"optionId": "a"}, 200)
	c.expect("POST", "/api/scope/versions/1/confirm", invite, map[string]string{"name": "Maya"}, 409)
	c.expect("POST", "/api/proposals/"+proposal(s)["id"].(string)+"/confirm", owner, nil, 200)
	// Even once re-decided, the old snapshot still describes a replaced proposal.
	c.expect("POST", "/api/scope/versions/1/confirm", invite, map[string]string{"name": "Maya"}, 409)
	c.expect("POST", "/api/scope/versions", owner, scopeBody("Scope for A"), 201)
	for _, tok := range []string{owner, invite} {
		c.expect("POST", "/api/scope/versions/2/confirm", tok, map[string]string{"name": "Confirmed"}, 200)
	}
	foreign, _ := c.decided()
	c.expect("POST", "/api/scope/versions/2/confirm", foreign, map[string]string{"name": "Foreign"}, 409)
	c.expect("GET", "/api/scope/export.md", foreign, nil, 404)
}
func TestConcurrentScopeConfirmations(t *testing.T) {
	c := newClient(t)
	owner, invite := c.decided()
	c.expect("POST", "/api/scope/versions", owner, scopeBody("Concurrent agreement"), 201)
	statuses := make(chan int, 2)
	for i, tok := range []string{owner, invite} {
		go func(token string, name string) {
			status, _, _ := c.do("POST", "/api/scope/versions/1/confirm", token, map[string]string{"name": name})
			statuses <- status
		}(tok, fmt.Sprintf("Person %d", i))
	}
	for range 2 {
		if status := <-statuses; status != 200 {
			t.Fatalf("concurrent confirm status %d", status)
		}
	}
	if s := c.expect("GET", "/api/session", owner, nil, 200); s["stage"] != "agreed" {
		t.Fatal("concurrent confirmation lost")
	}
}
