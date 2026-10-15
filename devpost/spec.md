---
doc: spec
status: approved
---

# ScopeMatch — Technical Spec

## How This Works, In Plain Language
ScopeMatch has three pieces:

- **The website (`scopematch_FE`)** — what the freelancer sees on a laptop and the client sees on a phone. Built with React. It only shows what the server sends it.
- **The server (`scopematch_BE`)** — a Go program that is always running while the app is in use. It holds the rules: who may see what, when answers are revealed, when a scope counts as agreed.
- **The database** — a single SQLite file next to the server (`scopematch.db`). Think of it as a spreadsheet the server reads and writes: projects, answers, proposals, scope versions.

**Secret links instead of logins.** When a freelancer creates a project, the server makes a long random code (a *token*) and puts it in the owner link. Locking the questions makes a second token for the client link. Every request from the website carries its token; the server looks it up and learns "this is the freelancer of project X" or "this is the client of project X". The website never asks for a project by ID, so changing a number in the URL can't open someone else's project.

**Why answers can't leak.** The server decides what goes into each response. Until both parties have submitted, it simply doesn't include the other side's answers — there's nothing hidden in the page to find.

Why this shape: one server program + one database file is the smallest setup that still keeps the rules on the server (required by the kernel). No Docker, no cloud service, no accounts.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.

1. Freelancer fills the New project form → website sends it to `POST /api/projects` → server saves the project, matches the brief against the card library, creates the **owner token**, returns it → website stores the owner link in the browser's local storage (for the Projects list) and opens `/o/<ownerToken>`.
2. Setup tab shows the brief with highlighted matched sentences and suggested cards (`GET /api/session`, `GET /api/library`) → freelancer adjusts → `PUT /api/project/cards`.
3. "Lock questions & get links" → `POST /api/project/lock` → server freezes the card list and creates the **client token** → website shows both links.
4. Each party opens their link → Answer screen → choices autosave with `PUT /api/answers` → Submit → `POST /api/answers/submit` seals them. `GET /api/session` tells each side only "the other party has/hasn't submitted".
5. When the second party submits, the next `GET /api/session` (the website re-checks every 4 seconds while waiting) reports `stage: compare` and now includes both answers → Compare screen plays the flip reveal.
6. Proposals: `POST /api/cards/{cardId}/proposals` and `POST /api/proposals/{id}/confirm` → server applies the replace-and-cancel rules → card becomes Decided when both confirmed.
7. All cards decided → freelancer opens Scope tab, the server-assembled draft summary loads (`GET /api/scope/draft`) → freelancer edits → `POST /api/scope/versions` saves version N → each side confirms with name (`POST /api/scope/versions/{n}/confirm`).
8. Both confirmed the same version → server sets the project to Agreed → website shows the stamp → `GET /api/scope/export.md` downloads the stored version as Markdown.

## Stack
Learner choices: React + Vite + TypeScript, Go (from the handoff, kept). SQLite and local-first running were agent recommendations the learner accepted ("lanjut").

| Piece | Choice | Why | Docs |
|---|---|---|---|
| Frontend | React 19 + TypeScript, Vite | Learner's stack | https://react.dev · https://vite.dev |
| Routing | React Router (declarative mode) | Four URL patterns, nothing more | https://reactrouter.com |
| Motion | Motion for React (`motion` package) | Flip, stamp, layout reveal; built-in reduced-motion hook | https://motion.dev/docs/react |
| Fonts | Fontsource variable packages (self-hosted, works offline): Fraunces, Instrument Sans, JetBrains Mono | Matches Look and Feel; no CDN dependency during recording | https://fontsource.org |
| Styling | Plain CSS with custom properties (design tokens) + CSS Modules | Full control of the paper/ink look; avoids default utility-kit styling | https://vite.dev/guide/features#css-modules |
| Backend | Go 1.26 standard library `net/http` (method + path patterns) | No framework needed for ~14 routes | https://pkg.go.dev/net/http |
| Database | SQLite via `modernc.org/sqlite` (pure Go, no C compiler) with `database/sql` | One file, zero setup; accepted tradeoff: no "PostgreSQL" on the résumé; SQL kept portable | https://pkg.go.dev/modernc.org/sqlite |
| Tests | Go `testing` + `net/http/httptest` | Server rules are where correctness matters | https://pkg.go.dev/net/http/httptest |

