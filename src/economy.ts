import type { VehicleLook } from './models';
import type { PowerUp, PowerUpStats } from './pickups';
import type { Progress, Upgrades } from './progress';
import type { VehicleKind } from './simulation';

export type Slot = 'paint' | 'art' | 'extra' | 'outfit';
export interface LookItem {
  id: string;
  name: string;
  vehicle: VehicleKind | 'rider';
  slot: Slot;
  price: number;
  look: VehicleLook;
}

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
  return {
    chaSeconds: 5 + level(u.cha),
    magnetSeconds: 6 + level(u.jhalmuri),
    magnetRadius: 2 + level(u.jhalmuri) * 0.5,
    stomachReduction: level(u.chaap) * 0.025,
  };
}

export function buyLook(save: Progress, id: string): Purchase {
  const item = LOOKS.find(i => i.id === id);
  if (!item) return 'unknown';
  if (save.owned.includes(id)) return 'owned';
  if (save.taka < item.price) return 'too-poor';
  save.taka -= item.price;
  save.owned.push(id);
  save.equipped[slotKey(item)] = id;
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
  save.taka -= price;
  save.upgrades[kind] = current + 1;
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

export function settleRide(save: Progress, r: RideResult): Payout {
  const p = ridePayout(r);
  save.taka += p.total;
  return p;
}

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
