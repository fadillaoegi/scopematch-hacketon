---
doc: scope
status: approved
---

# ScopeMatch

A responsive web app where a freelancer and their client answer the same scope questions separately, then see where their expectations differ — before any work starts.

## The Unique Kernel
**Blind answers, then reveal.** Both sides answer the same scenario without seeing the other's answer; the server keeps answers hidden until both have submitted. The app doesn't say "your brief is unclear" — it shows "you two imagined different things," then helps them agree on one checkable decision.
Tools checked (BriefCraft, Scopey, Handoffs) follow a "one side writes, the other approves" pattern. Approving a sentence like "booking system" is not the same as sharing its meaning. (Checked from public product pages only — not proof that nothing similar exists.)

## Who It's For
A freelancer who builds websites for small businesses (e.g., a salon) and the business owner who hired them. Today the freelancer reads a one-line brief, writes a proposal, and the client says "looks good" — and the mismatch surfaces at handover.

## The Core Loop
Freelancer creates a project from the client's brief → picks the relevant scenario questions → answers them → sends the client a private link → client answers on their phone, no account → both see Compare → they settle each difference → both confirm → agreed scope exported.
Comes back for each new client project.

## Inspiration & Identity
Visually striking with interactive animation, but **not "AI slop"** (learner's words: "design yang menarik banget ... animasi yang interaktif tetapi jangan sampai seperti AI slop"). The reveal on Compare is the signature motion moment. UI language: English. Freelancer on laptop, client on phone. Specifics deferred to `prd.md > Look and Feel`.

## Why This Matters to the Learner
Competing in Build With AI: Basics to win — wants every judging criterion (Design, Potential Impact, Innovation, Presentation) to be strong. Background evidence on ambiguous requirements is collected in `devpost/background-research.md`.

## What "Working" Looks Like
Demo flow approved by the learner:
1. Freelancer enters the salon brief ("We need a salon website with booking, two languages, and editable content.") and checks the booking question.
2. Client opens the link on a phone and picks **C — reserve a slot immediately**; freelancer picks **A — open WhatsApp**. Neither can see the other's answer.
3. **The "oh" moment:** once both submit, Compare reveals the answers side by side with an animated reveal, marked **Needs discussion**, with a static "what the salon's customer sees" preview for A and C.
4. Both choose **B — request with staff approval**; each confirms; scope becomes **Agreed** and exports as Markdown.

## The POC Boundary
- One freelancer, one client per project.
- Create project with name + brief.
- A small fixed set of curated scenario cards (4–6) linked to brief sentences; freelancer selects relevant ones. Questions lock once the client is invited.
- Each option includes "Not sure yet"; "Not sure" and matching answers are not final agreement.
- Private client link with access limited to that project and the client role; not guessable from project ID.
- Answers hidden by the **backend** until both submit.
- Compare: Same answer / Needs discussion / Needs clarification; decision counts, not certainty scores.
- Static per-option preview for the booking scenario.
- Propose final decision; other side confirms. All blocking questions resolved before Agreed.
- Summary: included, excluded, client responsibilities, acceptance criteria, open questions.
- Both confirmations bound to the same saved snapshot; agreed scope locked.
- Markdown export from stored data.

## Later
- Interactive booking simulation (three live behaviors).
- Versioned questions/options with answer invalidation; editing agreed scope as a new draft version.
- PDF via print view.
- Optional AI that suggests questions or tidies the draft (never decides answers, price, time, or approval).
- More scenario libraries beyond the salon/small-business set.

## Explicitly Cut
- Realtime chat — discussion can happen outside the app for a PoC.
- Payments, e-signatures — out of the scope-alignment kernel; also legal weight we can't back.
- Team management — one freelancer, one client is enough to prove the kernel.
- WhatsApp/email integrations — link is copied manually.
- Free-form prototype generator, automatic change-request analysis — large, and not the kernel.
- Identity verification — confirmation name/time is recorded but never called verification.
