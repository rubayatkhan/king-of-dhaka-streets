import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MusicPlayer, StepScheduler, sanitizeBeds } from '../src/musicplayer';
import { LOOP_SECONDS, STEP_SECONDS, STEPS_PER_BAR } from '../src/music';

const BAR = STEP_SECONDS * STEPS_PER_BAR;

describe('step scheduler', () => {
  it('hands out every step once, in order, however unevenly it is polled', () => {
    const s = new StepScheduler(.12); s.start(10); const seen: number[] = [];
    for (const now of [10, 10.01, 10.2, 10.21, 10.6, 11]) seen.push(...s.due(now));
    expect(seen).toEqual(Array.from({ length: seen.length }, (_, i) => i));
    expect(s.timeOf(seen.at(-1)!)).toBeLessThan(11 + .12);
  });
  it('skips steps that are already late after a stall instead of bursting them out', () => {
    const s = new StepScheduler(.12); s.start(0); s.due(0);
    const late = s.due(5);
    expect(late.every(step => s.timeOf(step) >= 5 - .05)).toBe(true);
  });
  it('finds the next bar line', () => { const s = new StepScheduler(); s.start(2); expect(s.nextBar(2 + BAR * 1.2)).toBeCloseTo(2 + BAR * 2, 9); });
});

describe('bed manifest', () => {
  it('accepts only beds cut to the music grid', () => {
    expect(sanitizeBeds({ bpm: 96, loopSeconds: 40, beds: { bazaar: 'bazaar.mp3', nope: 'x.mp3' } })).toEqual({ bpm: 96, loopSeconds: 40, beds: { bazaar: 'bazaar.mp3' } });
    expect(sanitizeBeds({ bpm: 100, loopSeconds: 40, beds: {} })).toBeUndefined();
    expect(sanitizeBeds(null)).toBeUndefined();
  });
});

class Param { setTargetAtTime = vi.fn(); value = 0; }
class Source { buffer: unknown = null; loop = false; connect = vi.fn(); disconnect = vi.fn(); start = vi.fn(); stop = vi.fn(); }
const makeHost = (beds?: Record<string, string>, delay = 0) => {
  const sources: Source[] = [], played: { when: number }[] = [];
  const context = { currentTime: 0, createGain: () => ({ gain: new Param(), connect: vi.fn() }), createBufferSource: () => { const s = new Source(); sources.push(s); return s; } };
  let resolveBed: (() => void) | undefined;
  const host = {
    context: context as unknown as AudioContext, output: {} as AudioNode, base: '/',
    play: vi.fn((_: unknown, when: number) => played.push({ when })),
    fetchJson: vi.fn(async () => beds ? { bpm: 96, loopSeconds: 40, beds } : undefined),
    fetchBuffer: vi.fn(() => new Promise<AudioBuffer | undefined>(r => { resolveBed = () => r({ duration: LOOP_SECONDS } as AudioBuffer); if (!delay) resolveBed(); })),
  };
  return { host, context, sources, played, arrive: () => resolveBed?.() };
};
const ride = { scene: 'bazaar' as const, speed: .5, combo: 0, boost: false, playing: true };

describe('music player', () => {
  beforeEach(() => vi.useFakeTimers()); afterEach(() => vi.useRealTimers());

  it('runs one scheduler however often the state is set, and stops cleanly', () => {
    const { host } = makeHost(), p = new MusicPlayer(host), spy = vi.spyOn(globalThis, 'setInterval');
    for (let i = 0; i < 5; i++) p.setState(ride);
    expect(spy).toHaveBeenCalledTimes(1);
    p.setState({ ...ride, playing: false }); expect(vi.getTimerCount()).toBe(0);
  });

  it('synthesizes the base layer when no bed has been shipped', async () => {
    const { host, context, played } = makeHost(); const p = new MusicPlayer(host);
    p.setState(ride); await vi.advanceTimersByTimeAsync(0);
    context.currentTime = 1; vi.advanceTimersByTime(30);
    expect(played.length).toBeGreaterThan(0);
  });

  it('joins a bed that arrives mid-ride on the next bar, aligned to the loop, and drops the synthesized base from there', async () => {
    const h = makeHost({ bazaar: 'bazaar.mp3' }, 1), p = new MusicPlayer(h.host);
    p.setState(ride); await vi.advanceTimersByTimeAsync(0);
    h.context.currentTime = BAR * 2.5; h.arrive(); await vi.advanceTimersByTimeAsync(0);
    const bed = h.sources.at(-1)!, [when, offset] = bed.start.mock.calls[0] as [number, number];
    expect(bed.loop).toBe(true);
    expect(when).toBeCloseTo(.05 + BAR * 3, 6); expect(offset).toBeCloseTo(BAR * 3 % LOOP_SECONDS, 6);
  });

  it('never leaves more than one bed playing across twenty retries', async () => {
    const h = makeHost({ bazaar: 'bazaar.mp3' }), p = new MusicPlayer(h.host);
    for (let i = 0; i < 20; i++) { p.setState(ride); await vi.advanceTimersByTimeAsync(0); p.setState({ ...ride, playing: false }); }
    p.setState(ride); await vi.advanceTimersByTimeAsync(0);
    expect(h.sources.filter(s => s.start.mock.calls.length && !s.stop.mock.calls.length)).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(1);
  });
});
