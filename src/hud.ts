// The ride HUD's numbers, kept pure so the race bar and hearts are testable without a DOM.
export interface RaceInput { distance: number; routeLength: number; elapsed: number; parTime: number }
export interface RaceBar { covered: number; pace: number; metresLeft: number; goldSecondsLeft: number; ahead: boolean; goldGone: boolean; distanceLabel: string; clockLabel: string }

const unit = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));

/** Where the rider is on the route against where gold pace would be now. A slow finish still advances, so the label never implies failure. */
export function raceBar({ distance, routeLength, elapsed, parTime }: RaceInput): RaceBar {
  const covered = routeLength > 0 ? unit(distance / routeLength) : 1, pace = parTime > 0 ? unit(elapsed / parTime) : 1;
  const metresLeft = Math.ceil(Math.max(0, routeLength - distance)), goldSecondsLeft = Math.ceil(Math.max(0, parTime - elapsed)), goldGone = goldSecondsLeft === 0;
  return { covered, pace, metresLeft, goldSecondsLeft, goldGone, ahead: !goldGone && covered >= pace,
    distanceLabel: metresLeft ? `${metresLeft} m to go` : 'Finish line!', clockLabel: goldGone ? 'Finish for ★' : `${goldSecondsLeft} s for gold` };
}

export function heartsLabel(health: number): string {
  const n = Math.min(3, Math.max(0, Math.round(health)));
  return n ? `${n} of 3 hearts left` : 'No hearts left';
}

export function shavesChip(nearMisses: number, target: number): { text: string; done: boolean } {
  const done = nearMisses >= target;
  return { text: `Close shaves ${Math.min(nearMisses, target)}/${target}${done ? ' ✓' : ''}`, done };
}
