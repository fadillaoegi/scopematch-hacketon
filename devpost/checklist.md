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

- [x] **5. Confirm one scope version, stamp it AGREED, export Markdown**
  Becomes usable: When all cards are Decided, freelancer reviews/edits the summary, sends v1; both confirm with their names; AGREED stamp lands; both can download the Markdown file.
  Why now: Closes the core journey end to end; depends on decided cards from slice 4.
  PRD ref: `prd.md > Scope review and confirmation`, `prd.md > Export`
  Spec ref: `spec.md > Scope versions and confirmation`, `spec.md > Markdown export`, `spec.md > ScopeDocument`
  Build: Draft assembly from decided options, versions save/confirm, agreed lock, export endpoint; ScopeDocument (editable sections for owner, confirmation form, records labelled "recorded, not identity-verified"), AgreedStamp animation, download button.
  Verify (mechanical): `go test ./...` covers spec Verification #5 (edit after a confirmation → new version, both must confirm it), #6 (no agreed while undecided), #7 (export equals stored agreed version; writes after agreed → 409).
  Learner check: Finish the salon project: edit one summary line, send it, confirm on both sides, watch the stamp, and open the downloaded `.md` to check it matches the screen.
  Commit: `Add versioned scope confirmation, AGREED stamp, and export`

- [x] **6. Ready to demo: Projects list, bad links, phone polish, run docs**
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
- [x] Final review feedback accepted — learner replied "lanjut" to the final readiness question with no requested fixes. Browser exploration evidence above is agent verification; no detailed hands-on learner report was supplied.

## Final Review

- [x] Final review complete — final-readiness prompt accepted with "lanjut"; no further changes requested before shipping preparation.

## Code Tour and App Map

- [x] Learning activity complete — brief evidence-based recap of the server response boundary, its API test, and a reusable verification practice; no interactive tour or learner mastery claimed.
- [x] Optional edit and transfer reflection addressed — not applicable to the concise recap route; code pointers remain available in the reference map.
- [x] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse — offline reference map checked and shown; recap route used instead of an interactive tour

Activity and evidence: Brief recap delivered after final review acceptance: AnswerFlow.submit → scope.Submit → buildSession; TestAnswersStaySealedUntilBothSubmit checks that other.answers and secret custom text are absent before both submit. Connected this project guarantee to testing observable server responses. Map paths/anchors verified and offline desktop/375px checks passed with JavaScript disabled.
Route and stops: Reference route, not an interactive tour: AnswerFlow.submit → scope.Submit → buildSession/CompareBoard.
Edit outcome: No learner edit requested or performed; not applicable to recap route. Cosmetic-change pointers are in the map.
Reflection: No learner reflection supplied; no claim about learning made. Optional reflection does not gate shipping.
Activity mode: Brief evidence-based recap plus offline reference map.

## Revisions

- Brief matches computed from the brief on each read instead of stored in `project_cards.matched_sentence`; session also returns `matches` for all cards — unselected cards need provenance too.

- Slice 2: client invites are derived with HMAC from the authenticated owner secret, allowing idempotent lock/recovery without storing plaintext tokens. Client and owner use a shared workspace shell with role-specific access and navigation.
- Slice 2 verification: Go API tests and production frontend build passed; isolated Chrome desktop/mobile sessions exercised create → lock → answer (including custom text) → seal → reload. Raw client session omitted freelancer answers before the second submission. Mobile width 390px had no horizontal overflow; screenshots inspected. Learner checkpoint remains after slice 3.

- Resume audit: Claude stopped at commit `ab30dd2` after slice 1 because of a usage limit. Approved plans and fast mode were preserved; no uncommitted work existed at handoff.
- Slice 3 verification: all 25 pairs of concrete/custom/unsure answers pass API status tests, with Compare and counts omitted until both submit; matching answers remain 0 decided. `go test ./...`, `go vet ./...`, and `npm run build` pass. Isolated desktop/mobile Chrome sessions verified automatic reveal through polling, booking previews A/B/C, custom answers, one-time reveal after reload, and reduced-motion fade. Screenshots inspected; Setup and Compare have no overflow at 375px. Browser harness and dummy database are under `/private/tmp`, outside the repository.
- Checkpoint after slice 3: local freelancer/client Compare links provided; learner responded "oke lanjut" with no requested changes. Continue from slice 4.

- Slice 4: proposal replacement, project isolation, same-answer system proposals, explicit dual confirmation, and reopened decisions pass API tests; frontend production build passes. Startup backfills unconfirmed system proposals for matching answers on projects revealed before this feature.

