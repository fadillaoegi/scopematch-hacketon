# ScopeMatch

Two people read the same brief. They rarely picture the same thing.

ScopeMatch helps a freelancer and a small-business client answer the same scope questions independently, reveal differences, and confirm one exportable scope before work starts. The proof of concept uses four curated scenarios: booking, languages, editable content, and launch content.

## What works

- Paste a brief, see deterministic keyword matches, and select relevant questions.
- Lock the questions and share a separate private client link; no account required.
- Answer independently. The server omits the other person's answers until both submit; submitted answers are sealed.
- Compare with **Same answer**, **Needs discussion**, and **Needs clarification**, plus static booking previews.
- Propose, counter-propose, and confirm decisions. Matching answers still need both confirmations.
- Edit the assembled scope, send a saved version, and confirm that exact version with names and timestamps.
- Stamp the scope **AGREED**, lock changes, and download the stored version as Markdown.

Confirmation records are labelled **recorded, not identity-verified**. Booking previews contain sample data; they do not make reservations. Brief matching uses a fixed library, with no runtime AI service or API key.

## Run locally

Requirements: **Go 1.26.3** and **Node 24** with npm. Dependencies are locked in `go.sum` and `package-lock.json`.

Development, in two terminals from the repository root:

```sh
cd scopematch_BE
go run ./cmd/server
```

```sh
cd scopematch_FE
npm ci
npm run dev -- --host
```

Open <http://localhost:5173>. Vite forwards `/api` to the Go server on port 8080. Fonts are self-hosted; no external service is needed once dependencies are installed.

### One server, including the website

```sh
cd scopematch_FE
npm ci
npm run build
cd ../scopematch_BE
go run ./cmd/server -static ../scopematch_FE/dist
```

Open <http://127.0.0.1:8080>. Direct owner/client links and reloads work through the SPA fallback. Stop the server with Ctrl+C.

### Start a fresh demo project

After building the frontend:

```sh
cd scopematch_BE
go run ./cmd/server -static ../scopematch_FE/dist -db data/demo.db -seed-demo
```

The terminal prints the private freelancer link for a new salon project in Setup. Every `-seed-demo` run adds a new project; it does not erase existing projects. Opening that link also remembers the project in this browser.

Flags: `-addr :8080`, `-db data/scopematch.db`, `-static <built-directory>`, and `-seed-demo`. If port 8080 is occupied, the built-site command can use `-addr :8081`; the printed demo link follows that port.

## Try the core journey

1. Create a project using **Use the salon example**, or open the printed demo link. Keep the four suggested questions and select **Lock questions & get links**. Save the freelancer link; share only the client link.
2. Open the client link in a separate browser/private window. As freelancer choose **A — Open WhatsApp** for Booking; as client choose **C — Reserve immediately**. Choose A for the other questions on both sides.
3. Seal the freelancer answers first: the freelancer waits and the client cannot see those answers. Seal the client answers. Compare appears automatically, with the A/C booking previews and **Needs discussion**.
4. Propose **B — Submit a request for staff approval** for Booking; the other person confirms. For each matching-answer question, both people select **Confirm decision**. Counter-proposals are also supported and replace earlier confirmations.
5. At **4 of 4 decided**, the freelancer selects **Review scope**, edits any summary item, and selects **Send for confirmation**.
6. Both people review the same version and confirm with their names. **AGREED** appears. Download Markdown and check that it matches the saved scope.
7. To exercise versioning before agreement: confirm as one person, edit as a new version, then confirm that new version on both sides. Reopening a decision also requires a fresh scope version.

The reveal plays once per private link in a browser. Use a fresh private window/project to replay it. Reduced-motion settings replace the flip and stamp motion with fades. Try `/c/not-a-valid-token` to see the invalid-link page.

## Use a phone

With the laptop and phone on the same Wi-Fi, use the laptop's LAN address instead of `localhost` in the client link. For the development server, Vite prints its network address when started with `--host`. The built Go server listens on all interfaces by default. Keep the port and `/c/<token>` path when replacing the address.

For a temporary public test, run the built-site command, install [cloudflared](https://developers.cloudflare.com/tunnel/downloads/), and in another terminal run:

```sh
cloudflared tunnel --url http://127.0.0.1:8080
```

Open the printed HTTPS address before creating a project, so copied links use that address. For an existing project, replace only the origin, preserving `/o/<token>` or `/c/<token>`. The temporary hostname changes on a new tunnel and stops working when the tunnel stops. See [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

## Checks

```sh
cd scopematch_BE
go test ./...
go vet ./...
```

```sh
cd scopematch_FE
npm run build
```

Backend tests exercise token/role isolation, the server-side reveal gate, all 25 answer-pair statuses, proposal replacement, two-party decisions, version resets, stale-decision rejection, concurrent confirmations, immutable agreed exports, validation, and static serving.

## Code and data

- `scopematch_FE/src/pages/OwnerWorkspace.tsx`: role-specific navigation and project stages.
- `scopematch_FE/src/components/`: answers, Compare, proposals, versioned scope, and motion.
- `scopematch_BE/internal/scope/`: product rules, response visibility, versions, and Markdown export.
- `scopematch_BE/internal/store/`: SQLite access and idempotent startup schema.
- `scopematch_BE/internal/library/cards.json`: curated questions, option scope text, and booking previews.
- `devpost/`: approved scope, PRD, technical spec, and build checklist.

Projects and all agreement records live in the SQLite file on the server. The Projects list stores owner links in this browser's local storage; it is a convenience, not a login or backup. Losing the private owner link loses freelancer access. Keep the database file and owner link to resume later.

The proof of concept is one freelancer and one client per project, with no accounts, chat, notifications, payments, or editing an agreed scope. Final user review and submission preparation are tracked separately in `devpost/checklist.md`.

## License

Project code is available under the [MIT License](LICENSE). Dependencies and fonts retain their own licenses.
