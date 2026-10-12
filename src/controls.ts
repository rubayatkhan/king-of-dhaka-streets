export const SWIPE = { steerSpanRatio: 0.18, flickPixels: 40, flickMs: 250 } as const;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
interface Sample { y: number; t: number }

// One finger drives: horizontal drag steers, a quick flick up jumps,
// and a quick swipe down brakes until the finger lifts.
export class SwipeRecognizer {
  steer = 0; brake = false;
  private active: { id: number; startX: number; samples: Sample[] } | undefined;
  private jumpQueued = false;
  constructor(private width: number) {}
  get touching(): boolean { return !!this.active; }
  resize(width: number): void { this.width = width; }
  down(id: number, x: number, y: number, t: number): void {
    if (!this.active) this.active = { id, startX: x, samples: [{ y, t }] };
  }
  move(id: number, x: number, y: number, t: number): void {
    const active = this.active;
    if (!active || active.id !== id) return;
    this.steer = clamp((x - active.startX) / Math.max(1, this.width * SWIPE.steerSpanRatio), -1, 1);
    active.samples = active.samples.filter(sample => t - sample.t <= SWIPE.flickMs);
    active.samples.push({ y, t });
    const ys = active.samples.map(sample => sample.y);
    if (Math.max(...ys) - y >= SWIPE.flickPixels) { this.jumpQueued = true; active.samples = [{ y, t }]; }
    else if (y - Math.min(...ys) >= SWIPE.flickPixels) this.brake = true;
  }
  up(id: number, x: number, y: number, t: number): void {
    if (this.active?.id !== id) return;
    this.move(id, x, y, t); this.release();
  }
  cancel(id: number): void { if (this.active?.id === id) this.release(); }
  clear(): void { this.release(); this.jumpQueued = false; }
  takeJump(): boolean { const queued = this.jumpQueued; this.jumpQueued = false; return queued; }
  private release(): void { this.active = undefined; this.steer = 0; this.brake = false; }
}
