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

Public repository: https://github.com/fadillaoegi/scopematch. The learner authorized public creation and pushing code/history by replying “lanjut” to the explicit publication question. The configured credential helper authenticated account `fadillaoegi`; that account was used as the destination. The repository was created as public using the GitHub REST API without an initial README or other remote commits. `origin` points to its HTTPS clone URL. No tokens were displayed or saved in project files.

GitHub CLI is not installed; publishing uses the existing Git credential helper and Git. Branch `main` and audited history were pushed successfully. Anonymous requests to the GitHub repository API and raw README both returned successfully; the API reports `private: false`, and the public README matches the local file byte for byte. The published branch was verified through commit `7c4e9c6` before this verification record was added.

## Remaining actions

- [x] Existing Go tests/vet and frontend build pass.
- [x] Local demo MP4 recorded and technical metadata checked; sampled frames inspected.
- [x] README, MIT license, planning docs, offline app map, and third-party notice prepared.
- [ ] Learner reviews the silent video and chooses whether to add their own narration.
- [x] Learner authorized public creation/push, including code/history; authenticated account `fadillaoegi` resolved the destination.
- [x] Repository created/pushed and its URL checked without authentication (public API and raw README).
- [ ] Video uploaded publicly to YouTube/Vimeo and link checked without authentication.
- [ ] Actual submission-form fields and exit survey completed by the learner.
- [ ] Learner explicitly authorizes submission, or submits directly and reports completion.

Public repository URL: https://github.com/fadillaoegi/scopematch (created, pushed, anonymous access verified).
Public video URL: pending.
Optional deployment URL: not requested.
Devpost submission URL/status: pending, not submitted.
