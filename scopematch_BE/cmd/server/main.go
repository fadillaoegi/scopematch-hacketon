// Command server runs the ScopeMatch API (and, with -static, the built site).
package main

import (
	"context"
	"flag"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"scopematch/internal/api"
	"scopematch/internal/scope"
	"scopematch/internal/store"
)

func main() {
	addr := flag.String("addr", ":8080", "listen address")
	dbPath := flag.String("db", "data/scopematch.db", "SQLite database file")
	static := flag.String("static", "", "serve built frontend directory with SPA fallback")
	seed := flag.Bool("seed-demo", false, "create a fresh salon project in setup and print its private owner link")
	flag.Parse()
	if *static != "" {
		info, err := os.Stat(filepath.Join(*static, "index.html"))
		if err != nil || info.IsDir() {
			log.Fatalf("frontend build missing in %s; run npm run build in scopematch_FE first", *static)
		}
	}
	st, err := store.Open(*dbPath)
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	defer st.Close()
	listener, err := net.Listen("tcp", *addr)
	if err != nil {
		log.Fatalf("listen: %v", err)
	}
	defer listener.Close()
	svc := scope.NewService(st)
	if *seed {
		token, err := svc.CreateProject(context.Background(), scope.NewProject{Name: "Salon website", FreelancerName: "Dimas", ClientName: "Maya", Brief: "We need a salon website with booking, two languages, and editable content."})
		if err != nil {
			log.Fatalf("seed demo: %v", err)
		}
		origin := "http://localhost:5173"
		if *static != "" {
			host, port, _ := net.SplitHostPort(listener.Addr().String())
			if host == "" || host == "::" || host == "0.0.0.0" {
				host = "127.0.0.1"
			}
			origin = "http://" + net.JoinHostPort(host, port)
		}
		log.Printf("Demo freelancer link (keep private): %s/o/%s", origin, token)
	}
	log.Printf("ScopeMatch listening on %s (db %s)", listener.Addr(), *dbPath)
	if *static != "" {
		log.Printf("serving site from %s", *static)
	}
	server := &http.Server{Handler: api.New(svc, *static), ReadHeaderTimeout: 5 * time.Second}
	log.Fatal(server.Serve(listener))
}
