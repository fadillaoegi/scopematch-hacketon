package api

import (
	"errors"
	"net/http"
	"strings"

	"scopematch/internal/domain"
	"scopematch/internal/scope"
)

// authed wraps a handler that needs a link token. The token comes only from
// the Authorization header; project IDs never appear in API paths.
func (s *Server) authed(h func(w http.ResponseWriter, r *http.Request, a scope.Actor)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		if !ok {
			writeError(w, http.StatusUnauthorized, "invalid_link", nil)
			return
		}
		a, err := s.svc.Authenticate(r.Context(), strings.TrimSpace(token))
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusUnauthorized, "invalid_link", nil)
			return
		}
		if err != nil {
			s.internal(w, err)
			return
		}
		h(w, r, a)
	}
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Link tokens live in page URLs; never leak them to other sites.
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		next.ServeHTTP(w, r)
	})
}
