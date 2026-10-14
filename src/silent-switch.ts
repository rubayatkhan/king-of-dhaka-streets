// iOS mutes web audio when the ringer switch is on silent, but not media such as video.
// The family chose to let the game play through the switch like a video; the in-game speaker button is the mute.

export interface SilentSwitchDevice {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  audioSession?: { type: string };
}
export interface MediaElement { src: string; loop: boolean; play(): Promise<void> | void; pause(): void; paused: boolean }
export interface SilentSwitchRoute { kind: 'session' | 'element' | 'none'; resume(): void; stop(): void }

const isIOS = (d: SilentSwitchDevice) => /iP(hone|ad|od)/.test(d.userAgent) || (d.platform === 'MacIntel' && d.maxTouchPoints > 1);
const quietly = (el: MediaElement) => { try { void Promise.resolve(el.play()).catch(() => {}); } catch { /* A later tap retries. */ } };

/** Call from a user gesture. Safari 17+ takes the Audio Session API; older iOS needs a looping silent media element playing. */
export function playThroughSilentSwitch(device: SilentSwitchDevice, makeAudio: () => MediaElement): SilentSwitchRoute {
  const none: SilentSwitchRoute = { kind: 'none', resume() {}, stop() {} };
  if (device.audioSession) { device.audioSession.type = 'playback'; return { ...none, kind: 'session' }; }
  if (!isIOS(device)) return none;
  const el = makeAudio();
  el.src = silentWav(); el.loop = true;
  quietly(el);
  return { kind: 'element', resume: () => { if (el.paused) quietly(el); }, stop: () => el.pause() };
}

/** A tenth of a second of 8-bit mono silence as a WAV data URI. */
export function silentWav(seconds = 0.1, rate = 8000): string {
  const samples = Math.round(seconds * rate), bytes = new Uint8Array(44 + samples), view = new DataView(bytes.buffer);
  const text = (at: number, s: string) => { for (let i = 0; i < s.length; i++) bytes[at + i] = s.charCodeAt(i); };
  text(0, 'RIFF'); view.setUint32(4, 36 + samples, true); text(8, 'WAVE');
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true);
  text(36, 'data'); view.setUint32(40, samples, true); bytes.fill(128, 44);
  let binary = ''; for (const b of bytes) binary += String.fromCharCode(b);
  return `data:audio/wav;base64,${btoa(binary)}`;
}
