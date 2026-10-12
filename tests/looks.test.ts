import { describe, expect, it } from 'vitest';
import { BufferGeometry, Color, Mesh, type Object3D } from 'three';
import { createVehicle, snackModel } from '../src/models';

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

describe('street food models', () => {
  it('builds a distinct floating model for each snack', () => {
    const models = (['cha', 'jhalmuri', 'chaap'] as const).map(kind => snackModel(kind));
    for (const [i, kind] of (['cha', 'jhalmuri', 'chaap'] as const).entries()) { expect(models[i].userData.kind).toBe(kind); expect(models[i].children.length).toBeGreaterThan(1); }
    expect(new Set(models.map(m => vertices(m))).size).toBe(3);
  });
  it('shares every snack material between snacks, so none leaks when a snack is disposed', () => {
    const materials = (model: Object3D) => { const found = new Set<unknown>(); model.traverse(o => { if (o instanceof Mesh) found.add(o.material); }); return found; };
    for (const kind of ['cha', 'jhalmuri', 'chaap'] as const) {
      const first = materials(snackModel(kind)), second = materials(snackModel(kind));
      expect([...second].every(m => first.has(m))).toBe(true);
    }
  });
});
