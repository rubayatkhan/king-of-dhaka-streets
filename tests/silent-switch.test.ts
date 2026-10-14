import { describe, expect, it } from 'vitest';
import { playThroughSilentSwitch, silentWav } from '../src/silent-switch';

const IPHONE = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15', platform: 'iPhone', maxTouchPoints: 5 };
const IPAD_AS_MAC = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', platform: 'MacIntel', maxTouchPoints: 5 };
const ANDROID = { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/129.0', platform: 'Linux armv8l', maxTouchPoints: 5 };

function fakeAudio() {
  const el = { src: '', loop: false, plays: 0, paused: true, play() { this.plays++; this.paused = false; return Promise.resolve(); }, pause() { this.paused = true; } };
  return el;
}

describe('playing through the iPhone silent switch', () => {
  it('asks Safari to treat the game as media playback when the Audio Session API exists', () => {
    const session = { type: 'auto' };
    const made: ReturnType<typeof fakeAudio>[] = [];
    const route = playThroughSilentSwitch({ ...IPHONE, audioSession: session }, () => { const a = fakeAudio(); made.push(a); return a; });
    expect(route.kind).toBe('session');
    expect(session.type).toBe('playback');
    expect(made).toHaveLength(0);
  });

  it('falls back to a looping silent media element on older iPhones and iPads', () => {
    for (const device of [IPHONE, IPAD_AS_MAC]) {
      const el = fakeAudio();
      const route = playThroughSilentSwitch(device, () => el);
      expect(route.kind).toBe('element');
      expect(el.loop).toBe(true);
      expect(el.src.startsWith('data:audio/wav;base64,')).toBe(true);
      expect(el.plays).toBe(1);
    }
  });

  it('leaves other phones alone, since only iOS mutes web audio with the ringer switch', () => {
    const el = fakeAudio();
    expect(playThroughSilentSwitch(ANDROID, () => el).kind).toBe('none');
    expect(el.plays).toBe(0);
  });

  it('restarts the fallback element on a later tap after iOS paused it, and stops it on mute', () => {
    const el = fakeAudio();
    const route = playThroughSilentSwitch(IPHONE, () => el);
    el.pause();
    route.resume();
    expect(el.plays).toBe(2);
    route.stop();
    expect(el.paused).toBe(true);
  });
});

describe('the silent clip', () => {
  it('is a valid, short, all-silent WAV', () => {
    const bytes = Uint8Array.from(atob(silentWav().split(',')[1]), c => c.charCodeAt(0));
    const text = (from: number) => String.fromCharCode(...bytes.slice(from, from + 4));
    expect(text(0)).toBe('RIFF');
    expect(text(8)).toBe('WAVE');
    expect(text(36)).toBe('data');
    expect(bytes.length).toBeLessThan(2000);
    expect(bytes.slice(44).every(b => b === 128)).toBe(true); // 8-bit PCM silence sits at the midpoint
  });
});
