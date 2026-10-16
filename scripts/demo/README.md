# Application demo tooling

## Current delivery: 128 seconds, with real PDF output

The current requested cut is `artifacts/app-demo-128s/scopematch-demo-128s.mp4`.
It contains seventeen working-app phases, including the actual **Print / Save as
PDF** click and the resulting file in Chrome's native PDF viewer. There is no
intro, closing, narration audio or decorative overlay. With the separate
8-second intro and 6-second closing added later, the total is 142 seconds.

The actual application no longer has the salon-example shortcut. The first
scene is a fresh recording of the form after that change; controls are not
painted out of old footage. English voice-over text and SRT are separately
retimed from 00:00 for this 128-second cut.

```sh
PYTHONPYCACHEPREFIX=/private/tmp/scopematch-python-cache python3 scripts/demo/compact.py
```

`compact-storyboard.json` defines the scene budgets/narration. `compact.py`
combines validated raw footage from the initial walkthrough with genuine pickup
captures. `capture-pickup.mjs` records the new form. `capture-pdf.mjs` records the
agreed project's real `window.print()` action with Chrome configured to save
directly as PDF, then opens the saved file in the browser's real PDF viewer.
It does not substitute `Page.printToPDF`, draw a pretend viewer, use a physical
printer or require macOS save-dialog Accessibility automation.

The PDF recorder expects a private ignored `artifacts/pdf-demo/session.json`
containing `url` (an owner URL for the same agreed sample fixture) and a dedicated
Chrome CDP instance at `SCOPEMATCH_CDP_ORIGIN`. Chrome must be launched with
`--kiosk-printing`, the Save as PDF destination and headers/footers disabled;
its `savefile.default_directory` must point to the ignored PDF output folder.
Only a disposable profile/fixture is used. Keep its local URL/capability out of
Git and logs. The captured fixture was copied from the original disposable demo
database with an owner capability renewed in the copy; original decisions,
versions and confirmation times are preserved and the source database is untouched.

`inspect-pdf.swift` uses macOS PDFKit to read and render every page of the actual
saved PDF; it checks names, scope content and the absence of private source URLs
or app controls. Recorder cursor/click markers are hidden in print media so they
remain visible in the walkthrough but do not become part of the document.

```sh
swiftc -module-cache-path /private/tmp/scopematch-swift-modules scripts/demo/inspect-pdf.swift -o /private/tmp/scopematch-inspect-pdf
/private/tmp/scopematch-inspect-pdf artifacts/pdf-demo/output/ScopeMatch.pdf artifacts/pdf-demo/pdf-check
```

The final cut is verified as 128 seconds, 3,840 frames, H.264 1920×1080/30 fps,
one video stream and no audio, with full decode, sampled visual review and ZIP
integrity checks. If pickup sources change, invalidate their corresponding
cached scene MP4s before reassembling. Raw footage and all output remain ignored.

## Earlier 176-second application-only delivery

The requested demo follows the original full-screen recording preview: desktop
app footage and the client's portrait browser, with visible real interactions
through the completed result. It contains no 3D intro/closing, title cards,
decorative frames or audio. English narration **text** is separate.

```sh
PYTHONPYCACHEPREFIX=/private/tmp/scopematch-python-cache python3 scripts/demo/app_only.py
```

This reads the validated raw capture from `artifacts/submission-demo/` and writes
the corrected delivery to ignored `artifacts/app-demo/`:

- `scopematch-demo-full.mp4`: 2:56, 1920×1080, 30 fps, application footage only.
- `voice-over-timed-en.txt`, `voice-over-reading-en.txt`, `voice-over-en.srt`:
  English text timed to this demo, starting at 00:00.
- `scopematch-demo-full-pack.zip`: the video, narration text and visual review.
- `verification.json`: duration/frame/decode checks and source-camera mapping.

Both roles' actual confirmation clicks are shown, including confirmations for
matching answers. One fictional project runs from brief through real Gemini
draft review, private answers, comparison, counter-proposal, versioned scope,
confirmation reset, AGREED and actual downloaded Markdown contents. Only the
long provider waiting interval is removed; action footage is retained. Camera
offsets are calibrated to the saved raw recording and need review for a new take.
The source raw MP4s are generated with `SCOPEMATCH_SAVE_RAW=1` when capturing.

