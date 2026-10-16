#!/usr/bin/env python3
"""Assemble real CDP frames, original 3D bookends, and timed VO *text*.

No speech is synthesized and the delivered MP4 has no audio stream. Long static
waits are condensed; the edit report records each scene's timing adjustment.
"""
import argparse
import hashlib
import json
import subprocess
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
PAPER = '#f4efe4'
INK = '#1b1a17'
MUTED = '#6c665b'
BLUE = '#233c9a'


def run(args):
    subprocess.run(args, check=True)


def ffmpeg(args):
    run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *args])


def complete_segment(path, duration):
    if not path.exists():
        return False
    try:
        actual=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(path)],stderr=subprocess.DEVNULL))
        return abs(actual-duration) < .06
    except (ValueError, subprocess.CalledProcessError):
        return False


def font(size, serif=False):
    name = 'Georgia.ttf' if serif else 'Arial.ttf'
    return ImageFont.truetype('/System/Library/Fonts/Supplemental/' + name, size)


def plate(item, dest):
    img = Image.new('RGB', (1920, 1080), PAPER)
    d = ImageDraw.Draw(img)
    d.text((72, 20), item['label'].upper(), font=font(22), fill=MUTED)
    if item.get('cuts'):
        d.text((1510, 23), 'Request wait condensed', font=font(18), fill=MUTED)
    phone = bool(item.get('lead'))
    box = (1250, 68, 1690, 1020) if phone else (80, 66, 1840, 1056)
    shadow = Image.new('RGBA', img.size)
    ImageDraw.Draw(shadow).rectangle((box[0]-3, box[1]+7, box[2]+3, box[3]+10), fill=(35, 26, 10, 35))
    img = Image.alpha_composite(img.convert('RGBA'), shadow.filter(ImageFilter.GaussianBlur(13)))
    d = ImageDraw.Draw(img)
    d.rectangle((box[0]-1, box[1]-1, box[2]+1, box[3]+1), outline='#cfc5b4', width=2)
    if phone:
        d.text((112, 250), 'ScopeMatch', font=font(38, True), fill=INK)
        d.line((112, 318, 310, 318), fill=BLUE, width=3)
        d.multiline_text((112, 370), item['lead'], font=font(57, True), spacing=20, fill=INK)
        d.text((116, 600), item['note'], font=font(25), fill=BLUE)
        d.text((116, 948), 'Automated walkthrough · fictional sample project', font=font(19), fill=MUTED)
    img.convert('RGB').save(dest)
    return box


def timestamp(seconds, sep='.'):
    ms = round(seconds*1000)
    h, rem = divmod(ms, 3600000)
    m, rem = divmod(rem, 60000)
    s, f = divmod(rem, 1000)
    return f'{h:02}:{m:02}:{s:02}{sep}{f:03}'


def write_narration(story, output):
    timed = ['SCOPEMATCH — ENGLISH VOICE-OVER TEXT ONLY',
             'Silent picture master. Record your own voice; no generated narration audio.',
             'Read at a relaxed conversational pace. Leave the first 0.4 s of each cue clear.',
             'Times refer to scopematch-demo-silent.mp4.\n']
    clean = []
    captions = []
    cue = 1
    at = 0
    mapping = []
    for item in story:
        end = at + item['duration']
        text = item['voice']
        timed += [f'[{timestamp(at)} – {timestamp(end)}] {item.get("label", item["id"].title())}', text, '']
        clean.append(text)
        # Short subtitle cues, supplied as an optional editable text track.
        words = text.split()
        chunks = [words[i:i+11] for i in range(0, len(words), 11)]
        usable = item['duration'] - .8
        start = at + .4
        for chunk in chunks:
            length = usable * len(chunk)/len(words)
            captions += [str(cue), f'{timestamp(start, ",")} --> {timestamp(start+length, ",")}',
                         '\n'.join(textwrap.wrap(' '.join(chunk), 45)), '']
            cue += 1
            start += length
        mapping.append({**item, 'start': at, 'end': end, 'words': len(words), 'wpm': round(len(words)*60/usable)})
        at = end
    (output/'voice-over-timed-en.txt').write_text('\n'.join(timed)+'\n')
    (output/'voice-over-reading-en.txt').write_text('\n\n'.join(clean)+'\n')
    (output/'voice-over-en.srt').write_text('\n'.join(captions)+'\n')
    (output/'timeline.json').write_text(json.dumps(mapping, indent=2)+'\n')
    return mapping


def frame_manifest(all_frames, scene, target, dest, cuts=()):
    """Retain genuine cursor motion; condense only repeated/static capture holds."""
    before = [f for f in all_frames if f['t'] <= scene['start']]
    selected = ([{**before[-1], 't': scene['start']}] if before else [])
    selected += [f for f in all_frames if scene['start'] < f['t'] < scene['end']]
    if cuts:
        selected = [f for f in selected if not any(a <= f['t']-scene['start'] < b for a,b in cuts)]
        selected = [{**f,'t':f['t']-sum(b-a for a,b in cuts if b <= f['t']-scene['start'])} for f in selected]
    effective_end = scene['end']-sum(b-a for a,b in cuts)
    if not selected:
        raise RuntimeError('No frames for '+scene['id'])
    # Identical JPEGs need no duplicate decode. A held image still receives its
    # real duration before the documented maximum static hold is applied.
    distinct = []
    for frame in selected:
        digest = hashlib.sha256(Path(frame['path']).read_bytes()).digest()
        if not distinct or digest != distinct[-1][1]:
            distinct.append((frame, digest))
    selected = [x[0] for x in distinct]
    holds = [min(1.15, max(.025, (selected[i+1]['t'] if i+1 < len(selected) else effective_end)-f['t'])) for i, f in enumerate(selected)]
    condensed = sum(holds)
    factor = target/condensed
    lines = ['ffconcat version 1.0']
    for f, hold in zip(selected, holds):
        path = f['path'].replace("'", "'\\''")
        lines += [f"file '{path}'", f'duration {hold*factor:.7f}']
    lines += ["file '"+selected[-1]['path'].replace("'", "'\\''")+"'"]
    dest.write_text('\n'.join(lines)+'\n')
    return {'rawSeconds': round(scene['end']-scene['start'], 3), 'condensedSeconds': round(condensed, 3), 'targetSeconds': target, 'motionSpeed': round(1/factor, 3), 'frames': len(selected), 'omittedSourceIntervals':cuts}


