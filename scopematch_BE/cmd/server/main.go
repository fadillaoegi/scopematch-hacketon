// Command server runs the ScopeMatch API (and, with -static, the built site).
package main

import (
	"flag"
	"log"
	"net/http"

	"scopematch/internal/api"
	"scopematch/internal/scope"
	"scopematch/internal/store"
)

func main() {
	addr := flag.String("addr", ":8080", "listen address")
	dbPath := flag.String("db", "data/scopematch.db", "SQLite database file")
	static := flag.String("static", "", "serve a built frontend from this directory (e.g. ../scopematch_FE/dist)")
	flag.Parse()

	st, err := store.Open(*dbPath)
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	defer st.Close()

	svc := scope.NewService(st)
	log.Printf("ScopeMatch listening on %s (db %s)", *addr, *dbPath)
	if *static != "" {
		log.Printf("serving site from %s", *static)
	}
	log.Fatal(http.ListenAndServe(*addr, api.New(svc, *static)))
}
