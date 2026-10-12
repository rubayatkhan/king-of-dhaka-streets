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
