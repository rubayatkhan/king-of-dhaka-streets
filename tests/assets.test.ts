import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { sanitizeManifest } from '../src/voices';

const root = 'public/audio';
const files = (dir: string): string[] => readdirSync(dir).flatMap(name => { const p = join(dir, name); return statSync(p).isDirectory() ? files(p) : [p]; });

describe('shipped audio', () => {
  it('stays within the 6 MB download budget', () => {
    expect(files(root).reduce((sum, f) => sum + statSync(f).size, 0)).toBeLessThanOrEqual(6 * 1024 * 1024);
  });

  it('ships a file for every voice the manifest promises, and no voice file it does not list', () => {
    const raw = JSON.parse(readFileSync(join(root, 'voices/manifest.json'), 'utf8')), manifest = sanitizeManifest(raw);
    expect(Object.keys(manifest)).toEqual(Object.keys(raw));
    for (const [id, entry] of Object.entries(manifest)) for (const s of ['family', 'ai'] as const) if (entry[s]) expect(existsSync(join(root, 'voices', s, `${id}.mp3`)), `${s}/${id}`).toBe(true);
    for (const s of ['family', 'ai'] as const) {
      const dir = join(root, 'voices', s);
      if (existsSync(dir)) for (const f of readdirSync(dir)) expect(manifest[f.replace(/\.mp3$/, '')]?.[s], `${s}/${f}`).toBe(true);
    }
  });
});
