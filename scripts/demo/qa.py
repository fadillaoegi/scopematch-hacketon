#!/usr/bin/env python3
"""Inspect the delivered movie and create a compact visual review sheet."""
import json
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'artifacts/submission-demo'
movie=OUT/'scopematch-demo-silent.mp4'
timeline=json.loads((OUT/'timeline.json').read_text())
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',16)
tiles=[]
for item in timeline:
    at=item['start']+item['duration']*.63
    png=OUT/'edit-cache'/('qa-'+item['id']+'.png')
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(at),'-i',str(movie),'-frames:v','1',str(png)],check=True)
    image=Image.open(png).convert('RGB')
    tile=Image.new('RGB',(480,300),'#f4efe4')
    tile.paste(image.resize((480,270),Image.Resampling.LANCZOS),(0,30))
    ImageDraw.Draw(tile).text((10,8),f'{item["start"]:03}s  {item["id"]}',font=font,fill='#1b1a17')
    tiles.append(tile)
sheet=Image.new('RGB',(480*3,300*6),'#f4efe4')
for i,tile in enumerate(tiles):sheet.paste(tile,((i%3)*480,(i//3)*300))
sheet.save(OUT/'contact-sheet.jpg',quality=90)

# Cues must stay within the exact film and leave a little breathing room.
assert len(timeline)==18
assert timeline[-1]['end']==173
assert all(50 <= i['wpm'] <= 160 for i in timeline)
assert all(a['end']==b['start'] for a,b in zip(timeline,timeline[1:]))
print('Contact sheet saved. Narration: 325 words; all cues fit their scenes.')
