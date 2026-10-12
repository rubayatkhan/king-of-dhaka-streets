import type { SoundId } from './soundbank';
import type { District } from './voices';

export interface NearbyActor { kind: string; x: number; distance: number }
export interface CueInput { district: District; beat: number; nearby: NearbyActor[]; random: () => number }
export interface Cue { sound?: SoundId; voice?: string; pan: number }

// What each district sounds like between vehicles: conch workshops and crows in Shankhari Bazaar, launches and
// water at Sadarghat, sacks and the ice-cream cart at Karwan Bazar.
export const DISTRICT_SOUNDS: Record<District, SoundId[]> = {
  bazaar: ['conch-saw', 'crow', 'rickshaw-tring'],
  riverfront: ['launch-horn', 'water-lap', 'crow'],
  boulevard: ['sack-thump', 'icecream-bell', 'rickshaw-tring'],
};
const DISTRICT_CALLS: Record<District, string[]> = {
  bazaar: ['tea-vendor', 'badam-seller'],
  riverfront: ['launch-caller', 'boatman-nouka'],
  boulevard: ['vegetable-vendor', 'auction-caller'],
};
const BUS_CALLS = ['bus-helper-plastic', 'bus-route-gulistan', 'bus-route-motijheel', 'bus-route-farmgate'];
const pan = (x: number) => Math.round(Math.max(-0.85, Math.min(0.85, x / 5.3)) * 100) / 100;

export function asDistrict(name?: string): District { return name === 'riverfront' || name === 'boulevard' ? name : 'bazaar'; }

export function streetCue({ district, beat, nearby, random }: CueInput): Cue {
  const near = nearby.find(a => a.distance < 25);
  if (near?.kind === 'rickshaw') return random() < 0.15 ? { sound: 'rickshaw-tring', voice: 'rickshaw-mama', pan: pan(near.x) } : { sound: 'rickshaw-tring', pan: pan(near.x) };
  if (near?.kind === 'truck') return { sound: 'truck-call', pan: pan(near.x) };
  if (near?.kind === 'cng') return { sound: 'cng-putter', pan: pan(near.x) };
  if (near && /bus|car|motorbike/.test(near.kind)) return { sound: 'traffic-horn', pan: pan(near.x) };
  const palette = DISTRICT_SOUNDS[district];
  return { sound: palette[((beat % palette.length) + palette.length) % palette.length], pan: beat % 2 ? -0.7 : 0.7 };
}

export function passCue(kind: string, passes: number): Cue | undefined {
  if (kind === 'bus') return { sound: 'bus-slap', voice: BUS_CALLS[passes % BUS_CALLS.length], pan: 0 };
  if (kind === 'rickshaw') return { sound: 'rickshaw-tring', pan: 0 };
  if (kind === 'truck') return { sound: 'truck-call', pan: 0 };
}

export function districtCall(district: District, n: number): string { const calls = DISTRICT_CALLS[district]; return calls[n % calls.length]; }
