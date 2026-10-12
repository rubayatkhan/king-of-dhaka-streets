import { describe, expect, it } from 'vitest';
import {
  BASE_POWER_UPS,
  STOMACH_DELAY,
  STOMACH_SECONDS,
  eatSnack,
  newEffects,
  stomachChance,
  tickEffects,
} from '../src/pickups';

describe('street food effects', () => {
  it('raises the upset-stomach chance with every snack, lowered by chaap upgrades', () => {
    expect([0, 1, 2, 3].map(n => stomachChance(n, 0))).toEqual(
      [0.1, 0.25, 0.4, 0.55].map(v => expect.closeTo(v, 10)),
    );
    expect(stomachChance(0, 0.1)).toBeCloseTo(0);
    expect(stomachChance(2, 0.1)).toBeCloseTo(0.3);
    expect(stomachChance(9, 0)).toBe(1);
    expect(stomachChance(0, 0.5)).toBe(0);
  });

  it('gives each snack its power for the upgraded duration', () => {
    const e = newEffects();
    const stats = { ...BASE_POWER_UPS, chaSeconds: 7, magnetSeconds: 8 };

    eatSnack(e, 'cha', stats, 0.99);
    expect(e.boost).toBe(7);

    eatSnack(e, 'jhalmuri', stats, 0.99);
    expect(e.magnet).toBe(8);

    eatSnack(e, 'chaap', stats, 0.99);
    expect(e.belly).toBe(true);

    expect(e.snacksEaten).toBe(3);
    expect(e.stomachPending).toBe(-1);
  });

  it('queues one upset stomach on an unlucky roll and never stacks a second', () => {
    const e = newEffects();

    expect(eatSnack(e, 'cha', BASE_POWER_UPS, 0.05)).toBe(true);
    expect(e.stomachPending).toBe(STOMACH_DELAY);

    expect(eatSnack(e, 'cha', BASE_POWER_UPS, 0)).toBe(false);
    expect(e.stomachPending).toBe(STOMACH_DELAY);
  });

  it('starts the stomach after its delay, waits during a rear-threat warning, then wears off', () => {
    const e = newEffects();
    e.stomachPending = STOMACH_DELAY;

    expect(tickEffects(e, 1, true)).toBe(false);
    expect(e.stomachPending).toBe(STOMACH_DELAY);

    expect(tickEffects(e, 1, false)).toBe(false);
    expect(tickEffects(e, 0.6, false)).toBe(true);
    expect(e.stomach).toBe(STOMACH_SECONDS);

    tickEffects(e, STOMACH_SECONDS, false);
    expect(e.stomach).toBe(0);
  });

  it('counts boost and magnet down to zero', () => {
    const e = newEffects();
    e.boost = 1;
    e.magnet = 0.5;

    tickEffects(e, 0.75, false);
    expect(e.boost).toBeCloseTo(0.25);
    expect(e.magnet).toBe(0);
  });
});
