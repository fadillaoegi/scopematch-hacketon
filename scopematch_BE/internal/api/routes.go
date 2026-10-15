// Package api is the HTTP layer: JSON in and out, mapping rule errors to
// status codes. Product rules live in package scope.
package api

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"scopematch/internal/domain"
	"scopematch/internal/library"
	"scopematch/internal/scope"
)

type Server struct {
	svc *scope.Service
	mux *http.ServeMux
}

// New builds the API. staticDir, if set, is a built frontend served for every
// non-API path (with index.html fallback for client-side routes).
func New(svc *scope.Service, staticDir string) http.Handler {
	s := &Server{svc: svc, mux: http.NewServeMux()}

	s.mux.HandleFunc("POST /api/projects", s.createProject)
	s.mux.HandleFunc("GET /api/library", s.getLibrary)
	s.mux.HandleFunc("GET /api/session", s.authed(s.getSession))
	s.mux.HandleFunc("PUT /api/project/cards", s.authed(s.putCards))
	s.mux.HandleFunc("POST /api/project/lock", s.authed(s.lockProject))
	s.mux.HandleFunc("PUT /api/answers", s.authed(s.putAnswers))
	s.mux.HandleFunc("POST /api/answers/submit", s.authed(s.submitAnswers))
	s.mux.HandleFunc("POST /api/cards/{cardId}/proposals", s.authed(s.propose))
	s.mux.HandleFunc("POST /api/proposals/{id}/confirm", s.authed(s.confirmProposal))
	s.mux.HandleFunc("GET /api/scope/draft", s.authed(s.scopeDraft))
	s.mux.HandleFunc("GET /api/scope", s.authed(s.getScope))
	s.mux.HandleFunc("POST /api/scope/versions", s.authed(s.saveVersion))
	s.mux.HandleFunc("POST /api/scope/versions/{n}/confirm", s.authed(s.confirmVersion))
	s.mux.HandleFunc("GET /api/scope/export.md", s.authed(s.exportScope))
	s.mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotFound, "not_found", nil)
	})

	if staticDir != "" {
		s.mux.Handle("/", spa(staticDir))
	}
	return securityHeaders(s.mux)
}

func (s *Server) createProject(w http.ResponseWriter, r *http.Request) {
	var in scope.NewProject
	if !readJSON(w, r, &in) {
		return
	}
	token, err := s.svc.CreateProject(r.Context(), in)
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"ownerToken": token})
}

func (s *Server) getLibrary(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"cards": library.All()})
}

func (s *Server) getSession(w http.ResponseWriter, r *http.Request, a scope.Actor) {
	s.respondSession(w, r, a)
}

func (s *Server) putCards(w http.ResponseWriter, r *http.Request, a scope.Actor) {
	var in struct {
		CardIDs []string `json:"cardIds"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	if err := s.svc.SetCards(r.Context(), a, in.CardIDs); err != nil {
		s.fail(w, err)
		return
	}
	s.respondSession(w, r, a)
}

func (s *Server) respondSession(w http.ResponseWriter, r *http.Request, a scope.Actor) {
	v, err := s.svc.Session(r.Context(), a)
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, v)
}

func (s *Server) lockProject(w http.ResponseWriter, r *http.Request, a scope.Actor) {
	token := strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
	clientToken, err := s.svc.Lock(r.Context(), a, token)
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"clientToken": clientToken})
}

func (s *Server) putAnswers(w http.ResponseWriter, r *http.Request, a scope.Actor) {
	var in struct {
		Answers []domain.Answer `json:"answers"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	if err := s.svc.SaveAnswers(r.Context(), a, in.Answers); err != nil {
		s.fail(w, err)
		return
	}
	s.respondSession(w, r, a)
}

func (s *Server) submitAnswers(w http.ResponseWriter, r *http.Request, a scope.Actor) {
	if err := s.svc.Submit(r.Context(), a); err != nil {
		s.fail(w, err)
		return
	}
	s.respondSession(w, r, a)
}

// fail maps a rule error to its status; anything else is a 500.
func (s *Server) fail(w http.ResponseWriter, err error) {
	var e *scope.Error
	if errors.As(err, &e) {
		status := map[scope.Kind]int{
			scope.Invalid:   http.StatusUnprocessableEntity,
			scope.Conflict:  http.StatusConflict,
			scope.NotFound:  http.StatusNotFound,
			scope.Forbidden: http.StatusForbidden,
		}[e.Kind]
		writeError(w, status, e.Code, e.Fields)
		return
	}
	if errors.Is(err, domain.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not_found", nil)
		return
	}
	s.internal(w, err)
}

func (s *Server) internal(w http.ResponseWriter, err error) {
	log.Printf("internal error: %v", err)
	writeError(w, http.StatusInternalServerError, "internal", nil)
}

const maxBody = 64 << 10

func readJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBody))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		writeError(w, http.StatusBadRequest, "bad_json", nil)
		return false
	}
	if err := dec.Decode(new(any)); err != io.EOF {
		writeError(w, http.StatusBadRequest, "bad_json", nil)
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code string, fields map[string]string) {
	body := map[string]any{"error": code}
	if len(fields) > 0 {
		body["fields"] = fields
	}
	writeJSON(w, status, body)
}

