import { describe, expect, it } from 'vitest';
import { MAGNET_FADE_SECONDS, SHAKE_SECONDS, SQUASH_SECONDS, landingSquash, magnetOpacity, shakeOffset } from '../src/feel';
describe('ride feel', () => {
  it('shakes within the amplitude, fades out, and is a third as strong with a gentler camera', () => {
    expect(shakeOffset(0, 0.35, 1.7, false)).toEqual({ x: 0, y: 0 });
    for (let clock = 0; clock < 3; clock += 0.013) {
      const full = shakeOffset(SHAKE_SECONDS, 0.35, clock, false), gentle = shakeOffset(SHAKE_SECONDS, 0.35, clock, true);
      expect(Math.abs(full.x)).toBeLessThanOrEqual(0.35); expect(Math.abs(full.y)).toBeLessThanOrEqual(0.35);
      expect(gentle.x).toBeCloseTo(full.x / 3, 10); expect(gentle.y).toBeCloseTo(full.y / 3, 10);
    }
    const late = shakeOffset(SHAKE_SECONDS * 0.1, 0.35, 0.3, false), early = shakeOffset(SHAKE_SECONDS, 0.35, 0.3, false);
    expect(Math.abs(late.x)).toBeCloseTo(Math.abs(early.x) * 0.1, 10);
  });
  it('squashes briefly on landing and returns to full height', () => {
    expect(landingSquash(Infinity)).toBe(1); expect(landingSquash(0)).toBe(1); expect(landingSquash(SQUASH_SECONDS)).toBe(1);
    expect(landingSquash(SQUASH_SECONDS / 2)).toBeCloseTo(0.85);
    expect(landingSquash(NaN)).toBe(1);
  });
  it('fades the magnet field out smoothly instead of blinking, with no pulse on the gentler camera', () => {
    expect(magnetOpacity(5, 0.37, false)).toBe(1); expect(magnetOpacity(0, 0.37, false)).toBe(0);
    for (let t = 0; t < 2; t += 0.01) {
      expect(magnetOpacity(MAGNET_FADE_SECONDS / 2, t, true)).toBeCloseTo(0.5, 10);
      const o = magnetOpacity(MAGNET_FADE_SECONDS / 2, t, false);
      expect(o).toBeGreaterThanOrEqual(0.35); expect(o).toBeLessThanOrEqual(0.5);
    }
    // The pulse repeats no faster than twice a second (well under the three-flashes guideline).
    let peaks = 0;
    for (let t = 0.001; t < 1; t += 0.001) { const [a, b, c] = [t - 0.001, t, t + 0.001].map(x => magnetOpacity(1, x, false)); if (b > a && b >= c) peaks++; }
    expect(peaks).toBeLessThanOrEqual(2);
  });
});
