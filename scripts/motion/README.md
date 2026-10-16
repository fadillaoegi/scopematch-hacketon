# ScopeMatch motion bookends

Original 3D animation and stereo sound design for the existing ScopeMatch demo. This is separate media tooling; application architecture and runtime behavior are unchanged. All output goes to ignored `artifacts/motion/`.

- **Intro — 8 seconds:** independently sealed blue/red cards arrive at different depths, turn over to reveal different answers, and settle above the ScopeMatch wordmark.
- **Closing — 6 seconds:** a layered scope document turns into view; a dimensional rubber stamp lands at 2.35 seconds, leaving the AGREED mark, then the scene settles and fades out.
- **Sound:** original synthesized paper movements, stereo whooshes, felt-like harmonic notes, a low tonal bed, and a stamp impact synchronized to the visual timeline. No downloaded music, stock samples, generated speech, or new narration.

The palette comes from `scopematch_FE/src/styles/tokens.css`. Type uses the Iowan Old Style/Georgia system fallback already named in those tokens. Cards, paper texture, and stamp are original procedural drawings/geometry. Titles use the project name and existing in-app phrases.

## Render

Requires macOS with a Metal-capable GPU, Apple command-line tools (`swiftc`, AppKit, SceneKit, AVFoundation), Python 3, and `ffmpeg`/`ffprobe` on PATH. Python uses only its standard library. A restricted execution environment may need permission for GPU access.

From the repository root:

```sh
python3 scripts/motion/build.py
```

To also assemble the existing silent demo between the bookends:

```sh
python3 scripts/motion/build.py --with-demo artifacts/footage/scopematch-split-2x.mp4
```

The source demo is preserved. The optional assembly requires a 1920×1080 silent source; narration should be mixed deliberately in an editor. `--output <directory>` selects another output folder; use a path under `artifacts/` to keep generated media out of Git.

Finished silent renders are cached under `.render-cache/` inside the output folder using a hash of `Render.swift`. A scene-source change creates a fresh cache; an audio/packaging retry can reuse the finished visual render.

## Outputs

| File | Purpose |
| --- | --- |
| `scopematch-intro.mp4` | 1920×1080, 30 fps H.264, 8 seconds, stereo AAC |
| `scopematch-closing.mp4` | Same delivery format, 6 seconds |
| `intro-sound.wav`, `closing-sound.wav` | Separate 48 kHz stereo 24-bit sound masters for editing |
| `bookends-preview.mp4` | The intro and closing played consecutively, with sound |
| `demo-with-bookends.mp4` | Optional assembly with the supplied demo, leaving its middle section silent |
| `*-contact-sheet.jpg`, `*-poster.png` | Visual review assets |
| `*-sound-events.json` | Timing of each original synthesized sound |
| `*-loudness.json`, `render-report.json` | Loudness inputs and delivery verification |

Mastering targets −18 LUFS integrated and a −1.5 dBTP ceiling with two-pass loudness normalization. AAC should be measured after encoding as well. `build.py` verifies delivered dimensions, frame rate, duration, audio channels, and sample rate. Generated clips and any assembled preview still need editorial review before public upload; creating them does not submit or publish anything.

## Source boundaries

`Render.swift` contains pure time/easing helpers, a SceneKit scene adapter, a typography compositor, and an AVFoundation output adapter. `sound.py` synthesizes the audio independently. `build.py` orchestrates rendering, mastering, encoding, and inspection. No component reads app databases, browser profiles, API keys, or client material.
