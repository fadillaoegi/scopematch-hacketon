---
doc: prd
status: approved
---

# ScopeMatch — Product Requirements

A responsive web app where a freelancer who builds small-business websites and their client answer the same scope questions separately, see where they differ only after both submit, and agree on a confirmed, exportable scope.
Source: `scope.md > The Unique Kernel`, `scope.md > Who It's For`.

## The Core Journey
Source: `scope.md > The Core Loop`, `scope.md > What "Working" Looks Like`.

1. **Freelancer starts a project.** Enters project name, their own name, client name, and pastes the client's brief.
2. **Freelancer reviews scenarios.** ScopeMatch suggests scenario cards by matching words in the brief; each suggestion shows the brief sentence it came from (highlighted). Freelancer keeps, removes, or adds cards from the library.
3. **Freelancer locks questions and gets the client link.** The private **owner link** (to return) exists from project creation; locking adds the **client link** (to send). Both are shown together after locking. Questions can no longer change.
4. **Both answer separately, in any order.** Each picks one option per card, including "Something else" (with text) and "Not sure yet". Submitting **seals** their answers. Neither can see the other's answers.
5. **Reveal.** When the second party submits, both see Compare: sealed cards flip; each card is marked **Same answer**, **Needs discussion**, or **Needs clarification**.
6. **Resolve.** Either side proposes a decision per card (optionally with a short "why"). The other side confirms or counter-proposes. A card is **Decided** when both have confirmed the same active proposal.
7. **Review & confirm.** When every card is Decided, the freelancer opens the scope summary (included, excluded, client responsibilities, acceptance criteria, open questions), may edit it, and sends it for confirmation. Both confirm the same saved version.
8. **Agreed.** The scope is stamped **AGREED**, locked, and downloadable as Markdown.

Success = demo flow from `scope.md > What "Working" Looks Like` runs end to end with two browsers (laptop + phone).

## Screens and Layout

1. **Projects** (freelancer home) — projects remembered on this device: name, client, current stage, counts ("3 decided · 1 needs discussion"). Button: New project. Empty state explains the idea in one line and invites creating the first project.
2. **Project setup** (freelancer) — left: the brief with matched sentences highlighted; right: scenario cards (suggested + library). Hover/focus a card → its source sentence highlights. "Lock questions & get links" at the end; then shows owner link + client link with copy buttons.
3. **Answer** (both roles; client on phone) — one card at a time on mobile, a list on desktop; progress ("2 of 4"); options as large tappable choices; Submit seals. After submitting: "Sealed. Waiting for [other name]."
4. **Compare & Resolve** (both roles) — per card: freelancer answer (blue ink) and client answer (vermilion ink) side by side, status label, proposal area. Booking card shows a static "What the salon's customer sees" preview for each chosen option. Header counter: "2 of 4 decided".
5. **Agreed Scope** (both roles) — the summary document, confirmation records, version label, AGREED stamp when final, "Download Markdown".

Navigation: freelancer moves via the project's stage tabs (Setup → Answer → Compare → Scope); client only ever sees Answer → Compare → Scope for their one project.

## Look and Feel
Learner-approved direction: **"two inks on contract paper"**.

