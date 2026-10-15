---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast (agent recommendation, learner accepted with "lanjut")

## Slices

- [x] **1. Freelancer creates a project and sees the brief with matched scenario cards**
  Becomes usable: Running site + server. New project form → Setup screen on paper-and-ink styling shows the brief with highlighted matched sentences and suggested cards §1–§4; reload keeps it.
  Why now: Bootstraps both apps, the database, token auth, and the design tokens on a real behavior; proves the deterministic matching the whole flow depends on.
  PRD ref: `prd.md > Creating a project`, `prd.md > Scenario cards`, `prd.md > Look and Feel`
  Spec ref: `spec.md > File Structure`, `spec.md > Stack`, `spec.md > Look and Feel`, `spec.md > Token auth middleware`, `spec.md > Card library and brief matching`, `spec.md > Project service`, `spec.md > Setup: BriefPanel and CardPicker`, `spec.md > Data Model`
  Build: Scaffold `scopematch_BE` (Go module, `cmd/server`, store + migrations, routes `POST /api/projects`, `GET /api/library`, `GET /api/session`, `PUT /api/project/cards`) and `scopematch_FE` (Vite React-TS, router, API client, tokens.css/global.css, fonts, NewProjectPage, OwnerWorkspace Setup tab with BriefPanel highlighter + CardPicker). Embed `cards.json` with §1–§4.
  Verify (mechanical): `go test ./...` passes tests for create validation (empty name/brief → 422), salon brief → §1–§4 matched with correct sentences, no-match brief → only §4, random token → 401; `npm run build` succeeds; dev servers start and `curl` create + session round-trip works.
  Learner check: Open `http://localhost:5173/new`, paste the salon brief, create the project, hover each card and watch its sentence highlight in the brief, then reload the page — the project is still there.
  Commit: `Create projects with brief matching and setup screen`

- [x] **2. Both sides answer separately and their answers stay sealed**
  Becomes usable: Freelancer locks questions and gets the client link; freelancer (laptop) and client (phone/second browser) each answer and submit; each sees "Sealed. Waiting for …" and nothing of the other's answers.
  Why now: This is the kernel's first half and the highest-risk rule (server-side hiding + role-limited links); it must be proven before anything builds on it.
  PRD ref: `prd.md > Links and access`, `prd.md > Answering separately`
  Spec ref: `spec.md > Token auth middleware`, `spec.md > Answer service and reveal gate`, `spec.md > AnswerFlow`, `spec.md > API Contract`
  Build: Lock endpoint + client token, LinksPanel, answers save/submit with sealing, session view builder that omits other-party answers until both submitted, ClientView route, AnswerFlow (one card per screen on phone, "Something else" text, "Not sure yet"), SealedState with 4 s polling.
  Verify (mechanical): `go test ./...` covers spec Verification #1 (cross-project and owner-only access), #2 (raw session JSON has no other-party answers before both submit), #8 (sealed answers can't change; "Something else" needs text); manual two-browser run shows waiting states.
  Learner check: Lock the salon project, open the client link in a private window or on your phone, answer differently on each side, submit both, and confirm neither side could see the other's choices before the second submit.
  Commit: `Add client link and sealed independent answers`

- [x] **3. The reveal: Compare shows where you differ**
  Becomes usable: After both submit, both sides see Compare — sealed cards flip together, each card tagged Same answer / Needs discussion / Needs clarification, counts in the header, booking card shows the static customer-view preview for A/B/C.
  Why now: The "oh" moment of the demo and the kernel's second half; getting the design right here shapes everything after, so the early checkpoint follows this slice.
  PRD ref: `prd.md > Compare`, `prd.md > Look and Feel`
  Spec ref: `spec.md > Answer service and reveal gate`, `spec.md > CompareBoard`, `spec.md > Look and Feel`
  Build: Server-side compare statuses in the session; CompareBoard with AnswerCard flip (Motion, reduced-motion fade, play-once flag), StatusTag, BookingPreview from library preview steps, decided counter.
  Verify (mechanical): `go test ./...` covers spec Verification #3 (status mapping); `npm run build` passes; manual run shows flip once and fade with reduced motion enabled.
  Learner check: With the project from slice 2, watch the reveal on both screens; check that the booking card shows "Needs discussion" with the A and C previews, and tell me how the motion and look feel.
  Commit: `Reveal answers on Compare with statuses and booking preview`

- [x] **4. Settle each difference with proposals and confirmations**
  Becomes usable: Either side proposes a decision (option or custom text + why); the other confirms or counter-proposes; same answers need one tap from each; cards turn Decided.
  Why now: Builds directly on Compare and is the most rule-heavy part of the server; doing it before the summary keeps the summary built on real decisions.
  PRD ref: `prd.md > Resolving differences`
  Spec ref: `spec.md > Resolution service`, `spec.md > CompareBoard`, `spec.md > API Contract`
  Build: Proposal create/confirm endpoints with replace-and-cancel rules, system proposals for same answers inside the submit transaction, project-scoped proposal lookup, ProposalBox UI with strike-through swap animation.
  Verify (mechanical): `go test ./...` covers spec Verification #4 (new proposal cancels old confirmations; "Not sure" rejected; foreign proposal ID → 404; Decided only when both confirmed).
  Learner check: Propose B on the booking card as freelancer, counter-propose from the client, then agree on B — watch the card become Decided and the counter go up.
  Commit: `Add proposals, counter-proposals, and confirmations`

