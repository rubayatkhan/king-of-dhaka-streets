import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { ChunkBender, bendMesh, pathX } from '../src/bend';

const chunk = (meshes = 4, z = -100) => {
  const g = new T.Group(); g.position.z = z;
  for (let i = 0; i < meshes; i++) { const m = new T.Mesh(new T.BoxGeometry(1, 1, 8)); m.position.set(0, 0, 0); g.add(m); }
  return g;
};
// A fake clock that moves 2 ms on every reading, as if each mesh took 2 ms to bend.
const clock = () => { let t = -2; return () => (t += 2); };

describe('bending street blocks onto the curving road', () => {
  it('offsets every vertex sideways by the road curve at its world distance', () => {
    const m = new T.Mesh(new T.BoxGeometry(1, 1, 8)), straight = Array.from(m.geometry.getAttribute('position').array);
    bendMesh(m, -100);
    const p = m.geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++) expect(p.getX(i)).toBeCloseTo(straight[i * 3] + pathX(straight[i * 3 + 2] - 100), 5);
    bendMesh(m, -300);
    expect(p.getX(0)).toBeCloseTo(straight[0] + pathX(straight[2] - 300), 5);
  });

  it('spreads a recycled block over several frames and hides it until it is done', () => {
    const bender = new ChunkBender(clock()), g = chunk(4);
    bender.queue(g);
    expect(g.visible).toBe(false); expect(bender.pending(g)).toBe(true);
    bender.work(3); expect(bender.pending(g)).toBe(true);
    bender.work(3); expect(bender.pending(g)).toBe(false);
    expect(g.visible).toBe(true);
    const x = (g.children[0] as T.Mesh).geometry.getAttribute('position').getX(0);
    expect(x).toBeCloseTo(0.5 + pathX(4 - 100), 5);
  });

  it('bends at least one mesh per frame even on a tiny budget', () => {
    const bender = new ChunkBender(clock()), g = chunk(3);
    bender.queue(g);
    for (let frame = 0; frame < 3; frame++) bender.work(0);
    expect(bender.pending(g)).toBe(false);
  });

  it('skips a block already bent where it stands and restarts one that moves mid-bend', () => {
    const bender = new ChunkBender(clock()), g = chunk(4);
    bender.queue(g); bender.finish(g);
    bender.queue(g); expect(bender.pending(g)).toBe(false);
    g.position.z = -436; bender.queue(g); bender.work(3);
    g.position.z = -772; bender.queue(g); bender.finish(g);
    for (const m of g.children as T.Mesh[]) expect(m.geometry.getAttribute('position').getX(0)).toBeCloseTo(0.5 + pathX(4 - 772), 5);
  });

  it('slices one huge merged mesh across frames, a few thousand vertices at a time', () => {
    const bender = new ChunkBender(clock()), g = new T.Group(); g.position.z = -100;
    const big = new T.Mesh(new T.PlaneGeometry(4, 40, 4, 4000)); g.add(big); // ~20k vertices, like a merged street block
    bender.queue(g);
    let frames = 0; while (bender.pending(g) && frames < 50) { bender.work(3); frames++; }
    expect(frames).toBeGreaterThan(2); expect(bender.pending(g)).toBe(false);
    const p = big.geometry.getAttribute('position'), last = p.count - 1, straight = big.userData.straightPositions as Float32Array;
    expect(p.getX(last)).toBeCloseTo(straight[last * 3] + pathX(straight[last * 3 + 2] - 100), 5);
  });
});
