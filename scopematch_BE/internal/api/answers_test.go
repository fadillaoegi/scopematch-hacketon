package api

import (
	"bytes"
	"testing"
)

func (c *client) expect(method, path, token string, body any, want int) map[string]any {
	c.t.Helper()
	status, out, raw := c.do(method, path, token, body)
	if status != want {
		c.t.Fatalf("%s %s: want %d, got %d %s", method, path, want, status, raw)
	}
	return out
}

func (c *client) lock(owner string) string {
	c.t.Helper()
	return c.expect("POST", "/api/project/lock", owner, nil, 200)["clientToken"].(string)
}

func answerBody(card, option, text string) map[string]any {
	return map[string]any{"answers": []map[string]string{{"cardId": card, "optionId": option, "customText": text}}}
}

func TestLockAndProjectIsolation(t *testing.T) {
	c := newClient(t)
	owner := c.createSalon()
	c.expect("PUT", "/api/answers", owner, answerBody("booking", "a", ""), 409)
	invite := c.lock(owner)
	if invite == owner || len(invite) != 43 {
		t.Fatalf("invalid client token")
	}
	if again := c.lock(owner); again != invite {
		t.Fatal("lock retry changed invite")
	}
	c.expect("POST", "/api/project/lock", invite, nil, 403)
	c.expect("PUT", "/api/project/cards", invite, map[string]any{"cardIds": []string{"booking"}}, 403)
	c.expect("PUT", "/api/project/cards", owner, map[string]any{"cardIds": []string{"booking"}}, 409)
	otherOwner := c.createSalon()
	c.expect("PUT", "/api/project/cards", otherOwner, map[string]any{"cardIds": []string{"booking"}}, 200)
	s := c.expect("GET", "/api/session", invite, nil, 200)
	if s["role"] != "client" || len(cardIDs(s)) != 4 {
		t.Fatal("client access escaped its role or project")
	}
	c.expect("PUT", "/api/answers", invite, map[string]any{"projectId": "foreign", "answers": []any{}}, 400)
	c.expect("GET", "/api/session", otherOwner+"x", nil, 401)
}

func TestAnswersStaySealedUntilBothSubmit(t *testing.T) {
	c := newClient(t)
	owner := c.createSalon()
	c.expect("PUT", "/api/project/cards", owner, map[string]any{"cardIds": []string{"booking"}}, 200)
	invite := c.lock(owner)
	c.expect("POST", "/api/answers/submit", owner, nil, 422)
	c.expect("PUT", "/api/answers", owner, answerBody("booking", "other", "   "), 422)
	c.expect("PUT", "/api/answers", owner, answerBody("editable", "a", ""), 422)
	c.expect("PUT", "/api/answers", owner, answerBody("booking", "bogus", ""), 422)
	c.expect("PUT", "/api/answers", owner, answerBody("booking", "other", "SECRET freelancer custom answer"), 200)
	c.expect("PUT", "/api/answers", invite, answerBody("booking", "other", "SECRET client custom answer"), 200)
	assertHidden := func(token, secret string) {
		t.Helper()
		status, s, raw := c.do("GET", "/api/session", token, nil)
		if status != 200 {
			t.Fatalf("session %d", status)
		}
		other := s["other"].(map[string]any)
		if _, exists := other["answers"]; exists {
			t.Fatal("other.answers leaked before both submitted")
		}
		if _, exists := s["compare"]; exists {
			t.Fatal("compare leaked before both submitted")
		}
		if bytes.Contains(raw, []byte(secret)) {
			t.Fatalf("secret leaked in raw JSON: %s", raw)
		}
	}
	assertHidden(owner, "SECRET client")
	assertHidden(invite, "SECRET freelancer")
	c.expect("POST", "/api/answers/submit", owner, nil, 200)
	assertHidden(invite, "SECRET freelancer")
	assertHidden(owner, "SECRET client")
	c.expect("PUT", "/api/answers", owner, answerBody("booking", "a", ""), 409)
	c.expect("POST", "/api/answers/submit", owner, nil, 409)
	c.expect("POST", "/api/answers/submit", invite, nil, 200)
	for _, token := range []string{owner, invite} {
		s := c.expect("GET", "/api/session", token, nil, 200)
		if len(s["other"].(map[string]any)["answers"].([]any)) != 1 {
			t.Fatal("answers not revealed after both submitted")
		}
	}
	c.expect("PUT", "/api/answers", invite, answerBody("booking", "c", ""), 409)
}

func TestAnswerValidationIsAtomic(t *testing.T) {
	c := newClient(t)
	owner := c.createSalon()
	c.lock(owner)
	c.expect("PUT", "/api/answers", owner, map[string]any{"answers": []map[string]string{
		{"cardId": "booking", "optionId": "a"}, {"cardId": "languages", "optionId": "other"},
	}}, 422)
	s := c.expect("GET", "/api/session", owner, nil, 200)
	if len(s["me"].(map[string]any)["answers"].([]any)) != 0 {
		t.Fatal("failed batch partially saved")
	}
	c.expect("PUT", "/api/answers", owner, answerBody("booking", "a", "irrelevant text"), 200)
	s = c.expect("GET", "/api/session", owner, nil, 200)
	a := s["me"].(map[string]any)["answers"].([]any)[0].(map[string]any)
	if _, exists := a["customText"]; exists {
		t.Fatal("irrelevant custom text persisted")
	}
}
