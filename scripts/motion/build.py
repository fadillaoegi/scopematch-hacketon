"""Render and master the original ScopeMatch 3D bookends on macOS.

Dependencies: Apple command-line tools (Swift/SceneKit/Metal), Python 3, ffmpeg.
Outputs remain under ignored artifacts/. Does not modify or publish the app.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]


def run(*args, **kwargs):
    return subprocess.run([str(a) for a in args], check=True, **kwargs)


def probe(path):
    return json.loads(run('ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', path, capture_output=True, text=True).stdout)


def master_audio(kind, out):
    source = out / f'{kind}-raw.wav'
    first = run('ffmpeg', '-hide_banner', '-i', source, '-af', 'loudnorm=I=-18:TP=-1.5:LRA=7:print_format=json', '-f', 'null', '-', capture_output=True, text=True)
    # ffmpeg may print a final progress line after the JSON block.
    measured, _ = json.JSONDecoder().raw_decode('{' + first.stderr.rsplit('{', 1)[1])
    settings = ':'.join([
        'loudnorm=I=-18:TP=-1.5:LRA=7', 'linear=true',
        f'measured_I={measured["input_i"]}', f'measured_TP={measured["input_tp"]}',
        f'measured_LRA={measured["input_lra"]}', f'measured_thresh={measured["input_thresh"]}',
        f'offset={measured["target_offset"]}',
    ])
    run('ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', source, '-af', settings, '-ar', '48000', '-c:a', 'pcm_s24le', out / f'{kind}-sound.wav')
    (out / f'{kind}-loudness.json').write_text(json.dumps(measured, indent=2) + '\n')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=ROOT / 'artifacts/motion')
    parser.add_argument('--with-demo', type=Path, help='Optional existing 1080p demo for an assembly preview; source unchanged.')
    args = parser.parse_args()
    out = args.output.resolve(); out.mkdir(parents=True, exist_ok=True)
    fingerprint = hashlib.sha256((ROOT / 'scripts/motion/Render.swift').read_bytes()).hexdigest()[:16]
    work = out / '.render-cache' / fingerprint
    work.mkdir(parents=True, exist_ok=True)
    cache = Path(tempfile.gettempdir()) / 'scopematch-motion-module-cache'
    cache.mkdir(parents=True, exist_ok=True)
    renderer = work / 'render-motion'
    if not renderer.exists():
        run('swiftc', '-O', '-module-cache-path', cache, ROOT / 'scripts/motion/Render.swift', '-o', renderer)
    run(sys.executable, ROOT / 'scripts/motion/sound.py', out)
    report = {'originalAssets': True, 'stockMedia': False, 'narration': False, 'files': {}}
    for kind, duration in [('intro', 8), ('closing', 6)]:
        raw = work / f'{kind}-silent.mp4'
        if not raw.exists():
            run(renderer, kind, raw)
        else:
            if abs(float(probe(raw)['format']['duration']) - duration) >= .1:
                raise ValueError(f'Incomplete cached render: {raw}')
            print(f'Reusing verified {kind} render for this source fingerprint', flush=True)
        master_audio(kind, out)
        dest = out / f'scopematch-{kind}.mp4'
        run('ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', raw, '-i', out / f'{kind}-sound.wav',
            '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000',
            '-movflags', '+faststart', '-t', duration, '-metadata', f'title=ScopeMatch {kind}', dest)
        run('ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', dest, '-vf', f'fps=1/{duration / 6},scale=640:360,tile=3x2', '-frames:v', '1', out / f'{kind}-contact-sheet.jpg')
        run('ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', '5.8' if kind == 'intro' else '4.2', '-i', dest, '-frames:v', '1', out / f'{kind}-poster.png')
        data = probe(dest)
        video = next(s for s in data['streams'] if s['codec_type'] == 'video')
        audio = next(s for s in data['streams'] if s['codec_type'] == 'audio')
        assert (video['width'], video['height'], video['r_frame_rate']) == (1920, 1080, '30/1')
        assert audio['channels'] == 2 and audio['sample_rate'] == '48000'
        assert abs(float(data['format']['duration']) - duration) < .1
        report['files'][dest.name] = data
    # A short preview plays the two bookends consecutively, with their sound.
    run('ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', out / 'scopematch-intro.mp4', '-i', out / 'scopematch-closing.mp4',
        '-filter_complex', '[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]', '-map', '[v]', '-map', '[a]',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '19', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', out / 'bookends-preview.mp4')
    if args.with_demo:
        demo = args.with_demo.resolve()
        data = probe(demo)
        video = next(s for s in data['streams'] if s['codec_type'] == 'video')
        if (video['width'], video['height']) != (1920, 1080):
            raise ValueError('Assembly preview requires a 1920x1080 demo')
        length = data['format']['duration']
        # The existing sample demo has no audio. Add silence only to that
        # segment; preserve the original source and the separate bookends.
        if any(s['codec_type'] == 'audio' for s in data['streams']):
            raise ValueError('Use an editor to mix narration from an existing audio track')
        run('ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', out / 'scopematch-intro.mp4', '-i', demo,
            '-i', out / 'scopematch-closing.mp4', '-f', 'lavfi', '-t', length, '-i', 'anullsrc=r=48000:cl=stereo',
            '-filter_complex', '[1:v]fps=30,setsar=1[body];[0:v][0:a][body][3:a][2:v][2:a]concat=n=3:v=1:a=1[v][a]',
            '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'fast', '-crf', '19', '-c:a', 'aac', '-b:a', '256k',
            '-movflags', '+faststart', out / 'demo-with-bookends.mp4')
        report['assemblyDurationSeconds'] = float(probe(out / 'demo-with-bookends.mp4')['format']['duration'])
    (out / 'render-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(f'Finished: {out}', flush=True)


if __name__ == '__main__':
    main()
