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
