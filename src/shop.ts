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
    const owned = save.owned.includes(item.id);
    const equipped = save.equipped[`${item.vehicle}:${item.slot}`] === item.id;
    return {
      id: item.id,
      name: item.name,
      detail: item.vehicle === 'rider' ? 'Outfit · every ride' : SLOT_NAMES[item.slot],
      price: item.price,
      state: equipped ? 'equipped' : owned ? 'equip' : save.taka >= item.price ? 'buy' : 'too-poor',
    };
  });
}

function effectText(kind: PowerUp, level: number): string {
  const s = powerUpStats({ cha: level, jhalmuri: level, chaap: level });
  return kind === 'cha'
    ? `${s.chaSeconds} s of speed`
    : kind === 'jhalmuri'
      ? `${s.magnetSeconds} s, ${s.magnetRadius} m pull`
      : `stomach risk −${Math.round(s.stomachReduction * 100)} pts`;
}

export function powerUpRows(save: Progress): ShopRow[] {
  return (['cha', 'jhalmuri', 'chaap'] as const).map(kind => {
    const level = save.upgrades[kind];
    const maxed = level >= MAX_LEVEL;
    const price = maxed ? 0 : UPGRADE_PRICES[level];
    return {
      id: kind,
      name: `${POWER_UP_NAMES[kind]} · level ${level}/${MAX_LEVEL}`,
      detail: maxed ? `Maxed: ${effectText(kind, level)}` : `${effectText(kind, level)} → ${effectText(kind, level + 1)}`,
      price,
      state: maxed ? 'maxed' : save.taka >= price ? 'buy' : 'too-poor',
    };
  });
}

export function renderShop(save: Progress, vehicle: VehicleKind, tab: ShopTab): string {
  const rows = tab === 'looks' ? lookRows(save, vehicle) : powerUpRows(save);
  const attr = tab === 'looks' ? 'data-look' : 'data-upgrade';
  return rows.map(r => `<div class="shop-row ${r.state}"><div><strong>${r.name}</strong><small>${r.detail}</small></div><button ${attr}="${r.id}" ${r.state === 'maxed' ? 'disabled' : ''} aria-label="${ACTION[r.state]}: ${r.name}">${r.state === 'buy' || r.state === 'too-poor' ? `৳${r.price} · ` : ''}${ACTION[r.state]}</button></div>`).join('');
}
