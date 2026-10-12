import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MusicPlayer, StepScheduler, sanitizeBeds } from '../src/musicplayer';
import { readFileSync } from 'node:fs';
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
  it('ships a valid empty manifest, so the page asks for no missing file until beds are mastered', () => {
    expect(sanitizeBeds(JSON.parse(readFileSync('public/audio/music/manifest.json', 'utf8')))).toEqual({ bpm: 96, loopSeconds: 40, beds: {} });
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
    expect(bed.loop).toBe(true); expect((bed as unknown as { loopStart: number; loopEnd: number }).loopStart).toBe(0); expect((bed as unknown as { loopEnd: number }).loopEnd).toBe(LOOP_SECONDS);
    expect(when).toBeCloseTo(.05 + BAR * 3, 6); expect(offset).toBeCloseTo(BAR * 3 % LOOP_SECONDS, 6);
  });

  it('never leaves more than one bed playing across twenty retries', async () => {
    const h = makeHost({ bazaar: 'bazaar.mp3' }), p = new MusicPlayer(h.host);
    for (let i = 0; i < 20; i++) { p.setState(ride); await vi.advanceTimersByTimeAsync(0); p.setState({ ...ride, playing: false }); }
    p.setState(ride); await vi.advanceTimersByTimeAsync(0);
    expect(h.sources.filter(s => s.start.mock.calls.length && !s.stop.mock.calls.length)).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('keeps the outgoing bed in charge of its scene until the bar where the next scene takes over', async () => {
    const h = makeHost({ bazaar: 'bazaar.mp3' }), p = new MusicPlayer(h.host);
    p.setState(ride); await vi.advanceTimersByTimeAsync(0);
    const bazaarBed = h.sources[0], base = (p as unknown as { layers: { base: unknown } }).layers.base;
    h.context.currentTime = BAR * 1.5; p.setState({ ...ride, scene: 'riverfront' });
    const switchAt = .05 + BAR * 2, from = h.host.play.mock.calls.length;
    while (h.context.currentTime < switchAt + .3) { h.context.currentTime += .02; vi.advanceTimersByTime(25); }
    const baseCalls = (h.host.play.mock.calls.slice(from) as unknown as [unknown, number, unknown][]).filter(([, , out]) => out === base);
    expect(baseCalls.filter(([, when]) => when < switchAt - 1e-9)).toEqual([]);
    expect(baseCalls.some(([, when]) => when >= switchAt - 1e-9)).toBe(true);
    expect(bazaarBed.stop.mock.calls.at(-1)![0]).toBeCloseTo(switchAt, 9);
  });

  it('stops scheduling a layer that has been silent for a while, and resumes when it comes back', async () => {
    const h = makeHost(), p = new MusicPlayer(h.host), layers = (p as unknown as { layers: Record<string, unknown> }).layers;
    const run = (seconds: number) => { const end = h.context.currentTime + seconds; while (h.context.currentTime < end) { h.context.currentTime += .02; vi.advanceTimersByTime(25); } };
    const boostPlays = (from: number) => (h.host.play.mock.calls.slice(from) as unknown as [unknown, number, unknown][]).filter(([, , out]) => out === layers.boost);
    p.setState({ ...ride, boost: true }); await vi.advanceTimersByTimeAsync(0); run(3);
    expect(boostPlays(0).length).toBeGreaterThan(0);
    p.setState(ride); const afterOff = h.host.play.mock.calls.length;
    run(1.4); expect(boostPlays(afterOff).length).toBeGreaterThan(0); // its fade-out still completes
    run(3); const silent = h.host.play.mock.calls.length; run(3);
    expect(boostPlays(silent)).toEqual([]);
    p.setState({ ...ride, boost: true }); const back = h.host.play.mock.calls.length; run(3);
    expect(boostPlays(back).length).toBeGreaterThan(0);
  });

  it('stops an outgoing bed straight away when the music stops before the bar where it was due to end', async () => {
    const h = makeHost({ bazaar: 'bazaar.mp3' }), p = new MusicPlayer(h.host);
    p.setState(ride); await vi.advanceTimersByTimeAsync(0);
    const bazaarBed = h.sources[0];
    h.context.currentTime = BAR * 1.5; p.setState({ ...ride, scene: 'riverfront' });
    const switchAt = .05 + BAR * 2;
    expect(bazaarBed.stop.mock.calls.at(-1)![0]).toBeCloseTo(switchAt, 9);
    h.context.currentTime = BAR * 1.6; p.stop();
    expect(bazaarBed.stop.mock.calls.at(-1)![0]).toBeLessThanOrEqual(h.context.currentTime);
    expect((p as unknown as { outgoing: unknown[] }).outgoing).toEqual([]);
  });

  it('ignores a decoded bed shorter than the loop', async () => {
    const h = makeHost({ bazaar: 'bazaar.mp3' }), p = new MusicPlayer(h.host);
    h.host.fetchBuffer.mockImplementation(async () => ({ duration: LOOP_SECONDS - .2 } as AudioBuffer));
    p.setState(ride); await vi.advanceTimersByTimeAsync(0);
    expect(h.sources).toHaveLength(0);
  });
});
