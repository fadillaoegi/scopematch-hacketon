"""Original ScopeMatch sound design. Standard-library synthesis; no samples.

Sound events share the visual timeline. Quiet harmonic beds, stereo paper
movement, felt-like notes and the rubber-stamp impact are generated directly.
Master loudness/true-peak processing is applied separately by ffmpeg.
"""
import argparse
from array import array
import json
import math
from pathlib import Path
import random
import wave

RATE = 48000
TAU = 2 * math.pi


class Mix:
    def __init__(self, duration):
        self.duration = duration
        self.left = array('f', [0]) * int(duration * RATE)
        self.right = array('f', [0]) * int(duration * RATE)
        self.events = []

    def event(self, start, duration, kind, gain, pan=0, frequency=220):
        self.events.append(dict(start=start, duration=duration, kind=kind, pan=pan))
        rng = random.Random(f'{start}:{kind}')
        low = 0.0
        for i in range(int(duration * RATE)):
            p = i / RATE
            u = p / duration
            if kind == 'note':
                env = (1 - math.exp(-p * 180)) * math.exp(-p * 3.5)
                sample = (math.sin(TAU * frequency * p)
                          + .27 * math.sin(TAU * frequency * 2.002 * p) * math.exp(-p * 2)
                          + .09 * math.sin(TAU * frequency * 4.01 * p) * math.exp(-p * 7)) * env
            elif kind == 'bed':
                env = math.sin(math.pi * min(1, u)) ** 1.4
                sample = (math.sin(TAU * frequency * p)
                          + .4 * math.sin(TAU * frequency * 1.002 * p)
                          + .1 * math.sin(TAU * frequency * 2 * p)) * env
            elif kind == 'paper':
                white = rng.uniform(-1, 1)
                low += .12 * (white - low)
                grain = white - low
                env = math.sin(math.pi * u) ** 1.8
                flutter = .6 + .4 * math.sin(TAU * (23 * p + 12 * p * p)) ** 2
                sample = (grain * .38 + low * .6) * env * flutter
            elif kind == 'whoosh':
                white = rng.uniform(-1, 1)
                low += (.025 + .12 * math.sin(math.pi * u)) * (white - low)
                sample = (low * .9 + .09 * math.sin(TAU * (90 * p + 110 * p * p))) * math.sin(math.pi * u) ** 2
            elif kind == 'impact':
                white = rng.uniform(-1, 1)
                low += .2 * (white - low)
                sample = (.8 * math.sin(TAU * (64 * p + 2.4 * (1 - math.exp(-p * 28)))) * math.exp(-p * 16)
                          + .35 * low * math.exp(-p * 30)
                          + .16 * math.sin(TAU * 820 * p) * math.exp(-p * 65))
            else:
                raise ValueError(kind)
            index = round(start * RATE) + i
            if not 0 <= index < len(self.left):
                continue
            # Gentle movement in the image; bass/impact remain centred.
            moving = pan if kind != 'whoosh' else pan * math.cos(math.pi * u)
            angle = (moving + 1) * math.pi / 4
            self.left[index] += gain * sample * math.cos(angle)
            self.right[index] += gain * sample * math.sin(angle)

    def finish(self, path):
        # Low-level cross-channel reflections add a small, intimate studio tail.
        left, right = array('f', self.left), array('f', self.right)
        for delay, gain in [(.071, .12), (.113, .08), (.179, .045)]:
            offset = int(delay * RATE)
            for i in range(offset, len(left)):
                self.left[i] += right[i - offset] * gain
                self.right[i] += left[i - offset] * gain
        peak = max(max(map(abs, self.left)), max(map(abs, self.right)), 1e-9)
        scale = .65 / peak
        pcm = array('h')
        for i, (left, right) in enumerate(zip(self.left, self.right)):
            t = i / RATE
            fade = min(1, t / .08, max(0, (self.duration - t) / .4))
            pcm.extend((round(math.tanh(left * scale) * fade * 32767),
                        round(math.tanh(right * scale) * fade * 32767)))
        with wave.open(str(path), 'wb') as file:
            file.setnchannels(2); file.setsampwidth(2); file.setframerate(RATE)
            file.writeframes(pcm.tobytes())


def make(kind, out):
    m = Mix(8 if kind == 'intro' else 6)
    if kind == 'intro':
        for f, pan in [(146.832, -.6), (220, .6), (293.665, -.15), (329.628, .2)]:
            m.event(.25, 7.5, 'bed', .024, pan, f)
        m.event(.2, 1.5, 'whoosh', .28, -.6)
        m.event(.7, .65, 'paper', .14, -.7)
        m.event(1.25, .8, 'paper', .14, .7)
        m.event(1.55, 2.2, 'note', .13, -.6, 293.665)
        m.event(1.72, 2.2, 'note', .11, .6, 329.628)
        m.event(2.0, 1.5, 'whoosh', .24, .65)
        m.event(2.8, .55, 'paper', .12, -.4)
        m.event(3.18, .55, 'paper', .12, .4)
        m.event(3.55, 2, 'note', .15, -.25, 440)
        m.event(4.25, 2.6, 'note', .18, .15, 587.33)
        m.event(4.43, 2.6, 'note', .11, -.15, 733.5)
        m.event(4.6, 3.1, 'note', .15, 0, 880)
    else:
        for f, pan in [(146.832, -.4), (220, .4), (293.665, 0)]:
            m.event(.1, 5.6, 'bed', .022, pan, f)
        m.event(.1, 1.1, 'paper', .14, .3)
        m.event(1.35, .95, 'whoosh', .32, -.3)
        m.event(2.35, .55, 'impact', .6)
        m.event(2.39, .35, 'paper', .22)
        m.event(2.8, 2.6, 'note', .15, -.25, 293.665)
        m.event(2.94, 2.5, 'note', .12, .25, 440)
        m.event(3.1, 2.7, 'note', .13, 0, 587.33)
    m.finish(out / f'{kind}-raw.wav')
    (out / f'{kind}-sound-events.json').write_text(json.dumps(m.events, indent=2) + '\n')
    print(f'Original {kind} stereo sound generated ({m.duration}s, {RATE} Hz)')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    for kind in ['intro', 'closing']:
        make(kind, args.output)