- [ ] **5. Confirm one scope version, stamp it AGREED, export Markdown**
  Becomes usable: When all cards are Decided, freelancer reviews/edits the summary, sends v1; both confirm with their names; AGREED stamp lands; both can download the Markdown file.
  Why now: Closes the core journey end to end; depends on decided cards from slice 4.
  PRD ref: `prd.md > Scope review and confirmation`, `prd.md > Export`
  Spec ref: `spec.md > Scope versions and confirmation`, `spec.md > Markdown export`, `spec.md > ScopeDocument`
  Build: Draft assembly from decided options, versions save/confirm, agreed lock, export endpoint; ScopeDocument (editable sections for owner, confirmation form, records labelled "recorded, not identity-verified"), AgreedStamp animation, download button.
  Verify (mechanical): `go test ./...` covers spec Verification #5 (edit after a confirmation → new version, both must confirm it), #6 (no agreed while undecided), #7 (export equals stored agreed version; writes after agreed → 409).
  Learner check: Finish the salon project: edit one summary line, send it, confirm on both sides, watch the stamp, and open the downloaded `.md` to check it matches the screen.
  Commit: `Add versioned scope confirmation, AGREED stamp, and export`

- [ ] **6. Ready to demo: Projects list, bad links, phone polish, run docs**
  Becomes usable: Projects home lists this device's projects with stage and counts; invalid links show a safe page; client screens fit phone width; `-seed-demo` and `-static` work; README explains running and the demo.
  Why now: Wraps the working journey for recording and the real-user test without changing the kernel.
  PRD ref: `prd.md > Screens and Layout`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Projects page`, `spec.md > App shell and routes`, `spec.md > Demo seed`, `spec.md > Where It Runs and How Someone Tries It`, `spec.md > Important Failure Modes`
  Build: ProjectsPage with empty state, InvalidLinkPage, responsive pass on all client screens, `-seed-demo`, `-static` SPA serving with fallback, root README (what it is, run steps, demo steps, tunnel steps), LICENSE.
  Verify (mechanical): `go test ./...` and `npm run build` pass; `go run ./cmd/server -static ../scopematch_FE/dist -seed-demo` serves the site on :8080 and prints an owner link that opens; browser check at 375px width shows no horizontal scroll.
  Learner check: Start fresh with `-seed-demo`, run the whole demo flow from the README with laptop + phone, and try a broken link.
  Commit: `Add projects home, invalid link page, demo seed, and run docs`

## Hands-on Checkpoints

- [x] Early usable behavior explored — after slice 3 (reveal + design direction). Learner accepted the checkpoint and requested continuation with "oke lanjut".
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence:
Route and stops:
Edit outcome:
Reflection:
Activity mode:

## Revisions

- Brief matches computed from the brief on each read instead of stored in `project_cards.matched_sentence`; session also returns `matches` for all cards — unselected cards need provenance too.

- Slice 2: client invites are derived with HMAC from the authenticated owner secret, allowing idempotent lock/recovery without storing plaintext tokens. Client and owner use a shared workspace shell with role-specific access and navigation.
- Slice 2 verification: Go API tests and production frontend build passed; isolated Chrome desktop/mobile sessions exercised create → lock → answer (including custom text) → seal → reload. Raw client session omitted freelancer answers before the second submission. Mobile width 390px had no horizontal overflow; screenshots inspected. Learner checkpoint remains after slice 3.

- Resume audit: Claude stopped at commit `ab30dd2` after slice 1 because of a usage limit. Approved plans and fast mode were preserved; no uncommitted work existed at handoff.
- Slice 3 verification: all 25 pairs of concrete/custom/unsure answers pass API status tests, with Compare and counts omitted until both submit; matching answers remain 0 decided. `go test ./...`, `go vet ./...`, and `npm run build` pass. Isolated desktop/mobile Chrome sessions verified automatic reveal through polling, booking previews A/B/C, custom answers, one-time reveal after reload, and reduced-motion fade. Screenshots inspected; Setup and Compare have no overflow at 375px. Browser harness and dummy database are under `/private/tmp`, outside the repository.
- Checkpoint after slice 3: local freelancer/client Compare links provided; learner responded "oke lanjut" with no requested changes. Continue from slice 4.

- Slice 4: proposal replacement, project isolation, same-answer system proposals, explicit dual confirmation, and reopened decisions pass API tests; frontend production build passes. Startup backfills unconfirmed system proposals for matching answers on projects revealed before this feature.
