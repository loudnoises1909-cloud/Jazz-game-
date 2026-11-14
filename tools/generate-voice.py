#!/usr/bin/env python3
"""Generate the game's voice lines with Kokoro, an open-source neural text-to-speech model.

Reads every line (text + moods) from index.html, speaks each one with a warm voice at a
pace that fits its moods, and writes voice/<line>.mp3 plus voice/voices.json, the same
files the game loads for recorded voices. Lines you recorded yourself (voice-takes/<line>.*)
are never overwritten.

Needs:  pip install kokoro-onnx soundfile   and ffmpeg
Model files (from https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0):
        kokoro-v1.0.onnx  and  voices-v1.0.bin
Licenses: kokoro-onnx is MIT; the Kokoro model is Apache 2.0.

Examples:
  python3 tools/generate-voice.py --model /path/kokoro-v1.0.onnx --voices /path/voices-v1.0.bin
  python3 tools/generate-voice.py ... --voice "af_heart:0.7,af_bella:0.3"      # blend two voices
  python3 tools/generate-voice.py ... --samples /tmp/samples                    # compare voices
"""
import argparse, glob, json, os, re, subprocess, sys, tempfile

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# pace for each mood (1.0 = normal speed); a line's pace is the average of its phrases' moods
PACE = {'happy': 1.0, 'excited': 1.06, 'celebrate': 1.08, 'question': .95, 'gentle': .9, 'cozy': .86, 'worried': .9, 'slow': .74}


def read_lines():
    src = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    block = src[src.index('const LINES = ['):]
    block = block[:block.index('];')]
    out = []
    for m in re.finditer(r"\{ k: '([A-Za-z0-9_]+)', t: (?:'([^']*)'|\"([^\"]*)\"), m: '([a-z,]+)' \}", block):
        text = m.group(2) if m.group(2) is not None else m.group(3)
        out.append((m.group(1), text, m.group(4).split(',')))
    if not out:
        sys.exit('no lines found in index.html')
    return out


def spoken_text(text):
    # phrases are separated by "|" in the game; keep their punctuation, which Kokoro uses for intonation
    return re.sub(r'\s+', ' ', text.replace('|', ' ')).strip()


def voice_style(kokoro, spec):
    if ',' not in spec and ':' not in spec:
        return spec
    style = None
    for part in spec.split(','):
        name, w = (part.split(':') + ['1'])[:2]
        v = kokoro.get_voice_style(name.strip()) * float(w)
        style = v if style is None else style + v
    return style


def synth(kokoro, voice, text, speed, wav_path):
    samples, sr = kokoro.create(text, voice=voice, speed=speed, lang='en-us')
    pad = np.zeros(int(sr * .12), dtype=samples.dtype)  # a little air before and after
    sf.write(wav_path, np.concatenate([pad, samples, pad]), sr)


def to_mp3(wav_path, mp3_path, warmth):
    # a very slight lift in pitch for a sweeter sound, then even out the loudness
    af = f'rubberband=pitch={warmth},highpass=f=70,loudnorm=I=-16:TP=-1.5:LRA=11' if warmth != 1 else 'highpass=f=70,loudnorm=I=-16:TP=-1.5:LRA=11'
    subprocess.run(['ffmpeg', '-nostdin', '-y', '-loglevel', 'error', '-i', wav_path, '-ac', '1', '-ar', '44100',
                    '-af', af, '-codec:a', 'libmp3lame', '-b:a', '96k', mp3_path], check=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--model', required=True)
    ap.add_argument('--voices', required=True)
    ap.add_argument('--voice', default='af_heart', help='a Kokoro voice, or a blend like "af_heart:0.7,af_bella:0.3"')
    ap.add_argument('--warmth', type=float, default=1.03, help='pitch factor; 1.0 leaves the voice as is')
    ap.add_argument('--only', help='comma-separated line keys to (re)generate')
    ap.add_argument('--samples', help='write a comparison of several voices into this folder instead')
    a = ap.parse_args()

    kokoro = Kokoro(a.model, a.voices)
    lines = read_lines()
    tmp = tempfile.mkdtemp()

    if a.samples:
        os.makedirs(a.samples, exist_ok=True)
        pick = [l for l in lines if l[0] in ('welcome', 'p_scrape', 'w_fluff', 'healed')]
        text = ' '.join(spoken_text(t) for _, t, _ in pick)
        for spec in ['af_heart', 'af_bella', 'af_nicole', 'af_sarah', 'af_aoede', 'af_heart:0.6,af_bella:0.4']:
            wav = os.path.join(tmp, 'sample.wav')
            synth(kokoro, voice_style(kokoro, spec), text, .95, wav)
            name = spec.replace(':', '').replace(',', '+').replace('.', '')
            to_mp3(wav, os.path.join(a.samples, f'voice-sample-{name}.mp3'), a.warmth)
            print('sample', spec)
        return

    voice = voice_style(kokoro, a.voice)
    out_dir = os.path.join(ROOT, 'voice'); os.makedirs(out_dir, exist_ok=True)
    recorded = {os.path.splitext(os.path.basename(f))[0] for f in glob.glob(os.path.join(ROOT, 'voice-takes', '*'))}
    only = set(a.only.split(',')) if a.only else None
    made = 0
    for key, text, moods in lines:
        if only and key not in only:
            continue
        if key in recorded:
            print('keep recorded', key); continue
        speed = round(sum(PACE.get(m, 1) for m in moods) / len(moods), 3)
        wav = os.path.join(tmp, key + '.wav')
        synth(kokoro, voice, spoken_text(text), speed, wav)
        to_mp3(wav, os.path.join(out_dir, key + '.mp3'), a.warmth)
        made += 1
        print(f'{key:12} pace {speed}  "{spoken_text(text)}"')

    have = {k: k + '.mp3' for k, _, _ in lines if os.path.exists(os.path.join(out_dir, k + '.mp3'))}
    json.dump(have, open(os.path.join(out_dir, 'voices.json'), 'w'), indent=1)
    print(f'made {made} file(s); voice/voices.json lists {len(have)} of {len(lines)} lines')


if __name__ == '__main__':
    main()
