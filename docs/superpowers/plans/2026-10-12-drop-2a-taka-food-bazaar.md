# Drop 2a: Taka, Street Food and the Bazaar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every ride rewarding moment to moment. Riders collect taka (৳) coin trails, eat cha, jhalmuri and chaap for power-ups (with a funny upset-stomach risk), and spend their taka in a garage shop, the Bazaar, on Dhaka-style looks and capped power-up upgrades.

**Architecture:**
- **Pure modules:**
  - `pickups.ts`: coin and snack placement, and power-up timers
  - `economy.ts`: catalogue, wallet, upgrades, payouts
  - `shop.ts`: the Bazaar's rows and HTML
- **Simulation:** coins and snacks are real objects inside the deterministic `Simulation`, so the existing pilot tests prove fairness.
- **Rendering:**
  - `models.ts` gains themed art, rider outfits, accessories, a coin and three snack models.
  - `world.ts` draws coins as two instanced meshes.
- **Wiring:** `main.ts` connects the HUD, results, settlement and the Bazaar screen.
- **Save:** moves to v3.

**Tech Stack:** TypeScript 5.9 (strict), Three.js r180, Vite 7, Vitest 4. Node 22 in CI.

**Spec:** `docs/superpowers/specs/2026-10-12-round-one-design.md`. This plan implements:
- §1: "Taka trails", "Street food", "Results"
- §2: "Shop and economy"
- §5: the economy and pickup tests

**Scope split (planning decision):** the spec's Drop 2 is split in two.
- **This plan (2a):** taka, street food, the Bazaar and save v3. New pickups get simple placeholder sounds.
- **Drop 2b (its own plan):**
  - the full soundscape and music
  - district ambience
  - bells and horns as purchasable looks
  - the voice manifest and family voice script
  - the ElevenLabs licence check

## Global Constraints

**Platform and code**
- Runs in phone and laptop browsers from GitHub Pages under `/king-of-dhaka-streets/`. Asset URLs stay base-aware (`import.meta.env.BASE_URL`).
- Never real money, ads or random-reward boxes.
- Code style matches each file:
  - dense one-line style: `main.ts`, `world.ts`, `progress.ts`, `models.ts` (its vehicle and rider builders)
  - conventional style: `simulation.ts`, `campaign.ts`, `audio.ts`, and the new `pickups.ts`, `economy.ts`, `shop.ts`
- Conventional Commits, each ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Work on branch `feat/drop-2a-taka` (already created from `main`).

**Coins**
- ৳1 coins sit in safe trails of 6–12 coins.
- ৳5 coins sit in bold trails of 3–6 coins.
- Arc trails of 4–7 ৳1 coins can only be collected in the air.
- Coins are about 1.2 m apart.
- No coin sits inside an obstacle footprint at the moment the rider would reach it.
- Bold trails never sit in a rear-threat attack lane while it passes.
- Coins collected within 0.6 s of each other form a chain.

**Snacks**
- At most one snack per 120 m, and at most four per ride.

| Snack | Effect at base level |
| --- | --- |
| Cha | Speed +25% and double street rep for 5 s |
| Jhalmuri | Pulls coins within 2 m for 6 s |
| Chaap | Full belly: absorbs the next ordinary hit; lasts until used or the ride ends |

- Cha's extra speed never takes the rider past `SPEED_CAP` (28 m/s, 100 km/h).

**Upset stomach**
- Chance per snack: 10% for the first, then +15% for each further snack in the ride (10%, 25%, 40%, 55%).
- After a 1.5 s delay: speed −35% and a steering wobble for 4 s, captioned "পেট গুড়গুড়!".
- Never costs a heart directly.
- Waits while a rear-threat warning is in progress.
- A full belly does not prevent it.

**Earning**
- Finish payout: ৳20, plus ৳10 per star.
- First completion of a mission: ৳50, once.
- A lost ride keeps the coins it collected but gets no finish payout.

**Prices**
- Looks: ৳150–800.
- Power-up upgrades: four levels at ৳200, ৳500, ৳1,000 and ৳2,000.

| Power-up | Level 0 | Level 4 |
| --- | --- | --- |
| Cha | 5 s | 9 s |
| Jhalmuri | 6 s, 2 m pull | 10 s, 4 m pull |
| Chaap | 0-point stomach reduction | 10-point stomach reduction |

Levels 1–3 sit evenly between level 0 and level 4.

**Fairness**
- Upgrades never add hearts, and never change unlocks or medals.
- Every mission stays completable with no upgrades and with maximum upgrades.

**Save v3**
- Key: `dhaka-streets-v3`.
- Contents: wallet, owned items, equipped looks per vehicle, the equipped outfit (`rider:outfit`), and upgrade levels.
- A v2 save migrates with ৳0 and default looks. Review mode never writes.

**Planning rulings**
- **First-completion bonus:** derived from the mission's stars still being 0 at the finish, so no separate "claimed" list is stored.
- **Car seat covers:** dropped, because they can't be seen from the chase camera. The car gets two paints.
- **"What did you buy?":** sent automatically with each feedback note, instead of a form field the child must fill in.

## Review Focus

1. **Settling a ride twice:** taka is banked exactly once per ride, whether it's won, lost, or abandoned through Pause → Back to the garage; never twice (finish, then garage). Test owner: Task 4 (`bankRide`).
2. **Double taps and exact amounts:** buying with exactly enough taka works, and tapping Buy twice quickly never charges twice or takes the wallet below zero. Test owner: Task 4.
3. **Bad saved looks:** an equipped id that is unknown, not owned, or saved under the wrong slot (old save, changed catalogue) falls back to the default look without crashing. Test owner: Task 4.
4. **Snacks right before the finish:** a snack eaten just before the finish line produces no boost or stomach events after the results appear. Test owner: Task 5.
5. **Coins in a rear threat's lane:** when a rear bus or truck warns, coins in its lane ahead are cleared, so coins never lure a child into the attack lane. Test owner: Task 5.

---

## File Structure

| File | Status | Responsibility |
| --- | --- | --- |
| `src/progress.ts` | Modify | Save v3: wallet, owned, equipped, upgrades; migration and sanitizing. |
| `src/pickups.ts` | Create | Coin and snack types, power-up timers and stomach odds, seeded placement and reachability. |
| `src/economy.ts` | Create | Look catalogue, upgrade ladder, buy, toggle, upgrade, payout, bank-once, equipped look, purchase summary. |
| `src/simulation.ts` | Modify | Places pickups; collects coins and snacks; boost, magnet, belly and stomach effects; sweeps coins from rear-threat lanes. |
| `src/models.ts` | Modify | `VehicleLook`; paint, art themes, extras and outfits in `createVehicle`; `coinParts`, `snackModel`. |
| `src/world.ts` | Modify | Instanced coins, floating snacks, magnet ring, stomach wobble, cha FOV kick, equipped look on the player. |
| `src/audio.ts` | Modify | Placeholder coin, snack, stomach and belly sounds. |
| `src/shop.ts` | Create | Bazaar rows and HTML. |
| `src/main.ts`, `src/style.css`, `src/feedback.ts`, `README.md` | Modify | HUD taka and effect chips, events, settlement, results, Bazaar screen, feedback purchases, docs. |
| `tests/*.test.ts` | Modify / Create | One test file per module. |

---

### Task 1: Save v3

**Files:**
- Modify: `src/progress.ts`, `src/main.ts` (two lines)
- Test: `tests/progress.test.ts`

**Interfaces:**
- Produces:
  - `interface Upgrades { cha: number; jhalmuri: number; chaap: number }`
  - `Progress` with `version: 3`, `taka: number`, `owned: string[]`, `equipped: Record<string, string>` (keys like `bicycle:paint`, `rider:outfit`) and `upgrades: Upgrades`
  - `loadProgress(raw, legacy, reducedDefault)` keeps its signature.

- [ ] **Step 1: Write the failing tests**

Add inside the `describe` in `tests/progress.test.ts`:

```ts
 it('upgrades a v2 save to v3 with an empty wallet and default looks',()=>{const p=loadProgress(JSON.stringify({version:2,stars:[1,2],best:[10,20],muted:true}),null);expect(p.version).toBe(3);expect(p.taka).toBe(0);expect(p.owned).toEqual([]);expect(p.equipped).toEqual({});expect(p.upgrades).toEqual({cha:0,jhalmuri:0,chaap:0});expect(p.stars.slice(0,2)).toEqual([1,2]);expect(p.muted).toBe(true);});
 it('round trips the wallet, looks and upgrades and sanitizes corrupt values',()=>{const p=loadProgress(null,null);p.taka=340;p.owned=['bicycle-paint-mango'];p.equipped={'bicycle:paint':'bicycle-paint-mango'};p.upgrades={cha:2,jhalmuri:0,chaap:4};const q=loadProgress(JSON.stringify(p),null);expect(q.taka).toBe(340);expect(q.owned).toEqual(['bicycle-paint-mango']);expect(q.equipped).toEqual({'bicycle:paint':'bicycle-paint-mango'});expect(q.upgrades).toEqual({cha:2,jhalmuri:0,chaap:4});const bad=loadProgress(JSON.stringify({stars:[],taka:-5,owned:'x',equipped:[1],upgrades:{cha:9,jhalmuri:'2',chaap:-1}}),null);expect(bad.taka).toBe(0);expect(bad.owned).toEqual([]);expect(bad.equipped).toEqual({});expect(bad.upgrades).toEqual({cha:4,jhalmuri:0,chaap:0});});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/progress.test.ts`
Expected: FAIL. `expected 2 to be 3` (version), and `taka` is undefined.

- [ ] **Step 3: Implement**

In `src/progress.ts`, replace the interface with:

```ts
export interface Upgrades { cha:number; jhalmuri:number; chaap:number }
export interface Progress {
 version:3; stars:number[];best:number[];muted:boolean;quality:'auto'|'low'|'high';reduced:boolean;controls?:'swipe'|'buttons';
 taka:number;owned:string[];equipped:Record<string,string>;upgrades:Upgrades;
}
```

Add after the `parse` helper:

```ts
const ids=(v:unknown)=>Array.isArray(v)?[...new Set(v.filter((x):x is string=>typeof x==='string'&&x.length>0&&x.length<=40))].slice(0,200):[];
const slots=(v:unknown)=>{const out:Record<string,string>={};if(v&&typeof v==='object'&&!Array.isArray(v))for(const [k,x] of Object.entries(v).slice(0,50))if(typeof x==='string'&&k.length<=40&&x.length<=40)out[k]=x;return out;};
```

In `loadProgress`, replace the `return {version:2,...}` line with:

```ts
 const up=(source.upgrades&&typeof source.upgrades==='object'?source.upgrades:{}) as Record<string,unknown>;
 return {version:3,stars,best,muted:source.muted===true,quality:source.quality==='low'||source.quality==='high'?source.quality:'auto',reduced:typeof source.reduced==='boolean'?source.reduced:reducedDefault,controls:source.controls==='swipe'||source.controls==='buttons'?source.controls:undefined,
  taka:number(source.taka),owned:ids(source.owned),equipped:slots(source.equipped),upgrades:{cha:number(up.cha,4),jhalmuri:number(up.jhalmuri,4),chaap:number(up.chaap,4)}};
```

In `src/main.ts`, read v3 first and save to v3:
- Replace `loadProgress(localStorage.getItem('dhaka-streets-v2'),localStorage.getItem('dhaka-streets-v1'),` with `loadProgress(localStorage.getItem('dhaka-streets-v3')??localStorage.getItem('dhaka-streets-v2'),localStorage.getItem('dhaka-streets-v1'),`.
- Replace `localStorage.setItem('dhaka-streets-v2',JSON.stringify(save))` with `localStorage.setItem('dhaka-streets-v3',JSON.stringify(save))`.

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run tests/progress.test.ts && npx tsc --noEmit`
Expected: PASS (9 tests); no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/progress.ts src/main.ts tests/progress.test.ts
git commit -m "feat(progress): save v3 with wallet, looks and upgrades

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Power-up effects and stomach odds

**Files:**
- Create: `src/pickups.ts`
- Test: `tests/pickups.test.ts`

**Interfaces:**
- Produces (`src/pickups.ts`):
  - `type PowerUp = 'cha' | 'jhalmuri' | 'chaap'`
  - `interface Coin { id: number; group: number; x: number; y: number; z: number; value: 1 | 5; trail: 'safe' | 'bold' | 'arc'; collected: boolean; gone: boolean }`
  - `interface Snack { id: number; kind: PowerUp; x: number; z: number; eaten: boolean }`
  - `interface PowerUpStats { chaSeconds: number; magnetSeconds: number; magnetRadius: number; stomachReduction: number }`
  - `const BASE_POWER_UPS: PowerUpStats`
  - `const COIN_HEIGHT = 0.55`, `CHA_SPEED = 1.25`, `STOMACH_SPEED = 0.65`, `STOMACH_DELAY = 1.5`, `STOMACH_SECONDS = 4`
  - `const SNACK_TEXT: Record<PowerUp, string>`
  - `interface Effects { boost: number; magnet: number; belly: boolean; stomach: number; stomachPending: number; snacksEaten: number }`
  - `newEffects(): Effects`
  - `stomachChance(previousSnacks: number, reduction: number): number`
  - `eatSnack(e: Effects, kind: PowerUp, stats: PowerUpStats, roll: number): boolean`. Returns true when an upset stomach is queued.
  - `tickEffects(e: Effects, dt: number, rearThreat: boolean): boolean`. Returns true on the step the stomach starts.

- [ ] **Step 1: Write the failing tests**

Create `tests/pickups.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BASE_POWER_UPS, STOMACH_DELAY, STOMACH_SECONDS, eatSnack, newEffects, stomachChance, tickEffects } from '../src/pickups';