- Slice 5: frozen scope snapshots include decision text and proposal IDs; a replaced decision invalidates pending versions until a new version is sent. API tests cover old-version rejection, confirmation reset, undecided/replaced decisions, simultaneous confirmations, deterministic stored export, role restrictions, and locked writes after agreement. Go tests, vet, and frontend build passed. Real isolated desktop/mobile browser sessions completed counter-proposals → 4/4 decisions → edited v1 → one confirmation → revised v2 → both confirmations → AGREED; the actual downloaded Markdown matched export bytes. Reload kept the agreed scope locked; screenshots inspected and no horizontal overflow/runtime errors observed.

- Slice 6: Projects reads live stage/counts and remembers opened owner links; malformed or unavailable local storage is tolerated. Question-library fetch retries instead of hanging on failure. Added seed-demo startup, static-build validation, missing-asset 404, strict single-JSON-body parsing, SQLite sidecar ignores, README demo/LAN/tunnel instructions, and MIT license. Markdown export reads only the stored agreed snapshot and records.
- Final mechanical verification: Go tests and vet plus production frontend build pass. Real browser journey repeated on final build through counter-proposals, same-answer/custom decisions, revised v2, dual agreement, actual Markdown download, and live Agreed project listing. Additional 375px checks passed for fresh seed setup, bad/wrong-role links, corrupted/invalid/unavailable storage, library-request failure/retry, maximum-length unbroken input, and reduced-motion agreed scope. Screenshots inspected. No public tunnel or publication was started.
- Implementation is complete through slice 6. Final hands-on exploration, explicit readiness confirmation, and the learning wrap-up remain pending; do not mark final review or invoke 6-ship until they are complete.

- Final review requested with links to a fresh setup project and an agreed example. Await learner observations and explicit readiness before marking Final Review complete. The offline app map is prepared as a reference, not recorded as a completed learning activity.
- Final UI correction: outdated scope versions no longer show the "waiting for the other person" prompt; they retain the stale-version notice and historical confirmation records. Frontend build passed after this correction.

- Build closeout: learner accepted final readiness and requested continuation with "lanjut". Concise recap delivered, map retained as a reference route, and 5-build complete. Proceed to 6-ship; repository/video publication and Devpost submission remain separate actions.

- Shipping preparation: existing Go tests/vet and frontend production build passed again. A 105-second silent 1080p recording of the real salon workflow was captured with isolated browser sessions; video/upload and repository publication remain pending. See `shipping.md` for artifacts and current requirements.

- Publication authorization: learner replied "lanjut" to the explicit public-repository and history-push question. Existing Git credential helper authenticated `fadillaoegi`; created public repository `https://github.com/fadillaoegi/scopematch-hacketon` and configured its HTTPS remote. No credentials included in project files.

- Repository published: branch `main` pushed to https://github.com/fadillaoegi/scopematch-hacketon. Anonymous GitHub API reported public visibility and the unauthenticated raw README matched the local file. Video upload and learner-written Devpost fields/exit survey remain pending.

- Repository renamed at learner request to `scopematch-hacketon`; local `origin` and project documentation now use https://github.com/fadillaoegi/scopematch-hacketon.

- Clean Architecture requested by the learner after publication: saved as a mandatory project rule in AGENTS.md, imported by CLAUDE.md. Removed concrete-store/SQL dependencies from backend use cases through an application-owned transactional repository port and persistence-neutral domain records. Frontend models and gateway/errors are separated from HTTP; presentation uses an injected gateway. No product behavior, API schema, or SQLite migration change intended. Import guards added to Go tests and the frontend build.

- Architecture revision verification: Go tests/vet and frontend architecture checks/production build passed. Temporary invalid dependency probes were rejected by both architecture guards and removed. Two isolated browser sessions completed the full flow through revised scope, dual agreement, actual Markdown download, and live Projects status without runtime errors or mobile overflow. Pre-refactor setup/agreed projects on an unchanged database copy returned identical session JSON and export bytes. The updated offline app map also passed with JavaScript disabled at desktop and 375px widths.

- Post-ship design revision (learner request, 16 Oct): asymmetric layout with bento summaries and informative motion; recorded in `prd.md > Look and Feel` and `spec.md > Look and Feel`. Presentation-only; button labels kept so existing flows and the recording script still work. Verified: frontend architecture check + build, Go tests unchanged, a two-role browser E2E (freelancer 1440px, client 390px) covering create → lock → sealed answers → reveal → counter-proposals → same-answer confirmations → v1 → v2 → AGREED → identical exports, access probes, and no horizontal overflow; screenshots inspected. One issue found and fixed during the revision: the brief→question line crossed brief words; it now leaves from the panel edge.
- Booking card wording generalized from salon-specific ("the salon") to "the business" after a synthetic multi-brief check; the salon demo story is unchanged. Earlier stored scope versions keep their frozen text.
