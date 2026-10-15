package api

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSPAFallbackAndAssets(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte("<html>ScopeMatch test shell</html>"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(filepath.Join(dir, "assets"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "assets", "app.js"), []byte("const testAsset = true;"), 0600); err != nil {
		t.Fatal(err)
	}
	h := New(nil, dir)
	for _, path := range []string{"/", "/new", "/o/example-token", "/c/example-token"} {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("GET", path, nil))
		if w.Code != 200 || !strings.Contains(w.Body.String(), "ScopeMatch test shell") {
			t.Errorf("SPA %s: %d %s", path, w.Code, w.Body)
		}
		if w.Header().Get("Referrer-Policy") != "no-referrer" {
			t.Error("missing link privacy header")
		}
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("GET", "/assets/app.js", nil))
	if w.Code != 200 || !strings.Contains(w.Body.String(), "testAsset") {
		t.Fatal("asset not served")
	}
	for _, path := range []string{"/assets/missing.js", "/api/unknown"} {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("GET", path, nil))
		if w.Code != http.StatusNotFound {
			t.Errorf("missing %s: %d", path, w.Code)
		}
	}
}
func TestJSONRejectsTrailingData(t *testing.T) {
	h := New(nil, "")
	for _, body := range []string{`{} {}`, `{} trailing`, strings.Repeat("x", maxBody+1)} {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("POST", "/api/projects", strings.NewReader(body)))
		if w.Code != 400 {
			t.Fatalf("malformed JSON: status %d", w.Code)
		}
	}
}
