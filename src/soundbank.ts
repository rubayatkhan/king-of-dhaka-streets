import type { VehicleKind } from './simulation';

// Every effect is data: short notes of original synthesis, shaped after Dhaka street sounds.
export interface ToneNote { kind: 'tone'; f: number; to?: number; dur: number; vol: number; wave: OscillatorType; at?: number; attack?: number; vibrato?: number; lowpass?: number }
export interface NoiseNote { kind: 'noise'; filter: BiquadFilterType; f: number; to?: number; q?: number; dur: number; vol: number; at?: number }
export type Note = ToneNote | NoiseNote;
export type Recipe = readonly Note[];

const t = (f: number, dur: number, vol: number, wave: OscillatorType = 'sine', at = 0, to?: number, extra: Partial<ToneNote> = {}): ToneNote => ({ kind: 'tone', f, dur, vol, wave, at, ...(to ? { to } : {}), ...extra });
const n = (filter: BiquadFilterType, f: number, dur: number, vol: number, at = 0, to?: number, q?: number): NoiseNote => ({ kind: 'noise', filter, f, dur, vol, at, ...(to ? { to } : {}), ...(q ? { q } : {}) });

export const SOUNDS = {
  coin1: [t(1046.5, .12, .06, 'triangle'), t(3139.5, .05, .015, 'sine', .004)],                                   // a bright poisha clink
  coin5: [t(659.3, .16, .07, 'triangle'), t(987.8, .18, .055, 'triangle', .09), n('bandpass', 5200, .05, .025, .09)], // a deeper double jingle
  cha: [t(2093, .08, .05), n('bandpass', 1700, .45, .045, .08, 900, 2)],                                          // glass clink, then a pour
  jhalmuri: [t(1320, .06, .06, 'square', 0, undefined, { lowpass: 3000 }), t(1320, .06, .05, 'square', .14, undefined, { lowpass: 3000 }), t(1320, .07, .06, 'square', .28, undefined, { lowpass: 3000 })], // tin and spoon: tong-tong-tong
  chaap: [n('highpass', 3200, .7, .045, 0, 2200), t(180, .2, .025, 'sawtooth', 0, 120, { lowpass: 600 })],       // sizzling tawa
  belly: [t(110, .25, .12, 'sine', 0, 80), t(150, .32, .06, 'sawtooth', .24, 85, { lowpass: 500 })],              // thud, then a burp
  stomach: [t(140, .45, .08, 'sine', 0, 70), t(95, .35, .05, 'triangle', .22, 150), t(196, .8, .045, 'sawtooth', .4, 185, { vibrato: 6, lowpass: 1400, attack: .06 })], // gurgle and a wobbly harmonium note
  'jump-bicycle': [t(330, .16, .07, 'triangle', 0, 660), t(1568, .3, .06, 'sine', .05)],                           // spring creak and a bell ding
  'jump-motorbike': [t(110, .22, .08, 'sawtooth', 0, 260, { lowpass: 1200 })],                                    // a rev blip
  'jump-rickshaw': [n('bandpass', 700, .2, .05, 0, 420, 5), t(240, .12, .035, 'triangle', .02, 180)],              // chassis creak
  'jump-car': [t(92, .2, .16, 'sine', 0, 62)],                                                                    // suspension thump
  'jump-truck': [t(68, .28, .2, 'sine', 0, 46), n('lowpass', 420, .14, .06)],                                     // heavy clunk
  pothole: [t(74, .22, .3), n('bandpass', 900, .26, .06, .05, 560, 3), t(190, .05, .04, 'square', .1, undefined, { lowpass: 900 })], // thunk and chassis rattle
  impact: [t(74, .22, .3), t(142, .09, .09, 'triangle')],
  'near-miss': [t(587.3, .15, .065), t(881, .21, .045, 'sine', .07)],
  'bus-slap': [n('lowpass', 900, .07, .16), n('lowpass', 900, .07, .16, .15)],                                   // thak-thak on the bus side
  'rickshaw-tring': [t(1568, .18, .06), t(2420, .1, .02), t(1568, .18, .06, 'sine', .2), t(2420, .1, .02, 'sine', .2)],
  'truck-call': [t(392, .16, .07, 'sawtooth', 0, undefined, { lowpass: 1800 }), t(494, .16, .07, 'sawtooth', .18, undefined, { lowpass: 1800 }), t(587, .3, .07, 'sawtooth', .36, undefined, { lowpass: 1800 })], // a passing truck's melodic pressure horn
  'cng-putter': [t(42, .4, .05, 'square', 0, 48, { lowpass: 380 })],
  'launch-horn': [t(98, 1.15, .065, 'triangle', 0, 87), t(147, .95, .025, 'sine', .08)],                           // a deep river launch
  'water-lap': [n('lowpass', 520, .9, .045, 0, 280), n('lowpass', 420, .7, .03, .5, 260)],
  crow: [t(820, .16, .04, 'sawtooth', 0, 620, { lowpass: 2600 }), t(780, .18, .04, 'sawtooth', .24, 590, { lowpass: 2600 })],
  'conch-saw': [n('bandpass', 2600, .22, .03, 0, 3400, 6), n('bandpass', 2600, .22, .03, .3, 3400, 6), n('bandpass', 2600, .22, .03, .6, 3400, 6)], // conch-shell workshop sawing
  'sack-thump': [t(60, .18, .12, 'sine', 0, 40), n('lowpass', 300, .1, .05)],
  'icecream-bell': [t(1760, .25, .035), t(1568, .25, .035, 'sine', .18), t(1318.5, .4, .035, 'sine', .36)],
  'bike-bell': [t(1568, .65, .17), t(2420, .35, .055), t(1568, .5, .1, 'sine', .13)],
  'traffic-horn': [t(330, .24, .05, 'sawtooth', 0, undefined, { lowpass: 1400 }), t(415, .24, .05, 'triangle', 0, undefined, { lowpass: 1400 })], // a short, quiet two-tone car or bus horn, nothing like the rider's own bell
} satisfies Record<string, Recipe>;
export type SoundId = keyof typeof SOUNDS;

