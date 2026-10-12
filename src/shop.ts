import { LOOKS, MAX_LEVEL, UPGRADE_PRICES, powerUpStats } from './economy';
import type { PowerUp } from './pickups';
import type { Progress } from './progress';
import type { VehicleKind } from './simulation';

export type ShopTab = 'looks' | 'power-ups';
export type RowState = 'buy' | 'too-poor' | 'equip' | 'equipped' | 'maxed' | 'locked';
export interface ShopRow { id: string; name: string; detail: string; price: number; state: RowState; level?: number }

const SLOT_NAMES = { paint: 'Paint', art: 'Art', extra: 'Extra', outfit: 'Outfit' } as const;
const POWER_UP_NAMES: Record<PowerUp, string> = { cha: 'Cha boost', jhalmuri: 'Jhalmuri magnet', chaap: 'Chaap belly' };
const POWER_UP_ICONS: Record<PowerUp, string> = { cha: '☕', jhalmuri: '🧲', chaap: '🍢' };
const EXTRA_ICONS: Record<string, string> = { streamers: '🎏', basket: '🧺', garland: '🌸', 'red-helmet': '⛑️' };
const ART_ICONS: Record<string, string> = { peacock: '🦚', tiger: '🐅', city: '🌃', rose: '🌹' };
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const lockedFor = (r: ShopRow) => LOOKS.find(i => i.id === r.id)?.vehicle;

// A phone double tap fires two clicks, and the Bazaar redraws under the finger: a second tap on the same
// item this soon after an action would buy the next level or undo the purchase, so it is ignored.
export const REPEAT_TAP_MS = 400;
export interface Tap { key: string; at: number }

export function isRepeatTap(last: Tap | undefined, key: string, now: number): boolean {
  return last !== undefined && last.key === key && now - last.at < REPEAT_TAP_MS;
}

export function actionLabel(r: ShopRow, taka: number): string {
  if (r.state === 'buy') return `Buy · ৳${r.price}`;
  if (r.state === 'too-poor') return `Need ৳${r.price - taka} more`;
  if (r.state === 'equip') return 'Use';
  if (r.state === 'equipped') return 'Using ✓ · tap to remove';
  if (r.state === 'locked') return `Unlocks with the ${lockedFor(r)}`;
  return 'Maxed ★';
}

export function actionAria(r: ShopRow, taka: number): string {
  if (r.state === 'buy') return `Buy ${r.name} for ৳${r.price}`;
  if (r.state === 'too-poor') return `${r.name} costs ৳${r.price} — you need ৳${r.price - taka} more`;
  if (r.state === 'equip') return `Use ${r.name}`;
  if (r.state === 'equipped') return `Using ${r.name} — tap to remove`;
  if (r.state === 'locked') return `${r.name} unlocks with the ${lockedFor(r)}`;
  return `${r.name} is maxed`;
}

function buyState(taka: number, price: number): 'buy' | 'too-poor' {
  return taka >= price ? 'buy' : 'too-poor';
}

// Looks for a vehicle the player has not unlocked yet cannot be bought; outfits suit every ride.
export function lookRows(save: Progress, vehicle: VehicleKind, unlocked: boolean): ShopRow[] {
  return LOOKS.filter(item => item.vehicle === vehicle || item.vehicle === 'rider').map(item => {
    const owned = save.owned.includes(item.id);
    const equipped = save.equipped[`${item.vehicle}:${item.slot}`] === item.id;
    let state: RowState;
    if (equipped) state = 'equipped';
    else if (owned) state = 'equip';
    else if (!unlocked && item.vehicle !== 'rider') state = 'locked';
    else state = buyState(save.taka, item.price);
    return {
      id: item.id,
      name: item.name,
      detail: item.vehicle === 'rider' ? 'Outfit · every ride' : SLOT_NAMES[item.slot],
      price: item.price,
      state,
    };
  });
}

function effectText(kind: PowerUp, level: number): string {
  const s = powerUpStats({ cha: level, jhalmuri: level, chaap: level });
  if (kind === 'cha') return `${s.chaSeconds} s of speed`;
  if (kind === 'jhalmuri') return `${s.magnetSeconds} s, ${s.magnetRadius} m pull`;
  return `stomach risk −${Math.round(s.stomachReduction * 100)} pts`;
}

export function powerUpRows(save: Progress): ShopRow[] {
  return (['cha', 'jhalmuri', 'chaap'] as const).map(kind => {
    const level = save.upgrades[kind];
    const maxed = level >= MAX_LEVEL;
    const price = maxed ? 0 : UPGRADE_PRICES[level];
    return {
      id: kind,
      name: POWER_UP_NAMES[kind],
      level,
      detail: maxed ? `Maxed: ${effectText(kind, level)}` : `${effectText(kind, level)} → ${effectText(kind, level + 1)}`,
      price,
      state: maxed ? 'maxed' : buyState(save.taka, price),
    };
  });
}

// A small picture of each item: the paint colour, the art motif, the extra, the outfit's colours or the power-up.
function swatch(r: ShopRow, tab: ShopTab): string {
  if (tab === 'power-ups') return `<span class="swatch ${r.id}" aria-hidden="true">${POWER_UP_ICONS[r.id as PowerUp]}</span>`;
  const look = LOOKS.find(i => i.id === r.id)?.look ?? {};
  if (look.outfit) {
    const { shirt, lower, accent } = look.outfit;
    return `<span class="swatch outfit" style="--shirt:${hex(shirt)};--lower:${hex(lower)};--accent:${accent === undefined ? 'transparent' : hex(accent)}" aria-hidden="true"></span>`;
  }
  if (look.paint !== undefined) return `<span class="swatch paint" style="--paint:${hex(look.paint)}" aria-hidden="true"></span>`;
  if (look.art) return `<span class="swatch art ${look.art}" aria-hidden="true">${ART_ICONS[look.art]}</span>`;
  return `<span class="swatch extra" aria-hidden="true">${EXTRA_ICONS[look.extra ?? ''] ?? '✨'}</span>`;
}

function pips(level: number): string {
  const lit = Array.from({ length: MAX_LEVEL }, (_, i) => `<i class="pip${i < level ? ' on' : ''}"></i>`).join('');
  return `<span class="pips" aria-hidden="true">${lit}</span><span class="level">Level ${level} of ${MAX_LEVEL}</span>`;
}

export function renderShop(save: Progress, vehicle: VehicleKind, tab: ShopTab, unlocked: boolean): string {
  const rows = tab === 'looks' ? lookRows(save, vehicle, unlocked) : powerUpRows(save);
  const attr = tab === 'looks' ? 'data-look' : 'data-upgrade';
  return rows.map(r => {
    const tag = r.state === 'buy' || r.state === 'too-poor' || r.state === 'locked' ? `<span class="tag">৳${r.price}</span>` : '';
    const level = r.level === undefined ? '' : pips(r.level);
    const button = `<button ${attr}="${r.id}" ${r.state === 'maxed' || r.state === 'locked' ? 'disabled' : ''} aria-label="${actionAria(r, save.taka)}">${actionLabel(r, save.taka)}</button>`;
    return `<div class="shop-card ${r.state}"><div class="shop-art">${swatch(r, tab)}${tag}</div><div class="shop-info"><strong>${r.name}</strong>${level}<small>${r.detail}</small></div>${button}</div>`;
  }).join('');
}
