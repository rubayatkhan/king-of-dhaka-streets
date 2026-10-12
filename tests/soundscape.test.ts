import { describe, expect, it } from 'vitest';
import { DISTRICT_SOUNDS, asDistrict, districtCall, passCue, streetCue } from '../src/soundscape';
import { SOUNDS } from '../src/soundbank';
import { lineById } from '../src/voices';

const never = () => 0.99, always = () => 0;

describe('street and district cues', () => {
  it('lets each district be heard through its own palette when no traffic is near', () => {
    for (const d of ['bazaar', 'riverfront', 'boulevard'] as const) {
      const heard = new Set(Array.from({ length: 12 }, (_, beat) => streetCue({ district: d, beat, nearby: [], random: never }).sound));
      expect([...heard].sort()).toEqual([...DISTRICT_SOUNDS[d]].sort());
    }
    expect(DISTRICT_SOUNDS.bazaar).toContain('conch-saw'); expect(DISTRICT_SOUNDS.riverfront).toContain('launch-horn'); expect(DISTRICT_SOUNDS.boulevard).toContain('icecream-bell');
  });

  it('answers nearby traffic: rickshaw bells (sometimes a call), truck horns, CNG putter, panned to the vehicle', () => {
    const near = (kind: string) => [{ kind, x: 2.65, distance: 8 }];
    expect(streetCue({ district: 'bazaar', beat: 1, nearby: near('rickshaw'), random: never })).toEqual({ sound: 'rickshaw-tring', pan: 0.5 });
    expect(streetCue({ district: 'bazaar', beat: 1, nearby: near('rickshaw'), random: always }).voice).toBe('rickshaw-mama');
    expect(streetCue({ district: 'bazaar', beat: 1, nearby: near('truck'), random: never }).sound).toBe('truck-call');
    expect(streetCue({ district: 'bazaar', beat: 1, nearby: near('cng'), random: never }).sound).toBe('cng-putter');
    expect(streetCue({ district: 'bazaar', beat: 1, nearby: [{ kind: 'bus', x: -9, distance: 5 }], random: never }).pan).toBe(-0.85);
  });

  it('slaps a passed bus twice, then the helper calls the bus line or a route', () => {
    const calls = [1, 2, 3, 4, 5, 6].map(n => passCue('bus', n));
    for (const c of calls) { expect(c?.sound).toBe('bus-slap'); expect(lineById(c!.voice!)).toBeDefined(); }
    expect(calls.map(c => c!.voice)).toContain('bus-helper-plastic');
    expect(new Set(calls.map(c => c!.voice)).size).toBeGreaterThanOrEqual(3);
    expect(passCue('cow', 1)).toBeUndefined();
  });

  it('alternates each district\'s street calls and only uses real lines', () => {
    expect([0, 1, 2].map(n => districtCall('riverfront', n))).toEqual(['launch-caller', 'boatman-nouka', 'launch-caller']);
    for (const d of ['bazaar', 'riverfront', 'boulevard'] as const) expect(lineById(districtCall(d, 1))?.district).toBe(d);
  });

  it('maps unknown names to the bazaar and only names sounds that exist', () => {
    expect(asDistrict('riverfront')).toBe('riverfront'); expect(asDistrict(undefined)).toBe('bazaar'); expect(asDistrict('x')).toBe('bazaar');
    for (const list of Object.values(DISTRICT_SOUNDS)) for (const s of list) expect(SOUNDS[s]).toBeDefined();
  });
});