def render_capture(item, scene, frames, segment, cache, force):
    manifest=cache/(item['id']+'.ffconcat')
    stats=frame_manifest(frames[scene['role']],scene,item['duration'],manifest,item.get('cuts',()))
    bg=cache/(item['id']+'.png')
    x,y,right,bottom=plate(item,bg)
    width,height=right-x,bottom-y
    dur=item['duration']
    filters=f'[1:v]scale={width}:{height}:flags=lanczos,setsar=1,fps=30,format=rgba,fade=t=in:st=0:d=0.16:alpha=1,fade=t=out:st={dur-.16}:d=0.16:alpha=1[screen];[0:v][screen]overlay={x}:{y}:shortest=1,format=yuv420p[v]'
    if force or not complete_segment(segment,dur):
        print('Rendering '+item['id']+' '+str(stats),flush=True)
        ffmpeg(['-loop','1','-framerate','30','-i',str(bg),'-f','concat','-safe','0','-i',str(manifest),'-filter_complex',filters,'-map','[v]','-an','-t',str(dur),'-r','30','-c:v','libx264','-preset','fast','-crf','18','-video_track_timescale','15360',str(segment)])
    return stats


def join_segments(segments,manifest,dest):
    manifest.write_text('ffconcat version 1.0\n'+'\n'.join("file '"+str(p)+"'" for p in segments)+'\n')
    ffmpeg(['-f','concat','-safe','0','-i',str(manifest),'-map','0:v:0','-c:v','copy','-an','-movflags','+faststart',str(dest)])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default='artifacts/submission-demo')
    parser.add_argument('--text-only', action='store_true')
    parser.add_argument('--only', help='Render one scene for review')
    parser.add_argument('--force', action='store_true', help='Replace existing scene renders')
    args = parser.parse_args()
    output = (ROOT/args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    cache = output/'edit-cache'
    cache.mkdir(exist_ok=True)
    story = json.loads((Path(__file__).with_name('storyboard.json')).read_text())
    mapping = write_narration(story, output)
    if args.text_only:
        return
    capture = json.loads((output/'capture.json').read_text())
    frames = json.loads((output/'frames.json').read_text())
    scenes = {s['id']: s for s in capture['scenes']}
    report = {'duration': sum(s['duration'] for s in story), 'audio': 'none', 'scenes': {}, 'checks': capture['checks']}
    segments = []
    for item in mapping:
        segment = cache/(item['id']+'.mp4')
        segments.append(segment)
        if args.only and item['id'] != args.only:
            continue
        if item['id'] in ('intro', 'closing'):
            source = ROOT/'artifacts/motion'/('scopematch-'+item['id']+'.mp4')
            if args.force or not complete_segment(segment,item['duration']):
                ffmpeg(['-i', str(source), '-map', '0:v:0', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30', '-t', str(item['duration']), '-video_track_timescale', '15360', str(segment)])
            continue
        if item.get('shots'):
            parts=[]; stats=[]; parent=scenes[item['id']]
            for i,shot in enumerate(item['shots']):
                shot_item={**item,**shot,'id':item['id']+'-'+str(i)}
                shot_scene={**parent,'role':shot['role'],'start':parent['start']+shot['from'],'end':parent['start']+shot['to'] if 'to' in shot else parent['end']}
                part=cache/(shot_item['id']+'.mp4');parts.append(part)
                stats.append(render_capture(shot_item,shot_scene,frames,part,cache,args.force))
            join_segments(parts,cache/(item['id']+'-parts.ffconcat'),segment)
            report['scenes'][item['id']]={'shots':stats}
        else:
            report['scenes'][item['id']]=render_capture(item,scenes[item['id']],frames,segment,cache,args.force)
    if args.only:
        return
    concat = cache/'master.ffconcat'
    master = output/'scopematch-demo-silent.mp4'
    join_segments(segments,concat,master)
    metadata = json.loads(subprocess.check_output(['ffprobe','-v','quiet','-show_format','-show_streams','-of','json',str(master)]))
    assert float(metadata['format']['duration']) < 180
    assert abs(float(metadata['format']['duration'])-report['duration']) < .06
    assert len(metadata['streams']) == 1 and metadata['streams'][0]['codec_type'] == 'video'
    assert metadata['streams'][0]['width'] == 1920 and metadata['streams'][0]['height'] == 1080
    ffmpeg(['-i',str(master),'-f','null','-'])
    report['verifiedDuration'] = float(metadata['format']['duration'])
    report['streams'] = [{'type':s['codec_type'],'codec':s['codec_name'],'width':s.get('width'),'height':s.get('height'),'fps':s.get('r_frame_rate')} for s in metadata['streams']]
    report['fullDecodePassed'] = True
    (output/'verification.json').write_text(json.dumps(report,indent=2)+'\n')
    print('Silent master complete: '+str(master), flush=True)


if __name__ == '__main__':
    main()
