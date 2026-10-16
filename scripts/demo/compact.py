#!/usr/bin/env python3
"""Application-only 128-second cut, including the actual PDF print/output.

Uses a genuine form pickup after removal of the example shortcut, the validated
two-role walkthrough, and the real Chrome print-and-PDF-viewer capture.
"""
import hashlib
import json
import subprocess
import zipfile
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from app_only import shots
from edit import complete_segment,join_segments,write_narration

ROOT=Path(__file__).resolve().parents[2]

def run(args):subprocess.run(args,check=True)

def main():
    out=ROOT/'artifacts/app-demo-128s';cache=out/'render-cache';cache.mkdir(parents=True,exist_ok=True)
    source=ROOT/'artifacts/submission-demo'
    capture=json.loads((source/'capture.json').read_text())
    scenes={s['id']:s for s in capture['scenes']}
    pickup=ROOT/'artifacts/demo-pickups';brief=json.loads((pickup/'brief-capture.json').read_text())
    pdf=ROOT/'artifacts/pdf-demo';pdf_capture=json.loads((pdf/'capture.json').read_text())
    pdf_check=json.loads((pdf/'pdf-check-final/verification.json').read_text())
    assert pdf_check['requiredContentPassed'] and pdf_check['privateUrlsAbsent'] and pdf_check['controlsAbsent']
    story=json.loads(Path(__file__).with_name('compact-storyboard.json').read_text())
    assert not brief['exampleShortcut'] and not brief['errors'] and not pdf_capture['errors']
    assert all(capture['checks'].values()) and not capture['errors']
    assert sum(s['duration'] for s in story)==128
    segments=[];report=[];clock=0
    for item in story:
        name=item['id'];target=item['duration']
        if name=='brief':
            parts=[(pickup/'brief-raw.mp4',0,brief['duration'],target,'owner')]
        elif name=='pdf':
            click=pdf_capture['printClick'];viewer=pdf_capture['viewer']
            parts=[(pdf/'print-click-raw.mp4',0,click['end']-click['begin'],5,'owner'),
                   (pdf/'pdf-view-raw.mp4',0,viewer['end']-viewer['begin'],13,'native PDF viewer')]
        else:
            scene=scenes[name];camera=shots(scene);raw=sum(b-a for _,a,b in camera)
            frames_so_far=0;seen=0;parts=[]
            for role,a,b in camera:
                seen+=b-a;end_frame=round(seen/raw*target*30)
                duration=(end_frame-frames_so_far)/30;frames_so_far=end_frame
                parts.append((source/(role+'-raw.mp4'),scene['start']-capture['begin']+a,b-a,duration,role))
        for i,(video,start,length,duration,role) in enumerate(parts):
            frames=round(duration*30);part=cache/f'{name}-{i}.mp4';segments.append(part)
            if not complete_segment(part,duration):
                print(f'Rendering 128s demo: {name}, {duration:.2f}s',flush=True)
                filters=f'setpts=(PTS-STARTPTS)*{duration/length:.10f},scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0xf4efe4,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=1'
                run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',f'{start:.6f}','-t',f'{length:.6f}','-i',str(video),'-vf',filters,'-frames:v',str(frames),'-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-r','30','-video_track_timescale','15360',str(part)])
            report.append({'scene':name,'role':role,'start':round(clock,6),'end':round(clock+duration,6),'source':str(video.relative_to(ROOT)),'sourceStart':start,'sourceDuration':length})
            clock+=duration
    timeline=write_narration(story,out)
    assert all(s['wpm']<=170 for s in timeline) and abs(clock-128)<.001
    timed=out/'voice-over-timed-en.txt'
    timed.write_text(timed.read_text().replace('scopematch-demo-silent.mp4','scopematch-demo-128s.mp4'))
    movie=out/'scopematch-demo-128s.mp4'
    join_segments(segments,cache/'demo.ffconcat',movie)
    meta=json.loads(subprocess.check_output(['ffprobe','-v','quiet','-show_format','-show_streams','-of','json',str(movie)]))
    stream=meta['streams'][0]
    assert len(meta['streams'])==1 and stream['codec_type']=='video'
    assert (stream['width'],stream['height'],stream['r_frame_rate'])==(1920,1080,'30/1')
    assert abs(float(meta['format']['duration'])-128)<.04 and int(stream['nb_frames'])==3840
    run(['ffmpeg','-hide_banner','-loglevel','error','-i',str(movie),'-f','null','-'])
    verification={'duration':float(meta['format']['duration']),'frames':3840,'audio':False,'intro':False,'closing':False,'exampleShortcut':False,'realPrintClick':True,'nativePdfViewer':pdf_capture['viewer']['nativePdfViewer'],'pdfValidation':pdf_check,'fullDecodePassed':True,'sourceChecks':capture['checks'],'shots':report}
    (out/'verification.json').write_text(json.dumps(verification,indent=2)+'\n')
    samples=[(s['id'],s['start']+s['duration']*.55) for s in timeline]
    samples.extend([('actual-print-click',112.5),('pdf-opened',117.5),('pdf-last-page',127)])
    sheet=Image.new('RGB',(1600,1250),'#f4efe4');draw=ImageDraw.Draw(sheet)
    font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',16)
    for i,(name,at) in enumerate(samples):
        png=cache/(name+'-review.png')
        run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(at),'-i',str(movie),'-frames:v','1',str(png)])
        x,y=(i%4)*400,(i//4)*250
        sheet.paste(Image.open(png).resize((400,225),Image.Resampling.LANCZOS),(x,y+25))
        draw.text((x+7,y+5),f'{int(at)//60:02}:{int(at)%60:02} {name}',font=font,fill='#1b1a17')
    sheet.save(out/'contact-sheet.jpg',quality=92)
    readme='''ScopeMatch — application demo, 128 seconds

1920×1080, 30 fps H.264. No audio, intro, closing or decorative title cards.
The initial form was genuinely re-recorded after removal of the salon-example
shortcut. Other working-flow footage retains the same fictional project's brief,
questions, independent answers, real AI review, negotiation, scope versions and
confirmation records. The final PDF uses that original agreed version.

Final scenes show the actual Print / Save as PDF button click and the resulting
browser-generated PDF opened in Chrome's native PDF viewer. The isolated browser
is configured to save directly to PDF; no physical printer or macOS save-dialog
automation is used. This is the app's real window.print path, not Page.printToPDF.
The saved file is inspected separately; no fake PDF or viewer is painted into
the footage. Long provider waiting is condensed and the walkthrough is retimed.

English voice-over text and SRT are separate and timed from 00:00 of this video.
Record your own voice. The 8-second intro and 6-second closing can later be added:
128 + 8 + 6 = 142 seconds (2:22), below the three-minute video limit.

The movie is an automated demonstration with fictional participants. It does not
complete registration, eligibility declarations, public upload or submission.
'''
    (out/'README.txt').write_text(readme)
    (out/'SHA256.txt').write_text(hashlib.sha256(movie.read_bytes()).hexdigest()+'  '+movie.name+'\n')
    names=['scopematch-demo-128s.mp4','voice-over-timed-en.txt','voice-over-reading-en.txt','voice-over-en.srt','README.txt','contact-sheet.jpg']
    with zipfile.ZipFile(out/'scopematch-demo-128s-pack.zip','w',compression=zipfile.ZIP_STORED) as z:
        for name in names:z.write(out/name,name)
    print('Completed: 128-second demo including actual PDF click/output, no example shortcut.',flush=True)

if __name__=='__main__':main()