// A pentatonic folk scale: a coin trail plays a short rising phrase.
export const FOLK_SCALE = [0, 2, 3, 7, 9, 12, 14, 15, 19];

export function transpose(recipe: Recipe, semitones: number): Recipe {
  const k = 2 ** (semitones / 12);
  return recipe.map(n => n.kind === 'tone' ? { ...n, f: n.f * k, ...(n.to ? { to: n.to * k } : {}) } : n);
}

export function coinRecipe(value: 1 | 5, chain: number): Recipe {
  const k = (Math.max(1, Math.floor(chain) || 1) - 1) % FOLK_SCALE.length;
  return transpose(value === 5 ? SOUNDS.coin5 : SOUNDS.coin1, FOLK_SCALE[k]);
}

export const JUMP_SOUND: Record<VehicleKind, SoundId> = { bicycle: 'jump-bicycle', rickshaw: 'jump-rickshaw', motorbike: 'jump-motorbike', car: 'jump-car', truck: 'jump-truck' };

const s = 'sawtooth' as const;
// Each vehicle's own bell or horn; the Bazaar sells a second voice for every ride (original melodies).
export const HORNS = {
  'bike-bell': SOUNDS['bike-bell'],
  'bike-bell-brass': [t(1975.5, .45, .14), t(2960, .3, .05), t(1975.5, .45, .12, 'sine', .11), t(2960, .3, .045, 'sine', .11), t(1975.5, .5, .1, 'sine', .22)],
  'rickshaw-bell': SOUNDS['rickshaw-tring'],
  'rickshaw-bell-double': [t(1396.9, .16, .08), t(2093, .12, .03), t(1396.9, .16, .08, 'sine', .13), t(1568, .16, .08, 'sine', .26), t(2349, .12, .03, 'sine', .26), t(1568, .2, .08, 'sine', .39)],
  'motorbike-beep': [t(523.3, .16, .1, 'square', 0, undefined, { lowpass: 2200 }), t(523.3, .16, .1, 'square', .2, undefined, { lowpass: 2200 })],
  'motorbike-horn-musical': [t(659.3, .14, .09, 'square', 0, undefined, { lowpass: 2400 }), t(784, .14, .09, 'square', .15, undefined, { lowpass: 2400 }), t(987.8, .22, .09, 'square', .3, undefined, { lowpass: 2400 })],
  'car-horn': [t(349.2, .3, .11, 'triangle'), t(440, .35, .08, 'triangle')],
  'car-horn-taxi': [t(415.3, .1, .1, s, 0, undefined, { lowpass: 1600 }), t(523.3, .1, .08, s, 0, undefined, { lowpass: 1600 }), t(415.3, .1, .1, s, .14, undefined, { lowpass: 1600 }), t(523.3, .1, .08, s, .14, undefined, { lowpass: 1600 })],
  'truck-horn': [t(116.5, .7, .16, s), t(155.6, .65, .1, 'triangle'), t(233.1, .5, .04)],
  'truck-horn-melody': [392, 440, 493.9, 587.3, 493.9, 440, 392].map((f, i) => t(f, i === 6 ? .4 : .17, .09, s, i * .18, undefined, { lowpass: 2000 })),
  'truck-horn-ship': [t(87.3, 1.2, .16, s, 0, undefined, { lowpass: 700 }), t(130.8, 1.1, .1, 'triangle'), t(174.6, .9, .05, 'sine', .05)],
} satisfies Record<string, Recipe>;
export type HornId = keyof typeof HORNS;
export const DEFAULT_HORN: Record<VehicleKind, HornId> = { bicycle: 'bike-bell', rickshaw: 'rickshaw-bell', motorbike: 'motorbike-beep', car: 'car-horn', truck: 'truck-horn' };
