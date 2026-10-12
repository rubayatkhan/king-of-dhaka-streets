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
