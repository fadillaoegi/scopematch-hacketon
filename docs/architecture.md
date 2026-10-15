# Clean Architecture

Clean Architecture is a project requirement, recorded in `AGENTS.md` and imported by `CLAUDE.md`. Product rules and models remain independent of HTTP, SQLite, and React. Outer adapters implement the interfaces defined by the application. Names and directories express the existing proof of concept; the dependency direction is the enforced rule.

## Backend boundaries

| Layer | Location | Responsibility and allowed project dependencies |
| --- | --- | --- |
| Domain | `scopematch_BE/internal/domain` | Project, answer, proposal, saved-version records and not-found error. No application, SQL, transport, or adapter imports. |
| Domain library | `scopematch_BE/internal/library` | Curated questions, option text, pure matching, and static preview data. No storage or transport dependencies. |
| Application | `scopematch_BE/internal/scope` | Use cases, role permissions, sealed answers, reveal gate, proposals, version checks, agreement, and export assembly. Imports domain/library and owns the `Repository` port. |
| Persistence adapter | `scopematch_BE/internal/store` | SQLite schema, queries, transaction execution, and the implementation of the application repository. SQL and database null handling stay here. |
| HTTP adapter | `scopematch_BE/internal/api` | Bearer authentication boundary, request decoding, response encoding, HTTP status mapping, and static serving. Imports inner types/use cases and never the SQLite adapter. |
| Composition root | `scopematch_BE/cmd/server/main.go` | Opens SQLite, constructs `store.NewRepository(st)`, injects it with `scope.NewService(...)`, and wires the HTTP server. |

`scope.Repository` is an application-owned persistence port for the project aggregate. Operations describe intent, such as `SealAnswers`, `ConfirmProposal`, and `MarkAgreed`; use cases cannot issue raw SQL or see `sql.DB`, `sql.Tx`, or database-specific null types.

`WithinTransaction(ctx, func(repo scope.Repository) error)` supplies a transaction-scoped implementation. Every rule read and subsequent write uses that same repository. The SQLite adapter commits only when the callback succeeds and rejects nested transactions. This preserves atomic answer sealing, replacement of proposal confirmations, version-number assignment, and simultaneous confirmation behavior.

The domain project uses an empty lock timestamp and zero agreed version for unset state; the SQLite adapter maps existing nullable columns. The database schema and public JSON contract remain compatible with existing projects.

## Frontend boundaries

| Layer | Location | Responsibility and allowed project dependencies |
| --- | --- | --- |
| Domain | `scopematch_FE/src/domain/models.ts` | Framework-independent project/session/card/scope models. No API, React, or browser dependencies. |
| Application port | `scopematch_FE/src/application/projectGateway.ts` | `ProjectGateway` describes the actions the presentation needs. Uses domain models. |
| Application errors | `scopematch_FE/src/application/errors.ts` | `GatewayError` exposes semantic failure codes and field messages, without HTTP status handling in the UI. |
| HTTP adapter | `scopematch_FE/src/api/client.ts` | Implements the gateway with fetch, endpoint paths, bearer headers, and response decoding. Uses only domain and application contracts. |
| Presentation | `src/pages`, `src/components`, React hooks in `src/lib` | UI state, navigation, motion, polling, and display. Uses `useProjectGateway()` and domain types instead of importing the HTTP implementation. |
| Browser conveniences | `src/lib/projects.ts`, component download handling | Remembers owner links on this device and saves downloaded text as a browser file. These stay outside domain/application. |
| Composition root | `scopematch_FE/src/main.tsx` | Injects the HTTP adapter through `ProjectGatewayProvider`. Tests or another host can provide a different gateway. |

The gateway returns downloaded Markdown as plain text plus a filename. Creating a Blob, an object URL, and a download anchor happens in presentation. The card-library cache is keyed by gateway instance, so separate injected implementations do not share cached results.

The backend remains authoritative for all agreement and visibility rules; the frontend does not duplicate those rules in a client-side domain engine.

## Architecture checks and regression verification

From `scopematch_BE`:

```sh
go test ./...
go vet ./...
```

`TestCleanArchitectureDependencies` parses production Go imports and rejects inward-to-outward dependencies, including application imports of storage, HTTP, and database packages. Existing API tests still exercise the real SQLite adapter, including rollback, sealed-answer visibility, all answer-pair statuses, proposal replacement, stale versions, concurrent confirmations, and immutable export.

From `scopematch_FE`:

```sh
npm run check:architecture
npm run build
```

The architecture checker uses the installed TypeScript scanner to check static/type/dynamic imports and rejects direct HTTP-adapter imports outside the composition root, fetch calls outside the HTTP adapter, and browser/framework dependencies in inner layers. The production build runs that check automatically before TypeScript compilation and Vite. These are import/dependency guards, not a proof of every possible architectural property.

The refactor was also checked with two isolated browser sessions through creation, sealing, reveal, counter-proposals, custom decisions, revised scope versions, both confirmations, agreement, actual Markdown download, and the Projects list. An unchanged copy of the previous SQLite database returned identical session JSON and export responses for pre-refactor setup and agreed projects.
