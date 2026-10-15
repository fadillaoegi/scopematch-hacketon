// Package api is the HTTP layer: JSON in and out, mapping rule errors to
// status codes. Product rules live in package scope.
package api

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"scopematch/internal/library"
	"scopematch/internal/scope"
	"scopematch/internal/store"
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
	if errors.Is(err, store.ErrNotFound) {
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
		http.ServeFile(w, r, filepath.Join(dir, "index.html"))
	})
}
