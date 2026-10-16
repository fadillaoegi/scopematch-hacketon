# Submission film tooling

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
