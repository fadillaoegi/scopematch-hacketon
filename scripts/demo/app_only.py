#!/usr/bin/env python3
"""Full-screen working-app demo in the original recording-preview format.

Real desktop/phone source only. No bookends, slides, scene titles, decorative
frames or voice/audio. Narration text is timed to the application footage.
"""
import argparse
import hashlib
import json
import subprocess
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[2]
from edit import write_narration, complete_segment, join_segments

DURATIONS=dict(zip(
    ['brief','questions','ai','invite','welcome','owner-answers','client-answers',
     'reveal','propose','counter','decision','same','scope','revision','agreement','export'],
    [14,9,20,6,7,14,13,12,7,11,6,13,14,9,12,9]))


def run(args):
    subprocess.run(args,check=True)


def shots(scene):
    """Camera switches follow the actual order of both participants' clicks."""
    n=scene['end']-scene['start']
    if scene['id']=='ai':
        return [('owner',0,5.5),('owner',22,n)]
    if scene['id']=='same':
        return [('owner',0,2),('client',2,4.4),('owner',4.4,6.5),('client',6.5,8.8),('owner',8.8,n)]
    if scene['id']=='scope':
        return [('owner',0,16.2),('client',16.2,n)]
    if scene['id']=='agreement':
        return [('owner',0,3.6),('client',3.6,10.5),('owner',10.5,n)]
    return [(scene['role'],0,n)]


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--source',default='artifacts/submission-demo')
    parser.add_argument('--output',default='artifacts/app-demo')
    parser.add_argument('--force',action='store_true')
    args=parser.parse_args()
    source=(ROOT/args.source).resolve(); out=(ROOT/args.output).resolve()
    cache=out/'render-cache';cache.mkdir(parents=True,exist_ok=True)
    capture=json.loads((source/'capture.json').read_text())
    text={s['id']:s for s in json.loads(Path(__file__).with_name('storyboard.json').read_text())}
    storyboard=[];segments=[];report=[]
    clock=0
    for scene in capture['scenes']:
        name=scene['id']; target=DURATIONS[name]
        storyboard.append({'id':name,'duration':target,'label':text[name]['label'],'voice':text[name]['voice']})
        camera_shots=shots(scene)
        raw_duration=sum(b-a for _,a,b in camera_shots)
        allocated=0;seen=0
        for i,(role,a,b) in enumerate(camera_shots):
            seen+=b-a
            end_frame=round(seen/raw_duration*target*30)
            frames=end_frame-allocated;allocated=end_frame
            duration=frames/30
            start=scene['start']-capture['begin']+a
            segment=cache/f'{name}-{i}.mp4';segments.append(segment)
            factor=duration/(b-a)
            filters=f'setpts=(PTS-STARTPTS)*{factor:.10f},scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0xf4efe4,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=1'
            if args.force or not complete_segment(segment,duration):
                print(f'Rendering app only: {name} / {role}, {duration:.2f}s',flush=True)
                run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',f'{start:.6f}',
                     '-t',f'{b-a:.6f}','-i',str(source/(role+'-raw.mp4')),
                     '-vf',filters,'-frames:v',str(frames),'-an','-c:v','libx264',
                     '-preset','fast','-crf','18','-pix_fmt','yuv420p','-r','30',
                     '-video_track_timescale','15360',str(segment)])
            report.append({'scene':name,'role':role,'sourceStart':round(start,6),
                           'sourceEnd':round(start+b-a,6),'start':round(clock,6),
                           'end':round(clock+duration,6),'frames':frames})
            clock+=duration
    timeline=write_narration(storyboard,out)
    assert [s['id'] for s in timeline]==list(DURATIONS)
    assert all(s['wpm']<=160 for s in timeline)
    assert abs(clock-176)<.001
    script=out/'voice-over-timed-en.txt'
    script.write_text(script.read_text().replace('scopematch-demo-silent.mp4','scopematch-demo-full.mp4'))
    movie=out/'scopematch-demo-full.mp4'
    join_segments(segments,cache/'app-only.ffconcat',movie)
    meta=json.loads(subprocess.check_output(['ffprobe','-v','quiet','-show_format','-show_streams','-of','json',str(movie)]))
    stream=meta['streams'][0]
    assert len(meta['streams'])==1 and stream['codec_type']=='video'
    assert (stream['width'],stream['height'],stream['r_frame_rate'])==(1920,1080,'30/1')
    assert abs(float(meta['format']['duration'])-176)<.04
    assert int(stream['nb_frames'])==5280
    assert all(capture['checks'].values()) and not capture['errors']
    run(['ffmpeg','-hide_banner','-loglevel','error','-i',str(movie),'-f','null','-'])
    verification={'duration':176,'resolution':'1920x1080','fps':30,'frames':5280,
                  'audio':False,'intro':False,'closing':False,'titleCards':False,
                  'decorativeOverlays':False,'fullDecodePassed':True,
                  'source':'real automated desktop/phone walkthrough; fictional project',
                  'omittedWaiting':{'scene':'ai','sourceOffsets':[5.5,22]},
                  'checks':capture['checks'],'shots':report}
    (out/'verification.json').write_text(json.dumps(verification,indent=2)+'\n')
    # A sample from every phase plus explicit confirmation and exported-result
    # checks. The images are QA artifacts, never added to the video.
    samples=[(s['id'],s['start']+s['duration']*.55) for s in timeline]
    samples.extend([('confirm-client',next(s for s in timeline if s['id']=='agreement')['start']+6),
                    ('agreed-result',next(s for s in timeline if s['id']=='agreement')['end']-1),
                    ('exported-file',175)])
    sheet=Image.new('RGB',(1600,250*5),'#f4efe4');draw=ImageDraw.Draw(sheet)
    font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',16)
    for i,(name,at) in enumerate(samples):
        png=cache/(name+'-review.png')
        run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(at),'-i',str(movie),'-frames:v','1',str(png)])
        x,y=(i%4)*400,(i//4)*250
        sheet.paste(Image.open(png).resize((400,225),Image.Resampling.LANCZOS),(x,y+25))
        draw.text((x+7,y+5),f'{int(at)//60:02}:{int(at)%60:02} {name}',font=font,fill='#1b1a17')
    sheet.save(out/'contact-sheet.jpg',quality=92)
    copy='''ScopeMatch — complete application demo

scopematch-demo-full.mp4: 02:56.000, 1920×1080, 30 fps, H.264.
Application footage starts at 00:00 and continues through the actual exported
result. No 3D intro/closing, title cards, decorative frames, music or voice.
Desktop is full-screen. The client's portrait browser is centered at full height,
matching the earlier application recording preview.

One fictional project, working end to end:
brief → curated questions → live Gemini draft review/Add → private links →
separate sealed answers → reveal → proposal/counter/history → both confirm
decisions → scope v1 → revision and confirmation reset → both confirm v2 →
AGREED → actual Markdown download and file contents.

Voice-over text is supplied separately in English. Timestamps start at 00:00 of
this corrected video. The SRT is optional and is not burned into the movie.
Record your own voice; no narration audio was generated.

Real app capture from isolated desktop/phone contexts. Cursor movement and
typing are automated; this is a demonstration, not an observed user study.
The long Gemini request wait is shortened; every application action is retained.
The plain text viewer at the end displays the file actually downloaded from the
app. That file matched the stored agreed export byte for byte.

Video rules checked: https://learn-ai-basics.devpost.com/rules
The movie shows the working browser platform, a complete function end to end,
English UI, and a duration below three minutes. Public video upload, public
repository/planning documents, form fields and participant eligibility remain
separate requirements; the movie does not itself perform submission.
'''
    (out/'README.txt').write_text(copy)
    (out/'SHA256.txt').write_text(hashlib.sha256(movie.read_bytes()).hexdigest()+'  '+movie.name+'\n')
    names=['scopematch-demo-full.mp4','voice-over-timed-en.txt','voice-over-reading-en.txt',
           'voice-over-en.srt','README.txt','contact-sheet.jpg']
    with zipfile.ZipFile(out/'scopematch-demo-full-pack.zip','w',compression=zipfile.ZIP_STORED) as z:
        for name in names:z.write(out/name,name)
    print('Complete: application-only demo, 176 seconds, no audio or bookends.',flush=True)


if __name__=='__main__':main()
