# Drop 1: Ride Feel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the young testers' ride-feel requests: swipe steering, jumping, a pothole bump with screen shake, a fresh random layout every ride, and faster, busier missions within each chapter.

**Architecture:** The deterministic `Simulation` gains jump state, airborne collision rules, a pothole bump, and per-mission speed and density scaling read from `campaign.ts`. New pure modules hold input recognition (`controls.ts`), seeding (`seed.ts`) and camera-feel maths (`feel.ts`), each unit-tested without WebGL. `main.ts` wires them together, `world.ts` renders height, landing squash and shake, and `audio.ts` gains jump and bump sounds.

**Tech Stack:** TypeScript 5.9 (strict), Three.js r180, Vite 7, Vitest 4. Node 22 in CI.

**Spec:** `docs/superpowers/specs/2026-10-12-round-one-design.md` (section 1, "The ride"; section 6, Drop 1).

## Global Constraints

- The game must keep running in phone and laptop browsers from GitHub Pages, under the `/king-of-dhaka-streets/` base path.
- Swipe is the default on touch devices; a *Controls: Swipe / Buttons* setting keeps the current buttons. Swipe mode keeps the horn button and hides the steer and brake buttons.
- Steering is proportional to horizontal drag from the touch-down point, saturating at 18% of screen width. Flick up (more than 40 px in under 250 ms) jumps. A downward swipe, then holding, brakes until release.
- Keyboard: unchanged, plus ↑ or W to jump. Gestures never fire inside dialogs, the pause menu or the feedback form.
- Jump profiles: bicycle 0.60 s / 0.9 m; motorbike 0.55 s / 0.8 m; rickshaw 0.45 s / 0.5 m; car 0.35 s / 0.25 m; truck 0.30 s / 0.15 m. No vehicle clears traffic vehicles, cows or pedestrians. 0.35 s cooldown after landing. 60% steering authority in the air.
- Grounded pothole contact still costs one heart, plus a jolt, about 0.35 s of camera shake, and a speed drop of about 30%. *Gentler camera* cuts shake amplitude to one third.
- Each ride's seed comes from `crypto.getRandomValues`; `Simulation` still accepts an explicit seed; review mode keeps fixed seeds.
- Ramp within each chapter: mission 2 about 6% faster with about 15% denser traffic; mission 3 about 12% faster with about 30% denser traffic. Par times use the scaled speed.
- Every mission stays completable by the existing automated pilot.
- Code style: match the surrounding files (dense one-line style in `main.ts`, `world.ts`, `progress.ts`; conventional style in `simulation.ts`, `campaign.ts`, `audio.ts`). Conventional Commits, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Work on branch `feat/round-one` (already created; the spec is committed there).

## Review Focus

1. **Stuck steering after an interrupted touch.** A system gesture or a second finger lifting must not leave steering or braking stuck on, and must not release the first finger's steering. Test owner: Task 6 (`cancel` ignores other pointers; `clear` drops everything).
2. **A second finger.** A second touch must not take over steering from the first. Test owner: Task 6.
3. **Jump requests outside a ride.** Jumping before the start, while paused or after the finish does nothing. Test owner: Task 4.
4. **Pausing mid-air.** A paused ride freezes jump height; resuming finishes the hop normally. Test owner: Task 4.
5. **Finishing or crashing mid-air.** The results screen must show the rider on the ground, not floating. Test owner: Task 4.

---

## File Structure

| File | Status | Responsibility |
| --- | --- | --- |
| `src/campaign.ts` | Modify | Adds `speedScale` and `densityScale` per stage; par time from scaled speed. |
| `src/seed.ts` | Create | `freshSeed()`: a non-zero 32-bit seed from `crypto`, with a fallback. |
| `src/simulation.ts` | Modify | Ramp, jump state and profiles, airborne clearing, pothole bump. |
| `src/controls.ts` | Create | `SwipeRecognizer`: pointer samples in, `{ steer, brake }` plus queued jumps out. |
| `src/feel.ts` | Create | `shakeOffset()` and `landingSquash()` maths for the camera and model. |
| `src/world.ts` | Modify | Renders jump height, landing squash and camera shake. |
| `src/audio.ts` | Modify | `jump(vehicle)` and `bump()` sounds. |
| `src/progress.ts` | Modify | Optional `controls` preference. |
| `src/main.ts`, `src/style.css` | Modify | Wiring: swipe mode, jump button and key, settings select, event routing, fresh seed. |
| `README.md` | Modify | Controls table. |
| `tests/*.test.ts` | Modify / Create | One test file per module. |

---

### Task 1: Difficulty ramp in the campaign

**Files:**
- Modify: `src/campaign.ts`
- Test: `tests/campaign.test.ts`

**Interfaces:**
- Produces: `StageProfile.speedScale: number` and `StageProfile.densityScale: number` (lesson 0 → 1 and 1; lesson 1 → 1.06 and 1.15; lesson 2 → 1.12 and 1.3). `parTime` is computed from the scaled speed.

- [ ] **Step 1: Write the failing test**

Add to `tests/campaign.test.ts`. Add `import { VEHICLES } from '../src/simulation';` at the top, then this test inside the `describe` block:

```ts
  it('ramps speed and traffic density within each chapter and times par from the faster speed', () => {
    for (let vehicle = 0; vehicle < 5; vehicle++) {
      const [first, second, third] = [0, 1, 2].map(lesson => getStage(vehicle, lesson));
      expect(first.speedScale).toBe(1); expect(first.densityScale).toBe(1);
      expect(second.speedScale).toBeGreaterThan(first.speedScale); expect(third.speedScale).toBeGreaterThan(second.speedScale);
      expect(second.densityScale).toBeGreaterThan(first.densityScale); expect(third.densityScale).toBeGreaterThan(second.densityScale);
      for (const stage of [first, second, third])
        expect(stage.parTime).toBe(Math.ceil(stage.routeLength / (VEHICLES[vehicle].maxSpeed * stage.speedScale) * 1.65 + 10));
    }
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/campaign.test.ts`
Expected: FAIL. `speedScale` is `undefined`.

- [ ] **Step 3: Implement**

In `src/campaign.ts`, extend the interface:

