import { describe, expect, it } from 'vitest';
import { SwipeRecognizer } from '../src/controls';
describe('swipe controls', () => {
  it('steers in proportion to drag from the touch-down point, saturating at 18% of the width', () => {
    const swipe = new SwipeRecognizer(1000); swipe.down(1, 600, 500, 0);
    swipe.move(1, 690, 500, 16); expect(swipe.steer).toBeCloseTo(0.5);
    swipe.move(1, 1000, 500, 32); expect(swipe.steer).toBe(1);
    swipe.move(1, 510, 500, 48); expect(swipe.steer).toBeCloseTo(-0.5);
    swipe.resize(500); swipe.move(1, 555, 500, 64); expect(swipe.steer).toBeCloseTo(-0.5);
  });
  it('jumps once per quick upward flick, including a second flick in the same touch', () => {
    const swipe = new SwipeRecognizer(1000); swipe.down(1, 500, 500, 0);
    swipe.move(1, 500, 455, 120); expect(swipe.takeJump()).toBe(true); expect(swipe.takeJump()).toBe(false);
    swipe.move(1, 500, 452, 400); expect(swipe.takeJump()).toBe(false);
    swipe.move(1, 500, 405, 500); expect(swipe.takeJump()).toBe(true);
  });
  it('counts a flick that ends as the finger lifts', () => {
    const swipe = new SwipeRecognizer(1000); swipe.down(1, 500, 500, 0); swipe.up(1, 500, 450, 150);
    expect(swipe.takeJump()).toBe(true); expect(swipe.touching).toBe(false);
  });
  it('ignores a slow upward drift', () => {
    const swipe = new SwipeRecognizer(1000); swipe.down(1, 500, 500, 0);
    for (let step = 1; step <= 6; step++) swipe.move(1, 500, 500 - step * 10, step * 150);
    expect(swipe.takeJump()).toBe(false);
  });
  it('brakes after a quick downward swipe until the finger lifts, but not on a slow drift', () => {
    const swipe = new SwipeRecognizer(1000); swipe.down(1, 500, 300, 0);
    swipe.move(1, 520, 350, 100); expect(swipe.brake).toBe(true);
    swipe.move(1, 520, 350, 2000); expect(swipe.brake).toBe(true);
    swipe.up(1, 520, 350, 2100); expect(swipe.brake).toBe(false); expect(swipe.steer).toBe(0);
    const slow = new SwipeRecognizer(1000); slow.down(1, 500, 300, 0);
    for (let step = 1; step <= 6; step++) slow.move(1, 500, 300 + step * 10, step * 150);
    expect(slow.brake).toBe(false);
  });
  it('keeps steering with the first finger when a second finger touches and lifts', () => {
    const swipe = new SwipeRecognizer(1000); swipe.down(1, 500, 500, 0); swipe.move(1, 590, 500, 16);
    swipe.down(2, 100, 100, 20); swipe.move(2, 900, 100, 30); swipe.up(2, 900, 100, 40); swipe.cancel(2);
    expect(swipe.steer).toBeCloseTo(0.5); expect(swipe.touching).toBe(true);
  });
  it('releases steering and braking when its own touch is cancelled, and clear drops a queued jump', () => {
    const swipe = new SwipeRecognizer(1000); swipe.down(1, 500, 300, 0); swipe.move(1, 590, 350, 100);
    swipe.cancel(1); expect(swipe.steer).toBe(0); expect(swipe.brake).toBe(false); expect(swipe.touching).toBe(false);
    swipe.down(3, 500, 500, 200); swipe.move(3, 500, 440, 260); swipe.clear();
    expect(swipe.takeJump()).toBe(false); expect(swipe.touching).toBe(false);
  });
});
