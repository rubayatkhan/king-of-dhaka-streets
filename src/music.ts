import type { Recipe, ToneNote } from './soundbank';
import type { District } from './voices';

// Original adaptive music: a baul-flavoured groove of ektara, dhol and harmonium, with a bansuri at the river and a
// band feel on the boulevard. Every layer shares one 96 BPM grid of sixteenth notes that loops every 16 bars (40 s),
// the same length a generated district bed is cut to, so the layers stay locked to it.
export const BPM = 96, STEPS_PER_BAR = 16, BARS = 16, LOOP_STEPS = STEPS_PER_BAR * BARS;
export const STEP_SECONDS = 60 / BPM / 4, LOOP_SECONDS = LOOP_STEPS * STEP_SECONDS;
export type Scene = 'menu' | District;
export type Layer = 'base' | 'energy' | 'boost';
export const LAYERS: readonly Layer[] = ['base', 'energy', 'boost'];
export interface MusicState { scene: Scene; speed: number; combo: number; boost: boolean; playing: boolean }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : 0));
export function layerGains(s: MusicState): Record<Layer, number> {
  if (!s.playing) return { base: 0, energy: 0, boost: 0 };
  if (s.scene === 'menu') return { base: .8, energy: 0, boost: 0 };
  return { base: .7, energy: clamp(.15 + clamp(s.speed, 0, 1) * .55 + Math.min(clamp(s.combo, 0, 99), 8) * .05, 0, .85), boost: s.boost ? .75 : 0 };
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const tone = (f: number, dur: number, vol: number, wave: OscillatorType, extra: Partial<ToneNote> = {}): ToneNote => ({ kind: 'tone', f, dur, vol, wave, ...extra });
export function dhol(stroke: 'dha' | 'dhin' | 'ta', vol = 1): Recipe {
  if (stroke === 'dha') return [tone(110, .32, .2 * vol, 'sine', { to: 62 }), { kind: 'noise', filter: 'lowpass', f: 420, dur: .08, vol: .06 * vol }];
  if (stroke === 'dhin') return [tone(196, .22, .12 * vol, 'sine', { to: 150 }), { kind: 'noise', filter: 'bandpass', f: 1400, q: 1.2, dur: .06, vol: .05 * vol }];
  return [{ kind: 'noise', filter: 'highpass', f: 3500, dur: .05, vol: .06 * vol }];
}
export const ektara = (midi: number, vol = 1): Recipe => [tone(hz(midi) * 1.01, .42, .07 * vol, 'triangle', { to: hz(midi) }), tone(hz(midi + 12), .18, .025 * vol, 'sine')];
export const harmonium = (midi: number, dur: number, vol = 1): Recipe => [tone(hz(midi), dur, .045 * vol, 'sawtooth', { attack: .08, lowpass: 1600 }), tone(hz(midi) * 1.004, dur, .03 * vol, 'sawtooth', { attack: .08, lowpass: 1600 })];
export const bansuri = (midi: number, dur: number, vol = 1): Recipe => [tone(hz(midi), dur, .05 * vol, 'sine', { attack: .06, vibrato: 5 }), { kind: 'noise', filter: 'bandpass', f: hz(midi) * 2, q: 8, dur: dur * .6, vol: .01 * vol }];

// D natural minor, the mode of many Bangla folk tunes; degrees past 6 climb an octave.
const ROOT = 62, MODE = [0, 2, 3, 5, 7, 8, 10];
const deg = (d: number) => ROOT + 12 * Math.floor(d / 7) + MODE[((d % 7) + 7) % 7];
// The tune, one eighth note per entry (-1 is a rest); four 2-bar phrases fill 8 bars and repeat.
const TUNE = [0, -1, 2, 3, 4, -1, 3, 2, 0, -1, -1, 1, 2, -1, 0, -1, 4, -1, 5, 4, 3, -1, 2, 3, 4, -1, -1, 2, 1, -1, 0, -1,
  0, -1, 2, 3, 4, -1, 5, 7, 6, -1, 4, -1, 3, 2, 1, -1, 2, -1, 1, 0, 1, -1, 2, -1, 0, -1, -1, -1, 0, -1, -1, -1];
const BAR = STEPS_PER_BAR * STEP_SECONDS;

const memo = new Map<string, Recipe[][]>();
export function patternSteps(scene: Scene, layer: Layer): readonly Recipe[][] {
  const key = `${scene}/${layer}`, cached = memo.get(key);
  if (cached) return cached;
  const steps: Recipe[][] = Array.from({ length: LOOP_STEPS }, () => []);
  const at = (step: number, recipe: Recipe) => { if (step >= 0 && step < LOOP_STEPS) steps[step].push(recipe); };
  for (let bar = 0; bar < BARS; bar++) {
    const s = bar * STEPS_PER_BAR, fill = bar % 4 === 3;
    const note = (k: number) => TUNE[((bar % 8) * 8 + k) % TUNE.length];
    if (layer === 'base') {
      if (scene === 'menu') {
        at(s, harmonium(deg(bar % 2 ? 4 : 0) - 12, BAR * .95, .7));
        for (let k = 0; k < 8; k += 2) if (note(k) >= 0) at(s + k * 2, ektara(deg(note(k)), .8));
        if (bar % 2 === 0) at(s, dhol('dha', .4));
      } else if (scene === 'bazaar') {
        [0, 8].forEach(k => at(s + k, dhol('dha'))); [4, 10, 14].forEach(k => at(s + k, dhol('dhin'))); [6, 12].forEach(k => at(s + k, dhol('ta')));
        at(s, harmonium(deg(bar % 4 === 2 ? 3 : 0) - 12, BAR * .95, .8));
        for (let k = 0; k < 8; k++) if (note(k) >= 0) at(s + k * 2, ektara(deg(note(k))));
      } else if (scene === 'riverfront') {
        at(s, dhol('dha', .6)); at(s + 8, dhol('dha', .5)); at(s + 12, dhol('dhin', .5));
        for (let k = 0; k < 16; k += 4) at(s + k, ektara(deg(k % 8 ? 4 : 0) - 12, .6));
        for (let k = 0; k < 8; k += 2) if (note(k) >= 0) at(s + k * 2, bansuri(deg(note(k)) + 12, STEP_SECONDS * 4 * .95));
      } else {
        [0, 6, 8].forEach(k => at(s + k, dhol('dha'))); [4, 12].forEach(k => at(s + k, dhol('dhin', 1.1))); [2, 10, 14].forEach(k => at(s + k, dhol('ta', .8)));
        [0, 8].forEach(k => at(s + k, ektara(deg(bar % 2 ? 4 : 0) - 24, 1.2)));
        [2, 6, 10, 14].forEach(k => at(s + k, harmonium(deg(note(k / 2)) >= ROOT ? deg(Math.max(0, note(k / 2))) : ROOT, STEP_SECONDS * 1.5, .9)));
      }
    } else if (scene !== 'menu' && layer === 'energy') {
      for (let k = 0; k < 16; k += 2) at(s + k, dhol('ta', .5 + (k % 4 ? 0 : .2)));
      if (fill) [9, 11, 13, 15].forEach(k => at(s + k, dhol('dhin', .7)));
      at(s + 15, dhol('dha', .5));
    } else if (scene !== 'menu' && layer === 'boost') {
      const arp = [0, 2, 4, 7];
      for (let k = 0; k < 16; k++) at(s + k, harmonium(deg(arp[k % 4] + (bar % 2 ? 1 : 0)), STEP_SECONDS * .9, .6));
      for (let k = 0; k < 16; k += 4) at(s + k, dhol('dha', .6));
    }
  }
  memo.set(key, steps);
  return steps;
}

// A dhol flourish for a medal: a quick roll into two big strokes.
export const MEDAL: Recipe = [...[0, .07, .14, .21, .28].flatMap(at => dhol('dhin', .8).map(n => ({ ...n, at }))), ...dhol('dha', 1.2).map(n => ({ ...n, at: .4 })), ...dhol('dha', 1.4).map(n => ({ ...n, at: .7 })), ...harmonium(deg(7), .9, 1).map(n => ({ ...n, at: .7 }))];