```ts
export interface StageProfile {
  id: number; vehicleIndex: number; lessonIndex: 0 | 1 | 2;
  name: string; bangla: string; neighborhood: Neighborhood; objective: string;
  routeLength: number; parTime: number; nearMissTarget: number;
  speedScale: number; densityScale: number;
}
```

Add above `export const STAGES`:

```ts
// Each chapter's later missions run faster through busier streets.
const ramp = [{ speed: 1, density: 1 }, { speed: 1.06, density: 1.15 }, { speed: 1.12, density: 1.3 }];
```

Replace the body of the `STAGES` generator with:

```ts
export const STAGES: StageProfile[] = Array.from({ length: 15 }, (_, id) => {
  const vehicleIndex = Math.floor(id / 3), lessonIndex = (id % 3) as 0 | 1 | 2;
  const { speed: speedScale, density: densityScale } = ramp[lessonIndex];
  const speed = [13, 14, 19, 21, 23][vehicleIndex] * speedScale;
  const routeLength = 650 + vehicleIndex * 80 + lessonIndex * 70;
  return { id, vehicleIndex, lessonIndex, name: lessonNames[vehicleIndex][lessonIndex], bangla: bangla[lessonIndex],
    neighborhood: NEIGHBORHOODS[(vehicleIndex + lessonIndex) % 3],
    objective: objectives[vehicleIndex][lessonIndex],
    routeLength, parTime: Math.ceil(routeLength / speed * 1.65 + 10), nearMissTarget: 2 + lessonIndex * 2,
    speedScale, densityScale };
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/campaign.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/campaign.ts tests/campaign.test.ts
git commit -m "feat(campaign): ramp speed and traffic density within each chapter

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Fresh random layout every ride

**Files:**
- Create: `src/seed.ts`
- Modify: `src/main.ts` (import and `start()`)
- Test: `tests/seed.test.ts`

**Interfaces:**
- Produces: `freshSeed(source?: { getRandomValues(array: Uint32Array): Uint32Array }): number`. It returns an integer from 1 to 4294967295 and never throws.

- [ ] **Step 1: Write the failing test**

Create `tests/seed.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/seed.test.ts`
Expected: FAIL. Cannot find module `../src/seed`.

- [ ] **Step 3: Implement**

Create `src/seed.ts`:

```ts
type RandomSource = { getRandomValues(array: Uint32Array): Uint32Array };