The earlier combined film below was rejected by the learner because it attached
the separately requested intro/closing. It is retained as historical media;
`app_only.py` is the earlier 176-second entry point; use `compact.py` for the
current 128-second delivery. Do not attach bookends unless
explicitly asked.

## Earlier combined-film tooling

Creates a silent, 1920×1080/30 fps walkthrough and synchronized English narration
**text**. It never generates a voice track. This is media tooling outside the
application boundaries; app/domain/use-case code is unchanged.

The browser recording is automated with natural cursor movement, real clicks,
short reading pauses and separate isolated browser contexts. Raka, Nadia and
Ombak are fictional sample participants/project. This is a demonstration, not
observed user research. The AI scene uses the configured real Gemini service;
the recorder fails instead of substituting a mocked response.

## Requirements

- Built frontend and a local backend started as documented in the root README.
- Node with global WebSocket support, Chrome with CDP on localhost port 9223.
- `ffmpeg`, `ffprobe`, Python 3 and Pillow.
- Existing original 3D bookends from `scripts/motion/build.py` under
  `artifacts/motion/`. The editor removes their audio for the silent master.
- To show the optional AI flow, the server must already have a configured Gemini
  key. The recording tools do not read, print or embed credentials.

Use an isolated temporary database and Chrome profile. Do not expose the CDP port
on a public network or point the recorder at a real customer's project.

```sh
SCOPEMATCH_DEMO_ORIGIN=http://127.0.0.1:8091 node scripts/demo/capture.mjs
python3 scripts/demo/edit.py
```

Optional `SCOPEMATCH_CDP_ORIGIN` and `SCOPEMATCH_FILM_OUTPUT` select the CDP server
and ignored output folder. For the editor, use `--output` with the same folder.
`SCOPEMATCH_SAVE_RAW=1` also encodes unedited owner/client MP4s; the final editor
reads the original JPEG frames directly, so this slower archival step is optional.
`--text-only` creates narration files without rendering; `--only ai --force`
replaces one scene for review. Run the editor again without `--only` afterward
to assemble the updated master. Source JPEGs remain in a temporary
directory recorded in private `frames.json`; keep them until editing is finished.

`capture.json` records scene times and real-flow checks. `frames.json` contains
private local capture paths; neither is published. The editor condenses long
unchanging holds, preserves cursor movement, and reports timing adjustments in
`verification.json`. Intro/closing are original procedural 3D scenes. Soft short
fades join scenes; on-screen app UI is actual captured footage.

The storyboard's AI wait cut and confirmation-camera offsets are calibrated to
this capture. After recording another take, review `capture.json` and the frames
and adjust those offsets before editing. Omitted waiting time is identified on
screen and in the report. The confirmation sequence cuts from Raka's click to
Nadia's click, then back to the agreed result, preserving the real source order.

## Deliverables

All generated output stays in ignored `artifacts/submission-demo/`:

- `scopematch-demo-silent.mp4`: 2:53, H.264, no audio stream.
- `voice-over-timed-en.txt`: chapter-aligned English recording script.
- `voice-over-reading-en.txt`: continuous reading copy.
- `voice-over-en.srt`: optional editable subtitle timing; not burned into the app.
- `timeline.json`: exact final scene times and narration pacing.
- `verification.json`: actual workflow assertions, timing, format and decode check.
- `download/*.md`: file downloaded by actually clicking the app's export button.

The exported file is compared byte for byte with the server's stored agreed
version. Its contents are displayed in a plain file viewer in the final scene;
the viewer is explicitly labelled as the downloaded file, separate from app UI.

## Competition coverage

Reviewed against [official rules](https://learn-ai-basics.devpost.com/rules) on
16 October 2026. The rules require a functioning proof of concept, footage on
its intended device/platform, an English video or English translation, a video
shorter than three minutes, and a public YouTube/Vimeo URL in the submission.

The film shows a complete browser flow from brief → independent answers →
comparison → mutually confirmed decisions → versioned agreement → real export.
Optional AI demonstrates draft/review boundaries. The opening explains the
audience/problem; the working result is visible in the export scene.

Planning documents, the public source repository, open-source license, testing
instructions, participant eligibility and final form/exit-survey answers are
separate submission requirements. A video cannot prove or complete those.
Adding the user's own narration, uploading the finished video publicly to
YouTube/Vimeo and entering that URL in Devpost remain publication steps.
