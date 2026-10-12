import { BPM, LAYERS, LOOP_SECONDS, LOOP_STEPS, STEP_SECONDS, STEPS_PER_BAR, layerGains, patternSteps, type Layer, type MusicState, type Scene } from './music';
import type { Recipe } from './soundbank';

/** How far behind the scheduler may fall (a frame hitch) and still hand out every step; past this it is a stall. */
const STALL_SECONDS = 0.5;

/** Hands out sixteenth-note steps a little ahead of time, each once; steps already late after a stall are skipped. */
export class StepScheduler {
  running = false; private origin = 0; private next = 0;
  constructor(private lookahead = 0.12) {}
  start(at: number): void { this.origin = at; this.next = 0; this.running = true; }
  stop(): void { this.running = false; }
  timeOf(step: number): number { return this.origin + step * STEP_SECONDS; }
  nextBar(now: number): number { const bar = STEPS_PER_BAR * STEP_SECONDS; return this.origin + Math.max(0, Math.ceil((now - this.origin) / bar - 1e-9)) * bar; }
  due(now: number): number[] {
    const out: number[] = [];
    if (!this.running) return out;
    // After a long stall, jump past the late steps rather than bursting them out together.
    if (now - this.timeOf(this.next) > STALL_SECONDS) this.next = Math.ceil((now - 0.05 - this.origin) / STEP_SECONDS);
    for (; this.timeOf(this.next) < now + this.lookahead; this.next++) out.push(this.next);
    return out;
  }
}

export interface BedManifest { bpm: number; loopSeconds: number; beds: Partial<Record<Scene, string>> }
const SCENES: Scene[] = ['menu', 'bazaar', 'riverfront', 'boulevard'];
export function sanitizeBeds(raw: unknown): BedManifest | undefined {
  if (!raw || typeof raw !== 'object') return;
  const r = raw as Record<string, unknown>;
  if (r.bpm !== BPM || typeof r.loopSeconds !== 'number' || Math.abs(r.loopSeconds - LOOP_SECONDS) > 0.05 || !r.beds || typeof r.beds !== 'object') return;
  const beds: BedManifest['beds'] = {};
  for (const scene of SCENES) { const file = (r.beds as Record<string, unknown>)[scene]; if (typeof file === 'string' && /^[\w-]+\.mp3$/.test(file)) beds[scene] = file; }
  return { bpm: BPM, loopSeconds: r.loopSeconds, beds };
}

export interface MusicHost {
  context: AudioContext; output: AudioNode; base: string;
  play(recipe: Recipe, when: number, out: AudioNode): void;
  fetchJson(url: string): Promise<unknown>;
  fetchBuffer(url: string): Promise<AudioBuffer | undefined>;
}

/** Plays the adaptive layers on one grid: a shipped district bed (or the synthesized groove) plus energy and boost. */
export class MusicPlayer {
  private layers: Record<Layer, GainNode>;
  private scheduler = new StepScheduler();
  private timer?: ReturnType<typeof setInterval>;
  private scene: Scene = 'menu'; private previous: Scene = 'menu'; private switchAt = 0;
  private bed?: { scene: Scene; source: AudioBufferSourceNode; from: number };
  private beds = new Map<Scene, AudioBuffer>(); private loads = new Map<Scene, Promise<void>>();
  private manifest?: Promise<BedManifest | undefined>;

  constructor(private host: MusicHost) {
    const make = () => { const g = host.context.createGain(); g.gain.value = 0; g.connect(host.output); return g; };
    this.layers = { base: make(), energy: make(), boost: make() };
  }

  setState(state: MusicState): void {
    if (!state.playing) { this.stop(); return; }
    const now = this.host.context.currentTime;
    if (!this.scheduler.running) {
      this.scheduler.start(now + 0.05); this.scene = this.previous = state.scene; this.switchAt = 0;
      this.timer = setInterval(() => this.tick(), 25);
      this.syncBed(this.scheduler.timeOf(0));
    } else if (state.scene !== this.scene) {
      this.previous = this.sceneAt(now); this.scene = state.scene; this.switchAt = this.scheduler.nextBar(now);
      this.syncBed(this.switchAt);
    }
    const gains = layerGains(state);
    for (const layer of LAYERS) this.layers[layer].gain.setTargetAtTime(gains[layer], now, 0.4);
    this.prepare(state.scene);
  }

  /** Loads a scene's bed in the background; one that lands mid-ride joins on the next bar line. */
  prepare(scene: Scene): void {
    if (this.loads.has(scene)) return;
    this.manifest ??= this.host.fetchJson(`${this.host.base}audio/music/manifest.json`).then(sanitizeBeds).catch(() => undefined);
    this.loads.set(scene, this.manifest.then(async manifest => {
      const file = manifest?.beds[scene];
      if (!file) return;
      const buffer = await this.host.fetchBuffer(`${this.host.base}audio/music/${file}`).catch(() => undefined);
      if (!buffer) return;
      this.beds.set(scene, buffer);
      if (this.scheduler.running && this.scene === scene && this.bed?.scene !== scene) this.syncBed(this.scheduler.nextBar(this.host.context.currentTime));
    }));
  }

  stop(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined; this.scheduler.stop();
    this.stopBed(this.host.context.currentTime);
    for (const layer of LAYERS) this.layers[layer].gain.setTargetAtTime(0, this.host.context.currentTime, 0.05);
  }

  private sceneAt(time: number): Scene { return time >= this.switchAt ? this.scene : this.previous; }

  private syncBed(at: number): void {
    this.stopBed(at);
    const buffer = this.beds.get(this.scene);
    if (!buffer) return;
    const source = this.host.context.createBufferSource();
    source.buffer = buffer; source.loop = true; source.connect(this.layers.base);
    source.onended = () => source.disconnect();
    source.start(at, (at - this.scheduler.timeOf(0)) % LOOP_SECONDS);
    this.bed = { scene: this.scene, source, from: at };
  }

  /** Drops the reference straight away, so a new bed can start at the same bar; the old source keeps its scheduled stop. */
  private stopBed(at: number): void {
    if (!this.bed) return;
    const { source } = this.bed;
    try { source.stop(at); } catch { /* Already stopped. */ }
    this.bed = undefined;
  }

  private tick(): void {
    for (const step of this.scheduler.due(this.host.context.currentTime)) {
      const when = this.scheduler.timeOf(step), scene = this.sceneAt(when), loopStep = step % LOOP_STEPS;
      const bedPlaying = this.bed?.scene === scene && when >= this.bed.from;
      for (const layer of LAYERS) {
        if (layer === 'base' && bedPlaying) continue;
        for (const recipe of patternSteps(scene, layer)[loopStep]) this.host.play(recipe, when, this.layers[layer]);
      }
    }
  }
}