// A new seed per ride keeps hazard and traffic placement from repeating between sessions.
export function freshSeed(source: RandomSource | undefined = globalThis.crypto): number {
  try { if (source) { const value = source.getRandomValues(new Uint32Array(1))[0]; if (value > 0) return value; } }
  catch { /* Fall back below when crypto is blocked. */ }
  return Math.floor(Math.random() * 0xfffffffe) + 1;
}
```

In `src/main.ts`, add after the `import { sendFeedback ... } from './feedback';` line:

```ts
import { freshSeed } from './seed';
```

Then replace the exact text `sim=new Simulation(selected,seed++,lesson);sim.start();` (inside `start()`) with:

```ts
sim=new Simulation(selected,reviewMode?seed++:freshSeed(),lesson);sim.start();
```

- [ ] **Step 4: Run the tests and typecheck**

Run: `npx vitest run tests/seed.test.ts && npx tsc --noEmit`
Expected: PASS, and no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/seed.ts src/main.ts tests/seed.test.ts
git commit -m "fix: give every ride a fresh random layout

Every page load started from seed 27, so a mission's first ride always
repeated the same traffic and hazards.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Apply the ramp in the simulation

**Files:**
- Modify: `src/simulation.ts`
- Test: `tests/simulation.test.ts`

**Interfaces:**
- Consumes: `StageProfile.speedScale` and `StageProfile.densityScale` (Task 1).
- Produces: `Simulation.maxSpeed: number` (getter) = `VEHICLES[vehicleIndex].maxSpeed * stage.speedScale`.

- [ ] **Step 1: Write the failing test**

Add inside `describe('ride lifecycle', ...)` in `tests/simulation.test.ts`:

```ts
  it('rides faster through busier streets in each chapter\'s later missions', () => {
    for (let vehicle = 0; vehicle < 5; vehicle++) {
      const speeds = [0, 1, 2].map(lesson => { const sim = new Simulation(vehicle, 3, lesson); sim.start(); sim.traffic.length = 0; advance(sim, 7); return sim.speed; });
      expect(speeds[1]).toBeGreaterThan(speeds[0]); expect(speeds[2]).toBeGreaterThan(speeds[1]);
      expect(speeds[2]).toBeLessThanOrEqual(VEHICLES[vehicle].maxSpeed * 1.12 + 1e-9);
      const perMetre = [0, 1, 2].map(lesson => { const sim = new Simulation(vehicle, 3, lesson); return sim.traffic.length / sim.routeLength; });
      expect(perMetre[1]).toBeGreaterThan(perMetre[0]); expect(perMetre[2]).toBeGreaterThan(perMetre[1]);
    }
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/simulation.test.ts -t "busier streets"`
Expected: FAIL. All three missions reach the same speed.

- [ ] **Step 3: Implement**

In `src/simulation.ts`:

1. Add a getter below `get neighborhood()`:

```ts
  get maxSpeed(): number { return VEHICLES[this.vehicleIndex].maxSpeed * this.stage.speedScale; }
```

2. In `createTraffic()`, add `const spacing = 28 / this.stage.densityScale;` immediately before the `for (let distance = 42, row = 0; ...)` loop. Change that loop header to:

```ts
    for (let distance = 42, row = 0; distance < this.routeLength - 25; distance += spacing, row++) {
```

Replace both occurrences of `distance + 14` in the loop body (the `if` condition and the `addMoving` call) with `distance + spacing / 2`.

3. In `step()`, replace

```ts
    const targetSpeed = input.brake ? 1.4 : vehicle.maxSpeed;
```

with

```ts
    const targetSpeed = input.brake ? 1.4 : this.maxSpeed;
```

and in the steering line replace `this.speed / vehicle.maxSpeed` with `this.speed / this.maxSpeed`.

4. In `updateRearThreats()`, replace `speed: vehicle.maxSpeed + 9` with `speed: this.maxSpeed + 9`.

- [ ] **Step 4: Run the ramp test and the full simulation suite**

Run: `npx vitest run tests/simulation.test.ts`
Expected: PASS, including "completes all fifteen lessons across 105 seeded pilots" and its traffic cap of 14 actors within 135 m.

If the 105-pilot test or the traffic cap fails, tune in this order, rerunning after each change, and stop at the first passing configuration:
1. Lesson 3 density 1.3 → 1.2.
2. Lesson 2 density 1.15 → 1.1.
3. Lesson 3 speed 1.12 → 1.09.

Record any final values that differ from the spec in the commit message body.

- [ ] **Step 5: Commit**

```bash
git add src/simulation.ts tests/simulation.test.ts
git commit -m "feat(simulation): apply per-mission speed and traffic ramp

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Jumping

**Files:**
- Modify: `src/simulation.ts`
- Test: `tests/simulation.test.ts`

**Interfaces:**
- Produces:
  - `type JumpClear = 'pothole' | 'paan' | 'splash'`
  - `interface JumpProfile { airtime: number; height: number; clears: JumpClear[] }`
  - `const JUMPS: Record<VehicleKind, JumpProfile>`
  - `Simulation.y: number` (metres above the road)
  - `Simulation.airborne: boolean` (getter)
  - `Simulation.jump(): boolean` (true when a hop started)
  - Events `{ type: 'jump' }` and `{ type: 'land' }`
- A hazard counts as cleared when the rider is airborne at the moment of first overlap; it then stays cleared for that pass, even after landing.

- [ ] **Step 1: Write the failing tests**

Add a new `describe` block at the end of `tests/simulation.test.ts`. Extend the import to `import { JUMPS, Simulation, VEHICLES, type Traffic } from '../src/simulation';`.

```ts
describe('jumping', () => {
  const splash = (sim: Simulation) => ({ id: 77, sourceId: 78, phase: 'splash' as const, sourceX: 5, sourceZ: sim.z, targetX: 0, targetZ: sim.z,
    x: 0, y: 0.03, z: sim.z, radius: 0.72, progress: 0, remaining: 0.8 });

  it('hops a bicycle over a pothole when timed and counts a clean pass', () => {
    const sim = new Simulation(0); sim.start(); sim.speed = 10; sim.traffic = [obstacle({ z: sim.z - 3 })];
    expect(sim.jump()).toBe(true); advance(sim, 1);
    expect(sim.health).toBe(3); expect(sim.overtakes).toBe(1);
    expect(sim.events.map(e => e.type)).toEqual(expect.arrayContaining(['jump', 'land']));
  });

  it('lands into a pothole after jumping too early', () => {
    const sim = new Simulation(0); sim.start(); sim.speed = 10; sim.traffic = [obstacle({ z: sim.z - 12 })];
    sim.jump(); advance(sim, 2);
    expect(sim.health).toBe(2);
  });

  it('lets a truck bounce a pothole but never clear a cow', () => {
    const bounce = new Simulation(4); bounce.start(); bounce.speed = 10; bounce.traffic = [obstacle({ z: bounce.z - 5 })];
    bounce.jump(); advance(bounce, 1);
    expect(bounce.health).toBe(3);
    const cow = new Simulation(4); cow.start(); cow.speed = 10; cow.traffic = [obstacle({ kind: 'cow', z: cow.z - 5, length: 2.1 })];
    cow.jump(); advance(cow, 1);
    expect(cow.health).toBe(2);
  });

  it.each([0, 1, 2, 3, 4])('never clears moving traffic in vehicle %i', (index) => {
    const sim = new Simulation(index); sim.start(); sim.speed = 10; sim.traffic = [obstacle({ kind: 'car', z: sim.z - 3, width: 1.8, length: 3.7 })];
    sim.jump(); advance(sim, 1);
    expect(sim.health).toBe(2);
  });

  it('jumps a paan splash on two wheels but not in a rickshaw', () => {
    for (const [index, health] of [[0, 3], [2, 3], [1, 2]]) {
      const sim = new Simulation(index); sim.start(); sim.traffic = []; sim.projectiles = [splash(sim)];
      sim.jump(); sim.update(1 / 60, straight);
      expect(sim.health, `vehicle ${index}`).toBe(health);
    }
  });

  it('follows each vehicle\'s jump arc and enforces a landing cooldown', () => {
    for (const vehicle of VEHICLES) {
      const sim = new Simulation(VEHICLES.indexOf(vehicle)); sim.start(); sim.traffic = [];
      const profile = JUMPS[vehicle.id];
      sim.jump(); advance(sim, profile.airtime / 2);
      expect(sim.y).toBeCloseTo(profile.height, 1);
      expect(sim.jump()).toBe(false);
      advance(sim, profile.airtime / 2 + 0.05);
      expect(sim.airborne).toBe(false); expect(sim.y).toBe(0);
      expect(sim.jump()).toBe(false);
      advance(sim, 0.4);
      expect(sim.jump()).toBe(true);
    }
  });

  it('steers with 60% authority in the air', () => {
    const ground = new Simulation(0), air = new Simulation(0);
    for (const sim of [ground, air]) { sim.start(); sim.traffic = []; }
    air.jump(); advance(ground, 0.2, 1); advance(air, 0.2, 1);
    expect(air.x).toBeCloseTo(ground.x * 0.6, 5);
  });

  it('ignores jump requests before the start, while paused and after the finish', () => {
    const sim = new Simulation(0);
    expect(sim.jump()).toBe(false);
    sim.start(); sim.pause(); expect(sim.jump()).toBe(false);
    sim.resume(); sim.traffic = []; sim.distance = sim.routeLength - 0.1; advance(sim, 0.1);
    expect(sim.status).toBe('won'); expect(sim.jump()).toBe(false);
  });

  it('freezes the hop while paused and finishes it after resuming', () => {
    const sim = new Simulation(0); sim.start(); sim.traffic = [];
    sim.jump(); advance(sim, 0.2); const height = sim.y;
    sim.pause(); sim.update(0.2, straight); expect(sim.y).toBe(height);
    sim.resume(); advance(sim, 1); expect(sim.airborne).toBe(false); expect(sim.y).toBe(0);
  });

  it('puts the rider back on the ground when the ride ends mid-air', () => {
    const won = new Simulation(0); won.start(); won.traffic = []; won.distance = won.routeLength - 0.5;
    won.jump(); advance(won, 0.2);
    expect(won.status).toBe('won'); expect(won.airborne).toBe(false); expect(won.y).toBe(0);
    const lost = new Simulation(0); lost.start(); lost.health = 1; lost.speed = 10; lost.traffic = [obstacle({ kind: 'car', z: lost.z - 2, width: 1.8, length: 3.7 })];
    lost.jump(); advance(lost, 0.5);
    expect(lost.status).toBe('lost'); expect(lost.airborne).toBe(false); expect(lost.y).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/simulation.test.ts -t "jump"`
Expected: FAIL. `JUMPS` is not exported, and `sim.jump` is not a function.

- [ ] **Step 3: Implement**

In `src/simulation.ts`, add after the `VEHICLES` array:

```ts
export type JumpClear = 'pothole' | 'paan' | 'splash';
export interface JumpProfile { airtime: number; height: number; clears: JumpClear[] }
// Every vehicle hops; smaller ones fly higher and clear more. Nothing clears traffic, cows or people.
export const JUMPS: Record<VehicleKind, JumpProfile> = {
  bicycle: { airtime: 0.6, height: 0.9, clears: ['pothole', 'paan', 'splash'] },
  motorbike: { airtime: 0.55, height: 0.8, clears: ['pothole', 'paan', 'splash'] },
  rickshaw: { airtime: 0.45, height: 0.5, clears: ['pothole', 'paan'] },
  car: { airtime: 0.35, height: 0.25, clears: ['pothole'] },
  truck: { airtime: 0.3, height: 0.15, clears: ['pothole'] },
};
const JUMP_COOLDOWN = 0.35, AIR_STEERING = 0.6;
```

Add fields to the class, after `invulnerable = 0; hornCooldown = 0;`:

```ts
  y = 0; airTime = -1; jumpCooldown = 0;
```

Add a private set next to `private contacted = new Set<number>();`:

```ts
  private cleared = new Set<number>();
```

Add these members after the `get maxSpeed()` getter:

```ts
  get airborne(): boolean { return this.airTime >= 0; }

  jump(): boolean {
    if (this.status !== 'playing' || this.airborne || this.jumpCooldown > 0) return false;
    this.airTime = 0;
    this.events.push({ type: 'jump', text: 'Hop!', x: this.x, z: this.z });
    return true;
  }

  private updateJump(dt: number): void {
    if (!this.airborne) { this.jumpCooldown = Math.max(0, this.jumpCooldown - dt); return; }
    const profile = JUMPS[VEHICLES[this.vehicleIndex].id];
    this.airTime += dt;
    const t = this.airTime / profile.airtime;
    if (t < 1) { this.y = 4 * profile.height * t * (1 - t); return; }
    this.airTime = -1; this.y = 0; this.jumpCooldown = JUMP_COOLDOWN;
    this.events.push({ type: 'land', text: '', x: this.x, z: this.z });
  }

  private clears(kind: string): boolean {
    return this.airborne && (JUMPS[VEHICLES[this.vehicleIndex].id].clears as string[]).includes(kind);
  }
```

In `update()`, after the `while` loop and before its closing brace, add:

```ts
    // Results always show the rider on the road.
    if (this.status === 'won' || this.status === 'lost') { this.airTime = -1; this.y = 0; }
```

In `step()`:
- Add `this.updateJump(dt);` immediately after `this.hornCooldown = Math.max(0, this.hornCooldown - dt);`.
- Replace `const steer = Number.isFinite(input.steer) ? clamp(input.steer, -1, 1) : 0;` with:

```ts
    const steer = (Number.isFinite(input.steer) ? clamp(input.steer, -1, 1) : 0) * (this.airborne ? AIR_STEERING : 1);
```

- Replace the line `if (overlapX && overlapZ) { this.contacted.add(actor.id); this.combo = 0; }` with:

```ts
      // Being airborne at first overlap clears the hazard for the whole pass.
      if (overlapX && overlapZ && !this.hit.has(actor.id) && this.clears(actor.kind)) this.cleared.add(actor.id);
      const cleared = this.cleared.has(actor.id);
      if (overlapX && overlapZ && !cleared) { this.contacted.add(actor.id); this.combo = 0; }
```

- Change the next condition, `if (overlapX && overlapZ && this.invulnerable <= 0 && !this.hit.has(actor.id)) {`, to:

```ts
      if (overlapX && overlapZ && !cleared && this.invulnerable <= 0 && !this.hit.has(actor.id)) {
```

In `updateProjectiles()`, change

```ts
      if (p.phase === 'splash' && Math.abs(this.x - p.x) < vehicle.width / 2 + p.radius && Math.abs(this.z - p.z) < vehicle.length / 2 + p.radius) {
```

to

```ts
      if (p.phase === 'splash' && !this.clears('splash') && Math.abs(this.x - p.x) < vehicle.width / 2 + p.radius && Math.abs(this.z - p.z) < vehicle.length / 2 + p.radius) {
```

- [ ] **Step 4: Run the simulation suite**

Run: `npx vitest run tests/simulation.test.ts`
Expected: PASS, all tests including the 105 pilots. The pilot never jumps, so its results are unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/simulation.ts tests/simulation.test.ts
git commit -m "feat(simulation): jump, scaled by vehicle, clearing potholes and paan

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Pothole bump

**Files:**
- Modify: `src/simulation.ts`
- Test: `tests/simulation.test.ts`

**Interfaces:**
- Produces: a `{ type: 'bump', text: 'Bump!', x, z, actorId }` event on a grounded pothole hit. Pothole hits multiply speed by 0.7; other hits keep 0.28.

- [ ] **Step 1: Write the failing test, and keep the old crash test's intent**

The existing test *collision slows the rider and grants immunity against repeated damage* uses a pothole and expects a heavy slowdown. Make it test a vehicle hit: change its first line to

```ts
    const sim = new Simulation(); sim.start(); sim.speed = 10; sim.traffic = [obstacle({ kind: 'cng' })];
```

Then add inside `describe('ride lifecycle', ...)`:

```ts
  it('bumps over a grounded pothole: one heart, a 30% slowdown and a bump event', () => {
    const sim = new Simulation(); sim.start(); sim.speed = 10; sim.traffic = [obstacle()];
    sim.update(1 / 60, straight);
    expect(sim.health).toBe(2);
    expect(sim.speed).toBeGreaterThan(6.5); expect(sim.speed).toBeLessThan(7.5);
    expect(sim.events.some(e => e.type === 'bump')).toBe(true);
    const cow = new Simulation(); cow.start(); cow.speed = 10; cow.traffic = [obstacle({ kind: 'cow' })];
    cow.update(1 / 60, straight);
    expect(cow.events.some(e => e.type === 'bump')).toBe(false); expect(cow.speed).toBeLessThan(4);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/simulation.test.ts -t "bumps over"`
Expected: FAIL. Speed is about 2.9 and there is no bump event.

- [ ] **Step 3: Implement**

In `step()`'s hit block, replace

```ts
        this.speed *= 0.28;
```

with

```ts
        const pothole = actor.kind === 'pothole';
        this.speed *= pothole ? 0.7 : 0.28;
        if (pothole) this.events.push({ type: 'bump', text: 'Bump!', x: actor.x, z: actor.z, actorId: actor.id });
```

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS, all files.

- [ ] **Step 5: Commit**

```bash
git add src/simulation.ts tests/simulation.test.ts
git commit -m "feat(simulation): potholes bump instead of stopping the rider

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Swipe recognizer

**Files:**
- Create: `src/controls.ts`
- Test: `tests/controls.test.ts`

**Interfaces:**
- Produces: `class SwipeRecognizer`
  - Constructor: `new SwipeRecognizer(width: number)`
  - State: `steer: number` (−1..1), `brake: boolean`, `touching: boolean` (getter)
  - Methods: `resize(width)`, `down(id, x, y, t)`, `move(id, x, y, t)`, `up(id, x, y, t)`, `cancel(id)` (releases only that pointer), `clear()` (releases everything and drops a queued jump), `takeJump(): boolean` (true once per flick)
  - Also exports `SWIPE` constants. Coordinates are CSS pixels; `t` is milliseconds.

- [ ] **Step 1: Write the failing tests**

Create `tests/controls.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SwipeRecognizer } from '../src/controls';
describe('swipe controls', () => {
  it('steers in proportion to drag from the touch-down point, saturating at 18% of the width', () => {
    const swipe = new SwipeRecognizer(1000); swipe.down(1, 600, 500, 0);
    swipe.move(1, 690, 500, 16); expect(swipe.steer).toBeCloseTo(0.5);
    swipe.move(1, 1000, 500, 32); expect(swipe.steer).toBe(1);
    swipe.move(1, 510, 500, 48); expect(swipe.steer).toBeCloseTo(-0.5);
    swipe.resize(500); swipe.move(1, 555, 500, 64); expect(swipe.steer).toBeCloseTo(-0.5);
  });
  it('jumps once per quick upward flick, including a second flick in the same touch', () => {
    const swipe = new SwipeRecognizer(1000); swipe.down(1, 500, 500, 0);
    swipe.move(1, 500, 455, 120); expect(swipe.takeJump()).toBe(true); expect(swipe.takeJump()).toBe(false);
    swipe.move(1, 500, 452, 400); expect(swipe.takeJump()).toBe(false);
    swipe.move(1, 500, 405, 500); expect(swipe.takeJump()).toBe(true);
  });
  it('counts a flick that ends as the finger lifts', () => {
    const swipe = new SwipeRecognizer(1000); swipe.down(1, 500, 500, 0); swipe.up(1, 500, 450, 150);
    expect(swipe.takeJump()).toBe(true); expect(swipe.touching).toBe(false);
  });
  it('ignores a slow upward drift', () => {
    const swipe = new SwipeRecognizer(1000); swipe.down(1, 500, 500, 0);
    for (let step = 1; step <= 6; step++) swipe.move(1, 500, 500 - step * 10, step * 150);
    expect(swipe.takeJump()).toBe(false);
  });
  it('brakes after a quick downward swipe until the finger lifts, but not on a slow drift', () => {
    const swipe = new SwipeRecognizer(1000); swipe.down(1, 500, 300, 0);
    swipe.move(1, 520, 350, 100); expect(swipe.brake).toBe(true);
    swipe.move(1, 520, 350, 2000); expect(swipe.brake).toBe(true);
    swipe.up(1, 520, 350, 2100); expect(swipe.brake).toBe(false); expect(swipe.steer).toBe(0);
    const slow = new SwipeRecognizer(1000); slow.down(1, 500, 300, 0);
    for (let step = 1; step <= 6; step++) slow.move(1, 500, 300 + step * 10, step * 150);
    expect(slow.brake).toBe(false);
  });
  it('keeps steering with the first finger when a second finger touches and lifts', () => {
    const swipe = new SwipeRecognizer(1000); swipe.down(1, 500, 500, 0); swipe.move(1, 590, 500, 16);
    swipe.down(2, 100, 100, 20); swipe.move(2, 900, 100, 30); swipe.up(2, 900, 100, 40); swipe.cancel(2);
    expect(swipe.steer).toBeCloseTo(0.5); expect(swipe.touching).toBe(true);
  });
  it('releases steering and braking when its own touch is cancelled, and clear drops a queued jump', () => {
    const swipe = new SwipeRecognizer(1000); swipe.down(1, 500, 300, 0); swipe.move(1, 590, 350, 100);
    swipe.cancel(1); expect(swipe.steer).toBe(0); expect(swipe.brake).toBe(false); expect(swipe.touching).toBe(false);
    swipe.down(3, 500, 500, 200); swipe.move(3, 500, 440, 260); swipe.clear();
    expect(swipe.takeJump()).toBe(false); expect(swipe.touching).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/controls.test.ts`
Expected: FAIL. Cannot find module `../src/controls`.

- [ ] **Step 3: Implement**

Create `src/controls.ts`:

```ts
export const SWIPE = { steerSpanRatio: 0.18, flickPixels: 40, flickMs: 250 } as const;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
interface Sample { y: number; t: number }

// One finger drives: horizontal drag steers, a quick flick up jumps,
// and a quick swipe down brakes until the finger lifts.
export class SwipeRecognizer {
  steer = 0; brake = false;
  private active: { id: number; startX: number; samples: Sample[] } | undefined;
  private jumpQueued = false;
  constructor(private width: number) {}
  get touching(): boolean { return !!this.active; }
  resize(width: number): void { this.width = width; }
  down(id: number, x: number, y: number, t: number): void {
    if (!this.active) this.active = { id, startX: x, samples: [{ y, t }] };
  }
  move(id: number, x: number, y: number, t: number): void {
    const active = this.active;
    if (!active || active.id !== id) return;
    this.steer = clamp((x - active.startX) / Math.max(1, this.width * SWIPE.steerSpanRatio), -1, 1);
    active.samples = active.samples.filter(sample => t - sample.t <= SWIPE.flickMs);
    active.samples.push({ y, t });
    const ys = active.samples.map(sample => sample.y);
    if (Math.max(...ys) - y >= SWIPE.flickPixels) { this.jumpQueued = true; active.samples = [{ y, t }]; }
    else if (y - Math.min(...ys) >= SWIPE.flickPixels) this.brake = true;
  }
  up(id: number, x: number, y: number, t: number): void {
    if (this.active?.id !== id) return;
    this.move(id, x, y, t); this.release();
  }
  cancel(id: number): void { if (this.active?.id === id) this.release(); }
  clear(): void { this.release(); this.jumpQueued = false; }
  takeJump(): boolean { const queued = this.jumpQueued; this.jumpQueued = false; return queued; }
  private release(): void { this.active = undefined; this.steer = 0; this.brake = false; }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/controls.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/controls.ts tests/controls.test.ts
git commit -m "feat(controls): swipe recognizer for steering, jumping and braking

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Camera shake and landing squash

**Files:**
- Create: `src/feel.ts`
- Modify: `src/world.ts`
- Test: `tests/feel.test.ts`

**Interfaces:**
- Consumes: `Simulation.y` (Task 4).
- Produces:
  - `SHAKE_SECONDS = 0.35`
  - `shakeOffset(remaining: number, amplitude: number, clock: number, reduced: boolean): { x: number; y: number }`
  - `SQUASH_SECONDS = 0.18`
  - `landingSquash(sinceLanding: number): number` (1 when idle, at least 0.85)
  - `World.shake(amplitude: number): void`
  - `World.land(): void`

- [ ] **Step 1: Write the failing tests**

Create `tests/feel.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/feel.test.ts`
Expected: FAIL. Cannot find module `../src/feel`.

- [ ] **Step 3: Implement `src/feel.ts`**

```ts
export const SHAKE_SECONDS = 0.35;
export const SQUASH_SECONDS = 0.18;

// A quick decaying wobble; the gentler-camera setting keeps a third of it.
export function shakeOffset(remaining: number, amplitude: number, clock: number, reduced: boolean): { x: number; y: number } {
  if (!(remaining > 0) || !(amplitude > 0)) return { x: 0, y: 0 };
  const strength = amplitude * Math.min(1, remaining / SHAKE_SECONDS) * (reduced ? 1 / 3 : 1);
  return { x: Math.sin(clock * 67) * strength, y: Math.sin(clock * 53 + 1.3) * strength * 0.6 };
}

export function landingSquash(sinceLanding: number): number {
  if (!(sinceLanding > 0) || sinceLanding >= SQUASH_SECONDS) return 1;
  return 1 - 0.15 * Math.sin(Math.PI * sinceLanding / SQUASH_SECONDS);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/feel.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire it into `src/world.ts`**

Add the import at the top with the other imports:

```ts
import { SHAKE_SECONDS, landingSquash, shakeOffset } from './feel';
```

In the class fields, change `private dust:T.Points;private reduced=false;` to:

```ts
 private dust:T.Points;private reduced=false;private shakeRemaining=0;private shakeAmplitude=0;private sinceLanding=Infinity;
```

Add after `setReduced(v:boolean){this.reduced=v;}`:

```ts
 shake(amplitude:number){this.shakeRemaining=SHAKE_SECONDS;this.shakeAmplitude=amplitude;}
 land(){this.sinceLanding=0;}
```

In `render()`, replace

```ts
  this.player.position.set(pathX(z)+sim.x,.025,z);
```

with

```ts
  this.player.position.set(pathX(z)+sim.x,.025+sim.y,z);
```

Immediately after the line `animateVehicle(this.player,this.clock,preview?2:sim.speed,steer);`, add:

```ts
  this.sinceLanding+=dt;this.player.scale.y=landingSquash(this.sinceLanding);
```

Replace

```ts
  this.camera.position.lerp(target,1-Math.exp(-dt*7));this.camera.lookAt(pathX(z-7)+sim.x*.3,large?1.4:1.0,z-9);
```

with

```ts
  this.camera.position.lerp(target,1-Math.exp(-dt*7));const cameraBase=this.camera.position.clone();
  this.shakeRemaining=Math.max(0,this.shakeRemaining-dt);const shake=shakeOffset(this.shakeRemaining,this.shakeAmplitude,this.clock,this.reduced);
  this.camera.position.x+=shake.x;this.camera.position.y+=shake.y;this.camera.lookAt(pathX(z-7)+sim.x*.3,large?1.4:1.0,z-9);
```

Replace `this.renderer.render(this.scene,this.camera);` (inside `render()`) with:

```ts
  this.renderer.render(this.scene,this.camera);this.camera.position.copy(cameraBase);
```

- [ ] **Step 6: Typecheck, test and commit**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all tests PASS.

```bash
git add src/feel.ts src/world.ts tests/feel.test.ts
git commit -m "feat(world): render jump height, landing squash and camera shake

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Jump and bump sounds

**Files:**
- Modify: `src/audio.ts`
- Test: `tests/audio.test.ts`

**Interfaces:**
- Produces: `GameAudio.jump(vehicle: string): void` (2 tones for a bicycle, 1 for other vehicles; at most one per 0.25 s), and `GameAudio.bump(): void` (`impact()` plus a 3-tone chassis rattle).

- [ ] **Step 1: Write the failing test**

Add inside `describe('street audio lifecycle', ...)` in `tests/audio.test.ts`:

```ts
  it('plays a vehicle-specific hop once per jump and a rattling pothole bump', async () => {
    const audio = await initialized();
    audio.update(10, 'bicycle', true);
    const start = context.createOscillator.mock.calls.length;
    audio.jump('bicycle');
    expect(context.createOscillator.mock.calls.length - start).toBe(2);
    audio.jump('bicycle');
    expect(context.createOscillator.mock.calls.length - start).toBe(2);
    context.currentTime = 1; audio.jump('truck');
    expect(context.createOscillator.mock.calls.length - start).toBe(3);
    const beforeBump = context.createOscillator.mock.calls.length;
    audio.bump();
    expect(context.createOscillator.mock.calls.length - beforeBump).toBe(5);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/audio.test.ts -t "hop once per jump"`
Expected: FAIL. `audio.jump is not a function`.

- [ ] **Step 3: Implement**

In `src/audio.ts`, add a field after `private lastImpact = -10;`:

```ts
  private lastJump = -10;
```

In `resetRide()`, change `this.lastHorn = this.lastImpact = this.lastSpeech = this.lastReward = -10;` to:

```ts
    this.lastHorn = this.lastImpact = this.lastSpeech = this.lastReward = this.lastJump = -10;
```

Add these methods after `impact()`:

```ts
  jump(vehicle: string): void {
    if (!this.ready() || this.context!.currentTime - this.lastJump < 0.25) return;
    this.lastJump = this.context!.currentTime;
    const heavy = /car|truck/i.test(vehicle);
    // A springy rise for light vehicles, a low suspension thump for heavy ones.
    this.tone(heavy ? 92 : 330, heavy ? 0.2 : 0.16, heavy ? 0.16 : 0.07, heavy ? 'sine' : 'triangle', 0, 0, false, heavy ? 62 : 660);
    if (/bicycle/i.test(vehicle)) this.tone(1568, 0.3, 0.06, 'sine', 0.05);
  }

  bump(): void {
    if (!this.ready()) return;
    this.impact();
    [0, 0.05, 0.1].forEach(delay => this.tone(180 + delay * 400, 0.05, 0.05, 'square', delay));
  }
```

- [ ] **Step 4: Run the audio suite**

Run: `npx vitest run tests/audio.test.ts`
Expected: PASS, all audio tests.

- [ ] **Step 5: Commit**

```bash
git add src/audio.ts tests/audio.test.ts
git commit -m "feat(audio): jump and pothole bump sounds

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Saved controls preference

**Files:**
- Modify: `src/progress.ts`
- Test: `tests/progress.test.ts`

**Interfaces:**
- Produces: `Progress.controls?: 'swipe' | 'buttons'`. It is `undefined` until the player chooses, in which case the device type decides.

- [ ] **Step 1: Write the failing test**

Add inside the `describe` in `tests/progress.test.ts`:

```ts
 it('remembers a chosen control mode and ignores unknown values',()=>{expect(loadProgress(JSON.stringify({stars:[],controls:'swipe'}),null).controls).toBe('swipe');expect(loadProgress(JSON.stringify({stars:[],controls:'buttons'}),null).controls).toBe('buttons');expect(loadProgress(JSON.stringify({stars:[],controls:'joystick'}),null).controls).toBeUndefined();expect(loadProgress(null,JSON.stringify({unlocked:1})).controls).toBeUndefined();});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/progress.test.ts`
Expected: FAIL. Received `undefined` for `'swipe'`.

- [ ] **Step 3: Implement**

In `src/progress.ts`, change the interface to:

```ts
export interface Progress {
 version:2; stars:number[];best:number[];muted:boolean;quality:'auto'|'low'|'high';reduced:boolean;controls?:'swipe'|'buttons';
}
```

In `loadProgress`, replace the `return {...}` line with:

```ts
 return {version:2,stars,best,muted:source.muted===true,quality:source.quality==='low'||source.quality==='high'?source.quality:'auto',reduced:typeof source.reduced==='boolean'?source.reduced:reducedDefault,controls:source.controls==='swipe'||source.controls==='buttons'?source.controls:undefined};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/progress.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/progress.ts tests/progress.test.ts
git commit -m "feat(progress): remember the chosen control mode

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Wire swipe, jump and bump into the game

**Files:**
- Modify: `src/main.ts`, `src/style.css`, `README.md`

**Interfaces:**
- Consumes:
  - `SwipeRecognizer` (Task 6)
  - `Simulation.jump()` and the `jump`, `land` and `bump` events (Tasks 4–5)
  - `World.shake()` and `World.land()` (Task 7)
  - `GameAudio.jump()` and `GameAudio.bump()` (Task 8)
  - `Progress.controls` (Task 9)

Each edit below names exact existing text to find in `src/main.ts`. Every anchor occurs exactly once.

- [ ] **Step 1: Import and create the recognizer**

After `import { freshSeed } from './seed';` add:

```ts
import { SwipeRecognizer } from './controls';
```

Replace the anchor `const keys=new Set<string>();` with:

```ts
const keys=new Set<string>();const swipe=new SwipeRecognizer(innerWidth);
```

- [ ] **Step 2: Add the jump button and the controls setting to the markup**

Replace the anchor `<div class="action-controls"><button id="brake"` with:

```ts
<div class="action-controls"><button id="jump" class="brake-btn jump-btn" aria-label="Jump"><svg viewBox="0 0 30 30" fill="none"><path d="M15 24V8m-7 7 7-7 7 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg><span>Jump</span></button><button id="brake"
```

Replace the anchor `<label>Gentler camera <input type="checkbox" id="reduced"/></label>` with:

```ts
<label>Gentler camera <input type="checkbox" id="reduced"/></label><label>Controls <select id="controls-mode"><option value="swipe">Swipe</option><option value="buttons">Buttons</option></select></label>
```

- [ ] **Step 3: Reset swipe input with all other input**

In `clearInput()`, replace the anchor `function clearInput(){keys.clear();` with:

```ts
function clearInput(){keys.clear();swipe.clear();
```

- [ ] **Step 4: Add control mode, pointer handling and jump**

Insert this block immediately before the anchor `function hold(id:string,on:()=>void,off:()=>void){`:

```ts
const touchFirst=matchMedia('(pointer: coarse)').matches;
const controlMode=()=>save.controls??(touchFirst?'swipe':'buttons');
function applyControlMode(){const mode=controlMode();$('#hud').classList.toggle('swipe-mode',mode==='swipe');$<HTMLSelectElement>('#controls-mode').value=mode;$('#tutorial').textContent=mode==='swipe'?'Drag to steer · Flick up to jump · Swipe down to brake':'Arrows to steer · ↑ to jump · Brake for space';}
applyControlMode();
$('#controls-mode').addEventListener('change',e=>{const v=(e.target as HTMLSelectElement).value;save.controls=v==='swipe'?'swipe':'buttons';swipe.clear();persist();applyControlMode();});
function jump(){if(sim.status==='playing')sim.jump();}
// The canvas is the swipe surface; HUD buttons sit above it and keep working.
const surface=$('#game');
surface.addEventListener('pointerdown',e=>{if(controlMode()!=='swipe'||sim.status!=='playing')return;e.preventDefault();surface.setPointerCapture(e.pointerId);swipe.down(e.pointerId,e.clientX,e.clientY,e.timeStamp);});
surface.addEventListener('pointermove',e=>swipe.move(e.pointerId,e.clientX,e.clientY,e.timeStamp));
surface.addEventListener('pointerup',e=>swipe.up(e.pointerId,e.clientX,e.clientY,e.timeStamp));
for(const type of ['pointercancel','lostpointercapture'] as const)surface.addEventListener(type,e=>swipe.cancel(e.pointerId));
$('#jump').addEventListener('pointerdown',e=>{e.preventDefault();jump();});$('#jump').addEventListener('click',e=>{if(e.detail===0)jump();});
```

- [ ] **Step 5: Add keyboard jump, resize and frame-loop input**

Replace the anchor `if(screen!=='playing'||!['ArrowLeft','ArrowRight','ArrowDown','a','d','s',' ','h','Escape'].includes(e.key))return;` with:

```ts
if(screen!=='playing'||!['ArrowLeft','ArrowRight','ArrowDown','ArrowUp','a','d','s','w',' ','h','Escape'].includes(e.key))return;
```

Replace the anchor `if(e.key==='h'&&!e.repeat)horn();` with:

```ts
if(e.key==='h'&&!e.repeat)horn();if((e.key==='ArrowUp'||e.key==='w')&&!e.repeat)jump();
```

Replace the anchor `window.addEventListener('resize',()=>{world?.resize();` with:

```ts
window.addEventListener('resize',()=>{world?.resize();swipe.resize(innerWidth);
```

Replace the anchor `steer+=((keyboard||desired)-steer)*(1-Math.exp(-dt*17));` with:

```ts
if(swipe.takeJump())jump();steer+=((keyboard||swipe.steer||desired)-steer)*(1-Math.exp(-dt*17));
```

Replace the anchor `sim.update(1/60,{steer,brake:brake||keys.has('ArrowDown')` with:

```ts
sim.update(1/60,{steer,brake:brake||swipe.brake||keys.has('ArrowDown')
```

- [ ] **Step 6: Route the new events**

Replace the anchor `if(event.type==='horn'){` with:

```ts
if(event.type==='jump')audio.jump(VEHICLES[selected].id);if(event.type==='land')world?.land();if(event.type==='bump'){world?.shake(.35);world?.land();audio.bump();}
  if(event.type==='horn'){
```

- [ ] **Step 7: Styles**

Append to `src/style.css`:

```css
.swipe-mode .steer-controls,.swipe-mode #brake,.swipe-mode #jump{display:none}
```

- [ ] **Step 8: README controls table**

In `README.md`, replace the two rows

```markdown
| Steer | Hold left/right arrow | Left/right arrow or A/D |
| Brake | Hold Brake | Down arrow, S or Space |
```

with

```markdown
| Steer | Drag left/right (Swipe mode) or hold the arrows (Buttons mode) | Left/right arrow or A/D |
| Jump | Flick up, or tap Jump | Up arrow or W |
| Brake | Swipe down and hold, or hold Brake | Down arrow, S or Space |
```

Add this sentence after the table: `Swipe is the default on phones and tablets; switch to Buttons in settings.`

- [ ] **Step 9: Typecheck, test and build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: no type errors; all tests PASS; build succeeds (the existing chunk-size advisory is expected).

- [ ] **Step 10: Commit**

```bash
git add src/main.ts src/style.css README.md
git commit -m "feat: swipe steering, jump button and key, pothole shake in the game

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Browser verification and pull request

**Files:** none changed unless a check fails. If one fails, fix it test-first in the owning task's files and commit with `fix:`.

- [ ] **Step 1: Start the dev server** with the `game` configuration in `.claude/launch.json` (`npm run dev -- --port 5173`). Open `http://localhost:5173/`.

- [ ] **Step 2: Desktop, Buttons mode.**
  1. Start mission 1. Press ↑ and check the rider visibly hops.
  2. Ride into a pothole without jumping and check the camera shakes, a heart is lost, and the ride continues at reduced speed.
  3. Check the tutorial reads "Arrows to steer · ↑ to jump · Brake for space".
  4. Open Settings and check the Controls select shows Buttons.
  5. Take a screenshot mid-hop.

- [ ] **Step 3: Phone portrait (375×812) and landscape (812×375), Swipe mode.**
  1. Set the viewport. Reload. Check the steer and brake buttons are hidden while the horn and pause buttons show.
  2. Drag on the road with `left_click_drag` and check the rider steers.
  3. Dispatch a quick upward pointer flick through the javascript tool on `#game`: `pointerdown` at y=600, `pointermove` to y=540 at +80 ms, `pointerup`. Check a hop happens.
  4. Do the same with a downward swipe and a held pointer, and check the speed readout drops.
  5. Pause, then check that a drag on the paused screen does not steer after resuming.
  6. Screenshot both orientations.

- [ ] **Step 4: Fresh layout.** Start mission 1, note the first three traffic actors' positions (`sim` is not global, so compare screenshots of the opening), retry, and confirm the opening differs.

- [ ] **Step 5: Gentler camera.** Enable it, hit a pothole, and check the shake is visibly smaller.

- [ ] **Step 6: Console.** `read_console_messages` with errors only; expect none. Reset the viewport to desktop.

- [ ] **Step 7: Review before the pull request.**
  1. Run the `code-simplifier` agent on the drop-1 changes.
  2. Run `/code-review`, and fix confirmed findings test-first.
  3. Run `npm test && npm run build` again.

- [ ] **Step 8: Open the pull request.**
  1. Push `feat/round-one`.
  2. Run `gh pr create --base main --title "feat: drop 1 — swipe, jump, pothole bump, fresh layouts, mission ramp"`. The body lists the testers' requests addressed (labelled A and B, as in the spec), the tests added, the browser checks with screenshots, any tuned ramp values, and ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
  3. Do not merge without the user's approval. Merging to `main` redeploys the live game.
