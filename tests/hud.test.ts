import { describe, expect, it } from 'vitest';
import { heartsLabel, raceBar, shavesChip } from '../src/hud';

const ride = (distance: number, elapsed: number, routeLength = 650, parTime = 74) => raceBar({ distance, routeLength, elapsed, parTime });

describe('the race bar', () => {
  it('starts a fresh ride at the start line with the whole gold clock and level with gold pace', () => {
    const r = ride(0, 0);
    expect(r).toMatchObject({ covered: 0, pace: 0, metresLeft: 650, goldSecondsLeft: 74, ahead: true, goldGone: false });
    expect(r.distanceLabel).toBe('650 m to go');
    expect(r.clockLabel).toBe('74 s for gold');
  });
  it('puts the gold line where gold pace would be now and knows whether the rider is ahead of it', () => {
    const r = ride(325, 30);
    expect(r.covered).toBeCloseTo(.5); expect(r.pace).toBeCloseTo(30 / 74);
    expect(r.ahead).toBe(true);
    expect(r).toMatchObject({ metresLeft: 325, goldSecondsLeft: 44, distanceLabel: '325 m to go', clockLabel: '44 s for gold' });
    expect(ride(130, 37).ahead).toBe(false);
  });
  it('rounds metres and seconds up so the clock never shows 0 while gold is still possible', () => {
    const r = ride(129.6, 73.2);
    expect(r.metresLeft).toBe(521); expect(r.goldSecondsLeft).toBe(1); expect(r.goldGone).toBe(false);
  });
  it('switches to an encouraging finish line once the gold time has gone, never a failure', () => {
    const r = ride(500, 90);
    expect(r.pace).toBe(1); expect(r.goldSecondsLeft).toBe(0); expect(r.goldGone).toBe(true); expect(r.ahead).toBe(false);
    expect(r.clockLabel).toBe('Finish for ★'); // as short as the countdown it replaces, so it fits a small landscape phone
    expect(r.clockLabel).not.toMatch(/fail|lost|late|over/i);
  });
  it('clamps a distance beyond the route to the finish flag', () => {
    const r = ride(700, 50);
    expect(r.covered).toBe(1); expect(r.metresLeft).toBe(0); expect(r.distanceLabel).toBe('Finish line!');
  });
  it('survives a zero-length route or par time without dividing by zero', () => {
    const r = raceBar({ distance: 0, routeLength: 0, elapsed: 0, parTime: 0 });
    expect(Number.isFinite(r.covered)).toBe(true); expect(Number.isFinite(r.pace)).toBe(true);
  });
});

describe('the hearts', () => {
  it('reads the hearts left out loud', () => {
    expect(heartsLabel(3)).toBe('3 of 3 hearts left');
    expect(heartsLabel(2)).toBe('2 of 3 hearts left');
    expect(heartsLabel(1)).toBe('1 of 3 hearts left');
  });
  it('says plainly when none are left and clamps odd values', () => {
    expect(heartsLabel(0)).toBe('No hearts left');
    expect(heartsLabel(-1)).toBe('No hearts left');
    expect(heartsLabel(5)).toBe('3 of 3 hearts left');
  });
});

describe('the close-shaves chip', () => {
  it('counts towards the mission target and ticks when done', () => {
    expect(shavesChip(0, 2)).toEqual({ text: 'Close shaves 0/2', done: false });
    expect(shavesChip(2, 2)).toEqual({ text: 'Close shaves 2/2 ✓', done: true });
    expect(shavesChip(5, 4)).toEqual({ text: 'Close shaves 4/4 ✓', done: true });
  });
});
