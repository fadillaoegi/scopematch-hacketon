---
doc: shipping
status: in-progress
---

# ScopeMatch — shipping record

Technical preparation and completion evidence. This is not submission copy or a narration script.

## Build closeout

All six implementation slices are committed. The learner accepted the final readiness question with “lanjut”; no further fixes were requested. The wrap-up was a short evidence-based recap plus the offline app map, not an interactive tour or a claim of learner mastery. Details are in `checklist.md`.

## Current requirements checked

Checked 15 October 2026 against the [official overview](https://learn-ai-basics.devpost.com/) and [official rules](https://learn-ai-basics.devpost.com/rules):

- A new working project using the Devpost Learn Skill Pack, with `scope.md`, `prd.md`, and `spec.md` in the public code repository.
- A public repository containing source, assets, run instructions, and an open-source license. Official rules accept GitHub, GitLab, or Bitbucket; the project workflow currently targets GitHub.
- A demo of the actual working app: overview says 1–3 minutes; full rules say less than 3 minutes. Keep the final cut between 1 minute and under 3 minutes.
- Video uploaded publicly to YouTube or Vimeo, with an accessible link in the submission.
- English submission materials, or English translations.
- The learner writes the project description, other form answers, and exit survey. The agent may identify missing information and correct spelling or grammar, but does not draft or rewrite that copy.
- Official deadline shown: 26 October 2026, 5:00 pm EDT, equivalent to 27 October 2026, 04:00 WIB.

The authenticated submission form and exit-survey prompts were not accessible. Their exact fields remain unverified; use the learner's current form rather than guessed prompts. The rules include Potential Impact among four equally weighted criteria; the public overview currently lists only three criteria. This difference is recorded without assuming the criterion was removed.

## Local artifacts

Ignored local folder: `artifacts/demo/`.

- `scopematch-demo.mp4`: actual screen capture, 1920×1080, H.264, 30 fps, 105.07 seconds, about 4.4 MB. Silent; no generated narration, captions, music, or upload.
- `agreed-scope.md`: the exact exported result from the recorded project.
- `recording.json`: recorded stages and timing; local capture metadata, not public submission text.
- `contact-sheet.jpg`: sampled frames used for visual inspection.

Two-role footage (16 Oct): `artifacts/footage/freelancer-laptop.mp4` (1920×1080) and `client-phone.mp4` (1080×1920), 5:00 each on one clock, recorded by `scripts/record-roles.mjs` with a visible cursor/touch dot and character-by-character typing (Ombak scenario). `scopematch-split-2x.mp4` places both side by side at 2× speed, 2:30, silent, labelled as a synthetic session. Candidate for the submission video once the learner adds their own narration.

Larger-text re-recording (15 Oct): `artifacts/demo-large/scopematch-demo.mp4`, same real workflow, 1920×1080, 105.1 seconds, silent. The freelancer view now renders at a 1024×576 CSS viewport with a 1.875 pixel ratio (phone view at 390×844, ratio 1.28), so interface text is about 1.4× larger and stays sharp. `scripts/record-demo.mjs` was changed accordingly. Sampled frames, including the final AGREED frame, were inspected. Prefer this file for upload unless the learner prefers the original.

The recording focuses on Booking as the selected scenario: independent freelancer A/client C choices, sealed waiting state, Compare and static previews, proposed B decision with both confirmations, saved scope v1, both name confirmations, AGREED, and export. The other three curated questions remain in the library and are covered by app verification.

The raw video has no address bar or normal browser profile. Read-only link field values are concealed for the recording. Only disposable sample project names are used. It demonstrates behavior but still needs the learner's own presentation review and, if desired, their own narration. A public code repository has now been created; video upload and Devpost submission remain pending.

## Re-record locally

The helper `scripts/record-demo.mjs` uses Node 24, ffmpeg, an already running built app, and an isolated Chrome DevTools instance. It controls only newly created browser contexts and outputs to the ignored artifacts folder.

```sh
# Build frontend, then run the app in another terminal.
cd scopematch_FE
npm ci
npm run build
cd ../scopematch_BE
go run ./cmd/server -static ../scopematch_FE/dist
```

```sh
# macOS: separate headless Chrome profile, no normal user profile.
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --no-first-run --no-default-browser-check --user-data-dir=/private/tmp/scopematch-demo-browser --remote-debugging-port=9223 about:blank
```

```sh
# From the repository root.
node scripts/record-demo.mjs
ffprobe -v error -show_entries format=duration,size -of json artifacts/demo/scopematch-demo.mp4
```

Optional environment variables: `SCOPEMATCH_DEMO_ORIGIN`, `SCOPEMATCH_CDP_ORIGIN`, `SCOPEMATCH_DEMO_OUTPUT`. Defaults are local ports 8080 and 9223 and `artifacts/demo/scopematch-demo.mp4`. The helper creates a fresh sample project and overwrites the local recording output; it does not publish anything.

## Publication audit

- Initial history audit: 8 commits, 153 distinct text/content blobs; no matches for the high-confidence private-key, GitHub-token, API-secret, and AWS access-key patterns checked.
- No actual `devpost/learner-profile.md`, `.env`, or SQLite database/sidecar file found in tracked history. The real profile stays ignored.
- No absolute local user paths found in project files outside copied skill templates.
- Required planning documents remain included. They contain design preferences and build decisions; commit history retains author metadata. These are included in the authorized public repository and remain publicly readable.
- `THIRD_PARTY_NOTICES.md` retains the upstream Devpost MIT notice for the copied skill pack.
- Review is targeted signature scanning and file inspection, not a guarantee of finding every possible secret. No history rewriting performed.

Public repository: https://github.com/fadillaoegi/scopematch-hacketon. The learner authorized public creation and pushing code/history by replying “lanjut” to the explicit publication question. The configured credential helper authenticated account `fadillaoegi`; that account was used as the destination. The repository was created as public using the GitHub REST API without an initial README or other remote commits, then renamed to `scopematch-hacketon` at the learner’s request. `origin` points to its HTTPS clone URL. No tokens were displayed or saved in project files.

GitHub CLI is not installed; publishing uses the existing Git credential helper and Git. Branch `main` and audited history were pushed successfully. Anonymous requests to the GitHub repository API and raw README both returned successfully; the API reports `private: false`, and the public README matches the local file byte for byte. The published branch was verified through commit `7c4e9c6` before this verification record was added.

## Remaining actions

- [x] Existing Go tests/vet and frontend build pass.
- [x] Local demo MP4 recorded and technical metadata checked; sampled frames inspected.
- [x] README, MIT license, planning docs, offline app map, and third-party notice prepared.
- [ ] Learner reviews the silent video (prefer `artifacts/demo-large/`) and chooses whether to add their own narration.
- [x] Learner authorized public creation/push, including code/history; authenticated account `fadillaoegi` resolved the destination.
- [x] Repository created/pushed and its URL checked without authentication (public API and raw README).
- [ ] Video uploaded publicly to YouTube/Vimeo and link checked without authentication.
- [ ] Actual submission-form fields and exit survey completed by the learner.
- [ ] Learner explicitly authorizes submission, or submits directly and reports completion.

Public repository URL: https://github.com/fadillaoegi/scopematch-hacketon (created, pushed, anonymous access verified).
Public video URL: pending.
Optional deployment URL: not requested.
Devpost submission URL/status: pending, not submitted.

## Claude resume — 16 October 2026

Claude's last successful step was a live Gemini request with model fallback. The learner accepted recording an AI scene immediately before the session limit. The uncommitted library, onboarding, proposal-history, printing, and optional-AI changes were retained and reviewed together.

Completed during resume:

- Go tests and `go vet ./...` passed, including model fallback/cooldown and errors that echo a credential. Raw provider HTTP and interaction error bodies are no longer included in logged errors.
- Frontend architecture checks (33 TypeScript files) and production build passed. AI draft options now expose included/excluded work, responsibilities, and acceptance criteria before Add.
- `scripts/e2e.mjs` passed all 44 checks against the current build in isolated desktop/phone contexts, including role isolation, proposal history, revised versions, and identical agreed Markdown exports. The offline app map passed at desktop and 375px with JavaScript disabled.
- `scripts/record-ai.mjs` captured a live Gemini request with a disposable bakery brief, review of option details, Discard, Add, and persistence after reload. Output: ignored `artifacts/ai-demo/scopematch-ai.mp4`, H.264, 1920×1200, 45.70 seconds, 2,755,211 bytes, no audio. Screenshots, sampled video frames, and capture metadata were inspected. This is supplementary synthetic footage, not a real-user test or a submitted video. No public upload performed.
- Publication candidates contain no detected Google-key/private-key signatures; the runtime `.env` remains ignored and mode 600. The example environment file contains no key.

The real-user test, learner-authored presentation/submission answers, public YouTube/Vimeo URL, and final Devpost submission remain pending. Do not mark these complete from automated browser or AI footage. The AI segment is separate from the existing 2:30 split-screen; appending it in full would exceed three minutes, so any final combined cut needs editing.

## Post-publication architecture revision

The learner requested Clean Architecture as a permanent project convention. `AGENTS.md` and `CLAUDE.md` now carry that requirement. `docs/architecture.md` describes the application-owned transactional repository, persistence-neutral records, frontend gateway injection, and dependency checks. This is an internal refactor; the approved product scope, HTTP API, and SQLite schema are preserved. Existing demo footage remains representative of the same user-visible behavior.

## Original motion bookends — 16 October 2026

At the learner's explicit request, created an original 3D intro and closing with synchronized sound for the demo. These use the existing project name, in-app phrases, paper palette, and two ink colors. They contain no new narration or submission answers.

- Intro: 8 seconds; sealed blue/red paper cards arrive at different depths, turn to reveal different answers, then settle with the ScopeMatch wordmark.
- Closing: 6 seconds; a layered scope document turns into view, a dimensional stamp lands at 2.35 seconds, and AGREED resolves before fade-out.
- Original sound is synthesized from oscillators and noise: paper movement, stereo whooshes, harmonic notes, low tonal bed, and stamp impact. No stock media or music samples used. Encoded audio measured −18.1 LUFS / −6.2 dBTP (intro), and −18.2 LUFS / −1.5 dBTP (closing).
- Both MP4s verified as 1920×1080, 30 fps H.264, with 48 kHz stereo AAC. Separate 24-bit WAV sound masters and a 14-second bookend preview are available. Key frames/contact sheets and encoded media were inspected.
- Ignored outputs: `artifacts/motion/scopematch-intro.mp4`, `scopematch-closing.mp4`, `bookends-preview.mp4`, and `scopematch-motion-pack.zip`. Source and reproduction instructions: `scripts/motion/`.
- Also created `artifacts/motion/demo-with-bookends.mp4` from the existing silent split-screen demo: 169.57 seconds total. That assembly includes the 155.57-second source demo plus the 14 seconds of bookends, preserves the source, and leaves the demo's middle section silent. It does not include the separate Gemini scene or narration. The earlier approximate 2:30 description of the split-screen is superseded by its measured 155.57-second duration.

No upload or submission performed. Real-user testing, learner-authored presentation/submission material, and the public video link remain pending.

## Complete silent submission film — 16 October 2026

At the learner's explicit request, recorded a new working-app walkthrough with
natural cursor/tap movement and prepared synchronized English voice-over text.
No speech or narration audio was generated. This supersedes the earlier demo
assemblies as the intended picture master for adding the learner's own voice.

- Output: ignored `artifacts/submission-demo/scopematch-demo-silent.mp4`, exactly
  173 seconds (2:53), 5,190 frames, H.264 1920×1080 at 30 fps, 27,398,865 bytes,
  with no audio stream. Full decode and sampled visual review passed.
- Original 8-second intro and 6-second closing surround one fictional Ombak
  surf-school project: brief, curated questions, real Gemini draft/detail review
  and Add, locked private links, separate desktop/phone answers, simultaneous
  reveal, proposal/counter-proposal/history, explicit confirmations for matching
  answers, scope v1, revision/reset, both v2 confirmation clicks, AGREED, export.
- Eight capture assertions passed, including answer privacy before both seals,
  no automatic agreement for matching answers, all decisions confirmed, reset of
  old confirmations after revision, latest-version agreement, and an actual
  downloaded Markdown file matching the stored export byte for byte.
- One earlier take had a provider timeout; the completed take uses a successful
  real provider response. Waiting time is condensed and labelled. No mocked AI
  result or fabricated application screen is included. The final plain file
  viewer displays the actual downloaded Markdown, labelled accordingly.
- Separate English text files: 325-word timed recording script, clean reading
  copy, optional SRT, and exact scene timeline. Narration cues fit the scene
  durations. These factual drafts were expressly requested by the learner;
  they do not invent personal learning reflections or user-research evidence.
- Source/reproduction notes: `scripts/demo/`. Generated footage, private capture
  metadata, sample download and scripts for recording voice stay under ignored
  `artifacts/`. Only media tooling and this technical record changed; app
  architecture/runtime code is unchanged.

Official video requirements were rechecked at
https://learn-ai-basics.devpost.com/rules: less than three minutes, actual working
platform footage, English/translation, and a public YouTube/Vimeo URL. This film
meets the local format/content checks; it does not complete publication or prove
all participant/submission eligibility requirements. Adding the learner's own
voice, public upload/link verification, actual form/exit-survey answers and final
Devpost submission remain pending. The recording is an automated demonstration
with fictional sample participants, not a real-user study.
