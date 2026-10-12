import { describe, expect, it } from 'vitest';
import { freshSeed } from '../src/seed';
const fixed = (value: number) => ({ getRandomValues: (array: Uint32Array) => { array[0] = value; return array; } });
describe('fresh ride seeds', () => {
  it('uses the cryptographic source and never returns zero', () => {
    expect(freshSeed(fixed(123456789))).toBe(123456789);
    expect(freshSeed(fixed(0))).toBeGreaterThan(0);
  });
  it('falls back to a valid seed when the source is missing or throws', () => {
    for (const source of [undefined, { getRandomValues: () => { throw new Error('blocked'); } }]) {
      const seed = freshSeed(source as never);
      expect(Number.isInteger(seed)).toBe(true); expect(seed).toBeGreaterThan(0); expect(seed).toBeLessThanOrEqual(0xffffffff);
    }
  });
  it('gives different layouts from one ride to the next', () => {
    expect(new Set(Array.from({ length: 20 }, () => freshSeed())).size).toBeGreaterThan(15);
  });
});
