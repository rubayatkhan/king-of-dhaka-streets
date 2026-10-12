/** CC0 street ambience, original effects, and street calls: the family's recording, else a bundled AI voice, else a caption. */
import { DEFAULT_HORN, HORNS, JUMP_SOUND, SOUNDS, coinRecipe, transpose, type HornId, type Note, type Recipe, type ToneNote } from './soundbank';
import type { VehicleKind } from './simulation';
import { asDistrict, streetCue, type Cue } from './soundscape';
import { MEDAL, type MusicState } from './music';
import { MusicPlayer } from './musicplayer';
import { lineById, linesFor, sanitizeManifest, voiceSource, voiceUrl, type District, type VoiceLine, type VoiceManifest } from './voices';
export interface StreetAudioContext {
  neighborhood: string;
  intensity: number;
  rear?: { kind: string; urgency: number; x: number };
  traffic?: readonly { kind: string; x: number; z: number; speed: number }[];
  playerZ?: number;
  effects?: { boost: number; boostFraction: number; magnet: number };
}
const finite = (value: number, fallback = 0) => Number.isFinite(value) ? value : fallback;
const bound = (value: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, finite(value)));
/** A plain tone note: frequency, duration, volume, wave, then its start offset and glide target. */
const tn = (f: number, dur: number, vol: number, wave: OscillatorType = 'sine', at = 0, to?: number): ToneNote => ({ kind: 'tone', f, dur, vol, wave, at, ...(to ? { to } : {}) });
type EngineLayer = { oscillator: OscillatorNode; gain: GainNode; pan: StereoPannerNode };

export class GameAudio {
  muted = false;
  onCaption?: (line: VoiceLine) => void;
  private context?: AudioContext;
  private master?: GainNode;
  private ambience?: GainNode;
  private wind?: GainNode;
  private engine?: GainNode;
  private engineOsc?: OscillatorNode;
  private pedal?: GainNode;
  private pedalOsc?: OscillatorNode;
  private noise?: AudioBuffer;
  private active = false;
  private crowd?: GainNode;
  private river?: GainNode;
  private trafficEngines: EngineLayer[] = [];
  private rearEngine?: EngineLayer;
  private kettle?: EngineLayer;
  private nextTong = 0;
  private temporary = new Set<() => void>();
  private duckUntil = 0;
  private warningUntil = 0;
  private nextRearHorn = 0;
  private lastReward = -10;
  private lastWarning = new Map<string, number>();
  private streetBeat = 0;
  private manifest: VoiceManifest = {};
  private manifestLoad?: Promise<void>;
  private voiceBuffers = new Map<string, AudioBuffer>();
  private voiceLoads = new Map<string, Promise<void>>();
  private lastLine = new Map<string, number>();
  private lastCall = -Infinity;
  private speechSource?: AudioBufferSourceNode;
  private fieldLoad?: Promise<void>;
  private fieldBuffer?: AudioBuffer;
  private fieldGain?: GainNode;
  private fieldSource?: AudioBufferSourceNode;
  private fieldOffset = 0;
  private fieldStartedAt = 0;
  private nextStreetSound = 0;
  private lastHorn = -10;
  private lastPreview = -10;
  private lastImpact = -10;
  private lastJump = -10;
  private lastCoin = -10;
  private musicBus?: GainNode;
  private music?: MusicPlayer;
  musicOn = true;

  constructor(private clock: () => number = () => performance.now() / 1000) {}

