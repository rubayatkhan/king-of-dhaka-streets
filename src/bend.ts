import * as T from 'three';

export const pathX = (z: number) => Math.sin(z * .008) * 5 + Math.sin(z * .019) * 1.8;

// Bends vertices [from, to) of a straight-built mesh onto the curving road for a block standing at chunkZ, from its
// kept straight copy; the slice that reaches the last vertex flags the upload and refreshes the bounds.
export function bendMesh(o: T.Mesh, chunkZ: number, from = 0, to = Infinity) {
  const attr = o.geometry.getAttribute('position'), normal = o.geometry.getAttribute('normal');
  to = Math.min(to, attr.count);
  if (!o.userData.straightPositions) { o.userData.straightPositions = new Float32Array(attr.array); if (normal) o.userData.straightNormals = new Float32Array(normal.array); }
  const positions = o.userData.straightPositions as Float32Array, normals = o.userData.straightNormals as Float32Array | undefined;
  for (let i = from; i < to; i++) {
    const z = positions[i * 3 + 2] + chunkZ; attr.setX(i, positions[i * 3] + pathX(z));
    if (normal && normals) { const slope = .04 * Math.cos(z * .008) + .0342 * Math.cos(z * .019), nx = normals[i * 3], ny = normals[i * 3 + 1], nz = normals[i * 3 + 2] - slope * nx, l = Math.hypot(nx, ny, nz) || 1; normal.setXYZ(i, nx / l, ny / l, nz / l); }
  }
  if (to < attr.count) return;
  attr.needsUpdate = true; if (normal) normal.needsUpdate = true; o.geometry.computeBoundingSphere(); o.geometry.computeBoundingBox();
}

interface Job { meshes: T.Mesh[]; next: number; vertex: number; z: number }
// A street block is mostly one merged mesh (~40-80k vertices), so work is sliced by vertex range, not by mesh.
const SLICE = 4096;

// Re-bending a whole recycled block (~90k vertices) in one frame is a visible hitch, so the work is sliced across
// frames while the block waits beyond the camera's far plane, hidden until it is whole.
export class ChunkBender {
  private jobs = new Map<T.Group, Job>();
  constructor(private now: () => number = () => performance.now()) {}
  pending(g: T.Group) { return this.jobs.has(g); }
  queue(g: T.Group) {
    const z = g.position.z, job = this.jobs.get(g);
    if (job ? job.z === z : g.userData.bentAt === z) return;
    const meshes: T.Mesh[] = []; g.traverse(o => { if (o instanceof T.Mesh) meshes.push(o); });
    this.jobs.set(g, { meshes, next: 0, vertex: 0, z }); g.visible = false;
  }
  work(budgetMs: number) {
    const start = this.now();
    for (const [g, job] of this.jobs) {
      while (job.next < job.meshes.length) {
        const mesh = job.meshes[job.next], count = mesh.geometry.getAttribute('position').count;
        bendMesh(mesh, job.z, job.vertex, job.vertex + SLICE);
        job.vertex += SLICE; if (job.vertex >= count) { job.next++; job.vertex = 0; }
        if (job.next === job.meshes.length) this.done(g, job);
        if (this.now() - start >= budgetMs) return;
      }
    }
  }
  finish(g: T.Group) {
    const job = this.jobs.get(g); if (!job) return;
    for (; job.next < job.meshes.length; job.next++, job.vertex = 0) bendMesh(job.meshes[job.next], job.z, job.vertex);
    this.done(g, job);
  }
  private done(g: T.Group, job: Job) { this.jobs.delete(g); g.userData.bentAt = job.z; g.visible = true; }
}
