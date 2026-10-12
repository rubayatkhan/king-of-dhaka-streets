import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FAMILY_CREDIT_DEFAULT, VOICE_LINES, familyCredits, lineById, linesFor, sanitizeManifest, voiceSource, voiceUrl } from '../src/voices';

describe('street voice lines', () => {
  it('gives every line a unique id, Bangla text, a romanization, an English caption and a stage direction', () => {
    expect(new Set(VOICE_LINES.map(l => l.id)).size).toBe(VOICE_LINES.length);
    for (const l of VOICE_LINES) {
      expect(l.bangla).toMatch(/[ঀ-৿]/);
      expect(l.roman.length).toBeGreaterThan(1); expect(l.caption.length).toBeGreaterThan(1); expect(l.direction.length).toBeGreaterThan(10);
    }
    expect(lineById('bus-helper-plastic')?.bangla).toBe('ওস্তাদ, বামে প্লাস্টিক!');
  });

  it('uses the colloquial street wording the family approved, and an angry line for an actual crash', () => {
    expect(lineById('tea-vendor')?.bangla).toBe('এই চা, গরম চা! খাইয়া যান, ভাই!');
    expect(lineById('launch-caller')?.bangla).toBe('সদরঘাট! সদরঘাট! লঞ্চ ছাইড়া দিবো, তাড়াতাড়ি আহেন!');
    expect(lineById('vegetable-vendor')?.bangla).toBe('তাজা সবজি! লাউ লন, টমেটো লন!');
    expect(lineById('crash-chokhe')).toMatchObject({ bangla: 'চোখে দেহো না মিয়া?!', reaction: true });
  });

  it('prefers the family recording, then the AI voice, then the caption alone', () => {
    const m = sanitizeManifest({ 'tea-vendor': { family: true, ai: true }, 'launch-caller': { ai: true } });
    expect(voiceSource('tea-vendor', m)).toBe('family');
    expect(voiceSource('launch-caller', m)).toBe('ai');
    expect(voiceSource('badam-seller', m)).toBe('caption');
    expect(voiceUrl('/king/', 'tea-vendor', 'family')).toBe('/king/audio/voices/family/tea-vendor.mp3');
  });

  it('ignores unknown lines, non-boolean flags and malformed manifests', () => {
    expect(sanitizeManifest(null)).toEqual({}); expect(sanitizeManifest([1])).toEqual({}); expect(sanitizeManifest('x')).toEqual({});
    expect(sanitizeManifest({ nope: { ai: true }, 'tea-vendor': { ai: 'yes', family: true, credit: '  Ma  ' } })).toEqual({ 'tea-vendor': { family: true, credit: 'Ma' } });
  });

  it('loads district lines lazily and the rest up front', () => {
    expect(linesFor('riverfront').map(l => l.id)).toEqual(['launch-caller', 'boatman-nouka']);
    expect(linesFor().every(l => l.district === undefined)).toBe(true);
    expect(linesFor().map(l => l.id)).toContain('easy-brother');
  });

  it('credits family voices only by the name the family gave', () => {
    expect(familyCredits(sanitizeManifest({ 'tea-vendor': { family: true, credit: 'Ma' }, 'cha-ah': { family: true }, 'pothole-uff': { ai: true } }))).toEqual(['Ma', FAMILY_CREDIT_DEFAULT]);
  });

  it('lists every line in the recording script with its id and exact Bangla', () => {
    const script = readFileSync('docs/voice-script.md', 'utf8');
    for (const l of VOICE_LINES) { expect(script).toContain(`\`${l.id}\``); expect(script).toContain(l.bangla); }
  });
});