- **Metaphor:** a scope agreement document, not a SaaS dashboard. Warm off-white paper background, near-black ink text.
- **Two-party color:** freelancer = deep blue ink; client = vermilion (red-orange) ink. Agreement = solid black **AGREED** stamp. Status colors stay inside this palette.
- **Type:** characterful display serif for headings (e.g., Fraunces or Instrument Serif); clean sans for body; monospace for metadata — clause numbers ("§ 1 Booking"), timestamps, version labels.
- **Meaningful motion:**
  - Sealed answer cards flip simultaneously on reveal (the video's key moment).
  - Hovering/focusing a question underlines its source sentence in the brief like a highlighter stroke.
  - The AGREED stamp lands on the document when both confirm.
  - Respect reduced-motion settings (fade instead of flip/stamp).
- **Avoid (learner: "jangan sampai seperti AI slop"):** purple/blue gradients, glassmorphism, neon glow, emoji as icons, "✨ AI-powered" labels, uniform grids of rounded cards, decorative blobs.
- **References:** [Stripe Press](https://press.stripe.com/) (editorial feel), [Are.na](https://www.are.na/) (calm, non-generic).
- UI copy in English. Client screens designed phone-first.

## Features and Behavior

### Creating a project
- As a freelancer, I want to paste my client's brief and get relevant questions so I don't start from a blank page.
  - [ ] Project cannot be created with an empty brief or empty project name; inline message says what's missing.
  - [ ] Created project appears in Projects on the same device after reload.

### Scenario cards
Source: `scope.md > The POC Boundary`.
Curated library (deterministic keyword matching — never described as AI extraction):

| § | Card | Matches brief words like | Options (plus "Something else" and "Not sure yet") |
|---|---|---|---|
| 1 | **Booking** — What should happen when a customer books an appointment? | book, booking, appointment, reserve | A: Open WhatsApp to contact the salon · B: Submit a request for staff approval · C: Reserve an available slot immediately |
| 2 | **Languages** — What does "two languages" cover? | language, bilingual, translation, English, Indonesian | A: Every page, translated by the client · B: Every page, translated by the freelancer · C: Main pages only |
| 3 | **Editable content** — What can the client change after launch, without the freelancer? | editable, edit, update, CMS | A: Text and photos on every page · B: Services and prices only · C: Nothing — send changes to the freelancer |
| 4 | **Launch content** — Who provides the text and photos at launch? | always suggested | A: Client provides all · B: Freelancer writes text, client provides photos · C: Freelancer provides all (stock photos) |

Each option stores predefined text for the summary: what it includes, excludes, client responsibilities, and acceptance criteria.
  - [ ] Salon brief suggests cards §1–§4; each suggested card shows the brief sentence it matched.
  - [ ] A brief with no matched words suggests only §4; freelancer can still add others from the library.
  - [ ] Lock is disabled when zero cards are selected.
  - [ ] After locking, cards and options cannot be edited by anyone.

### Links and access
- [ ] Creating a project produces an unguessable owner link; locking produces a different, unguessable client link; both are shown after locking.
- [ ] The client link opens only that project, only as the client: it can answer, propose, confirm, and download — never edit the brief, cards, or summary, and never see other projects.
- [ ] Changing the project ID or token in a URL never opens another project; an invalid link shows "This link isn't valid" and reveals nothing.
- [ ] Owner link opened on another device restores freelancer access to that project.

### Answering separately
Source: `scope.md > The Unique Kernel`.
- As a client, I want to answer on my phone without an account, so I can say what I actually imagine.
  - [ ] Every card must have a choice before Submit; "Something else" requires text.
  - [ ] Before submitting, answers can be changed; after Submit they are sealed (read-only).
  - [ ] Until **both** have submitted, the server returns no information about the other party's answers — not even through direct requests; the screen shows only "Waiting for [name]".

### Compare
- [ ] Appears for both parties only after both have submitted.
- [ ] Status per card: **Same answer** (same concrete option), **Needs discussion** (different concrete options), **Needs clarification** (either chose "Not sure yet" or "Something else").
- [ ] Counter shows numbers of decisions, never a percentage or "match score".
- [ ] Booking card shows the static customer-view preview for each chosen option (A: tap → WhatsApp chat opens; B: form → "Request sent, staff will confirm" → Pending; C: time slot grid → "Confirmed" instantly). Sample data only; no real booking.

### Resolving differences
- [ ] Either party can propose an option (or custom text) per card, with an optional short "why".
- [ ] The proposer counts as confirming their own proposal; the other party sees Confirm / Counter-propose.
- [ ] A new proposal replaces the previous one and cancels any confirmation of it.
- [ ] **Same answer** is not automatically decided: it pre-fills a proposal that still needs both confirmations (one tap each).
- [ ] "Not sure yet" can never become the decision.
- [ ] Card becomes **Decided** only when both confirmed the same active proposal.

### Scope review and confirmation
- [ ] "Review scope" is available to the freelancer only when every card is Decided.
- [ ] Summary is assembled from the decided options' stored text: Included, Excluded, Client responsibilities, Acceptance criteria; plus an **Open questions** list the freelancer can add to (non-blocking notes).
- [ ] Freelancer can edit summary text before sending; sending saves it as **version N** (e.g., v1).
- [ ] Each party confirms by entering their name; the record shows name + time, labelled "recorded, not identity-verified".
- [ ] Both confirmations must reference the same version. If the freelancer edits after any confirmation, a new version is saved and all confirmations reset.
- [ ] When both have confirmed the same version: status **Agreed**, AGREED stamp, scope locked.

### Export
- [ ] "Download Markdown" produces a `.md` file containing exactly the stored agreed version: project, brief, decisions, summary sections, version, confirmation records.
- [ ] Export is available only for an Agreed version.

## States and Boundaries
- **First use** — Projects empty state with one-line explanation and New project.
- **Waiting** — after sealing, "Waiting for [name]"; reloading keeps the state.
- **Invalid or wrong link** — "This link isn't valid"; no project details.
- **Client link after Agreed** — opens the read-only Agreed Scope.
- **Persistence** — projects, answers, proposals, versions, and confirmations are stored on the server; the Projects list per device is a convenience only. Losing the owner link means losing freelancer access (accepted for the PoC).
- **Permissions** — owner: setup, answer, propose, confirm, edit/send summary. Client: answer, propose, confirm, download. Enforced by the server, not just hidden in the UI.
- **Mobile** — all client screens usable at phone width without horizontal scrolling.

## Product Decisions
- **ScopeMatch Lite** — keep the kernel (blind answers, reveal, agree) and drop management features; realistic for the 20 Oct personal target and leaves time for design and a real user test.
- **Static preview instead of interactive simulation** — keeps the "they're really different" moment at low build cost.
- **"Two inks on contract paper" visual direction** — every visual element expresses the kernel (two parties, sealed, agreed), avoiding generic AI-app styling.
- **Owner link instead of login** — email integration is cut; login adds work invisible in the demo; server still separates owner and client.
- **Symmetric counter-proposals** — both parties are equals; avoids the "one writes, one approves" pattern of tools checked.
- **Sealed after submit** — matches the metaphor and keeps the reveal honest.

Assumptions (agent-proposed, confirm at review):
- The four scenario cards and their option wording above.
- All selected cards are blocking — every card must be Decided before review.

## What We're Building
Projects list; project setup with brief highlighting and four curated cards; locking with owner/client links; separate sealed answers; server-enforced hiding until both submit; Compare with three statuses and booking preview; symmetric proposals and confirmations; versioned summary with both confirmations bound to one version; Agreed lock and stamp; Markdown export; responsive layout and the motion moments listed in Look and Feel.

## Deferred From the POC
- **Accounts / login** — owner link covers returning; real accounts are a later product decision.
- **Interactive booking simulation** — static preview proves the point for now.
- **Editing questions after locking** (versioned questions with answer invalidation) — lock instead.
- **New draft from an agreed scope** — agreed versions stay locked; change management is later.
- **PDF export** — Markdown is required; print view later.
- **Notifications** — links are copied and sent manually.

## Possible Later Enhancements
- Optional AI that suggests extra questions from the brief or tidies summary wording; never decides answers, price, time, or approval.
- Scenario libraries for other small-business site types (restaurant, clinic, shop).
- Change requests as new scope versions.

## Non-Goals
- Realtime chat — discussion happens outside the app.
- Payments, invoices, e-signatures — not scope alignment; no legal weight we can back.
- Identity verification — confirmation names are records only.
- Team workspaces — one freelancer, one client.
- WhatsApp/email integration — manual link sharing.
- Claims of saved cost or prevented disputes — unmeasured.

## Open Questions
- Card wording for §2–§4 — confirm at this review (blocks `4-spec` only if changed substantially).
- Real-user test pair (freelancer + client) — needed by 18 Oct for impact evidence; doesn't block spec.
