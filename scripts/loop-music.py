#!/usr/bin/env python3
"""Tempo-lock a generated bed to 96 BPM and cut a seamless 16-bar (40 s) loop.
Usage: python3 -I scripts/loop-music.py <in-audio> <out.mp3>
"""
import subprocess, sys, tempfile, os
import numpy as np

BPM, BARS, SR = 96.0, 16, 22050
LOOP = BARS * 4 * 60.0 / BPM

def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)

def onset_envelope(x, hop=256):
    frames = len(x) // hop
    energy = np.array([np.sum(x[i * hop:(i + 1) * hop] ** 2) for i in range(frames)])
    flux = np.maximum(0, np.diff(np.log1p(energy * 1000), prepend=0))
    return flux - flux.mean(), SR / hop

def tempo(env, rate):
    lags = np.arange(int(rate * 60 / 140), int(rate * 60 / 70))
    ac = np.array([np.dot(env[:-l], env[l:]) for l in lags])
    return 60.0 * rate / lags[int(np.argmax(ac))]

def first_downbeat(env, rate, bpm):
    beat = int(round(rate * 60 / bpm)); scores = [env[o::beat * 4].sum() for o in range(beat * 4)]
    return int(np.argmax(scores)) / rate

def main(src, out):
    x = decode(src); env, rate = onset_envelope(x); found = tempo(env, rate)
    factor = BPM / found
    if found * 2 > 70 and abs(BPM / (found * 2) - 1) < abs(factor - 1): factor = BPM / (found * 2)
    if found / 2 > 70 and abs(BPM / (found / 2) - 1) < abs(factor - 1): factor = BPM / (found / 2)
    with tempfile.TemporaryDirectory() as tmp:
        locked = os.path.join(tmp, 'locked.wav')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af', f'atempo={factor:.6f}', '-ar', '44100', locked], check=True)
        start = first_downbeat(onset_envelope(decode(locked))[0], rate, BPM)
        fade = 0.03
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{start:.4f}', '-t', f'{LOOP + fade:.4f}', '-i', locked,
            '-af', f'afade=t=in:d={fade},afade=t=out:st={LOOP - fade:.4f}:d={fade},atrim=0:{LOOP:.4f},loudnorm=I=-20:TP=-2:LRA=11',
            '-ar', '44100', '-ac', '2', '-b:a', '96k', out], check=True)
    print(f'found {found:.1f} BPM, stretched x{factor:.4f}, downbeat {start:.3f}s, loop {LOOP:.2f}s -> {out}')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
