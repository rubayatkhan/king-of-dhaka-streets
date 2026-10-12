import { describe, expect, it } from 'vitest';
import { LOOKS, buyLook, buyUpgrade } from '../src/economy';
import { loadProgress } from '../src/progress';
import { REPEAT_TAP_MS, actionAria, actionLabel, isRepeatTap, lookRows, powerUpRows, renderShop, type ShopRow } from '../src/shop';
const wallet = (taka: number) => { const p = loadProgress(null, null); p.taka = taka; return p; };

describe('the Bazaar view', () => {
  it('lists the vehicle\'s looks plus every outfit, each with the right action', () => {
    const p = wallet(1000); buyLook(p, 'bicycle-basket'); buyLook(p, 'bicycle-streamers'); p.taka = 160;
    const rows = lookRows(p, 'bicycle', true);
    expect(rows.map(r => r.id)).toEqual(['bicycle-paint-mango', 'bicycle-paint-jamun', 'bicycle-streamers', 'bicycle-basket', 'outfit-lungi', 'outfit-panjabi', 'outfit-school', 'outfit-cricket', 'bike-bell-brass']);
    const state = (id: string) => rows.find(r => r.id === id)!.state;
    expect(state('bicycle-streamers')).toBe('equipped'); expect(state('bicycle-basket')).toBe('equip');
    expect(state('bicycle-paint-mango')).toBe('buy'); expect(state('outfit-school')).toBe('too-poor');
  });
  it('lets a player hear a bell or horn before buying it', () => {
    const html = renderShop(loadProgress(null, null), 'truck', 'looks', true);
    expect(html).toContain('data-hear="truck-horn-melody"');
    expect(html).toMatch(/aria-label="Hear Melody pressure horn"/);
    expect(html.match(/data-hear=/g)?.length).toBe(LOOKS.filter(i => i.vehicle === 'truck' && i.slot === 'sound').length);
  });
  it('shows each power-up level, its next step and when it is maxed', () => {
    const p = wallet(10000); for (let i = 0; i < 4; i++) buyUpgrade(p, 'chaap'); p.taka = 300;
    const rows = powerUpRows(p);
    expect(rows.map(r => [r.id, r.price, r.state])).toEqual([['cha', 200, 'buy'], ['jhalmuri', 200, 'buy'], ['chaap', 0, 'maxed']]);
    expect(rows[0].name).toBe('Cha boost'); expect(rows.map(r => r.level)).toEqual([0, 0, 4]); expect(rows[0].detail).toBe('5 s of speed → 6 s of speed');
    expect(rows[2].detail).toBe('Maxed: stomach risk −10 pts');
  });
  it('renders buttons the game can act on', () => {
    const p = wallet(0), looks = renderShop(p, 'rickshaw', 'looks', true), ups = renderShop(p, 'rickshaw', 'power-ups', true);
    expect(looks).toContain('data-look="rickshaw-art-tiger"'); expect(looks).toContain('৳500');
    expect(ups).toContain('data-upgrade="jhalmuri"'); expect(ups).toContain('Need ৳200 more');
  });
  it('labels each button so a child knows what a tap does', () => {
    const row = (state: ShopRow['state'], price = 300): ShopRow => ({ id: 'outfit-panjabi', name: 'Panjabi', detail: '', price, state });
    expect(actionLabel(row('buy'), 650)).toBe('Buy · ৳300');
    expect(actionLabel(row('too-poor', 800), 650)).toBe('Need ৳150 more');
    expect(actionLabel(row('equip'), 0)).toBe('Use');
    expect(actionLabel(row('equipped'), 0)).toBe('Using ✓ · tap to remove');
    expect(actionLabel(row('maxed', 0), 0)).toBe('Maxed ★');
  });
  it('keeps the price and the amount still needed in the accessible name', () => {
    const row = (state: ShopRow['state'], price = 300): ShopRow => ({ id: 'outfit-panjabi', name: 'Panjabi', detail: '', price, state });
    expect(actionAria(row('buy'), 650)).toBe('Buy Panjabi for ৳300');
    expect(actionAria(row('too-poor', 800), 650)).toBe('Panjabi costs ৳800 — you need ৳150 more');
    expect(actionAria(row('equipped'), 0)).toBe('Using Panjabi — tap to remove');
    const p = wallet(650), html = renderShop(p, 'truck', 'looks', true);
    expect(html).toContain('aria-label="Peacock truck art costs ৳800 — you need ৳150 more"');
    expect(html).toContain('>Need ৳150 more<');
  });
  it('shows each power-up level as four pips', () => {
    const p = wallet(0); p.upgrades.jhalmuri = 2;
    const html = renderShop(p, 'bicycle', 'power-ups', true);
    expect(html.match(/class="pip on"/g)?.length).toBe(2);
    expect(html.match(/class="pip"/g)?.length).toBe(10);
  });
  it('locks looks for a vehicle not yet unlocked, while outfits stay buyable', () => {
    const p = wallet(5000), rows = lookRows(p, 'truck', false);
    const art = rows.find(r => r.id === 'truck-art-peacock')!, outfit = rows.find(r => r.id === 'outfit-lungi')!;
    expect(art.state).toBe('locked'); expect(outfit.state).toBe('buy');
    expect(actionLabel(art, p.taka)).toBe('Unlocks with the truck');
    expect(actionAria(art, p.taka)).toBe('Peacock truck art unlocks with the truck');
    const html = renderShop(p, 'truck', 'looks', false);
    expect(html).toContain('<button data-look="truck-art-peacock" disabled aria-label="Peacock truck art unlocks with the truck">Unlocks with the truck</button>');
    expect(html).toMatch(/<button data-look="outfit-lungi"\s+aria-label="Buy Lungi and gamchha for ৳300">Buy · ৳300<\/button>/);
    expect(lookRows(p, 'truck', true).find(r => r.id === 'truck-art-peacock')!.state).toBe('buy');
  });
  it('keeps a look already owned for a locked vehicle usable', () => {
    const p = wallet(0); p.owned.push('truck-art-rose');
    expect(lookRows(p, 'truck', false).find(r => r.id === 'truck-art-rose')!.state).toBe('equip');
  });
});

describe('the Bazaar double-tap guard', () => {
  it('ignores a second tap on the same item soon after an action', () => {
    const last = { key: 'upgrade:cha', at: 1000 };
    expect(isRepeatTap(undefined, 'upgrade:cha', 1000)).toBe(false);
    expect(isRepeatTap(last, 'upgrade:cha', 1000 + 120)).toBe(true);
    expect(isRepeatTap(last, 'upgrade:cha', 1000 + REPEAT_TAP_MS - 1)).toBe(true);
    expect(isRepeatTap(last, 'upgrade:cha', 1000 + REPEAT_TAP_MS)).toBe(false);
    expect(isRepeatTap(last, 'look:outfit-lungi', 1000 + 120)).toBe(false);
    expect(REPEAT_TAP_MS).toBe(400);
  });
});
