package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"scopematch/internal/scope"
	"scopematch/internal/store"
)

const salonBrief = "We need a salon website with booking, two languages, and editable content."

type client struct {
	t   *testing.T
	srv *httptest.Server
}

func newClient(t *testing.T) *client {
	t.Helper()
	st, err := store.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	srv := httptest.NewServer(New(scope.NewService(st), ""))
	t.Cleanup(srv.Close)
	return &client{t: t, srv: srv}
}

// do sends a request and decodes the JSON response into a map. raw holds the
// exact bytes so tests can assert on what was (not) sent.
func (c *client) do(method, path, token string, body any) (status int, out map[string]any, raw []byte) {
	c.t.Helper()
	var buf bytes.Buffer
	if body != nil {
		json.NewEncoder(&buf).Encode(body)
	}
	req, _ := http.NewRequest(method, c.srv.URL+path, &buf)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		c.t.Fatal(err)
	}
	defer res.Body.Close()
	var b bytes.Buffer
	b.ReadFrom(res.Body)
	raw = b.Bytes()
	json.Unmarshal(raw, &out)
	return res.StatusCode, out, raw
}

func (c *client) createSalon() string {
	c.t.Helper()
	status, out, raw := c.do("POST", "/api/projects", "", map[string]string{
		"name": "Salon website", "freelancerName": "Dimas", "clientName": "Maya", "brief": salonBrief,
	})
	if status != http.StatusCreated {
		c.t.Fatalf("create: %d %s", status, raw)
	}
	return out["ownerToken"].(string)
}

func cardIDs(session map[string]any) []string {
	var ids []string
	for _, c := range session["cards"].([]any) {
		ids = append(ids, c.(map[string]any)["id"].(string))
	}
	return ids
}

func TestCreateValidation(t *testing.T) {
	c := newClient(t)
	status, out, _ := c.do("POST", "/api/projects", "", map[string]string{
		"name": "  ", "freelancerName": "Dimas", "clientName": "Maya", "brief": "",
	})
	if status != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d", status)
	}
	fields := out["fields"].(map[string]any)
	if fields["name"] == nil || fields["brief"] == nil || fields["clientName"] != nil {
		t.Errorf("fields = %v", fields)
	}
}

func TestCreateAndSessionRoundTrip(t *testing.T) {
	c := newClient(t)
	token := c.createSalon()

	status, s, raw := c.do("GET", "/api/session", token, nil)
	if status != http.StatusOK {
		t.Fatalf("session: %d %s", status, raw)
	}
	if s["role"] != "owner" || s["stage"] != "setup" {
		t.Errorf("role/stage = %v/%v", s["role"], s["stage"])
	}
	got := cardIDs(s)
	want := []string{"booking", "languages", "editable", "launch-content"}
	if len(got) != len(want) {
		t.Fatalf("cards = %v", got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("cards = %v", got)
		}
	}
	booking := s["cards"].([]any)[0].(map[string]any)["match"].(map[string]any)
	if booking["phrase"] != "booking" || booking["sentence"] != salonBrief {
		t.Errorf("booking match = %v", booking)
	}
	if launch := s["cards"].([]any)[3].(map[string]any)["match"]; launch != nil {
		t.Errorf("launch-content should be unmatched, got %v", launch)
	}
}

func TestInvalidTokens(t *testing.T) {
	c := newClient(t)
	c.createSalon()
	for _, tok := range []string{"", "nope", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"} {
		if status, out, _ := c.do("GET", "/api/session", tok, nil); status != http.StatusUnauthorized || out["error"] != "invalid_link" {
			t.Errorf("token %q: %d %v", tok, status, out)
		}
	}
}

func TestSetCards(t *testing.T) {
	c := newClient(t)
	token := c.createSalon()

	status, s, _ := c.do("PUT", "/api/project/cards", token, map[string]any{"cardIds": []string{"booking", "launch-content"}})
	if status != http.StatusOK || len(cardIDs(s)) != 2 {
		t.Fatalf("set cards: %d %v", status, s)
	}
	if status, _, _ := c.do("PUT", "/api/project/cards", token, map[string]any{"cardIds": []string{}}); status != http.StatusUnprocessableEntity {
		t.Errorf("empty cards: %d", status)
	}
	if status, _, _ := c.do("PUT", "/api/project/cards", token, map[string]any{"cardIds": []string{"teleport"}}); status != http.StatusUnprocessableEntity {
		t.Errorf("unknown card: %d", status)
	}
}

func TestLibrary(t *testing.T) {
	c := newClient(t)
	status, out, _ := c.do("GET", "/api/library", "", nil)
	if status != http.StatusOK || len(out["cards"].([]any)) != 4 {
		t.Fatalf("library: %d %v", status, out)
	}
}