// spa serves files from dir, falling back to index.html so client-side
// routes like /c/<token> load the app.
func spa(dir string) http.Handler {
	files := http.FileServer(http.Dir(dir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := filepath.Join(dir, filepath.Clean("/"+r.URL.Path))
		if info, err := os.Stat(path); err == nil && !info.IsDir() {
			files.ServeHTTP(w, r)
			return
		}
		if strings.HasPrefix(r.URL.Path, "/assets/") {
			http.NotFound(w, r)
			return
		}
		http.ServeFile(w, r, filepath.Join(dir, "index.html"))
	})
}

func (s *Server) propose(w http.ResponseWriter, r *http.Request, a scope.Actor) {
	var in scope.ProposalInput
	if !readJSON(w, r, &in) {
		return
	}
	if err := s.svc.Propose(r.Context(), a, r.PathValue("cardId"), in); err != nil {
		s.fail(w, err)
		return
	}
	s.respondSession(w, r, a)
}
func (s *Server) confirmProposal(w http.ResponseWriter, r *http.Request, a scope.Actor) {
	if err := s.svc.ConfirmProposal(r.Context(), a, r.PathValue("id")); err != nil {
		s.fail(w, err)
		return
	}
	s.respondSession(w, r, a)
}

func (s *Server) scopeDraft(w http.ResponseWriter, r *http.Request, a scope.Actor) {
	summary, err := s.svc.Draft(r.Context(), a)
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, 200, map[string]any{"summary": summary})
}
func (s *Server) getScope(w http.ResponseWriter, r *http.Request, a scope.Actor) {
	v, err := s.svc.Scope(r.Context(), a)
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, 200, v)
}
func (s *Server) saveVersion(w http.ResponseWriter, r *http.Request, a scope.Actor) {
	var in struct {
		Summary scope.Summary `json:"summary"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	v, err := s.svc.SaveVersion(r.Context(), a, in.Summary)
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, 201, map[string]int{"version": v})
}
func (s *Server) confirmVersion(w http.ResponseWriter, r *http.Request, a scope.Actor) {
	var in struct {
		Name string `json:"name"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	n, err := strconv.Atoi(r.PathValue("n"))
	if err != nil {
		writeError(w, 422, "validation", map[string]string{"version": "Choose a valid version."})
		return
	}
	agreed, err := s.svc.ConfirmVersion(r.Context(), a, n, in.Name)
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, 200, map[string]any{"version": n, "agreed": agreed})
}
func (s *Server) exportScope(w http.ResponseWriter, r *http.Request, a scope.Actor) {
	data, filename, err := s.svc.Export(r.Context(), a)
	if err != nil {
		s.fail(w, err)
		return
	}
	w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
	w.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": filename}))
	w.Header().Set("Cache-Control", "no-store")
	w.Write([]byte(data))
}
