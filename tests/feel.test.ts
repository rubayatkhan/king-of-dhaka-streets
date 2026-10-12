import { describe, expect, it } from 'vitest';
import { SHAKE_SECONDS, SQUASH_SECONDS, landingSquash, shakeOffset } from '../src/feel';
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
});