**Versions checked on npm / Go proxy, 15 Oct 2026:** react & react-dom 19.3.1, vite 8.3.4, typescript 7.0.2, react-router 8.4.0, motion 14.2.0, `@fontsource-variable/fraunces` 5.3.0, `@fontsource-variable/instrument-sans` 5.3.0, `@fontsource-variable/jetbrains-mono` 5.3.0, `modernc.org/sqlite` v1.60.1. Pin what `npm install` / `go get` resolves. If the Vite React-TS template pins a different TypeScript major, keep the template's version.

## Where It Runs and How Someone Tries It
Requirements: Go 1.26, Node 24 (both already installed on the learner's laptop). No API keys.

**Development / demo recording (two terminals):**
```sh
cd scopematch_BE && go run ./cmd/server          # API on :8080, creates ./data/scopematch.db
cd scopematch_FE && npm install && npm run dev -- --host   # site on :5173, proxies /api to :8080
```
Open `http://localhost:5173` on the laptop (freelancer). Open the client link on a phone on the same Wi-Fi by replacing `localhost` with the laptop's LAN IP (Vite prints it).

**Seed for recording:** `go run ./cmd/server -seed-demo` creates the salon project in setup state and prints its owner link, so the video starts clean.

**Real-user test (18 Oct) — temporary public link:**
```sh
cd scopematch_FE && npm run build
cd ../scopematch_BE && go run ./cmd/server -static ../scopematch_FE/dist
cloudflared tunnel --url http://localhost:8080   # prints a temporary https URL
```
The Go server serves the built website and the API on one port. Requires installing `cloudflared` (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/). Links stop working when the tunnel stops.

**Submission:** demo video + public GitHub repo (required). Permanent deployment is optional, decided in `6-ship`; the single-binary + SQLite shape fits a small VM/container host if wanted.

## Look and Feel
Carries `prd.md > Look and Feel` ("two inks on contract paper").

**Tokens** (`scopematch_FE/src/styles/tokens.css`):
- `--paper: #F4EFE4` background; `--paper-deep: #EAE2D2` panels; `--rule: #D6CCB8` hairlines.
- `--ink: #1B1A17` text and the AGREED stamp; `--ink-soft: #5E5A52` secondary text.
- `--ink-freelancer: #233F94` (deep blue); `--ink-client: #D9472B` (vermilion).
- `--highlight: rgba(217, 71, 43, 0.18)` highlighter stroke on brief sentences.
- Status: Same answer = ink check mark; Needs discussion = split blue/vermilion edge; Needs clarification = dashed pencil-grey outline. No green/yellow/red traffic-light palette.
- Light theme only (paper metaphor); dark mode deferred.

**Type:** Fraunces for headings (optical size up, slightly soft); Instrument Sans for body/UI; JetBrains Mono for clause numbers (`§ 1 Booking`), timestamps, version labels (`v2 · 15 Oct 14:02`). Generous line height, document-like column width (~68ch) on desktop.

**Surface:** paper with faint ruled lines, thin borders, almost no shadows; cards look like index cards, not rounded SaaS tiles (radius ≤ 4px). Buttons are ink-outlined or solid ink.

**Motion (Motion for React):**
- *Sealed → reveal:* both answer cards start face-down (stamped "SEALED"), then flip on Y axis together (~600 ms, slight stagger between cards).
- *Highlighter:* hovering/focusing a card animates a background stroke under its source sentence (`background-size` 0→100%).
- *AGREED stamp:* scales from 1.6 to 1 with −8° rotation and a 1-frame settle; faint ink-bleed opacity.
- *Proposal swap:* old proposal slides out with strike-through, new one slides in.
- `useReducedMotion()` → replace flips/stamps with opacity fades.

**Copy tone:** plain, calm, specific ("Sealed. Waiting for Maya."), no hype, no "AI".

**Avoid:** gradients, glass blur, glow, emoji icons, uniform rounded card grids, decorative blobs.

## Components

### Backend

#### HTTP server and routing
`cmd/server/main.go` wires flags (`-addr`, `-db`, `-static`, `-seed-demo`), opens the database, registers routes, sets `Referrer-Policy: no-referrer`, serves the SPA from `-static` with fallback to `index.html`.

#### Token auth middleware
Implements `prd.md > Links and access`.
Reads `Authorization: Bearer <token>`, hashes it (SHA-256), looks up `access_tokens` → puts `{projectID, role}` in the request context; otherwise `401 {"error":"invalid_link"}`. Tokens: 32 random bytes, base64url. Only hashes are stored. Owner-only routes check `role == owner` → `403`.

#### Card library and brief matching
Implements `prd.md > Scenario cards`.
`library/cards.json` embedded with `go:embed`: cards §1–§4 from the PRD, each option with `label`, `included[]`, `excluded[]`, `clientResponsibilities[]`, `acceptanceCriteria[]`, and (booking only) `preview` steps. Matching: split brief into sentences, lowercase, word-prefix match against card keywords; returns `{cardId, sentenceIndex, start, end}`. §4 always suggested. Deterministic — never labelled AI.

#### Project service
Implements `prd.md > Creating a project`, `prd.md > Scenario cards`.
Create (validates non-empty name/brief → `422` with field errors), set cards (owner, only before lock, ≥1 card), lock (creates client token once; idempotent). The client token is HMAC-SHA256 of a fixed domain label keyed by the authenticated random owner token; repeated locks restore the same invite while only token hashes are stored.

#### Answer service and reveal gate
Implements `prd.md > Answering separately`, `prd.md > Compare`.
Saves draft answers per role; submit validates every card answered and "Something else" text non-empty, then sets `submitted_at` (sealed: later writes → `409 sealed`). **Session view builder** is the single place that decides what each role sees: own answers always; other party's answers only when both `submitted_at` are set. Compare statuses computed server-side.

#### Resolution service
Implements `prd.md > Resolving differences`.
Rules in one transaction:
- New proposal on a card → mark previous active proposal inactive (its confirmations go with it) → insert new, `confirmed_by_owner/client` set for the proposer.
- "Not sure yet" option rejected (`422`).
- Same answer → inside the transaction where the second party submits, server creates a system proposal for each same-answer card with the shared option and **no** confirmations.
- Confirm → only a party that hasn't confirmed yet (for a system proposal, both may confirm); card is Decided when both timestamps are set on the active proposal. The proposal ID in the path must belong to the token's project and be active, otherwise `404` — proposal IDs never give cross-project access.
- Proposals and confirmations rejected after Agreed (`409`).

#### Scope versions and confirmation
Implements `prd.md > Scope review and confirmation`.
Draft assembly from decided options (union of included/excluded/responsibilities/criteria; custom-text decisions go into Included as written). Save version (owner, only when all cards Decided) → new row `version = max+1`, which leaves previous versions' confirmations attached to old versions only (effectively resetting). Confirm (`version` from the path, `{name}` in the body, name required) → rejected with `409 not_latest` unless it is the latest version; a role can confirm a version only once. When both roles confirmed the latest version → `projects.agreed_version = n`, everything locked. Each saved snapshot also freezes the per-card decision text and active proposal IDs. Reopening a decision makes existing scope versions stale: they stay in history but cannot be confirmed, even after the card is re-decided. A fresh version must be sent. Session scope metadata includes latest confirmation timestamps so polling updates both screens.

#### Markdown export
Implements `prd.md > Export`.
Renders the stored `agreed_version` row only (`404` if not agreed). Includes project name, brief, per-card decision, summary sections, version, confirmation names/times with "(recorded, not identity-verified)". `Content-Disposition: attachment; filename="scopematch-<slug>-v<n>.md"`.

#### Demo seed
`-seed-demo` inserts the salon project (brief from `scope.md > What "Working" Looks Like`) in setup state and prints the owner link.

### Frontend

#### App shell and routes
- `/` → Projects
- `/new` → New project form
- `/o/:token` → Owner workspace with stage tabs (Setup · Answer · Compare · Scope)
- `/c/:token` → Client view (Answer → Compare → Scope, whichever stage applies)
- Bad token → "This link isn't valid" page.

#### API client
`src/api/client.ts`: `fetch` wrapper that adds the bearer token taken from the route; typed responses; maps `401` to the invalid-link page. While waiting for the other party, polls `GET /api/session` every 4 s (stops when stage changes or tab hidden).

#### Projects page
Implements `prd.md > Screens and Layout` (Projects).
Reads `localStorage["scopematch.projects"]` (list of `{ownerToken, name}`, read/write wrapped in try/catch), fetches each session for stage and counts. Empty state + New project.

#### Setup: BriefPanel and CardPicker
Implements `prd.md > Scenario cards`.
BriefPanel renders the brief with `<mark>` spans from match offsets; highlighter animation driven by the hovered/focused card. CardPicker shows suggested + library cards, toggles, "Lock questions & get links", then LinksPanel with copy buttons.

#### AnswerFlow
Implements `prd.md > Answering separately`.
Phone: one card per screen with progress `2 of 4`; desktop: stacked list. Large option buttons; "Something else" reveals a text field. Submit → SealedState ("Sealed. Waiting for <name>.").

#### CompareBoard
Implements `prd.md > Compare`, `prd.md > Resolving differences`.
Per card: `AnswerCard` pair (blue/vermilion, flip reveal on first view — remembered per project in local storage so it plays once), `StatusTag`, `BookingPreview` (static steps from the library), `ProposalBox` (propose option/custom text + why, confirm, counter-propose). Header counter "2 of 4 decided".

#### ScopeDocument
Implements `prd.md > Scope review and confirmation`, `prd.md > Export`.
Owner: editable sections (textarea per list) + "Send for confirmation". Both: version label, confirmation form (name), confirmation records, AgreedStamp animation, Download Markdown.

## Data Model
SQLite, created on startup by `store/migrate.go`. All times UTC ISO-8601.

```sql
projects(id TEXT PK, name, freelancer_name, client_name, brief,
         locked_at NULL, agreed_version INTEGER NULL, created_at)
access_tokens(token_hash TEXT PK, project_id FK, role TEXT CHECK(role IN ('owner','client')))
project_cards(project_id FK, card_id, position, matched_sentence NULL,
              PRIMARY KEY(project_id, card_id))
participants(project_id FK, role, submitted_at NULL, PRIMARY KEY(project_id, role))
answers(project_id FK, role, card_id, option_id, custom_text NULL, updated_at,
        PRIMARY KEY(project_id, role, card_id))
proposals(id TEXT PK, project_id FK, card_id, proposed_by TEXT /* owner|client|system */,
          option_id NULL, custom_text NULL, why NULL, active INTEGER,
          confirmed_by_owner_at NULL, confirmed_by_client_at NULL, created_at)
scope_versions(project_id FK, version INTEGER, summary_json, created_at,
               owner_confirm_name NULL, owner_confirmed_at NULL,
               client_confirm_name NULL, client_confirmed_at NULL,
               PRIMARY KEY(project_id, version))
```

**Stage** is derived, never stored: `setup` (not locked) → `answering` → `compare` (both submitted, not all decided) → `review` (all decided, not agreed) → `agreed`.

**Where each piece lives / what happens on return:**
- Projects, answers, proposals, versions → SQLite on the server; reloading or switching devices shows the same state.
- Owner links list → browser local storage; convenience only, other devices use the owner link.
- Unsaved summary edits → component state only; lost on reload (acceptable for PoC).
- "Reveal already played" flag → local storage.

## File Structure
```
scopematch/
├── README.md                     # what it is, how to run, demo steps
├── LICENSE
├── .gitignore
├── devpost/                      # Skill Pack planning docs
├── scopematch_BE/
│   ├── go.mod
│   ├── cmd/server/main.go        # flags, wiring, static SPA serving, demo seed
│   ├── internal/
│   │   ├── api/                  # HTTP handlers, JSON in/out, error mapping
│   │   │   ├── routes.go
│   │   │   ├── middleware.go     # token auth, role checks
│   │   │   └── *_test.go         # httptest end-to-end rule tests
│   │   ├── library/
│   │   │   ├── cards.json        # curated scenario cards (embedded)
│   │   │   └── match.go          # brief sentence matching
│   │   ├── scope/                # domain rules: reveal gate, statuses, proposals,
│   │   │   ├── session.go        #   versions, agreed check, markdown export
│   │   │   ├── resolve.go
│   │   │   ├── versions.go
│   │   │   └── export.go
│   │   └── store/                # SQLite access + migrations
│   │       ├── migrate.go
│   │       └── store.go
│   └── data/                     # scopematch.db (gitignored)
└── scopematch_FE/
    ├── package.json
    ├── vite.config.ts            # /api proxy → :8080
    ├── index.html
    └── src/
        ├── main.tsx, App.tsx     # routes
        ├── api/client.ts         # typed fetch + polling
        ├── styles/tokens.css     # palette, type, spacing
        ├── styles/global.css     # paper background, ruled lines
        ├── pages/                # ProjectsPage, NewProjectPage, OwnerWorkspace,
        │                         #   ClientView, InvalidLinkPage
        └── components/           # BriefPanel, CardPicker, LinksPanel, AnswerFlow,
                                  #   SealedState, CompareBoard, AnswerCard, StatusTag,
                                  #   BookingPreview, ProposalBox, ScopeDocument, AgreedStamp
```

## API Contract
All JSON. `Authorization: Bearer <token>` on everything except `POST /api/projects` and `GET /api/library`.

| Method & path | Role | Body → Response |
|---|---|---|
| `POST /api/projects` | — | `{name, freelancerName, clientName, brief}` → `{ownerToken}` |
| `GET /api/library` | — | `{cards:[…]}` |
| `GET /api/session` | both | `{role, stage, project:{name, brief, freelancerName, clientName}, cards:[{id, matched}], me:{answers, submitted}, other:{name, submitted, answers?}, compare?:[{cardId, status, proposal}], scope?:{latestVersion, agreedVersion}}` — `other.answers` and `compare` present only when both submitted |
| `PUT /api/project/cards` | owner | `{cardIds:[…]}` → session |
| `POST /api/project/lock` | owner | → `{clientToken}` |
| `PUT /api/answers` | both | `{answers:[{cardId, optionId, customText?}]}` → session |
| `POST /api/answers/submit` | both | → session |
| `POST /api/cards/{cardId}/proposals` | both | `{optionId?, customText?, why?}` → session |
| `POST /api/proposals/{id}/confirm` | both | → session |
| `GET /api/scope/draft` | owner | → `{summary}` assembled from decisions |
| `POST /api/scope/versions` | owner | `{summary}` → `{version}` |
| `GET /api/scope` | both | `{versions:[…latest first], agreedVersion}` |
| `POST /api/scope/versions/{n}/confirm` | both | `{name}` → `{version, agreed}` |
| `GET /api/scope/export.md` | both | Markdown file |

Errors: `{"error": "<code>", "fields"?: {…}}` with `401 invalid_link`, `403 owner_only`, `409 sealed|locked|not_latest|agreed`, `422 validation`.

## External Services and Dependencies
None at runtime: no APIs, no keys, no paid services. Optional `cloudflared` quick tunnel for the real-user test (free, no account for quick tunnels; temporary URL). npm/Go module downloads at setup only.

## Verification
Go tests (`go test ./...`) cover the handoff's critical checks:
1. Client token cannot read/modify another project; a random token → 401; client cannot call owner routes → 403.
2. Before both submit, `GET /api/session` for either role contains no other-party answers (assert on raw JSON).
3. Statuses: same / different / not-sure / something-else map correctly.
4. New proposal cancels confirmations of the old one; "Not sure" can't be proposed.
5. Saving a new scope version after a confirmation → agreed requires both confirmations on the new version.
6. Agreed impossible while any card undecided.
7. Export bytes match the stored agreed version; edits after agreed rejected.
8. Empty brief/name → 422; sealed answers can't change.

Manual: full demo flow laptop + phone; phone width has no horizontal scroll; reduced-motion setting replaces flips.

## Important Failure Modes
- **Phone can't reach the laptop (different network/firewall)** → use the `-static` + tunnel path; README documents both.
- **Two people confirm at the same moment (SQLite write lock)** → single DB connection + `busy_timeout`, all rule changes in transactions; the loser simply sees the updated state.
- **Owner link lost** → not recoverable in the PoC; LinksPanel says "Save this link — it's the only way back in."
- **Flip/stamp animation stutters on a low-end phone** → transforms only (no layout animation on those), and reduced-motion fallback.

## What Was Simplified and Why
- **SQLite file** instead of PostgreSQL — no Docker or service to keep running; the fuller version would add a Postgres container and connection config.
- **Secret owner/client links** instead of accounts — accounts don't prove the kernel; the fuller version needs login, sessions, email recovery.
- **Polling every 4 s while waiting** instead of realtime push — same visible outcome for a two-person flow; realtime would need websockets.
- **Card library in a code file** instead of an editable admin library — four cards prove the idea.
- **Static booking preview** instead of a simulator — agreed in scope.
- **Cards locked after invite** instead of versioned questions — agreed in PRD.

## Decisions and Open Issues
- **Stack React + Vite + TS, Go** — learner's choice (handoff).
- **SQLite instead of PostgreSQL** — agent recommendation, learner accepted ("lanjut"). Tradeoff: no Postgres showcase.
- **Local-first; tunnel for the real-user test; deploy decided in `6-ship`** — agent recommendation, learner accepted.
- **Plain CSS tokens + Motion for React** — implementation detail derived from the Look and Feel direction.
- **Token-scoped API without project IDs in paths** — implementation detail derived from `prd.md > Links and access`.
- **Learner uncertainty:** none identified — the learner moved on without naming one. If a question comes up during the build (e.g., how the reveal gate works), record it here.
- **Open (from PRD):** card wording for §2–§4 is agent-proposed; real-user test pair needed by 18 Oct. Neither blocks the build.
- **Package versions:** verified 15 Oct 2026 (see Stack).
- **Owner link at creation, not at lock** — deviation from the first PRD wording, so the freelancer can return during setup; PRD updated to match.

## Sharing and submission status

Build review and the concise learning recap are complete. `devpost/shipping.md` records current official requirements, the local silent demo video, publication audit, and remaining learner-owned steps. The learner authorized public repository creation and pushing the audited history. Repository: https://github.com/fadillaoegi/scopematch, using the authenticated account `fadillaoegi`; push and anonymous-access verification are recorded in `shipping.md`. No public video URL, deployment, or Devpost submission has been created. External video upload and submission remain pending.
