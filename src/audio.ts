/** CC0 street ambience, original effects, and street calls: the family's recording, else a bundled AI voice, else a caption. */
import { lineById, linesFor, sanitizeManifest, voiceSource, voiceUrl, type District, type VoiceLine, type VoiceManifest } from './voices';
export interface StreetAudioContext {
  neighborhood: string;
  intensity: number;
  rear?: { kind: string; urgency: number; x: number };
  traffic?: readonly { kind: string; x: number; z: number; speed: number }[];
  playerZ?: number;
}
const finite = (value: number, fallback = 0) => Number.isFinite(value) ? value : fallback;
const bound = (value: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, finite(value)));
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
  private lastImpact = -10;
  private lastJump = -10;
  private lastCoin = -10;

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
    const river = /sadar|river|ghat|buriganga/i.test(street?.neighborhood ?? '');
    const market = /shankhari|chawk|market|bazaar|old|puran/i.test(street?.neighborhood ?? 'old');
    this.syncField(playing);
    this.fieldGain?.gain.setTargetAtTime(playing ? (river ? 0.42 : market ? 0.72 : 0.85) * (0.8 + intensity * 0.2) : 0, now, 0.65);
    const normalLevel = 0.57 + intensity * 0.22;
    this.ambience.gain.setTargetAtTime(playing ? normalLevel * (now < this.duckUntil ? 0.23 : 1) : 0, now, 0.08);
    this.crowd?.gain.setTargetAtTime((this.fieldBuffer ? 0.35 : 1) * (market ? 0.09 : 0.045) * (0.65 + intensity) * (0.82 + 0.18 * Math.sin(now * 1.7)), now, 0.3);
    this.river?.gain.setTargetAtTime(river ? 0.11 + Math.sin(now * 0.65) * 0.03 : 0, now, 0.7);
    const nearby = (street?.traffic ?? []).filter(t => /bus|truck|car|cng|motorbike/.test(t.kind))
      .map(t => ({ actor:t, distance: Math.abs(t.z - finite(street?.playerZ ?? 0)) }))
      .filter(t => t.distance < 55).sort((a,b) => a.distance - b.distance).slice(0, 2);
    this.trafficEngines.forEach((layer, i) => {
      const near = nearby[i], actor = near?.actor;
      const heavy = actor && /bus|truck/.test(actor.kind);
      layer.gain.gain.setTargetAtTime(playing && near ? (0.014 + intensity * 0.025) * (1 - near.distance / 55) : 0, now, 0.15);
      layer.oscillator.frequency.setTargetAtTime((heavy ? 36 : 67) + bound(actor?.speed ?? 0, 0, 45) * 2.4, now, 0.18);
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
    this.wind?.gain.setTargetAtTime(movement * 0.2, now, 0.12);
    this.engine?.gain.setTargetAtTime(cycling ? 0 : 0.055 + movement * 0.065, now, 0.12);
    this.engineOsc?.frequency.setTargetAtTime((/truck/i.test(vehicle) ? 30 : 45) + movement * 75, now, 0.15);
    this.pedal?.gain.setTargetAtTime(cycling ? movement * (0.018 + 0.013 * Math.sin(now * (5 + movement * 8))) : 0, now, 0.025);
    this.pedalOsc?.frequency.setTargetAtTime(85 + movement * 30, now, 0.2);
    if (playing && now > this.nextStreetSound && now >= this.warningUntil) {
      this.nextStreetSound = now + 1.9 - intensity * 1.05 + Math.random() * 1.4;
      this.streetBeat++;
      const actor = nearby[this.streetBeat % Math.max(1, nearby.length)]?.actor;
      const pan = actor ? bound(actor.x / 5.3, -0.85, 0.85) : (this.streetBeat % 2 ? -0.7 : 0.7);
      if (river && this.streetBeat % 5 === 0) {
        this.tone(98, 1.15, 0.065, 'triangle', 0, -0.8, true, 87);
        this.tone(147, 0.95, 0.025, 'sine', 0.08, -0.8, true);
      } else if (/bus|truck/.test(actor?.kind ?? '')) {
        this.tone(174, 0.35, 0.07, 'sawtooth', 0, pan, true, 162);
        this.tone(233, 0.27, 0.045, 'triangle', 0.16, pan, true);
      } else if (actor) {
        this.tone(actor.kind === 'cng' ? 490 : 370, 0.18, 0.045, 'triangle', 0, pan, true);
        this.tone(440, 0.14, 0.032, 'triangle', 0.22, pan, true);
      } else {
        // Metal bell partials and short rattles keep slower lanes alive.
        this.tone(1370, 0.38, 0.042, 'sine', 0, pan, true);
        this.tone(2231, 0.21, 0.014, 'sine', 0.09, pan, true);
        this.tone(730, 0.09, 0.012, 'triangle', 0.19, pan, true);
      }
    }
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
      this.tone(146.8, 0.53, 0.15, 'sawtooth', 0, pan);
      this.tone(196, 0.47, 0.09, 'triangle', 0.07, pan);
    } else if (kind === 'cow') {
      this.tone(127, 0.60, 0.095, 'triangle', 0, pan, false, 87);
      this.tone(254, 0.35, 0.033, 'sine', 0.08, pan, false, 174);
    } else {
      this.tone(860, 0.17, 0.07, 'triangle', 0, pan, false, 280);
      this.tone(190, 0.12, 0.045, 'sine', 0.13, pan);
    }
  }

  nearMiss(combo: number): void {
    if (!this.ready() || this.context!.currentTime - this.lastReward < 0.22) return;
    this.lastReward = this.context!.currentTime;
    const base = 587.3 * Math.pow(2, bound(combo, 0, 12) / 24);
    this.tone(base, 0.15, 0.065, 'sine');
    this.tone(base * 1.5, 0.21, 0.045, 'sine', 0.07);
  }

  horn(vehicle: string): void {
    if (!this.ready() || this.context!.currentTime - this.lastHorn < 0.32) return;
    this.lastHorn = this.context!.currentTime;
    if (/bicycle|rickshaw|cycle/i.test(vehicle)) {
      this.tone(1568, 0.65, 0.17, 'sine');
      this.tone(2420, 0.35, 0.055, 'sine');
      this.tone(1568, 0.5, 0.1, 'sine', 0.13);
    } else if (/truck/i.test(vehicle)) {
      this.tone(116.5, 0.7, 0.16, 'sawtooth');
      this.tone(155.6, 0.65, 0.10, 'triangle');
      this.tone(233, 0.5, 0.04, 'sine');
    } else {
      this.tone(349, 0.3, 0.11, 'triangle');
      this.tone(440, 0.35, 0.08, 'triangle');
    }
  }

  impact(): void {
    if (!this.ready() || this.context!.currentTime - this.lastImpact < 0.18) return;
    this.lastImpact = this.context!.currentTime;
    this.tone(74, 0.22, 0.3, 'sine');
    this.tone(142, 0.09, 0.09, 'triangle');
  }

  jump(vehicle: string): void {
    if (!this.ready() || this.context!.currentTime - this.lastJump < 0.25) return;
    this.lastJump = this.context!.currentTime;
    // A low suspension thump for heavy vehicles, a springy rise for light ones.
    if (/car|truck/i.test(vehicle)) this.tone(92, 0.2, 0.16, 'sine', 0, 0, false, 62);
    else this.tone(330, 0.16, 0.07, 'triangle', 0, 0, false, 660);
    if (/bicycle/i.test(vehicle)) this.tone(1568, 0.3, 0.06, 'sine', 0.05);
  }

  bump(): void {
    if (!this.ready()) return;
    this.impact();
    [0, 0.05, 0.1].forEach(delay => this.tone(180 + delay * 400, 0.05, 0.05, 'square', delay));
  }

  coin(chain: number): void {
    if (!this.ready() || this.context!.currentTime - this.lastCoin < 0.05) return;
    this.lastCoin = this.context!.currentTime;
    // Successive coins climb a folk-style pentatonic scale, so a trail plays a short phrase.
    const scale = [0, 2, 3, 7, 9, 12, 14, 15, 19], step = scale[(Math.max(1, Math.floor(chain) || 1) - 1) % scale.length];
    this.tone(1046.5 * Math.pow(2, step / 12), 0.12, 0.06, 'triangle');
  }

  snack(kind: string): void {
    if (!this.ready()) return;
    if (kind === 'cha') { this.tone(2093, 0.08, 0.05, 'sine'); this.tone(523, 0.5, 0.05, 'sine', 0.08, 0, false, 1046); }
    else if (kind === 'jhalmuri') [0, 0.09, 0.18, 0.27].forEach(delay => this.tone(1320, 0.05, 0.06, 'square', delay));
    else this.tone(180, 0.35, 0.05, 'sawtooth', 0, 0, false, 120);
  }

  stomach(): void {
    if (!this.ready()) return;
    this.tone(140, 0.5, 0.09, 'sine', 0, 0, false, 70); this.tone(196, 0.6, 0.05, 'triangle', 0.2, 0, false, 185);
  }

  belly(): void {
    if (!this.ready()) return;
    this.tone(110, 0.25, 0.12, 'sine', 0, 0, false, 80);
  }

  reward(): void {
    if (!this.ready()) return;
    [659, 880, 1319].forEach((note, i) => this.tone(note, 0.25, 0.07, 'sine', i * 0.075));
  }

  finish(): void {
    if (!this.context || this.muted) return;
    [392, 494, 587, 784, 988].forEach((note, i) => this.tone(note, 0.55, 0.11, 'triangle', i * 0.11));
  }

  loss(): void {
    if(!this.context||this.muted)return;
    this.tone(73, .45, .22, 'sine');
    this.tone(220, .35, .08, 'triangle', .08, 0, false, 110);
  }

  /** Decodes the voice lines for one district (or, with no district, the lines heard everywhere) the first time they are needed. */
  async prepareDistrict(district?: District): Promise<void> {
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
    this.stopSpeech();
    const source = this.context!.createBufferSource();
    source.buffer = buffer;
    this.duckUntil = Math.max(this.duckUntil, this.context!.currentTime + (buffer.duration || 3));
    source.connect(this.master!);
    this.speechSource = source;
    source.onended = () => { source.disconnect(); if (this.speechSource === source) this.speechSource = undefined; };
    source.start();
    return true;
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
    for (const stop of [...this.temporary]) stop();
    const now = this.context?.currentTime ?? 0;
    this.ambience?.gain.setTargetAtTime(0, now, 0.025);
    this.rearEngine?.gain.gain.setTargetAtTime(0, now, 0.025);
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

  private tone(frequency: number, duration: number, volume: number, type: OscillatorType, delay = 0, pan = 0, ambient = false, endFrequency?: number): void {
    const ctx = this.context;
    if (!ctx || !this.master || this.muted || ctx.state !== 'running' || document.hidden) return;
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    const panner = ctx.createStereoPanner();
    const at = ctx.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    panner.pan.value = bound(pan, -1, 1);
    if (endFrequency) { oscillator.frequency.setValueAtTime(frequency, at); oscillator.frequency.exponentialRampToValueAtTime(endFrequency, at + duration); }
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(Math.min(0.3, volume), at + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(envelope).connect(panner).connect(ambient ? this.ambience! : this.master);
    const cleanup = () => { oscillator.disconnect(); envelope.disconnect(); panner.disconnect(); this.temporary.delete(stop); };
    const stop = () => { try { oscillator.stop(); } catch { /* Already ended. */ } cleanup(); };
    this.temporary.add(stop); oscillator.onended = cleanup;
    oscillator.start(at);
    oscillator.stop(at + duration + 0.03);
  }
}
