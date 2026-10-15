# ScopeMatch — real-user test kit

Goal (from `prd.md > Open Questions`): find out whether one real freelancer–client pair discovers differences they had not noticed, and whether they can settle them in the app. Target date: 18 Oct 2026.

This file is a protocol and a blank record sheet, not submission copy. The repository is public: record **initials or roles only** — no names, phone numbers, client business details, or screenshots containing them.

## Who

- One freelancer who builds websites, and one real or prospective client of theirs.
- Best: a real brief they are about to start. The question library fits small-business sites (booking, two languages, editable content, launch content); a brief far outside that will get few questions — note it as a finding instead of forcing it.
- Keep this separate from the agent's synthetic tests and the demo recording: those are not user evidence.

## Run it (temporary public link)

```sh
cd scopematch_FE && npm run build
cd ../scopematch_BE && go run ./cmd/server -addr :8090 -static ../scopematch_FE/dist -db data/usertest.db
# second terminal
cloudflared tunnel --url http://localhost:8090
```

Open the printed `https://….trycloudflare.com` URL → New project. Send the client link to the client privately. The link stops working when the tunnel stops. Stop both commands after the session.

## Session (about 15–20 minutes)

1. **Before the app** — ask each person separately: "Do you think you two already agree on what this project includes?" Record their answer.
2. **Setup** — the freelancer pastes the brief and chooses questions. Don't help unless they are stuck; note where they hesitate.
3. **Answer separately** — each answers on their own device without talking.
4. **Reveal** — for each difference, ask both: "Did you expect this difference?" Record yes/no.
5. **Resolve** — let them reach decisions in the app. Note what they discuss and anything they need outside the app.
6. **Confirm** — both confirm the scope. Download the Markdown.
7. **After** — ask: "What was confusing?" and "Would you use this before your next project? Why or why not?" Record their words.

Don't prompt answers or explain what they "should" pick. Silence is fine.

## Record sheet

Date: ____ · Synthetic or real: **real** · Brief type (no details): ____

| Before the app | Freelancer | Client |
|---|---|---|
| "Do you already agree?" | | |

| § | Question | Freelancer answer | Client answer | Status shown | Expected the difference? | Final decision reached? |
|---|---|---|---|---|---|---|
| 1 | Booking | | | | | |
| 2 | Languages | | | | | |
| 3 | Editable content | | | | | |
| 4 | Launch content | | | | | |

- Differences found: __ of __ questions
- Differences they had **not** expected: __
- Settled in the app: __ · Still open: __
- Time from lock to Agreed: ____
- Where they needed help: ____
- Confusing moments (their words): ____
- Would use it again? (their words): ____

## What this can and cannot show

One pair shows whether the flow *can* surface unnoticed differences and settle them. It does not prove savings, prevented disputes, or that most projects behave this way. Report the counts above as they happened, including a result of zero differences.
