# Project working rules

## Architecture — required for all changes

Always use Clean Architecture for this project, following the user's explicit preference.

- Dependencies point inward: domain → no application, UI, transport, or persistence dependencies; application/use cases → domain and application-owned ports; adapters → those inner contracts.
- Backend: `internal/domain` owns persistence-neutral entities; `internal/scope` owns use cases and repository/transaction ports; `internal/store` implements SQLite persistence; `internal/api` adapts HTTP. Wire implementations in `cmd/server`.
- Never put SQL, `database/sql` types, HTTP concerns, or a concrete SQLite store inside domain/application code. Keep rule checks and their writes in one repository transaction.
- Frontend: `src/domain` owns models; `src/application` owns the gateway contract and application errors; `src/api` implements HTTP; UI/components/hooks consume the injected gateway. Wire the HTTP implementation in `src/main.tsx`.
- Keep business guarantees enforced by backend use cases. UI state, layout, and browser-specific conveniences belong in presentation/adapters.
- Prefer explicit, small interfaces needed by real use cases. Keep the proof of concept focused; do not add frameworks, generic base repositories, or extra layers without a concrete need.
- Preserve existing API contracts, database compatibility, and behavior when refactoring. Update architecture docs and the app map when paths or boundaries change.
- Verify architecture boundaries and run existing Go rule tests, `go vet ./...`, frontend architecture checks, and `npm run build` before committing architecture changes.

## Scope and publication

Use the approved documents in `devpost/` for product scope. Keep `devpost/learner-profile.md`, credentials, local databases, and generated recordings outside Git. Follow existing session authorization for commits and publication; never include unrelated changes or rewrite history silently.
