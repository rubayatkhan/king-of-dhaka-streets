import { describe, expect, it } from 'vitest';
import {
  BASE_POWER_UPS,
  COIN_SPACING,
  MAX_SNACKS,
  SNACK_GAP,
  STOMACH_DELAY,
  STOMACH_SECONDS,
  coinIsClear,
  eatSnack,
  newEffects,
  placePickups,
  stomachChance,
  tickEffects,
} from '../src/pickups';
import { JUMPS, Simulation, VEHICLES } from '../src/simulation';

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

const lcg = (seed: number) => { let s = seed >>> 0 || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
function placed(vehicle: number, lesson: number, seed: number) {
  const sim = new Simulation(vehicle, seed, lesson), jump = JUMPS[VEHICLES[vehicle].id];
  return { sim, ...placePickups({ traffic: sim.traffic, routeLength: sim.routeLength, startSpeed: sim.maxSpeed,
    arcHeight: jump.height, arcClears: jump.clears.filter(k => k !== 'splash'), random: lcg(seed) }) };
}
const groups = <T extends { group: number }>(items: T[]) => [...new Map(items.map(i => [i.group, items.filter(j => j.group === i.group)])).values()];

describe('coin trails and snack placement', () => {
  it('lays safe ৳1, bold ৳5 and arc trails of the right sizes', () => {
    for (let stage = 0; stage < 15; stage++) for (let seed = 1; seed <= 6; seed++) {
      const { coins } = placed(Math.floor(stage / 3), stage % 3, seed);
      for (const trail of groups(coins)) {
        const kind = trail[0].trail, size = trail.length;
        expect(trail.every(c => c.trail === kind)).toBe(true);
        if (kind === 'safe') { expect(size).toBeGreaterThanOrEqual(6); expect(size).toBeLessThanOrEqual(12); expect(trail.every(c => c.value === 1)).toBe(true); }
        if (kind === 'bold') { expect(size).toBeGreaterThanOrEqual(3); expect(size).toBeLessThanOrEqual(6); expect(trail.every(c => c.value === 5)).toBe(true); }
        if (kind === 'arc') { expect(size).toBeGreaterThanOrEqual(4); expect(size).toBeLessThanOrEqual(7); }
      }
      expect(coins.some(c => c.trail === 'safe'), `stage ${stage} seed ${seed}`).toBe(true);
    }
  });
  it('never puts a ground coin where an obstacle will be as the rider arrives, and keeps coins on the road', () => {
    for (let stage = 0; stage < 15; stage++) for (let seed = 1; seed <= 6; seed++) {
      const { sim, coins } = placed(Math.floor(stage / 3), stage % 3, seed);
      for (const c of coins) {
        expect(Math.abs(c.x)).toBeLessThanOrEqual(4.3);
        expect(-c.z).toBeGreaterThan(30); expect(-c.z).toBeLessThan(sim.routeLength - 20);
        if (c.trail !== 'arc') expect(coinIsClear(sim.traffic, c.x, c.z, sim.maxSpeed), `stage ${stage} seed ${seed} coin ${c.id}`).toBe(true);
      }
    }
  });
  it('never leads a safe trail into a pothole, paan spill or cow on its line within 6 m', () => {
    const bad: string[] = [];
    let trails = 0;
    for (let stage = 0; stage < 15; stage++) for (let i = 1; i <= 40; i++) {
      const seed = Math.imul(i, 2654435761) >>> 0, sim = new Simulation(Math.floor(stage / 3), seed, stage % 3);
      for (const trail of groups(sim.coins.filter(c => c.trail === 'safe'))) {
        trails++;
        const x = trail[0].x, first = trail[0].z, last = trail[trail.length - 1].z;
        const hazard = sim.traffic.find(t => (t.kind === 'pothole' || t.kind === 'paan' || t.kind === 'cow') && Math.abs(t.x - x) < t.width / 2 &&
          t.z + t.length / 2 > last - 6 && t.z - t.length / 2 < first + 6);
        if (hazard) bad.push(`stage ${stage} seed ${seed}: trail x=${x} ${first.toFixed(1)}..${last.toFixed(1)}, ${hazard.kind} at z=${hazard.z}`);
      }
    }
    expect(bad, `${bad.length}/${trails} safe trails`).toEqual([]);
  });
  it('arcs coins only over hazards this vehicle can clear in the air, and never for cars or trucks', () => {
    for (let vehicle = 0; vehicle < 5; vehicle++) for (let seed = 1; seed <= 6; seed++) {
      const { sim, coins } = placed(vehicle, 1, seed), clears = JUMPS[VEHICLES[vehicle].id].clears;
      const arcs = groups(coins.filter(c => c.trail === 'arc'));
      if (vehicle >= 3) expect(arcs).toHaveLength(0);
      for (const arc of arcs) {
        const top = arc.reduce((a, b) => (b.y > a.y ? b : a));
        expect(top.y).toBeGreaterThan(0.7);
        expect(sim.traffic.some(t => clears.includes(t.kind as never) && Math.abs(t.x - top.x) < 0.01 && Math.abs(t.z - top.z) < t.length)).toBe(true);
      }
    }
  });
  it('places at most four snacks, at least 120 m apart, clear of obstacles and coins', () => {
    for (let stage = 0; stage < 15; stage++) for (let seed = 1; seed <= 6; seed++) {
      const { sim, coins, snacks } = placed(Math.floor(stage / 3), stage % 3, seed);
      expect(snacks.length).toBeGreaterThan(0); expect(snacks.length).toBeLessThanOrEqual(MAX_SNACKS);
      const zs = snacks.map(s => -s.z).sort((a, b) => a - b);
      for (let i = 1; i < zs.length; i++) expect(zs[i] - zs[i - 1]).toBeGreaterThanOrEqual(SNACK_GAP);
      for (const s of snacks) {
        expect(coinIsClear(sim.traffic, s.x, s.z, sim.maxSpeed)).toBe(true);
        expect(coins.every(c => Math.hypot(c.x - s.x, c.z - s.z) > 3)).toBe(true);
      }
    }
  });
  it('places the same pickups for the same seed and spaces trail coins evenly', () => {
    const a = placed(1, 2, 44), b = placed(1, 2, 44);
    expect(a.coins).toEqual(b.coins); expect(a.snacks).toEqual(b.snacks);
    const safe = groups(a.coins.filter(c => c.trail === 'safe'))[0];
    expect(Math.abs(safe[0].z - safe[1].z)).toBeCloseTo(COIN_SPACING);
  });
});