  async init(): Promise<void> {
    if (!this.context) {
      const AudioClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioClass) return;
      const ctx = this.context = new AudioClass();
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.knee.value = 20;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.005;
      compressor.release.value = 0.2;
      compressor.connect(ctx.destination);
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.48;
      this.master.connect(compressor);
      this.ambience = ctx.createGain();
      this.ambience.gain.value = 0;
      this.ambience.connect(this.master);
      this.fieldGain = ctx.createGain();
      this.fieldGain.gain.value = 0;
      // Recorded horns belong to the background mix, so urgent cues duck them too.
      this.fieldGain.connect(this.ambience);
      this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.55; this.musicBus.connect(this.master);
      this.music = new MusicPlayer({
        context: ctx, output: this.musicBus, base: import.meta.env.BASE_URL,
        play: (recipe, when, out) => this.schedule(recipe, when, out),
        fetchJson: async url => { const r = await fetch(url); return r.ok ? r.json() : undefined; },
        fetchBuffer: async url => { const r = await fetch(url); return r.ok ? ctx.decodeAudioData(await r.arrayBuffer()) : undefined; },
      });

      this.noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
      const samples = this.noise.getChannelData(0);
      let previous = 0;
      for (let i = 0; i < samples.length; i++) {
        previous = (previous + (Math.random() * 2 - 1) * 0.07) / 1.035;
        samples[i] = previous * 3;
      }
      this.noiseLayer('lowpass', 310, 0.2, this.ambience);
      this.noiseLayer('bandpass', 900, 0.055, this.ambience);
      this.wind = this.noiseLayer('highpass', 720, 0, this.ambience);
      // Filtered original noise suggests a crowd bed and launch/river hiss;
      // these are synthesized textures, not field recordings of Dhaka.
      this.crowd = this.noiseLayer('bandpass', 1250, 0, this.ambience);
      this.river = this.noiseLayer('lowpass', 550, 0, this.ambience);
      this.trafficEngines = [this.engineLayer(this.ambience), this.engineLayer(this.ambience)];
      this.rearEngine = this.engineLayer(this.master);
      // A kettle whistle rises while cha's boost lasts.
      const kettleOsc = ctx.createOscillator(), kettleGain = ctx.createGain(), kettlePan = ctx.createStereoPanner();
      kettleOsc.type = 'sine'; kettleOsc.frequency.value = 1500; kettleGain.gain.value = 0;
      (kettleGain as GainNode & { kettle?: boolean }).kettle = true;
      kettleOsc.connect(kettleGain).connect(kettlePan).connect(this.master); kettleOsc.start();
      this.kettle = { oscillator: kettleOsc, gain: kettleGain, pan: kettlePan };

      this.engine = ctx.createGain();
      this.engine.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 240;
      this.engineOsc = ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 48;
      this.engineOsc.connect(engineFilter).connect(this.engine).connect(this.ambience);
      this.engineOsc.start();

      this.pedal = ctx.createGain();
      this.pedal.gain.value = 0;
      this.pedalOsc = ctx.createOscillator();
      this.pedalOsc.type = 'triangle';
      this.pedalOsc.frequency.value = 95;
      this.pedalOsc.connect(this.pedal).connect(this.ambience);
      this.pedalOsc.start();
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.active = false;
          this.ambience?.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
          this.silenceRide();
        }
      });
    }
    try { await this.context.resume(); } catch { /* A later user gesture can retry. */ }
    if (!this.manifestLoad) { this.manifestLoad = this.loadManifest(); void this.prepareDistrict(); }
    this.fieldLoad ??= this.loadField();
  }

  setMuted(value: boolean): void {
    this.muted = value;
    if (this.context) this.master?.gain.setTargetAtTime(value ? 0 : 0.48, this.context.currentTime, 0.03);
    if (value) this.silenceRide();
  }

  /** The adaptive music follows the screen, district, speed, combo and cha; muted, hidden or switched off means silence. */
  setMusic(state: MusicState): void {
    const ctx = this.context;
    if (!ctx || !this.music) return;
    const audible = state.playing && this.musicOn && !this.muted && !document.hidden && ctx.state === 'running';
    this.music.setState({ ...state, playing: audible });
    this.musicBus?.gain.setTargetAtTime(ctx.currentTime < this.duckUntil ? 0.2 : 0.55, ctx.currentTime, 0.08);
  }
  setMusicOn(on: boolean): void { this.musicOn = on; if (!on) this.music?.stop(); }
  /** A dhol flourish for a medal, and the family's crowd shout for the final crown. */
  medal(final: boolean): void {
    if (!this.context || this.muted) return;
    this.schedule(MEDAL, this.context.currentTime + 0.05, this.master!);
    // The ride has already ended, so the shout plays straight from its buffer rather than through say(), which needs a live ride.
    const shout = final && !document.hidden && this.context.state === 'running' ? this.voiceBuffers.get('crowd-king') : undefined;
    if (shout) this.speak(shout);
  }

  update(speed: number, vehicle: string, active: boolean, street?: StreetAudioContext): void {
    const nextActive = active && !document.hidden;
    if (this.active && !nextActive) this.silenceRide();
    this.active = nextActive;
    const ctx = this.context;
    if (!ctx || !this.ambience) return;
    const now = ctx.currentTime;
    const movement = Math.max(0, Math.min(1.5, Number.isFinite(speed) ? speed / 20 : 0));
    const cycling = /bicycle|rickshaw|cycle/i.test(vehicle);
    const playing = this.active && !this.muted && ctx.state === 'running';
    const intensity = bound(street?.intensity ?? 0.45);
    const district = asDistrict(street?.neighborhood);
    const river = district === 'riverfront', market = district === 'bazaar';
    this.syncField(playing);
    this.fieldGain?.gain.setTargetAtTime(playing ? (river ? 0.42 : market ? 0.72 : 0.85) * (0.8 + intensity * 0.2) : 0, now, 0.65);
    const normalLevel = 0.57 + intensity * 0.22;
    this.ambience.gain.setTargetAtTime(playing ? normalLevel * (now < this.duckUntil ? 0.23 : 1) : 0, now, 0.08);
    this.crowd?.gain.setTargetAtTime((this.fieldBuffer ? 0.35 : 1) * (market ? 0.09 : 0.045) * (0.65 + intensity) * (0.82 + 0.18 * Math.sin(now * 1.7)), now, 0.3);
    this.river?.gain.setTargetAtTime(river ? 0.11 + Math.sin(now * 0.65) * 0.03 : 0, now, 0.7);
    const withDistance = (street?.traffic ?? []).map(t => ({ actor: t, distance: Math.abs(t.z - finite(street?.playerZ ?? 0)) }))
      .filter(t => t.distance < 55).sort((a, b) => a.distance - b.distance);
    // Street cues hear every vehicle that has a voice (rickshaw bells included); only engine vehicles get a continuous engine layer.
    const nearby = withDistance.filter(t => /bus|truck|car|cng|motorbike/.test(t.actor.kind)).slice(0, 2);
    const cueActors = withDistance.filter(t => /rickshaw|bus|truck|car|cng|motorbike/.test(t.actor.kind));
    this.trafficEngines.forEach((layer, i) => {
      const near = nearby[i], actor = near?.actor;
      const heavy = actor && /bus|truck/.test(actor.kind);
      layer.gain.gain.setTargetAtTime(playing && near ? (0.014 + intensity * 0.025) * (1 - near.distance / 55) : 0, now, 0.15);
      layer.oscillator.type = actor?.kind === 'cng' ? 'square' : 'sawtooth';
      layer.oscillator.frequency.setTargetAtTime((actor?.kind === 'cng' ? 26 : heavy ? 36 : 67) + bound(actor?.speed ?? 0, 0, 45) * 2.4, now, 0.18);
      layer.pan.pan.setTargetAtTime(bound((actor?.x ?? 0) / 5.3, -0.95, 0.95), now, 0.14);
    });
    const rear = street?.rear, urgency = bound(rear?.urgency ?? 0);
    if (this.rearEngine) {
      this.rearEngine.gain.gain.setTargetAtTime(playing && rear ? 0.018 + urgency * 0.075 : 0, now, 0.10);
      this.rearEngine.oscillator.frequency.setTargetAtTime((rear?.kind === 'truck' ? 35 : 46) + urgency * 29, now, 0.12);
      this.rearEngine.pan.pan.setTargetAtTime(bound((rear?.x ?? 0) / 5.3, -0.95, 0.95), now, 0.08);
    }
    if (playing && rear && now >= this.nextRearHorn) {
      this.nextRearHorn = now + 1.5 - urgency * 0.85;
      this.warning('rear', bound(rear.x / 5.3, -0.95, 0.95));
    }
    const fx = street?.effects;
    this.kettle?.gain.gain.setTargetAtTime(playing && (fx?.boost ?? 0) > 0 ? 0.012 : 0, now, 0.08);
    this.kettle?.oscillator.frequency.setTargetAtTime(1500 + (1 - bound(fx?.boostFraction ?? 0)) * 900, now, 0.3);
    if (playing && (fx?.magnet ?? 0) > 0 && now >= this.nextTong) { this.nextTong = now + 0.9; this.play(SOUNDS.jhalmuri); }
    this.wind?.gain.setTargetAtTime(movement * 0.2, now, 0.12);
    this.engine?.gain.setTargetAtTime(cycling ? 0 : 0.055 + movement * 0.065, now, 0.12);
    this.engineOsc?.frequency.setTargetAtTime((/truck/i.test(vehicle) ? 30 : 45) + movement * 75, now, 0.15);
    this.pedal?.gain.setTargetAtTime(cycling ? movement * (0.018 + 0.013 * Math.sin(now * (5 + movement * 8))) : 0, now, 0.025);
    this.pedalOsc?.frequency.setTargetAtTime(85 + movement * 30, now, 0.2);
    // Street cues run with the sound off too: say() captions the puller's call on its own, and cue() only sounds when ready().
    if (this.active && ctx.state === 'running' && !document.hidden && now > this.nextStreetSound && now >= this.warningUntil) {
      this.nextStreetSound = now + 1.9 - intensity * 1.05 + Math.random() * 1.4;
      this.cue(streetCue({ district, beat: ++this.streetBeat, nearby: cueActors.map(n => ({ kind: n.actor.kind, x: n.actor.x, distance: n.distance })), random: Math.random }));
    }
  }

  /** Plays a street cue: its sound into the ambience (so warnings duck it), then its voice line if it has one. */
  cue(cue?: Cue): void {
    if (!cue) return;
    if (cue.sound && this.ready()) this.play(SOUNDS[cue.sound], cue.pan, true);
    if (cue.voice) this.say(cue.voice);
  }

  /** Clear a previous mission without rebuilding the graph or decoding clips again. */
  resetRide(): void {
    this.active = false; this.silenceRide();
    this.fieldOffset = 0;
    this.lastHorn = this.lastImpact = this.lastReward = this.lastJump = this.lastCoin = -10;
    this.nextStreetSound = this.context?.currentTime ?? 0;
    this.nextRearHorn = this.context?.currentTime ?? 0;
    this.duckUntil = this.warningUntil = 0; this.streetBeat = 0;
    this.lastWarning.clear(); this.lastLine.clear(); this.lastCall = -Infinity;
  }

  warning(kind: 'rear' | 'paan' | 'cow', pan = 0): void {
    if (!this.ready()) return;
    const now = this.context!.currentTime;
    if (now - (this.lastWarning.get(kind) ?? -10) < 0.2) return;
    this.lastWarning.set(kind, now);
    this.warningUntil = Math.max(this.warningUntil, now + (kind === 'rear' ? 1.3 : 0.85));
    this.duckUntil = Math.max(this.duckUntil, this.warningUntil);
    this.ambience?.gain.setTargetAtTime(0.13, now, 0.025);
    this.stopSpeech();
    if (kind === 'rear') {
      this.play([tn(146.8, 0.53, 0.15, 'sawtooth'), tn(196, 0.47, 0.09, 'triangle', 0.07)], pan);
    } else if (kind === 'cow') {
      this.play([tn(127, 0.60, 0.095, 'triangle', 0, 87), tn(254, 0.35, 0.033, 'sine', 0.08, 174)], pan);
    } else {
      this.play([tn(860, 0.17, 0.07, 'triangle', 0, 280), tn(190, 0.12, 0.045, 'sine', 0.13)], pan);
    }
  }

  nearMiss(combo: number): void {
    if (!this.ready() || this.context!.currentTime - this.lastReward < 0.22) return;
    this.lastReward = this.context!.currentTime;
    this.play(transpose(SOUNDS['near-miss'], bound(combo, 0, 12) / 2));
  }

  horn(vehicle: string, horn?: HornId): void {
    if (!this.ready() || this.context!.currentTime - this.lastHorn < 0.32) return;
    this.lastHorn = this.context!.currentTime;
    this.play(HORNS[horn ?? DEFAULT_HORN[vehicle as VehicleKind] ?? 'car-horn']);
  }

  /** Plays a bell or horn in the Bazaar, outside a ride. */
  preview(horn: HornId): void {
    if (!this.context || this.muted || this.context.state !== 'running' || this.context.currentTime - this.lastPreview < 0.32) return;
    this.lastPreview = this.context.currentTime;
    this.play(HORNS[horn]);
  }

  impact(): void {
    if (!this.ready() || this.context!.currentTime - this.lastImpact < 0.18) return;
    this.lastImpact = this.context!.currentTime;
    this.play(SOUNDS.impact);
  }

  jump(vehicle: string): void {
    if (!this.ready() || this.context!.currentTime - this.lastJump < 0.25) return;
    this.lastJump = this.context!.currentTime;
    this.play(SOUNDS[JUMP_SOUND[vehicle as keyof typeof JUMP_SOUND] ?? 'jump-car']);
  }

  bump(): void { if (this.ready()) this.play(SOUNDS.pothole); }

  /** Successive coins climb a folk-style pentatonic scale, so a trail plays a short phrase; the ৳5 note is a deeper double jingle. */
  coin(chain: number, value: 1 | 5 = 1): void {
    if (!this.ready() || this.context!.currentTime - this.lastCoin < 0.05) return;
    this.lastCoin = this.context!.currentTime;
    this.play(coinRecipe(value, chain));
  }

  snack(kind: string): void { if (this.ready()) this.play(SOUNDS[kind === 'cha' ? 'cha' : kind === 'jhalmuri' ? 'jhalmuri' : 'chaap']); }
  stomach(): void { if (this.ready()) this.play(SOUNDS.stomach); }
  belly(): void { if (this.ready()) this.play(SOUNDS.belly); }

  reward(): void {
    if (!this.ready()) return;
    this.play([659, 880, 1319].map((note, i) => tn(note, 0.25, 0.07, 'sine', i * 0.075)));
  }

  finish(): void {
    if (!this.context || this.muted) return;
    this.play([392, 494, 587, 784, 988].map((note, i) => tn(note, 0.55, 0.11, 'triangle', i * 0.11)));
  }

  loss(): void {
    if(!this.context||this.muted)return;
    this.play([tn(73, .45, .22), tn(220, .35, .08, 'triangle', .08, 110)]);
  }

  /** Decodes the voice lines for one district (or, with no district, the lines heard everywhere) the first time they are needed. */
  async prepareDistrict(district?: District): Promise<void> {
    if (district) this.music?.prepare(district);
    await this.manifestLoad;
    await Promise.all(linesFor(district).map(line => this.loadVoice(line.id)));
  }

  /** Captions a line whenever it may happen now, and plays it when sound is on and its audio is ready. Returns whether audio played. */
  say(id: string): boolean {
    const line = lineById(id);
    if (!line) return false;
    const now = this.clock();
    if (now - (this.lastLine.get(id) ?? -Infinity) < (line.cooldown ?? 0)) return false;
    if (!line.reaction && now - this.lastCall < 7) return false;
    if (this.context && this.context.currentTime < this.warningUntil) return false;
    this.lastLine.set(id, now); if (!line.reaction) this.lastCall = now;
    this.onCaption?.(line);
    const buffer = this.voiceBuffers.get(id);
    if (!buffer || !this.ready()) return false;
    this.speak(buffer);
    return true;
  }

  /** Plays a decoded line, replacing any line already speaking, and ducks the street under it. */
  private speak(buffer: AudioBuffer): void {
    this.stopSpeech();
    const source = this.context!.createBufferSource();
    source.buffer = buffer;
    this.duckUntil = Math.max(this.duckUntil, this.context!.currentTime + (buffer.duration || 3));
    source.connect(this.master!);
    this.speechSource = source;
    source.onended = () => { source.disconnect(); if (this.speechSource === source) this.speechSource = undefined; };
    source.start();
  }

  private stopSpeech(): void {
    if (this.speechSource) { try { this.speechSource.stop(); } catch { /* Already ended. */ } this.speechSource = undefined; }
  }

  private loadVoice(id: string): Promise<void> {
    const source = voiceSource(id, this.manifest);
    if (source === 'caption' || !this.context) return Promise.resolve();
    let load = this.voiceLoads.get(id);
    if (!load) {
      load = (async () => {
        try {
          const response = await fetch(voiceUrl(import.meta.env.BASE_URL, id, source));
          if (!response.ok) return;
          this.voiceBuffers.set(id, await this.context!.decodeAudioData(await response.arrayBuffer()));
        } catch { /* The caption still carries the line. */ }
      })();
      this.voiceLoads.set(id, load);
    }
    return load;
  }

  private async loadManifest(): Promise<void> {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}audio/voices/manifest.json`);
      if (response.ok) this.manifest = sanitizeManifest(await response.json());
    } catch { /* Without a manifest every line is caption-only. */ }
  }

  private async loadField(): Promise<void> {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}audio/dhaka-traffic-loop.mp3`);
      if (!response.ok) return;
      const buffer = await this.context!.decodeAudioData(await response.arrayBuffer());
      if (Number.isFinite(buffer.duration) && buffer.duration > 0) this.fieldBuffer = buffer;
      // Playback starts in update only, never from an asynchronous load callback.
    } catch { /* Original synthesis remains playable if the recording is unavailable. */ }
  }

  private syncField(playing: boolean): void {
    if (!playing) { this.stopField(); return; }
    if (this.fieldSource || !this.fieldBuffer || !this.fieldGain || !this.context) return;
    const source = this.context.createBufferSource();
    source.buffer = this.fieldBuffer; source.loop = true;
    source.connect(this.fieldGain);
    source.start(0, this.fieldOffset);
    this.fieldStartedAt = this.context.currentTime;
    this.fieldSource = source;
  }

  private stopField(): void {
    if (!this.fieldSource) return;
    this.fieldOffset = (this.fieldOffset + Math.max(0, this.context!.currentTime - this.fieldStartedAt)) % this.fieldBuffer!.duration;
    try { this.fieldSource.stop(); } catch { /* Already stopped. */ }
    this.fieldSource.disconnect(); this.fieldSource = undefined;
  }

  private silenceRide(): void {
    this.stopSpeech();
    this.stopField();
    this.music?.stop(); // Mute, a hidden tab and every ride start or end stop the music too.
    for (const stop of [...this.temporary]) stop();
    const now = this.context?.currentTime ?? 0;
    this.ambience?.gain.setTargetAtTime(0, now, 0.025);
    this.rearEngine?.gain.gain.setTargetAtTime(0, now, 0.025);
    this.kettle?.gain.gain.setTargetAtTime(0, now, 0.025); this.nextTong = 0;
  }

  private engineLayer(output: AudioNode): EngineLayer {
    const ctx = this.context!, oscillator = ctx.createOscillator(), gain = ctx.createGain(), pan = ctx.createStereoPanner();
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 190;
    gain.gain.value = 0; oscillator.type = 'sawtooth'; oscillator.frequency.value = 45;
    oscillator.connect(filter).connect(gain).connect(pan).connect(output); oscillator.start();
    return { oscillator, gain, pan };
  }

  private ready(): boolean { return !!this.context && this.active && !this.muted && this.context.state === 'running'; }

  private noiseLayer(type: BiquadFilterType, frequency: number, volume: number, output: AudioNode): GainNode {
    const ctx = this.context!;
    const source = ctx.createBufferSource();
    source.buffer = this.noise!;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = 0.6;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(output);
    source.start();
    return gain;
  }

  /** Plays a recipe now (plus delay), panned, into the ride mix or the ambience bus. */
  play(recipe: Recipe, pan = 0, ambient = false, delay = 0): void {
    const ctx = this.context;
    if (!ctx || !this.master) return;
    this.schedule(recipe, ctx.currentTime + delay, ambient ? this.ambience! : this.master, pan);
  }

  private schedule(recipe: Recipe, at: number, out: AudioNode, pan = 0): void {
    const ctx = this.context;
    if (!ctx || this.muted || ctx.state !== 'running' || document.hidden) return;
    for (const note of recipe) this.note(note, at + (note.at ?? 0), out, pan);
  }

  private note(note: Note, at: number, out: AudioNode, pan: number): void {
    const ctx = this.context!, envelope = ctx.createGain(), panner = ctx.createStereoPanner();
    panner.pan.value = bound(pan, -1, 1);
    const nodes: AudioNode[] = [envelope, panner];
    let source: AudioScheduledSourceNode, head: AudioNode;
    if (note.kind === 'tone') {
      const osc = ctx.createOscillator(); osc.type = note.wave; osc.frequency.value = note.f;
      if (note.to) { osc.frequency.setValueAtTime(note.f, at); osc.frequency.exponentialRampToValueAtTime(note.to, at + note.dur); }
      if (note.vibrato) {
        const lfo = ctx.createOscillator(), depth = ctx.createGain(); lfo.frequency.value = note.vibrato; depth.gain.value = note.f * 0.012;
        lfo.connect(depth).connect(osc.frequency); lfo.start(at); lfo.stop(at + note.dur + 0.03); nodes.push(lfo, depth);
      }
      source = osc; head = osc;
      if (note.lowpass) { const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = note.lowpass; head = head.connect(filter); nodes.push(filter); }
    } else {
      const noise = ctx.createBufferSource(), filter = ctx.createBiquadFilter();
      noise.buffer = this.noise!; filter.type = note.filter; filter.frequency.value = note.f; filter.Q.value = note.q ?? 0.8;
      if (note.to) { filter.frequency.setValueAtTime(note.f, at); filter.frequency.exponentialRampToValueAtTime(note.to, at + note.dur); }
      source = noise; head = noise.connect(filter); nodes.push(filter);
    }
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(Math.min(0.3, note.vol), at + (note.kind === 'tone' ? note.attack ?? 0.012 : 0.005));
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + note.dur);
    head.connect(envelope).connect(panner).connect(out);
    const cleanup = () => { source.disconnect(); for (const node of nodes) node.disconnect(); this.temporary.delete(stop); };
    const stop = () => { try { source.stop(); } catch { /* Already ended. */ } cleanup(); };
    this.temporary.add(stop); source.onended = cleanup;
    source.start(at); source.stop(at + note.dur + 0.03);
  }
}
