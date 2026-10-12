export const SHAKE_SECONDS = 0.35;
export const SQUASH_SECONDS = 0.18;

// A quick decaying wobble; the gentler-camera setting keeps a third of it.
export function shakeOffset(remaining: number, amplitude: number, clock: number, reduced: boolean): { x: number; y: number } {
  if (!(remaining > 0) || !(amplitude > 0)) return { x: 0, y: 0 };
  const strength = amplitude * Math.min(1, remaining / SHAKE_SECONDS) * (reduced ? 1 / 3 : 1);
  return { x: Math.sin(clock * 67) * strength, y: Math.sin(clock * 53 + 1.3) * strength * 0.6 };
}

export function landingSquash(sinceLanding: number): number {
  if (!(sinceLanding > 0) || sinceLanding >= SQUASH_SECONDS) return 1;
  return 1 - 0.15 * Math.sin(Math.PI * sinceLanding / SQUASH_SECONDS);
}