describe('street food effects', () => {
  it('raises the upset-stomach chance with every snack, lowered by chaap upgrades', () => {
    expect([0, 1, 2, 3].map(n => stomachChance(n, 0))).toEqual([0.1, 0.25, 0.4, 0.55].map(v => expect.closeTo(v, 10)));
    expect(stomachChance(0, 0.1)).toBeCloseTo(0); expect(stomachChance(2, 0.1)).toBeCloseTo(0.3);
    expect(stomachChance(9, 0)).toBe(1); expect(stomachChance(0, 0.5)).toBe(0);
  });
  it('gives each snack its power for the upgraded duration', () => {
    const e = newEffects(), stats = { ...BASE_POWER_UPS, chaSeconds: 7, magnetSeconds: 8 };
    eatSnack(e, 'cha', stats, 0.99); expect(e.boost).toBe(7);
    eatSnack(e, 'jhalmuri', stats, 0.99); expect(e.magnet).toBe(8);
    eatSnack(e, 'chaap', stats, 0.99); expect(e.belly).toBe(true);
    expect(e.snacksEaten).toBe(3); expect(e.stomachPending).toBe(-1);
  });
  it('queues one upset stomach on an unlucky roll and never stacks a second', () => {
    const e = newEffects();
    expect(eatSnack(e, 'cha', BASE_POWER_UPS, 0.05)).toBe(true); expect(e.stomachPending).toBe(STOMACH_DELAY);
    expect(eatSnack(e, 'cha', BASE_POWER_UPS, 0)).toBe(false); expect(e.stomachPending).toBe(STOMACH_DELAY);
  });
  it('starts the stomach after its delay, waits during a rear-threat warning, then wears off', () => {
    const e = newEffects(); e.stomachPending = STOMACH_DELAY;
    expect(tickEffects(e, 1, true)).toBe(false); expect(e.stomachPending).toBe(STOMACH_DELAY);
    expect(tickEffects(e, 1, false)).toBe(false);
    expect(tickEffects(e, 0.6, false)).toBe(true); expect(e.stomach).toBe(STOMACH_SECONDS);
    tickEffects(e, STOMACH_SECONDS, false); expect(e.stomach).toBe(0);
  });
  it('counts boost and magnet down to zero', () => {
    const e = newEffects(); e.boost = 1; e.magnet = 0.5;
    tickEffects(e, 0.75, false); expect(e.boost).toBeCloseTo(0.25); expect(e.magnet).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/pickups.test.ts`
Expected: FAIL. Cannot find module `../src/pickups`.

- [ ] **Step 3: Implement**

Create `src/pickups.ts`:

```ts
import type { Traffic } from './simulation';

export type PowerUp = 'cha' | 'jhalmuri' | 'chaap';
export interface Coin { id: number; group: number; x: number; y: number; z: number; value: 1 | 5; trail: 'safe' | 'bold' | 'arc'; collected: boolean; gone: boolean }
export interface Snack { id: number; kind: PowerUp; x: number; z: number; eaten: boolean }
export interface PowerUpStats { chaSeconds: number; magnetSeconds: number; magnetRadius: number; stomachReduction: number }
export const BASE_POWER_UPS: PowerUpStats = { chaSeconds: 5, magnetSeconds: 6, magnetRadius: 2, stomachReduction: 0 };
export const COIN_HEIGHT = 0.55, CHA_SPEED = 1.25, STOMACH_SPEED = 0.65, STOMACH_DELAY = 1.5, STOMACH_SECONDS = 4;
export const SNACK_TEXT: Record<PowerUp, string> = {
  cha: 'গরম চা! Hot cha — speed and double street rep.',
  jhalmuri: 'ঝালমুড়ি! Jhalmuri — taka magnet.',
  chaap: 'চাপ! Chaap — full belly shield.',
};

export interface Effects { boost: number; magnet: number; belly: boolean; stomach: number; stomachPending: number; snacksEaten: number }
export function newEffects(): Effects { return { boost: 0, magnet: 0, belly: false, stomach: 0, stomachPending: -1, snacksEaten: 0 }; }

// Each snack in a ride makes the next one riskier: 10%, 25%, 40%, 55%.
export function stomachChance(previousSnacks: number, reduction: number): number {
  return Math.min(1, Math.max(0, 0.1 + 0.15 * previousSnacks - reduction));
}

export function eatSnack(e: Effects, kind: PowerUp, stats: PowerUpStats, roll: number): boolean {
  const chance = stomachChance(e.snacksEaten, stats.stomachReduction);
  e.snacksEaten++;
  if (kind === 'cha') e.boost = stats.chaSeconds;
  else if (kind === 'jhalmuri') e.magnet = stats.magnetSeconds;
  else e.belly = true;
  const upset = roll < chance && e.stomachPending < 0 && e.stomach <= 0;
  if (upset) e.stomachPending = STOMACH_DELAY;
  return upset;
}

// A rear-threat warning holds the stomach back so a snack can never cause an unavoidable loss.
export function tickEffects(e: Effects, dt: number, rearThreat: boolean): boolean {
  e.boost = Math.max(0, e.boost - dt); e.magnet = Math.max(0, e.magnet - dt); e.stomach = Math.max(0, e.stomach - dt);
  if (e.stomachPending < 0 || rearThreat) return false;
  e.stomachPending -= dt;
  if (e.stomachPending > 0) return false;
  e.stomachPending = -1; e.stomach = STOMACH_SECONDS;
  return true;
}
```

(`Traffic` is imported now because Task 3 adds placement to this file.)

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run tests/pickups.test.ts && npx tsc --noEmit`
Expected: PASS (5 tests); no type errors. The tsconfig has no `noUnusedLocals`, so the early `Traffic` import is fine.

- [ ] **Step 5: Commit**

```bash
git add src/pickups.ts tests/pickups.test.ts
git commit -m "feat(pickups): street food effects and upset-stomach odds

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Coin trails and snack placement

**Files:**
- Modify: `src/pickups.ts`
- Test: `tests/pickups.test.ts`

**Interfaces:**
- Consumes: the `Coin`, `Snack` and `PowerUp` types, and `COIN_HEIGHT` (Task 2). `Traffic` from `simulation.ts`.
- Produces:
  - `interface PlacementInput { traffic: Traffic[]; routeLength: number; startSpeed: number; arcHeight: number; arcClears: string[]; random: () => number }`
  - `coinIsClear(traffic: Traffic[], x: number, z: number, startSpeed: number): boolean`
  - `placePickups(input: PlacementInput): { coins: Coin[]; snacks: Snack[] }`
  - Constants: `COIN_SPACING = 1.2`, `MAX_SNACKS = 4`, `SNACK_GAP = 120`
- Coordinates: `z` is negative ahead of the start; `x` is metres from the road centre.

- [ ] **Step 1: Write the failing tests**

Append to `tests/pickups.test.ts`. Add these imports at the top:

```ts
import { COIN_SPACING, MAX_SNACKS, SNACK_GAP, coinIsClear, placePickups } from '../src/pickups';
import { JUMPS, Simulation, VEHICLES } from '../src/simulation';
```

Then append:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/pickups.test.ts`
Expected: FAIL. `placePickups` is not exported.

- [ ] **Step 3: Implement**

Append to `src/pickups.ts`:

```ts
export interface PlacementInput { traffic: Traffic[]; routeLength: number; startSpeed: number; arcHeight: number; arcClears: string[]; random: () => number }
export const COIN_SPACING = 1.2, MAX_SNACKS = 4, SNACK_GAP = 120;
const SAFE_LANES = [-3.2, -1.6, 0, 1.6, 3.2], SNACK_LANES = [-2.4, 0, 2.4];
const SNACKS: PowerUp[] = ['cha', 'jhalmuri', 'chaap'];

// Checks where each actor will be when the rider reaches (x, z), widened for timing slack.
export function coinIsClear(traffic: Traffic[], x: number, z: number, startSpeed: number): boolean {
  return !traffic.some(t => {
    if (t.behavior === 'rear-threat') return false;
    if (t.kind === 'pedestrian') return Math.abs(t.z - z) < 3; // walkers cross the whole road
    const arrival = Math.abs(z) / Math.max(1, startSpeed), futureZ = t.z - t.speed * arrival, slack = t.speed > 0 ? 4 : 0;
    return Math.abs(t.x - x) < t.width / 2 + 0.6 && Math.abs(futureZ - z) < t.length / 2 + 0.6 + slack;
  });
}

export function placePickups(input: PlacementInput): { coins: Coin[]; snacks: Snack[] } {
  const { traffic, routeLength, startSpeed, random } = input;
  const coins: Coin[] = [], snacks: Snack[] = [];
  let id = 1, group = 1;
  const inRoute = (z: number) => -z > 40 && -z < routeLength - 30;
  const clear = (x: number, z: number) => coinIsClear(traffic, x, z, startSpeed);
  const free = (x: number, z: number) => !coins.some(c => Math.abs(c.x - x) < 1.2 && Math.abs(c.z - z) < 2);
  const lay = (x: number, zs: number[], value: 1 | 5, trail: Coin['trail'], y = (_: number) => COIN_HEIGHT) => {
    zs.forEach((z, k) => coins.push({ id: id++, group, x, y: y(k), z, value, trail, collected: false, gone: false }));
    group++;
  };

  // Arc trails hop over every other hazard this vehicle clears in the air.
  if (input.arcHeight >= 0.45) {
    traffic.filter(t => input.arcClears.includes(t.kind) && inRoute(t.z)).forEach((t, i) => {
      if (i % 2) return;
      const count = 4 + Math.floor(random() * 4), span = t.length + 2;
      const zs = Array.from({ length: count }, (_, k) => t.z + span / 2 - (k / (count - 1)) * span);
      lay(t.x, zs, 1, 'arc', k => COIN_HEIGHT + input.arcHeight * 0.8 * Math.sin(Math.PI * k / (count - 1)));
    });
  }

  // Safe trails teach a clean line through the traffic.
  for (let start = 70 + random() * 30; start < routeLength - 50; start += 70 + random() * 40) {
    const count = 6 + Math.floor(random() * 7), first = Math.floor(random() * SAFE_LANES.length);
    for (let j = 0; j < SAFE_LANES.length; j++) {
      const x = SAFE_LANES[(first + j) % SAFE_LANES.length];
      const zs = Array.from({ length: count }, (_, k) => -(start + k * COIN_SPACING));
      if (!zs.every(z => inRoute(z) && clear(x, z) && free(x, z))) continue;
      lay(x, zs, 1, 'safe');
      break;
    }
  }

  // Bold ৳5 trails run close beside moving traffic: a close shave pays.
  traffic.filter(t => t.speed > 0 && t.behavior !== 'rear-threat' && inRoute(t.z) && -t.z > 80).forEach((t, i) => {
    if (i % 3 !== 1) return;
    const side = t.x > 0 ? -1 : 1, x = t.x + side * (t.width / 2 + 0.9);
    if (Math.abs(x) > 4.3) return;
    const count = 3 + Math.floor(random() * 4);
    const meet = -t.z * startSpeed / Math.max(1, startSpeed - t.speed), centre = -meet;
    const zs = Array.from({ length: count }, (_, k) => centre + (count - 1) * COIN_SPACING / 2 - k * COIN_SPACING);
    if (zs.every(z => inRoute(z) && clear(x, z) && free(x, z))) lay(x, zs, 5, 'bold');
  });

  // Snacks float in an open lane at least 120 m apart.
  for (let z = -(110 + random() * 40); snacks.length < MAX_SNACKS && inRoute(z); z -= SNACK_GAP + random() * 60) {
    const first = Math.floor(random() * SNACK_LANES.length);
    for (let j = 0; j < SNACK_LANES.length; j++) {
      const x = SNACK_LANES[(first + j) % SNACK_LANES.length];
      if (!clear(x, z) || !coins.every(c => Math.hypot(c.x - x, c.z - z) > 3)) continue;
      snacks.push({ id: id++, kind: SNACKS[Math.floor(random() * SNACKS.length)], x, z, eaten: false });
      break;
    }
  }
  return { coins, snacks };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/pickups.test.ts && npx tsc --noEmit`
Expected: PASS (10 tests).

If "places at most four snacks" fails because a route got zero snacks (every lane blocked at every candidate), don't weaken the test. Debug with superpowers:systematic-debugging: print the candidate z values and which actor blocks each lane, then adjust the snack walk (for example, retry the same z with a 10 m nudge before advancing). Ledger any change as a ruling.

- [ ] **Step 5: Commit**

```bash
git add src/pickups.ts tests/pickups.test.ts
git commit -m "feat(pickups): seeded taka trails and street food placement

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Economy — catalogue, wallet, upgrades, payouts

**Files:**
- Create: `src/economy.ts`
- Modify: `src/models.ts` (adds the `VehicleLook` type only)
- Test: `tests/economy.test.ts`

**Interfaces:**
- Consumes: `Progress` and `Upgrades` (Task 1); `PowerUp` and `PowerUpStats` (Task 2); `VehicleKind` from `simulation.ts`.
- Produces:
  - In `src/models.ts`: `interface VehicleLook { paint?: number; art?: 'peacock' | 'tiger' | 'city' | 'rose'; extra?: 'streamers' | 'basket' | 'garland' | 'red-helmet'; outfit?: { shirt: number; lower: number; accent?: number } }`
  - In `src/economy.ts`:
    - `type Slot = 'paint' | 'art' | 'extra' | 'outfit'`
    - `interface LookItem { id; name; vehicle: VehicleKind | 'rider'; slot: Slot; price: number; look: VehicleLook }`
    - `LOOKS: LookItem[]`
    - `UPGRADE_PRICES = [200, 500, 1000, 2000]`, `MAX_LEVEL = 4`
    - `powerUpStats(u: Upgrades): PowerUpStats`
    - `type Purchase = 'bought' | 'owned' | 'too-poor' | 'maxed' | 'unknown'`
    - `buyLook(save, id): Purchase`. Buying also equips.
    - `toggleLook(save, id): boolean`. Equips an owned item, or unequips it if already equipped.
    - `buyUpgrade(save, kind: PowerUp): Purchase`
    - `interface RideResult { won: boolean; coins: number; stars: number; firstClear: boolean }`
    - `interface Payout { coins; finish; firstClear; total }`
    - `ridePayout(r): Payout`, `settleRide(save, r): Payout`
    - `bankRide(save, ride: { banked: boolean }, r): Payout | undefined`
    - `vehicleLook(save, vehicle: VehicleKind): VehicleLook`
    - `describePurchases(save): string`

- [ ] **Step 1: Add the `VehicleLook` type**

In `src/models.ts`, add after the `export type Model = ...` line:

```ts
export interface VehicleLook { paint?: number; art?: 'peacock'|'tiger'|'city'|'rose'; extra?: 'streamers'|'basket'|'garland'|'red-helmet'; outfit?: { shirt: number; lower: number; accent?: number } }
```

- [ ] **Step 2: Write the failing tests**

Create `tests/economy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { LOOKS, MAX_LEVEL, UPGRADE_PRICES, bankRide, buyLook, buyUpgrade, describePurchases, powerUpStats, ridePayout, settleRide, toggleLook, vehicleLook } from '../src/economy';
import { loadProgress } from '../src/progress';
import { VEHICLES } from '../src/simulation';
const wallet = (taka: number) => { const p = loadProgress(null, null); p.taka = taka; return p; };

describe('the Bazaar economy', () => {
  it('sells original Dhaka looks for every vehicle and four outfits, priced ৳150–800', () => {
    expect(new Set(LOOKS.map(i => i.id)).size).toBe(LOOKS.length);
    for (const v of VEHICLES) expect(LOOKS.some(i => i.vehicle === v.id), v.id).toBe(true);
    expect(LOOKS.filter(i => i.slot === 'outfit' && i.vehicle === 'rider')).toHaveLength(4);
    for (const i of LOOKS) { expect(i.price).toBeGreaterThanOrEqual(150); expect(i.price).toBeLessThanOrEqual(800); }
  });
  it('buys a look once, equips it, and refuses when the wallet is short', () => {
    const p = wallet(150);
    expect(buyLook(p, 'bicycle-paint-mango')).toBe('bought'); expect(p.taka).toBe(0);
    expect(p.equipped['bicycle:paint']).toBe('bicycle-paint-mango');
    expect(buyLook(p, 'bicycle-paint-mango')).toBe('owned'); expect(p.taka).toBe(0);
    expect(buyLook(p, 'bicycle-paint-jamun')).toBe('too-poor'); expect(p.taka).toBe(0); expect(p.owned).toEqual(['bicycle-paint-mango']);
    expect(buyLook(p, 'no-such-look')).toBe('unknown');
  });
  it('toggles an owned look on and off and refuses unowned looks', () => {
    const p = wallet(1000); buyLook(p, 'outfit-lungi');
    expect(toggleLook(p, 'outfit-lungi')).toBe(true); expect(p.equipped['rider:outfit']).toBeUndefined();
    expect(toggleLook(p, 'outfit-lungi')).toBe(true); expect(p.equipped['rider:outfit']).toBe('outfit-lungi');
    expect(toggleLook(p, 'outfit-cricket')).toBe(false);
  });
  it('climbs the upgrade ladder at ৳200, ৳500, ৳1,000 and ৳2,000, then stops', () => {
    const p = wallet(3700);
    for (const price of UPGRADE_PRICES) { const before = p.taka; expect(buyUpgrade(p, 'cha')).toBe('bought'); expect(before - p.taka).toBe(price); }
    expect(p.upgrades.cha).toBe(MAX_LEVEL); expect(buyUpgrade(p, 'cha')).toBe('maxed'); expect(p.taka).toBe(0);
    expect(buyUpgrade(p, 'jhalmuri')).toBe('too-poor');
  });
  it('turns upgrade levels into power-up strength, evenly between level 0 and 4', () => {
    expect(powerUpStats({ cha: 0, jhalmuri: 0, chaap: 0 })).toEqual({ chaSeconds: 5, magnetSeconds: 6, magnetRadius: 2, stomachReduction: 0 });
    expect(powerUpStats({ cha: 4, jhalmuri: 4, chaap: 4 })).toEqual({ chaSeconds: 9, magnetSeconds: 10, magnetRadius: 4, stomachReduction: expect.closeTo(0.1, 10) });
    expect(powerUpStats({ cha: 2, jhalmuri: 2, chaap: 2 })).toEqual({ chaSeconds: 7, magnetSeconds: 8, magnetRadius: 3, stomachReduction: expect.closeTo(0.05, 10) });
    expect(powerUpStats({ cha: 99, jhalmuri: -3, chaap: NaN }).chaSeconds).toBe(9);
  });
  it('pays coins, a finish bonus per star and a one-off first-clear bonus; a lost ride keeps only its coins', () => {
    expect(ridePayout({ won: true, coins: 37, stars: 2, firstClear: true })).toEqual({ coins: 37, finish: 40, firstClear: 50, total: 127 });
    expect(ridePayout({ won: true, coins: 10, stars: 3, firstClear: false })).toEqual({ coins: 10, finish: 50, firstClear: 0, total: 60 });
    expect(ridePayout({ won: false, coins: 12, stars: 0, firstClear: true })).toEqual({ coins: 12, finish: 0, firstClear: 0, total: 12 });
    const p = wallet(5); settleRide(p, { won: true, coins: 3, stars: 1, firstClear: false }); expect(p.taka).toBe(38);
  });
  it('banks each ride exactly once, however the ride ends', () => {
    const p = wallet(0), ride = { banked: false };
    expect(bankRide(p, ride, { won: false, coins: 9, stars: 0, firstClear: false })?.total).toBe(9);
    expect(bankRide(p, ride, { won: true, coins: 9, stars: 3, firstClear: true })).toBeUndefined();
    expect(p.taka).toBe(9);
  });
  it('builds the equipped look and ignores unknown, unowned or misfiled items', () => {
    const p = wallet(2000); buyLook(p, 'bicycle-paint-mango'); buyLook(p, 'bicycle-basket'); buyLook(p, 'outfit-cricket');
    expect(vehicleLook(p, 'bicycle')).toEqual({ paint: 0xf2b630, extra: 'basket', outfit: { shirt: 0x0f6b3a, lower: 0x1d2b2a, accent: 0xd62b2b } });
    expect(vehicleLook(p, 'truck')).toEqual({ outfit: { shirt: 0x0f6b3a, lower: 0x1d2b2a, accent: 0xd62b2b } });
    p.equipped = { 'bicycle:paint': 'gone-item', 'bicycle:art': 'bicycle-paint-mango', 'bicycle:extra': 'bicycle-streamers' };
    expect(vehicleLook(p, 'bicycle')).toEqual({});
  });
  it('summarises the wallet, looks and upgrades for feedback notes', () => {
    const p = wallet(500); buyLook(p, 'outfit-school'); buyUpgrade(p, 'cha');
    expect(describePurchases(p)).toBe('৳50 · looks: School uniform · cha 1, jhalmuri 0, chaap 0');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/economy.test.ts`
Expected: FAIL. Cannot find module `../src/economy`.

- [ ] **Step 4: Implement**

Create `src/economy.ts`:

```ts
import type { VehicleLook } from './models';
import type { PowerUp, PowerUpStats } from './pickups';
import type { Progress, Upgrades } from './progress';
import type { VehicleKind } from './simulation';

export type Slot = 'paint' | 'art' | 'extra' | 'outfit';
export interface LookItem { id: string; name: string; vehicle: VehicleKind | 'rider'; slot: Slot; price: number; look: VehicleLook }

// Original looks drawn in code: rickshaw and truck art, paint, accessories and outfits.
export const LOOKS: LookItem[] = [
  { id: 'bicycle-paint-mango', name: 'Mango yellow paint', vehicle: 'bicycle', slot: 'paint', price: 150, look: { paint: 0xf2b630 } },
  { id: 'bicycle-paint-jamun', name: 'Jamun purple paint', vehicle: 'bicycle', slot: 'paint', price: 150, look: { paint: 0x6b3a8c } },
  { id: 'bicycle-streamers', name: 'Handlebar streamers', vehicle: 'bicycle', slot: 'extra', price: 200, look: { extra: 'streamers' } },
  { id: 'bicycle-basket', name: 'Front basket', vehicle: 'bicycle', slot: 'extra', price: 250, look: { extra: 'basket' } },
  { id: 'rickshaw-hood-red', name: 'Red hood', vehicle: 'rickshaw', slot: 'paint', price: 200, look: { paint: 0xb8322e } },
  { id: 'rickshaw-art-peacock', name: 'Peacock rickshaw art', vehicle: 'rickshaw', slot: 'art', price: 400, look: { art: 'peacock' } },
  { id: 'rickshaw-art-tiger', name: 'Tiger rickshaw art', vehicle: 'rickshaw', slot: 'art', price: 500, look: { art: 'tiger' } },
  { id: 'rickshaw-art-city', name: 'City lights rickshaw art', vehicle: 'rickshaw', slot: 'art', price: 600, look: { art: 'city' } },
  { id: 'rickshaw-garland', name: 'Plastic flower garland', vehicle: 'rickshaw', slot: 'extra', price: 300, look: { extra: 'garland' } },
  { id: 'motorbike-paint-teal', name: 'Teal paint', vehicle: 'motorbike', slot: 'paint', price: 200, look: { paint: 0x1f8a8a } },
  { id: 'motorbike-helmet-red', name: 'Red helmet', vehicle: 'motorbike', slot: 'extra', price: 200, look: { extra: 'red-helmet' } },
  { id: 'car-paint-taxi', name: 'Yellow taxi paint', vehicle: 'car', slot: 'paint', price: 250, look: { paint: 0xf2c12e } },
  { id: 'car-paint-green', name: 'Bottle green paint', vehicle: 'car', slot: 'paint', price: 250, look: { paint: 0x2e7d4f } },
  { id: 'truck-paint-green', name: 'Bottle green paint', vehicle: 'truck', slot: 'paint', price: 300, look: { paint: 0x2e7d4f } },
  { id: 'truck-art-rose', name: 'Rose truck art', vehicle: 'truck', slot: 'art', price: 700, look: { art: 'rose' } },
  { id: 'truck-art-peacock', name: 'Peacock truck art', vehicle: 'truck', slot: 'art', price: 800, look: { art: 'peacock' } },
  { id: 'outfit-lungi', name: 'Lungi and gamchha', vehicle: 'rider', slot: 'outfit', price: 300, look: { outfit: { shirt: 0xf2efe4, lower: 0x2f5d8a, accent: 0xc0392b } } },
  { id: 'outfit-panjabi', name: 'Panjabi', vehicle: 'rider', slot: 'outfit', price: 350, look: { outfit: { shirt: 0xf4e3c1, lower: 0xf4e3c1, accent: 0xb88a3e } } },
  { id: 'outfit-school', name: 'School uniform', vehicle: 'rider', slot: 'outfit', price: 250, look: { outfit: { shirt: 0xf7f7f2, lower: 0x1f3b5c } } },
  { id: 'outfit-cricket', name: 'Red-and-green cricket jersey', vehicle: 'rider', slot: 'outfit', price: 500, look: { outfit: { shirt: 0x0f6b3a, lower: 0x1d2b2a, accent: 0xd62b2b } } },
];
export const UPGRADE_PRICES = [200, 500, 1000, 2000] as const;
export const MAX_LEVEL = 4;
export type Purchase = 'bought' | 'owned' | 'too-poor' | 'maxed' | 'unknown';
const slotKey = (item: LookItem) => `${item.vehicle}:${item.slot}`;
const level = (n: number) => Math.max(0, Math.min(MAX_LEVEL, Math.floor(n) || 0));

export function powerUpStats(u: Upgrades): PowerUpStats {
  return { chaSeconds: 5 + level(u.cha), magnetSeconds: 6 + level(u.jhalmuri), magnetRadius: 2 + level(u.jhalmuri) * 0.5, stomachReduction: level(u.chaap) * 0.025 };
}

export function buyLook(save: Progress, id: string): Purchase {
  const item = LOOKS.find(i => i.id === id);
  if (!item) return 'unknown';
  if (save.owned.includes(id)) return 'owned';
  if (save.taka < item.price) return 'too-poor';
  save.taka -= item.price; save.owned.push(id); save.equipped[slotKey(item)] = id;
  return 'bought';
}

export function toggleLook(save: Progress, id: string): boolean {
  const item = LOOKS.find(i => i.id === id);
  if (!item || !save.owned.includes(id)) return false;
  if (save.equipped[slotKey(item)] === id) delete save.equipped[slotKey(item)];
  else save.equipped[slotKey(item)] = id;
  return true;
}

export function buyUpgrade(save: Progress, kind: PowerUp): Purchase {
  const current = save.upgrades[kind];
  if (current >= MAX_LEVEL) return 'maxed';
  const price = UPGRADE_PRICES[current];
  if (save.taka < price) return 'too-poor';
  save.taka -= price; save.upgrades[kind] = current + 1;
  return 'bought';
}

export interface RideResult { won: boolean; coins: number; stars: number; firstClear: boolean }
export interface Payout { coins: number; finish: number; firstClear: number; total: number }
export function ridePayout(r: RideResult): Payout {
  const coins = Math.max(0, Math.floor(r.coins) || 0);
  const finish = r.won ? 20 + 10 * Math.max(0, Math.min(3, Math.floor(r.stars) || 0)) : 0;
  const firstClear = r.won && r.firstClear ? 50 : 0;
  return { coins, finish, firstClear, total: coins + finish + firstClear };
}
export function settleRide(save: Progress, r: RideResult): Payout { const p = ridePayout(r); save.taka += p.total; return p; }
// A ride can end by winning, losing or quitting to the garage; only the first settlement pays.
export function bankRide(save: Progress, ride: { banked: boolean }, r: RideResult): Payout | undefined {
  if (ride.banked) return undefined;
  ride.banked = true;
  return settleRide(save, r);
}

export function vehicleLook(save: Progress, vehicle: VehicleKind): VehicleLook {
  const look: VehicleLook = {};
  for (const key of [`${vehicle}:paint`, `${vehicle}:art`, `${vehicle}:extra`, 'rider:outfit']) {
    const item = LOOKS.find(i => i.id === save.equipped[key]);
    if (item && save.owned.includes(item.id) && slotKey(item) === key) Object.assign(look, item.look);
  }
  return look;
}

export function describePurchases(save: Progress): string {
  const names = save.owned.map(id => LOOKS.find(i => i.id === id)?.name).filter(Boolean);
  return `৳${save.taka} · looks: ${names.length ? names.join(', ') : 'none'} · cha ${save.upgrades.cha}, jhalmuri ${save.upgrades.jhalmuri}, chaap ${save.upgrades.chaap}`;
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run tests/economy.test.ts && npx tsc --noEmit`
Expected: PASS (9 tests); no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/economy.ts src/models.ts tests/economy.test.ts
git commit -m "feat(economy): Bazaar catalogue, wallet, upgrades and ride payouts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Pickups and power-ups in the ride

**Files:**
- Modify: `src/simulation.ts`
- Test: `tests/simulation.test.ts`

**Interfaces:**
- Consumes:
  - From `pickups.ts`: `placePickups`, `newEffects`, `eatSnack`, `tickEffects`, `BASE_POWER_UPS`, `COIN_HEIGHT`, `CHA_SPEED`, `STOMACH_SPEED`, `SNACK_TEXT`, and the `Coin`, `Snack`, `Effects`, `PowerUpStats` types (Tasks 2–3).
  - From `economy.ts`: `powerUpStats` (Task 4), used in tests only.
- Produces:
  - `new Simulation(index, seed, stageIndex, powerUps?: PowerUpStats)`
  - Fields: `coins: Coin[]`, `snacks: Snack[]`, `effects: Effects`, `taka: number` (coin value collected this ride), `banked: boolean`, `readonly powerUps: PowerUpStats`
  - `sweepCoins(x: number): void`
  - `GameEvent` gains optional `value?: number`, `chain?: number`, `kind?: string`
  - Events:

    | Event | Fields |
    | --- | --- |
    | `coin` | `value`, `chain` |
    | `snack` | `kind` |
    | `stomach` | — |
    | `belly` | — |

- [ ] **Step 1: Write the failing tests**

In `tests/simulation.test.ts`, extend the imports:

```ts
import { COIN_HEIGHT, type Coin } from '../src/pickups';
import { powerUpStats } from '../src/economy';
```

Give `pilot` an optional coin-following mode. Change its signature to `function pilot(sim: Simulation, followCoins = false) {`. Inside the lane loop, immediately after the `for (const p of sim.projectiles) { ... }` block and before `if (cost < bestCost)`, add:

```ts
    if (followCoins && cost < 5) {
      const coin = sim.coins.find(c => c.trail === 'safe' && !c.collected && !c.gone && sim.z - c.z > -1 && sim.z - c.z < 25);
      if (coin && Math.abs(x - coin.x) < 0.35) cost -= 40;
    }
```

Then append a new `describe` block at the end of the file:

```ts
describe('taka and street food', () => {
  const coin = (patch: Partial<Coin> = {}): Coin => ({ id: 501, group: 1, x: 0, y: COIN_HEIGHT, z: -3, value: 1, trail: 'safe', collected: false, gone: false, ...patch });
  const bare = (index = 0, lesson = 0) => { const sim = new Simulation(index, 1, lesson); sim.start(); sim.traffic = []; sim.coins = []; sim.snacks = []; return sim; };

  it('lays coin trails and snacks on every route', () => {
    for (let stage = 0; stage < 15; stage++) {
      const sim = new Simulation(Math.floor(stage / 3), 9, stage % 3);
      expect(sim.coins.length, `stage ${stage}`).toBeGreaterThan(20);
      expect(sim.snacks.length).toBeGreaterThan(0); expect(sim.snacks.length).toBeLessThanOrEqual(4);
    }
  });

  it('collects ground coins in its path and counts a quick chain', () => {
    const sim = bare(); sim.speed = 10;
    sim.coins = [coin({ id: 1, z: -3 }), coin({ id: 2, z: -4.2 }), coin({ id: 3, x: 4, z: -5 })];
    advance(sim, 0.6);
    expect(sim.taka).toBe(2);
    expect(sim.events.filter(e => e.type === 'coin').map(e => e.chain)).toEqual([1, 2]);
  });

  it('needs a jump to collect a raised arc coin', () => {
    for (const hop of [false, true]) {
      const sim = bare(); sim.speed = 10; sim.coins = [coin({ trail: 'arc', y: COIN_HEIGHT + 0.7, z: -3.5 })];
      if (hop) sim.jump();
      advance(sim, 0.6);
      expect(sim.taka, `jump ${hop}`).toBe(hop ? 1 : 0);
    }
  });

  it('pulls nearby coins in while the jhalmuri magnet is active', () => {
    for (const magnet of [0, 5]) {
      const sim = bare(); sim.speed = 10; sim.effects.magnet = magnet; sim.coins = [coin({ x: 2.2, z: -6 })];
      advance(sim, 1);
      expect(sim.taka, `magnet ${magnet}`).toBe(magnet ? 1 : 0);
    }
  });

  it('eats a cha for a speed boost and double street rep', () => {
    const sim = bare(); sim.snacks = [{ id: 1, kind: 'cha', x: 0, z: -2, eaten: false }];
    advance(sim, 3);
    expect(sim.events.some(e => e.type === 'snack' && e.kind === 'cha')).toBe(true);
    expect(sim.speed).toBeGreaterThan(sim.maxSpeed * 1.1);
    sim.traffic = [obstacle({ kind: 'cng', x: 2.5, z: sim.z - 2, width: 1.5, length: 2.5 })];
    const before = sim.score; advance(sim, 1);
    expect(sim.score - before).toBe(30);
  });

  it('never lets cha push past the 100 km/h cap', () => {
    const sim = bare(4, 2); sim.distance = sim.routeLength * 0.8; sim.speed = 27; sim.effects.boost = 5;
    let top = 0;
    for (let i = 0; i < 120 && sim.status === 'playing'; i++) { advance(sim, 1 / 60); top = Math.max(top, sim.speed); }
    expect(top).toBeLessThanOrEqual(SPEED_CAP + 1e-9);
  });

  it('lets a chaap full belly absorb exactly one ordinary hit', () => {
    const sim = bare(); sim.speed = 10; sim.effects.belly = true;
    sim.traffic = [obstacle({ kind: 'cng', id: 1 })]; sim.update(1 / 60, straight);
    expect(sim.health).toBe(3); expect(sim.effects.belly).toBe(false); expect(sim.events.some(e => e.type === 'belly')).toBe(true);
    advance(sim, 2.1); sim.traffic = [obstacle({ kind: 'cng', id: 2, z: sim.z })]; sim.update(1 / 60, straight);
    expect(sim.health).toBe(2);
  });

  it('slows and wobbles the rider with an upset stomach', () => {
    const calm = bare(), upset = bare(); upset.effects.stomachPending = 0.1;
    advance(calm, 3); advance(upset, 3);
    expect(upset.events.some(e => e.type === 'stomach')).toBe(true);
    expect(upset.speed).toBeLessThan(calm.speed * 0.8);
    expect(upset.x).not.toBe(0);
  });

  it('sweeps coins from a warned bus lane so they never lure a rider into it', () => {
    const sim = new Simulation(0);
    sim.coins = [coin({ id: 1, x: 0, z: -20 }), coin({ id: 2, x: 4, z: -20 }), coin({ id: 3, x: 0, z: -200 })];
    sim.sweepCoins(0.5);
    expect(sim.coins.map(c => c.gone)).toEqual([true, false, false]);
  });

  it('stops snack effects once the ride is over', () => {
    const sim = bare(); sim.effects.stomachPending = 0.5; sim.distance = sim.routeLength - 0.2;
    advance(sim, 1);
    expect(sim.status).toBe('won'); expect(sim.events.some(e => e.type === 'stomach')).toBe(false);
  });

  it('keeps every mission winnable with fully upgraded power-ups', () => {
    const maxed = powerUpStats({ cha: 4, jhalmuri: 4, chaap: 4 }), losses: string[] = [];
    for (let stage = 0; stage < 15; stage++) {
      let lost = 0;
      for (let i = 1; i <= 10; i++) {
        const sim = new Simulation(Math.floor(stage / 3), Math.imul(i, 2654435761) >>> 0, stage % 3, maxed); sim.start();
        for (let frame = 0; frame < 180 * 60 && sim.status === 'playing'; frame++) pilot(sim);
        if (sim.status !== 'won') lost++;
      }
      if (lost > 1) losses.push(`stage ${stage}: ${lost}/10`);
    }
    expect(losses).toEqual([]);
  }, 120000);

  it('lets a coin-following pilot collect at least 90% of safe-trail coins', () => {
    let safe = 0, got = 0;
    for (let stage = 0; stage < 15; stage++) for (let seed = 1; seed <= 4; seed++) {
      const sim = new Simulation(Math.floor(stage / 3), seed, stage % 3); sim.start();
      for (let frame = 0; frame < 180 * 60 && sim.status === 'playing'; frame++) pilot(sim, true);
      const trail = sim.coins.filter(c => c.trail === 'safe' && !c.gone && -c.z < sim.distance);
      safe += trail.length; got += trail.filter(c => c.collected).length;
    }
    expect(got / safe).toBeGreaterThanOrEqual(0.9);
  }, 120000);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/simulation.test.ts -t "taka and street food"`
Expected: FAIL. `sim.coins` is undefined.

- [ ] **Step 3: Implement**

In `src/simulation.ts`:

1. Add the import after the campaign import:

```ts
import { BASE_POWER_UPS, CHA_SPEED, COIN_HEIGHT, SNACK_TEXT, STOMACH_SPEED, eatSnack, newEffects, placePickups, tickEffects, type Coin, type Effects, type PowerUpStats, type Snack } from './pickups';
```

2. Replace the `GameEvent` interface with:

```ts
export interface GameEvent { type: string; text: string; x?: number; z?: number; actorId?: number; priority?: 'normal' | 'urgent'; value?: number; chain?: number; kind?: string }
```

3. After the line `  y = 0; airTime = -1; jumpCooldown = 0;`, add:

```ts
  coins: Coin[] = []; snacks: Snack[] = []; effects: Effects = newEffects(); taka = 0; banked = false;
  readonly powerUps: PowerUpStats;
  private coinChain = 0; private lastCoinAt = -10;
```

4. Replace the constructor with:

```ts
  constructor(index = 0, seed = 1, stageIndex = 0, powerUps: PowerUpStats = BASE_POWER_UPS) {
    this.vehicleIndex = Number.isFinite(index) ? clamp(Math.floor(index), 0, VEHICLES.length - 1) : 0;
    this.stage = getStage(this.vehicleIndex, stageIndex); this.stageIndex = this.stage.lessonIndex;
    this.rng = ((seed + this.stage.id * 7919) >>> 0) || 1;
    this.routeLength = this.stage.routeLength;
    this.remaining = this.routeLength;
    this.powerUps = powerUps;
    this.createTraffic();
    const jump = JUMPS[VEHICLES[this.vehicleIndex].id];
    ({ coins: this.coins, snacks: this.snacks } = placePickups({ traffic: this.traffic, routeLength: this.routeLength, startSpeed: this.maxSpeed,
      arcHeight: jump.height, arcClears: jump.clears.filter(kind => kind !== 'splash'), random: () => this.random() }));
  }
```

5. Add after the `get airborne()` getter:

```ts
  get repMultiplier(): number { return this.effects.boost > 0 ? 2 : 1; }

  // A warned bus or truck clears loose coins from its lane so they never lure a rider into it.
  sweepCoins(x: number): void {
    for (const coin of this.coins) if (!coin.collected && Math.abs(coin.x - x) < 2.6 && coin.z < this.z + 6 && coin.z > this.z - 120) coin.gone = true;
  }

  // Chaap's full belly soaks up one ordinary hit: no heart lost.
  private absorbHit(id: number, x: number, z: number): boolean {
    if (!this.effects.belly) return false;
    this.effects.belly = false; this.hit.add(id); this.invulnerable = 2; this.speed *= 0.6; this.combo = 0;
    this.events.push({ type: 'belly', text: 'Full belly! Bounced right off.', x, z, actorId: id });
    return true;
  }

  private updatePickups(dt: number): void {
    const vehicle = VEHICLES[this.vehicleIndex];
    if (tickEffects(this.effects, dt, this.rearThreats.length > 0)) this.events.push({ type: 'stomach', text: 'পেট গুড়গুড়! Tummy trouble — hold steady.', x: this.x, z: this.z, priority: 'urgent' });
    const reachX = vehicle.width / 2 + 0.45, reachZ = vehicle.length / 2 + 0.3;
    for (const coin of this.coins) {
      if (coin.collected || coin.gone) continue;
      const ahead = this.z - coin.z;
      if (ahead < -reachZ - 2 || ahead > 30) continue;
      if (this.effects.magnet > 0) {
        const gap = Math.hypot(coin.x - this.x, ahead);
        if (gap > 1e-6 && gap < this.powerUps.magnetRadius + reachX) {
          const pull = Math.min(1, 14 * dt / gap);
          coin.x += (this.x - coin.x) * pull; coin.z += (this.z - coin.z) * pull; coin.y += (COIN_HEIGHT + this.y - coin.y) * pull;
        }
      }
      if (Math.abs(coin.x - this.x) < reachX && Math.abs(this.z - coin.z) < reachZ && coin.y - COIN_HEIGHT <= this.y + 0.25) {
        coin.collected = true; this.taka += coin.value;
        this.coinChain = this.elapsed - this.lastCoinAt <= 0.6 ? this.coinChain + 1 : 1; this.lastCoinAt = this.elapsed;
        this.events.push({ type: 'coin', text: `৳${coin.value}`, x: coin.x, z: coin.z, value: coin.value, chain: this.coinChain });
      }
    }
    for (const snack of this.snacks) {
      if (snack.eaten || Math.abs(snack.x - this.x) >= vehicle.width / 2 + 0.5 || Math.abs(this.z - snack.z) >= vehicle.length / 2 + 0.4) continue;
      snack.eaten = true;
      eatSnack(this.effects, snack.kind, this.powerUps, this.random());
      this.events.push({ type: 'snack', text: SNACK_TEXT[snack.kind], kind: snack.kind, x: snack.x, z: snack.z });
    }
  }
```

6. In `step()`, replace

```ts
    const targetSpeed = input.brake ? 1.4 : this.maxSpeed;
```

with

```ts
    const pace = Math.min(SPEED_CAP, this.maxSpeed * (this.effects.boost > 0 ? CHA_SPEED : 1)) * (this.effects.stomach > 0 ? STOMACH_SPEED : 1);
    const targetSpeed = input.brake ? 1.4 : pace;
```

Replace

```ts
    const steer = (Number.isFinite(input.steer) ? clamp(input.steer, -1, 1) : 0) * (this.airborne ? AIR_STEERING : 1);
```

with

```ts
    const wobble = this.effects.stomach > 0 ? Math.sin(this.elapsed * 7) * 0.35 : 0;
    const steer = clamp((Number.isFinite(input.steer) ? clamp(input.steer, -1, 1) : 0) + wobble, -1, 1) * (this.airborne ? AIR_STEERING : 1);
```

7. In `step()`, replace

```ts
    this.updateProjectiles(dt);
    if (this.status !== 'playing') return;
```

with

```ts
    this.updateProjectiles(dt);
    if (this.status !== 'playing') return;
    this.updatePickups(dt);
```

8. In the traffic hit block, replace the line

```ts
      if (contact && this.invulnerable <= 0 && !this.hit.has(actor.id)) {
```

with

```ts
      if (contact && this.invulnerable <= 0 && !this.hit.has(actor.id) && this.absorbHit(actor.id, actor.x, actor.z)) continue;
      if (contact && this.invulnerable <= 0 && !this.hit.has(actor.id)) {
```

9. In `updateProjectiles`, replace `if (this.invulnerable <= 0 && !this.hit.has(p.id)) {` with:

```ts
if (this.invulnerable <= 0 && !this.hit.has(p.id) && !this.absorbHit(p.id, p.x, p.z)) {
```

10. Street rep doubles during cha:
    - Replace `this.score += 35 * this.combo;` with `this.score += 35 * this.combo * this.repMultiplier;`.
    - Replace `} else { this.score += 15; this.events.push(` with `} else { this.score += 15 * this.repMultiplier; this.events.push(`.
    - In `updateRearThreats`, replace `actor.passed = true; this.score += 50; }` with `actor.passed = true; this.score += 50 * this.repMultiplier; }`.

11. In `updateRearThreats`, replace `      this.rearThreats.push(candidate);` with:

```ts
      this.rearThreats.push(candidate);
      this.sweepCoins(x);
```

- [ ] **Step 4: Run the simulation suite**

Run: `npx vitest run tests/simulation.test.ts`
Expected: PASS, including:
- the broad random-seed winnability test
- the 105 pilots, which now meet real snacks and stomachs along their path
- the max-upgrade test
- the coin-pilot test

If a winnability test fails, debug before changing numbers (superpowers:systematic-debugging). Likely causes are a stomach wobble or a snack placed right before a hazard. Fix placement or effect timing, not the tests. Ledger any ruling.

If the coin pilot lands below 90%, check first whether the coins it misses were reachable (a placement bug) or whether the bot gave way to danger (a bot limit). Fix placement for the first. For the second, improve the bot's coin bonus. Never lower the 90% requirement without asking.

- [ ] **Step 5: Run the whole suite and commit**

Run: `npx tsc --noEmit && npm test`
Expected: all tests PASS.

```bash
git add src/simulation.ts tests/simulation.test.ts
git commit -m "feat(simulation): collect taka and eat street food during rides

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Looks on vehicles and riders

**Files:**
- Modify: `src/models.ts`
- Test: `tests/looks.test.ts`

**Interfaces:**
- Consumes: `VehicleLook` (Task 4).
- Produces:
  - `createVehicle(kind: string, color?: number, look?: VehicleLook): Model`
  - Look handling:

    | Look | Applies to |
    | --- | --- |
    | `paint` | Frame or body. On the rickshaw it recolours the hood. |
    | `art` | Rickshaw back panel and truck tailboard. |
    | `extra: 'streamers'` | Bicycle and motorbike handlebars |
    | `extra: 'basket'` | Bicycle |
    | `extra: 'garland'` | Rickshaw |
    | `extra: 'red-helmet'` | Motorbike rider |
    | `outfit` | Rider shirt, lower garment, and an accent sash or gamchha |

- [ ] **Step 1: Write the failing tests**

Create `tests/looks.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BufferGeometry, Color, Mesh, type Object3D } from 'three';
import { createVehicle } from '../src/models';

function hasColor(model: Object3D, hex: number): boolean {
  const c = new Color(hex); let found = false;
  model.traverse(o => {
    const colors = ((o as Mesh).geometry as BufferGeometry | undefined)?.getAttribute?.('color');
    if (!colors || found) return;
    for (let i = 0; i < colors.count && !found; i++) found = Math.abs(colors.getX(i) - c.r) < 1e-3 && Math.abs(colors.getY(i) - c.g) < 1e-3 && Math.abs(colors.getZ(i) - c.b) < 1e-3;
  });
  return found;
}
function vertices(model: Object3D): number {
  let n = 0; model.traverse(o => { n += ((o as Mesh).geometry as BufferGeometry | undefined)?.getAttribute?.('position')?.count ?? 0; }); return n;
}

describe('Bazaar looks', () => {
  it('paints the bicycle frame and dresses the rider in the chosen outfit', () => {
    const plain = createVehicle('bicycle', 0x38baa1);
    const styled = createVehicle('bicycle', 0x38baa1, { paint: 0xf2b630, outfit: { shirt: 0x0f6b3a, lower: 0x1d2b2a, accent: 0xd62b2b } });
    expect(hasColor(plain, 0x38baa1)).toBe(true); expect(hasColor(styled, 0xf2b630)).toBe(true); expect(hasColor(styled, 0x38baa1)).toBe(false);
    expect(hasColor(styled, 0x0f6b3a)).toBe(true); expect(hasColor(styled, 0x1d2b2a)).toBe(true); expect(hasColor(styled, 0xd62b2b)).toBe(true);
    expect(hasColor(plain, 0xd62b2b)).toBe(false);
  });
  it('adds a basket or streamers to the bicycle, a red helmet on the motorbike and paint on the car', () => {
    expect(vertices(createVehicle('bicycle', 0x38baa1, { extra: 'basket' }))).toBeGreaterThan(vertices(createVehicle('bicycle', 0x38baa1)));
    expect(hasColor(createVehicle('bicycle', 0x38baa1, { extra: 'streamers' }), 0xe8473c)).toBe(true);
    expect(hasColor(createVehicle('motorbike', 0xd84c3d, { extra: 'red-helmet' }), 0xc8322b)).toBe(true);
    expect(hasColor(createVehicle('motorbike', 0xd84c3d), 0xc8322b)).toBe(false);
    expect(hasColor(createVehicle('car', 0xf2dbad, { paint: 0xf2c12e }), 0xf2c12e)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/looks.test.ts`
Expected: FAIL. Paint and outfit colours are missing, because `createVehicle` ignores the third argument.

- [ ] **Step 3: Implement in `src/models.ts`**

1. Replace the rider signature `function rider(parent:T.Group,shirt=0xd99936,z=.1,motor=false) {` with:

```ts
function rider(parent:T.Group,shirt=0xd99936,z=.1,motor=false,lower=0x294946,accent?:number,helmet?:number) {
```

   - Replace `const skin=0xa9754d,trousers=0x294946;` with `const skin=0xa9754d,trousers=lower;`.
   - In both helmet sphere lines, replace `motor?0x285866:0x202d2b` with `motor?(helmet??0x285866):0x202d2b`.
   - After the line `  capsule(upper,0,.04,.005,.215,.055,.143,shirt);`, add:

```ts
  // A gamchha, sash or jersey stripe across the chest.
  if(accent!==undefined)tube(upper,[-.2,.52,.14],[.21,.06,.15],.032,accent,6);
```

2. Replace the whole `let artMat` + `function rickshawArt() {...}` block with:

```ts
const artMats=new Map<string,T.MeshStandardMaterial>();
function rickshawArt(theme='birds') {
 const cached=artMats.get(theme);if(cached)return cached;
 const mat=textured(canvasTexture(256,256,c=>{
  c.fillStyle=({birds:'#155748',peacock:'#1d3f7a',tiger:'#2b5d3a',city:'#3a2a5d'} as Record<string,string>)[theme]??'#155748';c.fillRect(0,0,256,256);c.strokeStyle='#ffc758';c.lineWidth=9;c.strokeRect(9,9,238,238);c.strokeStyle='#ed5d3d';c.lineWidth=5;c.strokeRect(22,22,212,212);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;const x=128+88*Math.cos(a),y=128+88*Math.sin(a);c.fillStyle=i%2?'#f4b73d':'#e86875';c.beginPath();c.ellipse(x,y,13,7,a,0,Math.PI*2);c.fill();}
  if(theme==='peacock'){for(let i=0;i<9;i++){const a=Math.PI*(1.1+i*.1),x=128+70*Math.cos(a),y=150+70*Math.sin(a);c.fillStyle=i%2?'#2fb5a3':'#3a7bd5';c.beginPath();c.ellipse(x,y,16,30,a+Math.PI/2,0,Math.PI*2);c.fill();c.fillStyle='#f4cf69';c.beginPath();c.arc(x,y,6,0,7);c.fill();}c.fillStyle='#1f6fb2';c.beginPath();c.ellipse(128,150,18,34,0,0,Math.PI*2);c.fill();c.beginPath();c.arc(128,108,12,0,7);c.fill();}
  else if(theme==='tiger'){c.fillStyle='#f08a24';c.beginPath();c.ellipse(138,135,66,40,0,0,Math.PI*2);c.fill();c.beginPath();c.arc(72,112,26,0,7);c.fill();c.strokeStyle='#1b1b1b';c.lineWidth=6;for(let i=0;i<6;i++){c.beginPath();c.moveTo(100+i*15,100);c.quadraticCurveTo(105+i*15,135,97+i*15,170);c.stroke();}c.fillStyle='#fff';c.beginPath();c.arc(64,106,4,0,7);c.fill();}
  else if(theme==='city'){c.fillStyle='#f4cf69';c.beginPath();c.arc(185,70,20,0,7);c.fill();for(let i=0;i<8;i++){const h=40+((i*37)%70);c.fillStyle=i%2?'#e86875':'#77c2c2';c.fillRect(40+i*22,190-h,18,h);c.fillStyle='#ffe6a1';for(let w=0;w<3;w++)c.fillRect(44+i*22,198-h+w*14,4,5);}}
  else{
   c.fillStyle='#77c2c2';c.beginPath();c.arc(128,122, 61,0,Math.PI*2);c.fill();c.fillStyle='#f4cf69';c.beginPath();c.arc(151,93,17,0,Math.PI*2);c.fill();
   c.fillStyle='#1e7352';c.beginPath();c.moveTo(65,163);c.quadraticCurveTo(105,100,148,160);c.lineTo(192,161);c.lineTo(192,191);c.lineTo(65,191);c.fill();
   for(const [x,y,s] of [[104,129,1],[151,142,-1]]){c.save();c.translate(x,y);c.scale(s,1);c.fillStyle='#e45435';c.beginPath();c.ellipse(0,0,16,10,-.2,0,Math.PI*2);c.fill();c.beginPath();c.arc(12,-9,8,0,Math.PI*2);c.fill();c.fillStyle='#ffe7a6';c.beginPath();c.moveTo(17,-10);c.lineTo(28,-7);c.lineTo(17,-4);c.fill();c.fillStyle='#fff';c.beginPath();c.arc(13,-11,2,0,7);c.fill();c.restore();}
  }
  c.fillStyle='#ffe6a1';c.font='bold 21px sans-serif';c.textAlign='center';c.fillText('ঢাকা',128,220);
 }));artMats.set(theme,mat);return mat;
}
```

3. Replace `export function createVehicle(kind:string,color=0x2a968c):Model {` with:

```ts
export function createVehicle(kind:string,color=0x2a968c,look:VehicleLook={}):Model {
 // Paint recolours the frame or body; on a rickshaw it recolours the hood instead.
 if(kind!=='rickshaw'&&look.paint!==undefined)color=look.paint;
```

4. Immediately after the line `  tube(g,[0,1.08,-.64],[0,1.28,-.77],.032,chrome);tube(g,[-.36,1.28,-.77],[.36,1.28,-.77],.03,chrome);`, add:

```ts
  if(look.extra==='streamers')for(const s of [-1,1])for(const [c,dz] of [[0xe8473c,0],[0xf2c12e,.05]] as const)tube(g,[s*.36,1.28,-.77+dz],[s*.44,1.02,-.68+dz],.012,c,5);
```

5. Inside the `if(!motor){...}` block, after `    box(g,0,.81,1.055,.08,.12,.025,0xe45633);`, add:

```ts
    if(look.extra==='basket'){box(g,0,1.05,-.98,.44,.26,.32,0xb08a4f);for(const s of [-1,1])tube(g,[s*.2,.92,-.9],[s*.2,1.18,-.9],.012,0x8a6a3a);}
```

6. Replace `const person=rider(g,0xd69d45,rick?-.25:0,motor);` with:

```ts
const person=rider(g,look.outfit?.shirt??0xd69d45,rick?-.25:0,motor,look.outfit?.lower,look.outfit?.accent,look.extra==='red-helmet'?0xc8322b:undefined);
```

7. In the rickshaw block, make these replacements:
   - `box(g,0,1.13,1.291,1.12,.65,.012,rickshawArt());` → `box(g,0,1.13,1.291,1.12,.65,.012,rickshawArt(look.art));`
   - `const hood=new T.Mesh(hoodGeo,material(0x155b53));` → `const hood=new T.Mesh(hoodGeo,material(look.paint??0x155b53));`
   - `const rearPanel=new T.Mesh(panelGeo,rickshawArt());` → `const rearPanel=new T.Mesh(panelGeo,rickshawArt(look.art));`

   After the line that starts `    for(let i=0;i<9;i++){sphere(g,(i-4)*.15,`, add:

```ts
    if(look.extra==='garland')for(let i=0;i<=14;i++){const a=Math.PI*i/14;sphere(g,Math.cos(a)*.74,1.54+Math.sin(a)*.74,.3,.055,i%2?0xff5d8f:0xffd34d);}
```

8. Replace the `let truckArt` + `function truckDecoration(){...}` block with:

```ts
const truckArts=new Map<string,T.MeshStandardMaterial>();
function truckDecoration(theme='classic'){
 const cached=truckArts.get(theme);if(cached)return cached;
 const mat=textured(canvasTexture(512,160,c=>{
 c.fillStyle=({classic:'#ad6236',rose:'#8a2f4a',peacock:'#1f5f7a'} as Record<string,string>)[theme]??'#ad6236';c.fillRect(0,0,512,160);c.strokeStyle='#f3cd72';c.lineWidth=8;c.strokeRect(6,6,500,148);
 c.fillStyle='#fbe6a9';c.textAlign='center';c.font='bold 44px "Noto Sans Bengali",sans-serif';c.fillText('ধীরে চলুন',256,73);
 c.font='bold 25px "Noto Sans Bengali",sans-serif';c.fillText('বাংলাদেশ • ঢাকা',256,122);
 if(theme==='rose'){for(const x of [47,465]){for(let i=0;i<6;i++){c.fillStyle=i%2?'#f26b8a':'#ffd1dc';c.beginPath();c.arc(x+Math.cos(i)*14,80+Math.sin(i)*14,14,0,7);c.fill();}c.fillStyle='#f4cf69';c.beginPath();c.arc(x,80,9,0,7);c.fill();}}
 else if(theme==='peacock'){for(const x of [47,465])for(let i=0;i<7;i++){const a=Math.PI*(1.15+i*.12);c.fillStyle=i%2?'#2fb5a3':'#f4cf69';c.beginPath();c.ellipse(x+40*Math.cos(a),110+40*Math.sin(a),8,18,a+Math.PI/2,0,7);c.fill();}}
 else for(const x of [47,465]){c.fillStyle='#246e66';c.beginPath();c.ellipse(x,80,23,54,0,0,Math.PI*2);c.fill();c.fillStyle='#eeb950';c.beginPath();c.arc(x,77,14,0,Math.PI*2);c.fill();}
 }));truckArts.set(theme,mat);return mat;
}
```

   Replace `const tail=new T.Mesh(new T.PlaneGeometry(w*.78,.56),truckDecoration());` with `const tail=new T.Mesh(new T.PlaneGeometry(w*.78,.56),truckDecoration(look.art));`.

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run tests/looks.test.ts && npx tsc --noEmit && npm test`
Expected: PASS. Existing tests are unaffected.

- [ ] **Step 5: Commit**

```bash
git add src/models.ts tests/looks.test.ts
git commit -m "feat(models): Bazaar looks — paint, rickshaw and truck art, extras and outfits

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Coins, snacks and power-up visuals in the world

**Files:**
- Modify: `src/models.ts`, `src/world.ts`
- Test: `tests/looks.test.ts` (snack models)

**Interfaces:**
- Consumes:
  - `Simulation.coins`, `snacks` and `effects` (Task 5)
  - `VehicleLook` and `createVehicle(kind, color, look)` (Tasks 4 and 6)
- Produces:
  - `coinParts(value: 1 | 5): { geometry: T.BufferGeometry; materials: T.Material[] }` (browser only; uses a canvas)
  - `snackModel(kind: 'cha' | 'jhalmuri' | 'chaap'): Model`
  - `World.setLook(look: VehicleLook): void`

- [ ] **Step 1: Write the failing test**

Append to `tests/looks.test.ts`. Extend the import to `import { createVehicle, snackModel } from '../src/models';`.

```ts
describe('street food models', () => {
  it('builds a distinct floating model for each snack', () => {
    const models = (['cha', 'jhalmuri', 'chaap'] as const).map(kind => snackModel(kind));
    for (const [i, kind] of (['cha', 'jhalmuri', 'chaap'] as const).entries()) { expect(models[i].userData.kind).toBe(kind); expect(models[i].children.length).toBeGreaterThan(1); }
    expect(new Set(models.map(m => vertices(m))).size).toBe(3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/looks.test.ts`
Expected: FAIL. `snackModel` is not exported.

- [ ] **Step 3: Implement the models**

Append to `src/models.ts`, before `export function disposeModel`:

```ts
export function coinParts(value:1|5){
 const r=value===5?.3:.22,geometry=new T.CylinderGeometry(r,r,.06,20);geometry.rotateX(Math.PI/2);
 const face=textured(canvasTexture(64,64,c=>{c.fillStyle=value===5?'#f2c14e':'#d9d2b8';c.fillRect(0,0,64,64);c.fillStyle='#7a5a12';c.font='bold 40px "Noto Sans Bengali",sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('৳',32,34);}));
 face.metalness=.5;face.roughness=.35;face.emissive=new T.Color(value===5?0x5a4000:0x3a3a30);
 const rim=new T.MeshStandardMaterial({color:value===5?0xe0a92e:0xb9b39b,metalness:.6,roughness:.3});
 return {geometry,materials:[rim,face,face] as T.Material[]};
}
export function snackModel(kind:'cha'|'jhalmuri'|'chaap'):Model{
 const g=new T.Group() as Model;g.userData.kind=kind;
 if(kind==='cha'){const glass=new T.Mesh(new T.CylinderGeometry(.13,.1,.26,14),new T.MeshStandardMaterial({color:0xc8741f,roughness:.25,transparent:true,opacity:.9}));glass.position.y=.13;g.add(glass);box(g,0,.015,0,.38,.03,.38,0xf3ead2);sphere(g,0,.3,0,.07,0xfff7e0,1,.4,1);}
 else if(kind==='jhalmuri'){const cone=new T.Mesh(new T.ConeGeometry(.16,.42,14),material(0xe9dcb8));cone.rotation.x=Math.PI;cone.position.y=.21;g.add(cone);for(let i=0;i<7;i++)sphere(g,Math.cos(i)*.08,.44+(i%3)*.03,Math.sin(i)*.08,.045,i%2?0xd9a441:0x6e9a3d);}
 else{const plate=new T.Mesh(new T.CylinderGeometry(.24,.2,.04,18),material(0xf2f0e6));g.add(plate);for(let i=0;i<4;i++)sphere(g,-.12+i*.08,.07,(i%2)*.05-.02,.07,0x8a4b23,1.2,.6,1);tube(g,[-.18,.14,0],[.2,.14,0],.012,0x8a6a3a);}
 g.scale.setScalar(1.8);return g;
}
```

Run: `npx vitest run tests/looks.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 4: Wire it into `src/world.ts`**

1. Extend the models import (it starts `import {box,sphere,tube,material,canvasTexture,textured,mergeStatic,createVehicle,`) to also import `coinParts,snackModel,type VehicleLook`.

2. Change the field line `private dust:T.Points;private reduced=false;private shakeRemaining=0;private shakeAmplitude=0;private sinceLanding=Infinity;` to:

```ts
 private dust:T.Points;private reduced=false;private shakeRemaining=0;private shakeAmplitude=0;private sinceLanding=Infinity;
 private coinMeshes:T.InstancedMesh[]=[];private snackModels=new Map<number,Model>();private dummy=new T.Object3D();private magnetRing!:T.Mesh;
 private look:VehicleLook={};private lookKey='{}';private builtLookKey='';
```

3. Replace `this.makeRoad();` (in the constructor) with:

```ts
this.makeRoad();
  this.coinMeshes=([1,5] as const).map(v=>{const p=coinParts(v);const m=new T.InstancedMesh(p.geometry,p.materials,256);m.count=0;m.frustumCulled=false;m.castShadow=true;this.scene.add(m);return m;});
  this.magnetRing=new T.Mesh(new T.TorusGeometry(1.4,.04,6,40),new T.MeshBasicMaterial({color:0xf2c14e,transparent:true,opacity:.55}));this.magnetRing.rotation.x=Math.PI/2;this.magnetRing.visible=false;this.scene.add(this.magnetRing);
```

4. Add after `land(){this.sinceLanding=0;}`:

```ts
 setLook(look:VehicleLook){this.look=look;this.lookKey=JSON.stringify(look);}
```

5. Replace

```ts
  if(this.lastVehicle!==sim.vehicleIndex){disposeModel(this.player);this.player=createVehicle(VEHICLES[sim.vehicleIndex].id,VEHICLES[sim.vehicleIndex].color);this.scene.add(this.player);this.lastVehicle=sim.vehicleIndex;}
```

with

```ts
  if(this.lastVehicle!==sim.vehicleIndex||this.builtLookKey!==this.lookKey){disposeModel(this.player);this.player=createVehicle(VEHICLES[sim.vehicleIndex].id,VEHICLES[sim.vehicleIndex].color,this.look);this.scene.add(this.player);this.lastVehicle=sim.vehicleIndex;this.builtLookKey=this.lookKey;}
```

6. Replace `this.projectiles.clear();this.currentSimulation=sim;` with:

```ts
this.projectiles.clear();for(const m of this.snackModels.values())disposeModel(m);this.snackModels.clear();this.currentSimulation=sim;
```

7. Replace `this.sinceLanding+=dt;this.player.scale.y=landingSquash(this.sinceLanding);` with:

```ts
  this.sinceLanding+=dt;this.player.scale.y=landingSquash(this.sinceLanding);
  this.player.rotation.z=sim.effects.stomach>0&&!this.reduced?Math.sin(this.clock*14)*.08:0;
  this.magnetRing.visible=sim.effects.magnet>0;this.magnetRing.position.set(pathX(z)+sim.x,.08+sim.y,z);
```

8. Replace `this.renderProjectiles(sim);` with `this.renderProjectiles(sim);this.renderPickups(sim,z);`.

9. Replace `this.camera.fov=(innerHeight>innerWidth?70:58)+(this.reduced?0:Math.min(sim.speed,22)*.2);` with:

```ts
this.camera.fov=(innerHeight>innerWidth?70:58)+(this.reduced?0:Math.min(sim.speed,22)*.2+(sim.effects.boost>0?6:0));
```

10. Add this method directly before ` private renderProjectiles(sim:Simulation){`:

```ts
 private renderPickups(sim:Simulation,z:number){
  ([1,5] as const).forEach((value,i)=>{const mesh=this.coinMeshes[i];let n=0;
   for(const coin of sim.coins){if(coin.value!==value||coin.collected||coin.gone||coin.z-z>25||coin.z-z<-110||n>=256)continue;
    this.dummy.position.set(pathX(coin.z)+coin.x,coin.y,coin.z);this.dummy.rotation.set(0,this.clock*3+coin.id*.4,0);this.dummy.updateMatrix();mesh.setMatrixAt(n++,this.dummy.matrix);}
   mesh.count=n;mesh.instanceMatrix.needsUpdate=true;});
  const keep=new Set<number>();
  for(const snack of sim.snacks){if(snack.eaten||snack.z-z>25||snack.z-z<-110)continue;keep.add(snack.id);let model=this.snackModels.get(snack.id);
   if(!model){model=snackModel(snack.kind);this.snackModels.set(snack.id,model);this.scene.add(model);}
   model.position.set(pathX(snack.z)+snack.x,.75+Math.sin(this.clock*2.4+snack.id)*.12,snack.z);model.rotation.y=this.clock*1.6;}
  for(const [id,m] of this.snackModels)if(!keep.has(id)){disposeModel(m);this.snackModels.delete(id);}
 }
```

- [ ] **Step 5: Typecheck, test, build and commit**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: all PASS; the build succeeds. Rendering is checked in the browser in Task 11.

```bash
git add src/models.ts src/world.ts tests/looks.test.ts
git commit -m "feat(world): spinning taka coins, floating street food and power-up visuals

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Placeholder pickup sounds

**Files:**
- Modify: `src/audio.ts`
- Test: `tests/audio.test.ts`

**Interfaces:**
- Produces:

  | Method | Tones |
  | --- | --- |
  | `GameAudio.coin(chain: number)` | One tone that rises with the chain, at most one per 0.05 s |
  | `GameAudio.snack(kind: string)` | Cha 2, jhalmuri 4, chaap 1 |
  | `GameAudio.stomach()` | 2 |
  | `GameAudio.belly()` | 1 |

  Drop 2b replaces these with rich Dhaka sounds.

- [ ] **Step 1: Write the failing test**

Add inside `describe('street audio lifecycle', ...)` in `tests/audio.test.ts`:

```ts
  it('rings a rising coin chain and gives each snack, stomach and full belly its own sound', async () => {
    const audio = await initialized();
    audio.update(10, 'bicycle', true);
    const count = () => context.createOscillator.mock.calls.length, freq = (n: number) => (context.createOscillator.mock.results[n].value as { frequency: { value: number } }).frequency.value;
    let start = count(); audio.coin(1); expect(count() - start).toBe(1); const low = freq(start);
    audio.coin(2); expect(count() - start).toBe(1);
    context.currentTime = 1; start = count(); audio.coin(3); expect(count() - start).toBe(1); expect(freq(start)).toBeGreaterThan(low);
    start = count(); audio.snack('cha'); expect(count() - start).toBe(2);
    start = count(); audio.snack('jhalmuri'); expect(count() - start).toBe(4);
    start = count(); audio.snack('chaap'); expect(count() - start).toBe(1);
    start = count(); audio.stomach(); expect(count() - start).toBe(2);
    start = count(); audio.belly(); expect(count() - start).toBe(1);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/audio.test.ts -t "coin chain"`
Expected: FAIL. `audio.coin is not a function`.

- [ ] **Step 3: Implement**

In `src/audio.ts`:
- Add `  private lastCoin = -10;` after `  private lastJump = -10;`.
- Change the reset line in `resetRide()` to end `... = this.lastJump = this.lastCoin = -10;`.
- Add after `bump()`:

```ts
  coin(chain: number): void {
    if (!this.ready() || this.context!.currentTime - this.lastCoin < 0.05) return;
    this.lastCoin = this.context!.currentTime;
    // Successive coins climb a folk-style pentatonic scale, so a trail plays a short phrase.
    const scale = [0, 2, 3, 7, 9, 12, 14, 15, 19], step = scale[(Math.max(1, Math.floor(chain) || 1) - 1) % scale.length];
    this.tone(1046.5 * Math.pow(2, step / 12), 0.12, 0.06, 'triangle');
  }

  snack(kind: string): void {
    if (!this.ready()) return;
    if (kind === 'cha') { this.tone(2093, 0.08, 0.05, 'sine'); this.tone(523, 0.5, 0.05, 'sine', 0.08, 0, false, 1046); }
    else if (kind === 'jhalmuri') [0, 0.09, 0.18, 0.27].forEach(delay => this.tone(1320, 0.05, 0.06, 'square', delay));
    else this.tone(180, 0.35, 0.05, 'sawtooth', 0, 0, false, 120);
  }

  stomach(): void {
    if (!this.ready()) return;
    this.tone(140, 0.5, 0.09, 'sine', 0, 0, false, 70); this.tone(196, 0.6, 0.05, 'triangle', 0.2, 0, false, 185);
  }

  belly(): void {
    if (!this.ready()) return;
    this.tone(110, 0.25, 0.12, 'sine', 0, 0, false, 80);
  }
```

- [ ] **Step 4: Run the audio suite**

Run: `npx vitest run tests/audio.test.ts && npx tsc --noEmit`
Expected: PASS (19 tests).

- [ ] **Step 5: Commit**

```bash
git add src/audio.ts tests/audio.test.ts
git commit -m "feat(audio): placeholder sounds for taka, snacks and tummy trouble

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: The Bazaar view

**Files:**
- Create: `src/shop.ts`
- Test: `tests/shop.test.ts`

**Interfaces:**
- Consumes: `LOOKS`, `MAX_LEVEL`, `UPGRADE_PRICES` and `powerUpStats` (Task 4); `Progress` (Task 1); `PowerUp` (Task 2).
- Produces:
  - `type ShopTab = 'looks' | 'power-ups'`
  - `type RowState = 'buy' | 'too-poor' | 'equip' | 'equipped' | 'maxed'`
  - `interface ShopRow { id; name; detail; price; state }`
  - `lookRows(save, vehicle): ShopRow[]`
  - `powerUpRows(save): ShopRow[]`
  - `renderShop(save, vehicle, tab): string`. Rows carry `data-look="<id>"` or `data-upgrade="<kind>"` buttons.

- [ ] **Step 1: Write the failing tests**

Create `tests/shop.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buyLook, buyUpgrade } from '../src/economy';
import { loadProgress } from '../src/progress';
import { lookRows, powerUpRows, renderShop } from '../src/shop';
const wallet = (taka: number) => { const p = loadProgress(null, null); p.taka = taka; return p; };

describe('the Bazaar view', () => {
  it('lists the vehicle\'s looks plus every outfit, each with the right action', () => {
    const p = wallet(1000); buyLook(p, 'bicycle-basket'); buyLook(p, 'bicycle-streamers'); p.taka = 160;
    const rows = lookRows(p, 'bicycle');
    expect(rows.map(r => r.id)).toEqual(['bicycle-paint-mango', 'bicycle-paint-jamun', 'bicycle-streamers', 'bicycle-basket', 'outfit-lungi', 'outfit-panjabi', 'outfit-school', 'outfit-cricket']);
    const state = (id: string) => rows.find(r => r.id === id)!.state;
    expect(state('bicycle-streamers')).toBe('equipped'); expect(state('bicycle-basket')).toBe('equip');
    expect(state('bicycle-paint-mango')).toBe('buy'); expect(state('outfit-school')).toBe('too-poor');
  });
  it('shows each power-up level, its next step and when it is maxed', () => {
    const p = wallet(10000); for (let i = 0; i < 4; i++) buyUpgrade(p, 'chaap'); p.taka = 300;
    const rows = powerUpRows(p);
    expect(rows.map(r => [r.id, r.price, r.state])).toEqual([['cha', 200, 'buy'], ['jhalmuri', 200, 'buy'], ['chaap', 0, 'maxed']]);
    expect(rows[0].name).toBe('Cha boost · level 0/4'); expect(rows[0].detail).toBe('5 s of speed → 6 s of speed');
    expect(rows[2].detail).toBe('Maxed: stomach risk −10 pts');
  });
  it('renders buttons the game can act on', () => {
    const p = wallet(0), looks = renderShop(p, 'rickshaw', 'looks'), ups = renderShop(p, 'rickshaw', 'power-ups');
    expect(looks).toContain('data-look="rickshaw-art-tiger"'); expect(looks).toContain('৳500');
    expect(ups).toContain('data-upgrade="jhalmuri"'); expect(ups).toContain('Need more ৳');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/shop.test.ts`
Expected: FAIL. Cannot find module `../src/shop`.

- [ ] **Step 3: Implement**

Create `src/shop.ts`:

```ts
import { LOOKS, MAX_LEVEL, UPGRADE_PRICES, powerUpStats } from './economy';
import type { PowerUp } from './pickups';
import type { Progress } from './progress';
import type { VehicleKind } from './simulation';

export type ShopTab = 'looks' | 'power-ups';
export type RowState = 'buy' | 'too-poor' | 'equip' | 'equipped' | 'maxed';
export interface ShopRow { id: string; name: string; detail: string; price: number; state: RowState }
const SLOT_NAMES = { paint: 'Paint', art: 'Art', extra: 'Extra', outfit: 'Outfit' } as const;
const POWER_UP_NAMES: Record<PowerUp, string> = { cha: 'Cha boost', jhalmuri: 'Jhalmuri magnet', chaap: 'Chaap belly' };
const ACTION: Record<RowState, string> = { buy: 'Buy', 'too-poor': 'Need more ৳', equip: 'Use', equipped: 'Using ✓', maxed: 'Maxed' };

export function lookRows(save: Progress, vehicle: VehicleKind): ShopRow[] {
  return LOOKS.filter(item => item.vehicle === vehicle || item.vehicle === 'rider').map(item => {
    const owned = save.owned.includes(item.id), equipped = save.equipped[`${item.vehicle}:${item.slot}`] === item.id;
    return { id: item.id, name: item.name, detail: item.vehicle === 'rider' ? 'Outfit · every ride' : SLOT_NAMES[item.slot], price: item.price,
      state: equipped ? 'equipped' : owned ? 'equip' : save.taka >= item.price ? 'buy' : 'too-poor' };
  });
}

function effectText(kind: PowerUp, level: number): string {
  const s = powerUpStats({ cha: level, jhalmuri: level, chaap: level });
  return kind === 'cha' ? `${s.chaSeconds} s of speed` : kind === 'jhalmuri' ? `${s.magnetSeconds} s, ${s.magnetRadius} m pull` : `stomach risk −${Math.round(s.stomachReduction * 100)} pts`;
}

export function powerUpRows(save: Progress): ShopRow[] {
  return (['cha', 'jhalmuri', 'chaap'] as const).map(kind => {
    const level = save.upgrades[kind], maxed = level >= MAX_LEVEL, price = maxed ? 0 : UPGRADE_PRICES[level];
    return { id: kind, name: `${POWER_UP_NAMES[kind]} · level ${level}/${MAX_LEVEL}`,
      detail: maxed ? `Maxed: ${effectText(kind, level)}` : `${effectText(kind, level)} → ${effectText(kind, level + 1)}`, price,
      state: maxed ? 'maxed' : save.taka >= price ? 'buy' : 'too-poor' };
  });
}

export function renderShop(save: Progress, vehicle: VehicleKind, tab: ShopTab): string {
  const rows = tab === 'looks' ? lookRows(save, vehicle) : powerUpRows(save), attr = tab === 'looks' ? 'data-look' : 'data-upgrade';
  return rows.map(r => `<div class="shop-row ${r.state}"><div><strong>${r.name}</strong><small>${r.detail}</small></div><button ${attr}="${r.id}" ${r.state === 'maxed' ? 'disabled' : ''} aria-label="${ACTION[r.state]}: ${r.name}">${r.state === 'buy' || r.state === 'too-poor' ? `৳${r.price} · ` : ''}${ACTION[r.state]}</button></div>`).join('');
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run tests/shop.test.ts && npx tsc --noEmit`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shop.ts tests/shop.test.ts
git commit -m "feat(shop): Bazaar rows for looks and power-up upgrades

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Wire taka, food and the Bazaar into the game

**Files:**
- Modify: `src/main.ts`, `src/style.css`, `src/feedback.ts`, `tests/feedback.test.ts`, `README.md`

**Interfaces:**
- Consumes: everything above.
- Every anchor below occurs exactly once in `src/main.ts`; verify with `grep -c` before replacing.

- [ ] **Step 1: Feedback carries purchases**

This is a type-only change: `buildFeedbackPayload` already spreads every context field into the email, and its existing test proves that. The failing check for this step is TypeScript.

In `src/feedback.ts`, change the interface to:

```ts
export interface FeedbackContext{vehicle:string;mission:string;progress:string;device:string;purchases:string}
```

In `tests/feedback.test.ts`, change the `context` constant to:

```ts
const context={vehicle:'Rickshaw',mission:'Catch the launch',progress:'4 / 15 missions',device:'Pixel 7 · 915×412',purchases:'৳120 · looks: Red hood · cha 1, jhalmuri 0, chaap 0'};
```

At the end of the test *builds a readable email with the kind, tester and where they were in the game*, add `expect(p.purchases).toContain('Red hood');`.

Run: `npx tsc --noEmit`
Expected: FAIL. `src/main.ts` doesn't pass `purchases` to `sendFeedback`. Step 4 fixes that.

- [ ] **Step 2: Imports and markup in `src/main.ts`**

Replace `import { loadProgress, completeStage, availableStage } from './progress';` with:

```ts
import { loadProgress, completeStage, availableStage } from './progress';
import { bankRide, buyLook, buyUpgrade, describePurchases, powerUpStats, ridePayout, toggleLook, vehicleLook } from './economy';
import { renderShop, type ShopTab } from './shop';
```

Replace `<div class="hud-score"><span id="score">0000</span><small>street rep</small></div>` with:

```ts
<div class="hud-score"><span id="score">0000</span><small>street rep</small></div><div class="hud-taka"><strong id="taka">৳0</strong><small>taka</small></div><div id="effects" class="effects" aria-live="polite"></div>
```

Replace `<button id="settings-open" class="icon-btn" aria-label="Settings">⚙</button>` with:

```ts
<button id="shop-open" class="beta-btn" aria-label="Open the Bazaar">🛍<span>Bazaar ৳<b id="wallet">0</b></span></button><button id="settings-open" class="icon-btn" aria-label="Settings">⚙</button>
```

Replace ` <section id="feedback" class="overlay hidden"` with:

```ts
 <section id="shop" class="overlay hidden" role="dialog" aria-modal="true" aria-labelledby="shop-title"><div class="panel shop-panel"><span class="panel-kicker">ঢাকার বাজার</span><h2 id="shop-title">The Bazaar</h2><p id="shop-wallet"></p><div class="shop-tabs"><button class="shop-tab" data-tab="looks">Looks</button><button class="shop-tab" data-tab="power-ups">Power-ups</button></div><p id="shop-note" role="status" aria-live="polite"></p><div id="shop-list"></div><button id="shop-close" class="primary">Back to the garage</button></div></section>
 <section id="feedback" class="overlay hidden"
```

- [ ] **Step 3: Rides use upgrades and looks, and settle once**

Replace `sim=new Simulation(selected,reviewMode?seed++:freshSeed(),lesson);sim.start();` with:

```ts
world.setLook(vehicleLook(save,VEHICLES[selected].id));sim=new Simulation(selected,reviewMode?seed++:freshSeed(),lesson,powerUpStats(save.upgrades));sim.start();
```

Replace `if(won){completeStage(save,id,sim.score,sim.stars);persist();audio.finish();}else audio.loss();` with:

```ts
const firstClear=won&&save.stars[id]===0;if(won){completeStage(save,id,sim.score,sim.stars);audio.finish();}else audio.loss();
 const ride={won,coins:sim.taka,stars:won?sim.stars:0,firstClear},payout=bankRide(save,sim,ride)??ridePayout(ride);persist();
```

Replace `<div><strong>×${sim.maxCombo}</strong><span>best chain</span></div></div>` with:

```ts
<div><strong>×${sim.maxCombo}</strong><span>best chain</span></div></div><p class="taka-note">৳${payout.coins} collected${payout.finish?` + ৳${payout.finish} finish`:''}${payout.firstClear?` + ৳${payout.firstClear} first clear`:''} = <b>৳${payout.total}</b> · ${sim.effects.snacksEaten} snack${sim.effects.snacksEaten===1?'':'s'} eaten · wallet ৳${save.taka}</p>
```

Replace `function menu(){clearInput();` with:

```ts
function menu(){if(screen==='playing'&&sim.status!=='won'&&sim.status!=='lost'&&sim.status!=='ready'){bankRide(save,sim,{won:false,coins:sim.taka,stars:0,firstClear:false});persist();}clearInput();
```

Replace `function drawGarage(){` with `function drawGarage(){$('#wallet').textContent=String(save.taka);`.

- [ ] **Step 4: HUD, events and the Bazaar screen**

Replace `$('#score').textContent=String(sim.score).padStart(4,'0');` with:

```ts
$('#score').textContent=String(sim.score).padStart(4,'0');$('#taka').textContent=`৳${sim.taka}`;const effectHtml=chips(sim.effects);if(effectHtml!==lastChips){$('#effects').innerHTML=effectHtml;lastChips=effectHtml;}
```

Insert directly before `function frame(now:number){`:

```ts
let lastChips='';
const chips=(e:Simulation['effects'])=>[e.boost>0?`<span class="chip cha">☕ cha ${Math.ceil(e.boost)}s</span>`:'',e.magnet>0?`<span class="chip jhalmuri">🥜 magnet ${Math.ceil(e.magnet)}s</span>`:'',e.belly?'<span class="chip chaap">🍢 full belly</span>':'',e.stomach>0?'<span class="chip stomach">🤢 পেট গুড়গুড়!</span>':''].join('');
```

Replace `if(event.type==='near-miss'){` with:

```ts
if(event.type==='coin')audio.coin(event.chain??1);if(event.type==='snack'){audio.snack(event.kind??'cha');showToast(event.text);}if(event.type==='stomach'){audio.stomach();showToast(event.text,true);}if(event.type==='belly'){audio.belly();showToast(event.text);}
  if(event.type==='near-miss'){
```

Replace `progress:`${save.stars.filter(n=>n>0).length} / ${STAGES.length} missions`,` with:

```ts
purchases:describePurchases(save),progress:`${save.stars.filter(n=>n>0).length} / ${STAGES.length} missions`,
```

Insert directly before `window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#settings').classList.contains('hidden')){e.preventDefault();closeSettings();}`:

```ts
let shopTab:ShopTab='looks';
function drawShop(note=''){$('#shop-wallet').textContent=`Your wallet: ৳${save.taka}`;$('#shop-note').textContent=note;$('#shop-list').innerHTML=renderShop(save,VEHICLES[selected].id,shopTab);document.querySelectorAll<HTMLButtonElement>('.shop-tab').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===shopTab)));$('#wallet').textContent=String(save.taka);}
const closeShop=()=>{$('#shop').classList.add('hidden');$('#menu').inert=false;$('#shop-open').focus();};
$('#shop-open').onclick=()=>{drawShop();$('#shop').classList.remove('hidden');$('#menu').inert=true;$('#shop-close').focus();};$('#shop-close').onclick=closeShop;
$('#shop').addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLButtonElement>('button');if(!b||b.id==='shop-close')return;let note='';
 if(b.dataset.tab)shopTab=b.dataset.tab==='power-ups'?'power-ups':'looks';
 else if(b.dataset.look){const id=b.dataset.look;if(save.owned.includes(id))toggleLook(save,id);else{const r=buyLook(save,id);note=r==='bought'?'Bought and equipped — enjoy the ride!':r==='too-poor'?'Not enough taka yet — ride and collect more!':'';}}
 else if(b.dataset.upgrade){const r=buyUpgrade(save,b.dataset.upgrade as 'cha'|'jhalmuri'|'chaap');note=r==='bought'?'Upgraded!':r==='too-poor'?'Not enough taka yet — ride and collect more!':'';}
 persist();world?.setLook(vehicleLook(save,VEHICLES[selected].id));drawShop(note);});
```

Then replace that keydown anchor with:

```ts
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#shop').classList.contains('hidden')){e.preventDefault();closeShop();}if(e.key==='Escape'&&!$('#settings').classList.contains('hidden')){e.preventDefault();closeSettings();}
```

- [ ] **Step 5: Styles**

Append to `src/style.css`:

```css
.hud-taka{display:flex;flex-direction:column;align-items:flex-end;margin-right:14px}.hud-taka strong{font-family:'Barlow Condensed',sans-serif;font-size:30px;color:var(--gold);line-height:1}.hud-taka small{font-size:10px;opacity:.8}
.effects{position:absolute;top:100%;right:0;margin-top:8px;display:flex;flex-direction:column;align-items:flex-end;gap:6px;pointer-events:none}.chip{background:#183b32d9;border:1px solid #f7c45c66;border-radius:14px;padding:4px 10px;font-size:12px;font-weight:700}.chip.stomach{border-color:#ffb38a;color:#ffd7c2}
.taka-note{font-size:13px;color:var(--gold)!important}
.shop-panel{text-align:left;max-height:94vh;overflow:auto;width:520px}#shop{touch-action:pan-y}.shop-tabs{display:flex;gap:8px;margin:10px 0}.shop-tab{padding:8px 14px;border:1px solid #d7c08266;border-radius:18px;background:#294e41;font-weight:700}.shop-tab[aria-pressed="true"]{background:var(--gold);color:#153c32}
.shop-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #d6d9c822}.shop-row strong{display:block;font-size:14px}.shop-row small{font-size:11px;color:#adbaa6}.shop-row button{white-space:nowrap;padding:8px 12px;border-radius:6px;background:#294e41;border:1px solid #d7c08277;font-size:12px;font-weight:700}.shop-row.buy button{background:var(--gold);color:#153c32}.shop-row.equipped button{color:#bfe6a8}.shop-row.too-poor button{opacity:.7}#shop-note{min-height:1.2em;font-size:13px;color:#bfe6a8}
@media(orientation:portrait){#shop-open span{display:none}}
```

- [ ] **Step 6: README**

In `README.md`, add after the controls paragraph (`Swipe is the default on phones and tablets; switch to Buttons in settings.`):

```markdown
## Taka, street food and the Bazaar

Collect taka (৳) as you ride. ৳1 coin trails show a safe line, ৳5 trails sit in daring gaps beside traffic, and raised arcs need a jump. Roadside snacks are power-ups: **cha** gives a speed burst and double street rep, **jhalmuri** pulls nearby taka in, and **chaap** absorbs one bump. Every snack you eat makes a funny upset stomach (পেট গুড়গুড়!) more likely, slowing you down and making you wobble for a few seconds.

Finishing pays ৳20 plus ৳10 per star, and the first clear of each mission pays ৳50 more. Losing keeps the taka you collected. Spend it in the **Bazaar** (garage, top right): rickshaw and truck art, paint, accessories and rider outfits, or upgrades that make cha, jhalmuri and chaap stronger. Upgrades never add hearts or change how missions unlock. There is no real money in the game.
```

- [ ] **Step 7: Typecheck, test, build and commit**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: no type errors; all tests PASS; build succeeds.

```bash
git add src/main.ts src/style.css src/feedback.ts tests/feedback.test.ts README.md
git commit -m "feat: taka counter, street food effects, ride payouts and the Bazaar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Browser verification, review and pull request

**Files:** none changed unless a check fails. If one fails, fix it test-first in the owning task's files and commit with `fix:`.

- [ ] **Step 1: Start the dev server** (`.claude/launch.json` configuration `game`). If the built-in browser pane is hidden (it pauses animation), use the Playwright browser, as in drop 1.

- [ ] **Step 2: A ride with pickups (desktop).**
  1. Start mission 1. Check that spinning ৳ coins and floating snacks appear.
  2. Steer through a safe trail and check the taka counter rises.
  3. Eat a cha and check for the toast, the "☕ cha" chip, the FOV kick and a rising speed readout.
  4. Pass a jhalmuri and check the magnet ring.
  5. Use the review fixtures or set `?review` to reach a stomach. Check the wobble, the "🤢 পেট গুড়গুড়!" chip and the slowdown.
  6. Screenshot each.

- [ ] **Step 3: Results and wallet.**
  1. Finish a mission and check the results line ("৳X collected + ৳Y finish + ৳50 first clear = ৳Z · N snacks eaten · wallet ৳W").
  2. Lose a ride and check only the coins are paid.
  3. Pause, choose "Back to the garage", and check the coins are banked once (the wallet rises by exactly the ride's taka).
  4. Reload the page and check the wallet persists.
  5. With `?review`, check the wallet is not saved across a reload.

- [ ] **Step 4: The Bazaar.**
  1. With enough taka, open the Bazaar.
  2. Buy the Mango paint; check the wallet drops by ৳150 and the bicycle is yellow in the next ride.
  3. Toggle it off and on.
  4. Buy a cha upgrade and check the next cha lasts 6 s.
  5. Check "Need more ৳" when the wallet is short.
  6. On the rickshaw (unlock it with review mode, or seed a save in the console), check the Tiger art and garland render.
  7. Check phone portrait (390×844) and landscape (844×390) layouts.

- [ ] **Step 5: Console.** No errors in any run. Reset the viewport. Remove any `.playwright-mcp/` folder the browser tool creates.

- [ ] **Step 6: Review before the pull request.**
  1. Run the `code-simplifier` agent on the drop-2a changes.
  2. Run the final whole-branch review on the most capable model, with this plan's Review Focus.
  3. Fix Critical and Important findings test-first.
  4. Run `npm test && npm run build` again.

- [ ] **Step 7: Open the pull request.**
  1. Push `feat/drop-2a-taka`.
  2. Run `gh pr create --base main --title "feat: drop 2a — taka, street food and the Bazaar"`. The body covers:
     - what testers get, and Rahat's street-food idea (tester B)
     - the tests added
     - the browser checks with screenshots
     - rulings and deferred minors
     - that Drop 2b (sound and voices) follows
     - and ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
  3. Do not merge without the user's approval.
