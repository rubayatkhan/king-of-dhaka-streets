import { describe, expect, it, vi } from 'vitest';
import { Box3, BufferGeometry, Color, Mesh, MeshStandardMaterial, type Object3D } from 'three';

// Painted art is drawn on canvases; a no-op 2D context lets the models build under Node.
const ctx: Record<string, unknown> = new Proxy({}, { get: (t: Record<string, unknown>, p: string) => p in t ? t[p] : () => ctx, set: (t, p: string, v) => { t[p] = v; return true; } });
vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
const { createVehicle } = await import('../src/models');

function fingerprint(m: Object3D) {
  let meshes = 0, verts = 0, sum = 0;
  m.traverse(o => { if (!(o instanceof Mesh)) return; meshes++; const p = (o.geometry as BufferGeometry).getAttribute('position'); verts += p.count; for (let i = 0; i < p.count; i++) sum += Math.abs(p.getX(i)) + p.getY(i) * 2 + p.getZ(i) * 3; });
  const b = new Box3().setFromObject(m);
  return { meshes, verts, sum: Math.round(sum * 100) / 100, min: b.min.toArray().map(v => Math.round(v * 1000) / 1000), max: b.max.toArray().map(v => Math.round(v * 1000) / 1000) };
}
const maps = (m: Object3D) => { const found = new Set<unknown>(); m.traverse(o => { if (o instanceof Mesh && o.material instanceof MeshStandardMaterial && o.material.map) found.add(o.material.map); }); return found; };
const vertices = (m: Object3D) => fingerprint(m).verts;
function hasColor(model: Object3D, hex: number): boolean {
  const c = new Color(hex); let found = false;
  model.traverse(o => {
    const colors = ((o as Mesh).geometry as BufferGeometry | undefined)?.getAttribute?.('color');
    if (!colors || found) return;
    for (let i = 0; i < colors.count && !found; i++) found = Math.abs(colors.getX(i) - c.r) < 1e-3 && Math.abs(colors.getY(i) - c.g) < 1e-3 && Math.abs(colors.getZ(i) - c.b) < 1e-3;
  });
  return found;
}

describe('traffic trucks and buses', () => {
  // Captured before the player truck existed: traffic models must not move by a vertex.
  it('keep their original models', () => {
    const truck = { meshes: 10, verts: 5472, sum: 21914.63, min: [-1.475, -0.14, -2.65], max: [1.475, 2.8, 2.835] };
    expect(fingerprint(createVehicle('truck', 0x378e84))).toEqual(truck);
    expect(fingerprint(createVehicle('truck', 0x378e84, { art: 'rose' }))).toEqual(truck);
    expect(fingerprint(createVehicle('bus', 0x378e84))).toEqual({ meshes: 10, verts: 5640, sum: 18015.03, min: [-1.4, -0.14, -2.913], max: [1.4, 2.49, 3.085] });
  });
  it('ignore the player flag on every other vehicle', () => {
    for (const kind of ['bicycle', 'rickshaw', 'motorbike', 'car', 'bus']) expect(fingerprint(createVehicle(kind, 0x259b99, {}, { player: true }))).toEqual(fingerprint(createVehicle(kind, 0x259b99)));
  });
});

describe('player truck', () => {
  const player = (look = {}) => createVehicle('truck', 0x259b99, look, { player: true });
  it('is its own painted Tata, not the traffic truck', () => {
    expect(vertices(player())).not.toBe(vertices(createVehicle('truck', 0x259b99)));
    expect(maps(player()).size).toBeGreaterThan(maps(createVehicle('truck', 0x259b99)).size);
  });
  it('fits the simulated truck footprint with its wheels on the road', () => {
    const b = new Box3().setFromObject(player());
    expect(b.max.x - b.min.x).toBeLessThanOrEqual(2.6); expect(b.max.x - b.min.x).toBeGreaterThan(2.3);
    expect(b.max.z - b.min.z).toBeLessThanOrEqual(6.4); expect(b.max.z - b.min.z).toBeGreaterThan(6);
    expect(Math.abs(b.min.x + b.max.x)).toBeLessThan(.05); expect(Math.abs(b.min.z + b.max.z)).toBeLessThan(.3);
    expect(b.min.y).toBeGreaterThan(-.05); expect(b.min.y).toBeLessThan(.02);
    const truck = player(); expect(truck.userData.wheels!.length).toBe(6);
  });
  it('keeps the ধীরে চলুন tailboard and follows the Bazaar art theme', () => {
    const classic = maps(player()), rose = maps(player({ art: 'rose' })), peacock = maps(player({ art: 'peacock' }));
    for (const tail of maps(createVehicle('truck', 0x378e84))) expect(classic.has(tail)).toBe(true);
    for (const tail of maps(createVehicle('truck', 0x378e84, { art: 'rose' }))) expect(rose.has(tail)).toBe(true);
    expect([...rose].some(m => !classic.has(m))).toBe(true); expect([...peacock].some(m => !rose.has(m) && !classic.has(m))).toBe(true);
  });
  it('wears its paint on the cab and takes the garland and streamers', () => {
    expect(hasColor(player({ paint: 0x2e7d4f }), 0x2e7d4f)).toBe(true); expect(hasColor(player(), 0x2e7d4f)).toBe(false);
    expect(hasColor(player({ extra: 'garland' }), 0xff5d8f)).toBe(true); expect(hasColor(player(), 0xff5d8f)).toBe(false);
    expect(hasColor(player({ extra: 'streamers' }), 0xe8473c)).toBe(true); expect(vertices(player({ extra: 'streamers' }))).toBeGreaterThan(vertices(player()));
  });
});
