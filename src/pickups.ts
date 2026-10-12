import type { Traffic } from './simulation';

export type PowerUp = 'cha' | 'jhalmuri' | 'chaap';

export interface Coin {
  id: number;
  group: number;
  x: number;
  y: number;
  z: number;
  value: 1 | 5;
  trail: 'safe' | 'bold' | 'arc';
  collected: boolean;
  gone: boolean;
}

export interface Snack {
  id: number;
  kind: PowerUp;
  x: number;
  z: number;
  eaten: boolean;
}

export interface PowerUpStats {
  chaSeconds: number;
  magnetSeconds: number;
  magnetRadius: number;
  stomachReduction: number;
}

export const BASE_POWER_UPS: PowerUpStats = {
  chaSeconds: 5,
  magnetSeconds: 6,
  magnetRadius: 2,
  stomachReduction: 0,
};

export const COIN_HEIGHT = 0.55;
export const CHA_SPEED = 1.25;
export const STOMACH_SPEED = 0.65;
export const STOMACH_DELAY = 1.5;
export const STOMACH_SECONDS = 4;

export const SNACK_TEXT: Record<PowerUp, string> = {
  cha: 'গরম চা! Hot cha — speed and double street rep.',
  jhalmuri: 'ঝালমুড়ি! Jhalmuri — taka magnet.',
  chaap: 'চাপ! Chaap — full belly shield.',
};

export interface Effects {
  boost: number;
  magnet: number;
  belly: boolean;
  stomach: number;
  stomachPending: number;
  snacksEaten: number;
}

export function newEffects(): Effects {
  return {
    boost: 0,
    magnet: 0,
    belly: false,
    stomach: 0,
    stomachPending: -1,
    snacksEaten: 0,
  };
}

// Each snack in a ride makes the next one riskier: 10%, 25%, 40%, 55%.
export function stomachChance(previousSnacks: number, reduction: number): number {
  return Math.min(1, Math.max(0, 0.1 + 0.15 * previousSnacks - reduction));
}

export function eatSnack(e: Effects, kind: PowerUp, stats: PowerUpStats, roll: number): boolean {
  const chance = stomachChance(e.snacksEaten, stats.stomachReduction);
  e.snacksEaten++;

  if (kind === 'cha') {
    e.boost = stats.chaSeconds;
  } else if (kind === 'jhalmuri') {
    e.magnet = stats.magnetSeconds;
  } else {
    e.belly = true;
  }

  const upset = roll < chance && e.stomachPending < 0 && e.stomach <= 0;
  if (upset) e.stomachPending = STOMACH_DELAY;
  return upset;
}

// A rear-threat warning holds the stomach back so a snack can never cause an unavoidable loss.
export function tickEffects(e: Effects, dt: number, rearThreat: boolean): boolean {
  e.boost = Math.max(0, e.boost - dt);
  e.magnet = Math.max(0, e.magnet - dt);
  e.stomach = Math.max(0, e.stomach - dt);

  if (e.stomachPending < 0 || rearThreat) return false;

  e.stomachPending -= dt;
  if (e.stomachPending > 0) return false;

  e.stomachPending = -1;
  e.stomach = STOMACH_SECONDS;
  return true;
}

// riderHalfWidth defaults to the bicycle's, the narrowest rider.
export interface PlacementInput { traffic: Traffic[]; routeLength: number; startSpeed: number; arcHeight: number; arcClears: string[]; random: () => number; ambushes?: number; riderHalfWidth?: number }
export const COIN_SPACING = 1.2, MAX_SNACKS = 4, SNACK_GAP = 120;
const SAFE_LANES = [-3.2, -1.6, 0, 1.6, 3.2], SNACK_LANES = [-2.4, 0, 2.4];
const SNACKS: PowerUp[] = ['cha', 'jhalmuri', 'chaap'];

