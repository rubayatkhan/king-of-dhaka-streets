import { describe, expect, it } from 'vitest';
import { FOLK_SCALE, JUMP_SOUND, SOUNDS, coinRecipe, transpose, type Recipe } from '../src/soundbank';
import { VEHICLES } from '../src/simulation';

const pitches = (r: Recipe) => r.flatMap(n => n.kind === 'tone' ? [n.f] : []);

describe('the Dhaka sound bank', () => {
  it('keeps every note audible, short and below the mix ceiling', () => {
    for (const [id, recipe] of Object.entries(SOUNDS)) {
      expect(recipe.length, id).toBeGreaterThan(0);
      for (const n of recipe) {
        expect(n.vol, id).toBeGreaterThan(0); expect(n.vol, id).toBeLessThanOrEqual(0.3);
        expect(n.dur, id).toBeGreaterThan(0); expect((n.at ?? 0) + n.dur, id).toBeLessThanOrEqual(2.5);
        expect(n.f, id).toBeGreaterThan(20); expect(n.f, id).toBeLessThan(12000);
      }
    }
  });

  it('climbs a folk scale as a coin chain grows, then wraps', () => {
    const base = pitches(coinRecipe(1, 1))[0];
    FOLK_SCALE.forEach((step, k) => expect(pitches(coinRecipe(1, k + 1))[0]).toBeCloseTo(base * 2 ** (step / 12), 3));
    expect(pitches(coinRecipe(1, FOLK_SCALE.length + 1))[0]).toBeCloseTo(base, 3);
    expect(pitches(coinRecipe(1, 0))[0]).toBeCloseTo(base, 3); expect(pitches(coinRecipe(1, Number.NaN))[0]).toBeCloseTo(base, 3);
  });

  it('gives the ৳5 coin a deeper double jingle', () => {
    const five = pitches(coinRecipe(5, 1));
    expect(five.length).toBeGreaterThanOrEqual(2); expect(five[0]).toBeLessThan(pitches(coinRecipe(1, 1))[0]);
  });

  it('gives every vehicle its own jump sound', () => {
    const ids = VEHICLES.map(v => JUMP_SOUND[v.id]);
    expect(new Set(ids).size).toBe(VEHICLES.length);
    for (const id of ids) expect(SOUNDS[id]).toBeDefined();
  });

  it('transposes pitched notes and leaves noise alone', () => {
    const up = transpose([{ kind: 'tone', f: 440, to: 220, dur: .1, vol: .1, wave: 'sine' }, { kind: 'noise', filter: 'lowpass', f: 500, dur: .1, vol: .1 }], 12);
    expect(up[0]).toMatchObject({ f: 880, to: 440 }); expect(up[1]).toMatchObject({ f: 500 });
  });
});
