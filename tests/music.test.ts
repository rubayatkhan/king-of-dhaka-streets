import { describe, expect, it } from 'vitest';
import { BPM, LAYERS, LOOP_SECONDS, LOOP_STEPS, MEDAL, STEP_SECONDS, layerGains, patternSteps, type Scene } from '../src/music';

const scenes: Scene[] = ['menu', 'bazaar', 'riverfront', 'boulevard'];
const ride = (patch = {}) => ({ scene: 'bazaar' as Scene, speed: .5, combo: 0, boost: false, playing: true, ...patch });

describe('adaptive music', () => {
  it('keeps every layer on one 96 BPM grid that loops every 40 seconds', () => {
    expect(BPM).toBe(96); expect(STEP_SECONDS).toBeCloseTo(60 / 96 / 4, 9); expect(LOOP_SECONDS).toBeCloseTo(40, 9);
    for (const s of scenes) for (const l of LAYERS) expect(patternSteps(s, l)).toHaveLength(LOOP_STEPS);
  });

  it('gives every ride district a groove, an energy layer and a boost layer, and the menu only its theme', () => {
    const hits = (s: Scene, l: (typeof LAYERS)[number]) => patternSteps(s, l).filter(r => r.length).length;
    for (const s of ['bazaar', 'riverfront', 'boulevard'] as const) for (const l of LAYERS) expect(hits(s, l), `${s}/${l}`).toBeGreaterThan(16);
    expect(hits('menu', 'base')).toBeGreaterThan(16); expect(hits('menu', 'energy')).toBe(0); expect(hits('menu', 'boost')).toBe(0);
  });

  it('colours each district with its own instruments', () => {
    const waves = (s: Scene) => new Set(patternSteps(s, 'base').flat().flat().map(n => n.kind === 'tone' && n.vibrato ? 'bansuri' : n.kind === 'tone' && n.wave === 'sawtooth' ? 'harmonium' : n.kind));
    expect(waves('riverfront').has('bansuri')).toBe(true);
    expect(waves('bazaar').has('harmonium')).toBe(true); expect(waves('bazaar').has('bansuri')).toBe(false);
  });

  it('raises the energy layer with speed and combo, adds the boost layer on cha, and is silent when not playing', () => {
    expect(layerGains(ride({ speed: 1 })).energy).toBeGreaterThan(layerGains(ride({ speed: 0 })).energy);
    expect(layerGains(ride({ combo: 6 })).energy).toBeGreaterThan(layerGains(ride()).energy);
    expect(layerGains(ride({ speed: 9, combo: 99 })).energy).toBeLessThanOrEqual(.85);
    expect(layerGains(ride({ boost: true })).boost).toBeGreaterThan(0); expect(layerGains(ride()).boost).toBe(0);
    expect(layerGains(ride({ playing: false }))).toEqual({ base: 0, energy: 0, boost: 0 });
    expect(layerGains(ride({ scene: 'menu', speed: 1, boost: true }))).toEqual({ base: .8, energy: 0, boost: 0 });
  });

  it('keeps every music note within the mix ceiling and inside its own bar', () => {
    for (const s of scenes) for (const l of LAYERS) for (const recipes of patternSteps(s, l)) for (const n of recipes.flat()) {
      expect(n.vol).toBeGreaterThan(0); expect(n.vol).toBeLessThanOrEqual(.3); expect((n.at ?? 0) + n.dur).toBeLessThanOrEqual(16 * STEP_SECONDS + 1e-9);
    }
    expect(MEDAL.length).toBeGreaterThan(4);
  });
});
