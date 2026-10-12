import { describe, expect, it } from 'vitest';
import { SPEED_CAP, STAGES, getStage } from '../src/campaign';
import { VEHICLES } from '../src/simulation';
describe('fifteen-lesson campaign', () => {
  it('requires three distinct lessons for every vehicle before the next vehicle', () => {
    expect(STAGES).toHaveLength(15);
    for (let vehicle = 0; vehicle < 5; vehicle++) {
      const stages = [0, 1, 2].map(lesson => getStage(vehicle, lesson));
      expect(stages.map(stage => stage.id)).toEqual([vehicle * 3, vehicle * 3 + 1, vehicle * 3 + 2]);
      expect(new Set(stages.map(stage => stage.name)).size).toBe(3);
      expect(new Set(stages.map(stage => stage.neighborhood)).size).toBe(3);
      expect(stages[2].routeLength).toBeGreaterThan(stages[0].routeLength);
    }
  });
  it('starts each mission noticeably faster, builds speed during the ride, and times par from the real pace', () => {
    for (let vehicle = 0; vehicle < 5; vehicle++) {
      const [first, second, third] = [0, 1, 2].map(lesson => getStage(vehicle, lesson));
      expect(first.speedScale).toBe(1); expect(first.densityScale).toBe(1);
      expect(second.speedScale).toBeCloseTo(1.1); expect(third.speedScale).toBeCloseTo(1.2);
      expect([first.finishBoost, second.finishBoost, third.finishBoost]).toEqual([1.2, 1.3, 1.4]);
      expect(second.densityScale).toBeGreaterThan(first.densityScale); expect(third.densityScale).toBeGreaterThan(second.densityScale);
      for (const stage of [first, second, third]) {
        const start = Math.min(SPEED_CAP, VEHICLES[vehicle].maxSpeed * stage.speedScale);
        const finish = Math.min(SPEED_CAP, VEHICLES[vehicle].maxSpeed * stage.speedScale * stage.finishBoost);
        expect(stage.parTime).toBe(Math.ceil(stage.routeLength / ((start + finish) / 2) * 1.65 + 10));
      }
    }
  });
  it('normalizes corrupted/out-of-range stage selections to a valid campaign entry', () => {
    expect(getStage(NaN, Infinity).id).toBe(0);
    expect(getStage(99, 99).id).toBe(14);
    expect(getStage(-1, -1).id).toBe(0);
  });
});