// Checks where each actor will be when the rider reaches (x, z), widened for timing slack.
// A rider centred on the coin must clear the actor's side by a margin (0.6 m in all for the bicycle).
export function coinIsClear(traffic: Traffic[], x: number, z: number, startSpeed: number, riderHalfWidth = 0.34): boolean {
  return !traffic.some(t => {
    if (t.behavior === 'rear-threat') return false;
    if (t.kind === 'pedestrian') return Math.abs(t.z - z) < 3; // walkers cross the whole road
    const arrival = Math.abs(z) / Math.max(1, startSpeed), futureZ = t.z - t.speed * arrival, slack = t.speed > 0 ? 4 : 0;
    return Math.abs(t.x - x) < t.width / 2 + riderHalfWidth + 0.26 && Math.abs(futureZ - z) < t.length / 2 + 0.6 + slack;
  });
}

export function placePickups(input: PlacementInput): { coins: Coin[]; snacks: Snack[] } {
  const { traffic, routeLength, startSpeed, random, riderHalfWidth = 0.34 } = input;
  const coins: Coin[] = [], snacks: Snack[] = [];
  let id = 1, group = 1;
  const inRoute = (z: number) => -z > 40 && -z < routeLength - 30;
  const clear = (x: number, z: number) => coinIsClear(traffic, x, z, startSpeed, riderHalfWidth);
  const free = (x: number, z: number) => !coins.some(c => Math.abs(c.x - x) < 1.2 && Math.abs(c.z - z) < 2);
  const lay = (x: number, zs: number[], value: 1 | 5, trail: Coin['trail'], y = (_: number) => COIN_HEIGHT) => {
    zs.forEach((z, k) => coins.push({ id: id++, group, x, y: y(k), z, value, trail, collected: false, gone: false }));
    group++;
  };

  // Arc trails hop over every other hazard this vehicle clears in the air (kerb-edge hazards sit off the coin road).
  if (input.arcHeight >= 0.45) {
    traffic.filter(t => input.arcClears.includes(t.kind) && inRoute(t.z) && Math.abs(t.x) <= 4.3).forEach((t, i) => {
      if (i % 2) return;
      const count = 4 + Math.floor(random() * 4), span = t.length + 2;
      const zs = Array.from({ length: count }, (_, k) => t.z + span / 2 - (k / (count - 1)) * span);
      lay(t.x, zs, 1, 'arc', k => COIN_HEIGHT + input.arcHeight * 0.8 * Math.sin(Math.PI * k / (count - 1)));
    });
  }

  // The first `ambushes` paan-throwers lob at the rider's lane, so no safe trail leads through their zone.
  const ambushZs = traffic.filter(t => t.behavior === 'paan-thrower').map(t => t.z).sort((a, b) => b - a).slice(0, input.ambushes ?? 0);

  // Safe trails teach a clean line through the traffic.
  for (let start = 70 + random() * 30; start < routeLength - 50; start += 70 + random() * 40) {
    const count = 6 + Math.floor(random() * 7), first = Math.floor(random() * SAFE_LANES.length);
    for (let j = 0; j < SAFE_LANES.length; j++) {
      const x = SAFE_LANES[(first + j) % SAFE_LANES.length];
      const zs = Array.from({ length: count }, (_, k) => -(start + k * COIN_SPACING));
      if (ambushZs.some(tz => zs[0] > tz - 40 && zs[zs.length - 1] < tz + 45)) continue;
      // The lane must also be open for the approach (6 m before) and the run-out (12 m after), or a rider gives the trail up.
      // Sample every metre: a hazard is only ~1.4 m long, so spot checks at the two ends can miss one.
      const reach = Array.from({ length: Math.ceil(zs[0] + 6 - (zs[zs.length - 1] - 12)) + 1 }, (_, k) => zs[0] + 6 - k);
      if (!zs.every(z => inRoute(z) && free(x, z)) || !reach.every(z => clear(x, z))) continue;
      lay(x, zs, 1, 'safe');
      break;
    }
  }

  // Bold ৳5 trails run close beside moving traffic: a rider on the trail passes 0.56 m from it, a close shave that pays.
  traffic.filter(t => t.speed > 0 && t.behavior !== 'rear-threat' && inRoute(t.z) && -t.z > 80).forEach((t, i) => {
    if (i % 3 !== 1) return;
    const side = t.x > 0 ? -1 : 1, x = t.x + side * (t.width / 2 + riderHalfWidth + 0.56);
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
