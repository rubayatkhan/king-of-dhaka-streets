import { describe, expect, it } from 'vitest';
import { JUMPS, Simulation, VEHICLES, type Traffic } from '../src/simulation';
import { SPEED_CAP } from '../src/campaign';
import { COIN_HEIGHT, type Coin } from '../src/pickups';
import { powerUpStats } from '../src/economy';

const straight = { steer: 0, brake: false };
function advance(sim: Simulation, seconds: number, steer = 0, brake = false) {
  for (let frame = 0; frame < Math.round(seconds * 60); frame++) sim.update(1 / 60, { steer, brake });
}
function obstacle(patch: Partial<Traffic> = {}): Traffic {
  return { id: 9999, kind: 'pothole', x: 0, z: -0.2, speed: 0, width: 1.2, length: 1.2, passed: false, warn: false, ...patch };
}

// A deliberately simple player: select a visible gap, brake for imminent threats,
// hop unavoidable ground hazards, and use the truck's horn. It has no access to unrendered future route geometry.
function pilot(sim: Simulation, followCoins = false) {
  const vehicle = VEHICLES[sim.vehicleIndex];
  // Like a player, hop a pothole or paan spill that steering has not avoided in time.
  if (sim.traffic.some(t => (t.kind === 'pothole' || t.kind === 'paan') && !t.passed && Math.abs(sim.x - t.x) < (vehicle.width + t.width) * 0.38 &&
    sim.z - t.z > 0 && sim.z - t.z < (vehicle.length + t.length) * 0.43 + Math.max(0.5, sim.speed * 0.08))) sim.jump();
  const visible = sim.traffic.filter(t => sim.z - t.z > -(t.length + vehicle.length) / 2 && sim.z - t.z < Math.max(18, sim.speed * 2));
  if (sim.vehicleIndex === 4 && visible.some(t => sim.z - t.z > 8 && t.speed > 0)) sim.horn();
  let target = sim.x, bestCost = Infinity;
  for (const x of [-3.6, -3, -2.4, -1.8, -1.2, -0.6, 0, 0.6, 1.2, 1.8, 2.4, 3, 3.6]) {
    let cost = Math.abs(x - sim.x) * 0.4;
    for (const actor of visible) {
      if (Math.abs(x - actor.x) - (actor.width + vehicle.width) / 2 < 0.45) cost += 100 / (Math.max(0, sim.z - actor.z) + 1);
      // Finish passing an obstacle before crossing back through its footprint.
      if (Math.abs(sim.z - actor.z) < (actor.length + vehicle.length) / 2 + 1 && Math.abs(sim.x - actor.x) > (actor.width + vehicle.width) * 0.43 && (sim.x - actor.x) * (x - actor.x) < 0) cost += 100000;
    }
    for (const rear of sim.rearThreats) {
      if (Math.abs(x - rear.x) < (vehicle.width + 2.5) / 2 + 0.35) cost += 10000;
      if (rear.phase === 'passing' && Math.abs(sim.x - rear.x) > (vehicle.width + 2.5) / 2 && (sim.x - rear.x) * (x - rear.x) < 0) cost += 100000;
    }
    for (const p of sim.projectiles) {
      if (sim.z - p.targetZ > -vehicle.length && sim.z - p.targetZ < Math.max(18, sim.speed * 3.5) && Math.abs(x - p.targetX) < vehicle.width / 2 + p.radius + 0.35) cost += 1000;
    }
    if (followCoins && cost < 10) {
      const coin = sim.coins.find(c => c.trail === 'safe' && !c.collected && !c.gone && sim.z - c.z > -1 && sim.z - c.z < 40);
      if (coin && Math.abs(x - coin.x) < 0.35) cost -= 40;
    }
    if (cost < bestCost) { target = x; bestCost = cost; }
  }
  const brake = visible.some(t => Math.abs(t.x - sim.x) < (t.width + vehicle.width) / 2 + 0.3 && sim.z - t.z < Math.max(6, sim.speed * (sim.vehicleIndex === 4 ? 1.6 : 1.3)));
  sim.update(1 / 60, { steer: Math.max(-1, Math.min(1, (target - sim.x) * 3)), brake });
  return visible;
}

describe('ride lifecycle', () => {
  it('changes districts within a ride and exposes the same lookup for scenery ahead', () => {
    const sim = new Simulation();
    expect(sim.neighborhood).toBe('bazaar'); expect(sim.neighborhoodAt(209)).toBe('bazaar');
    expect(sim.neighborhoodAt(210)).toBe('riverfront'); expect(sim.neighborhoodAt(420)).toBe('boulevard');
    sim.distance = 421; expect(sim.neighborhood).toBe('boulevard');
    expect(sim.neighborhoodAt(630)).toBe('bazaar');
  });

  it('always awards a progressing star for finishing, with extra stars for clean skillful riding', () => {
    const finish = (health: number, nearMisses: number, elapsed: number) => {
      const sim = new Simulation(); sim.start(); sim.traffic = []; sim.health = health; sim.nearMisses = nearMisses;
      sim.elapsed = elapsed; sim.distance = sim.routeLength - 0.01; sim.update(1 / 60, straight); return sim;
    };
    expect(finish(1, 0, 200).stars).toBe(1);
    expect(finish(3, 0, 200).stars).toBe(2);
    const excellent = finish(3, 5, 30);
    expect(excellent.stars).toBe(3); expect(excellent.rank).toBe('Street Royalty');
  });

  it('freezes traffic, distance, cooldowns and time while paused, then resumes', () => {
    const sim = new Simulation(); sim.start(); advance(sim, 2); sim.horn(); sim.pause();
    const before = JSON.stringify(sim);
    advance(sim, 5, 1); sim.horn();
    expect(JSON.stringify(sim)).toBe(before);
    sim.resume(); advance(sim, 1);
    expect(sim.elapsed).toBeGreaterThan(2);
    expect(sim.distance).toBeGreaterThan(0);
  });

  it.each([0, 1, 2, 3, 4])('vehicle %i can finish and emits a single completion event', (index) => {
    const sim = new Simulation(index); sim.start();
    for (let i = 0; i < 120 * 60 && sim.status === 'playing'; i++) {
      sim.traffic.length = 0; sim.update(1 / 60, straight);
    }
    expect(sim.status).toBe('won');
    expect(sim.remaining).toBe(0);
    expect(sim.health).toBe(3);
    expect(sim.score).toBeGreaterThan(0);
    const frozen = JSON.stringify(sim); advance(sim, 1);
    expect(JSON.stringify(sim)).toBe(frozen);
    expect(sim.events.filter(event => event.type === 'win')).toHaveLength(1);
  });

  it('stops the ride when the final heart is lost', () => {
    const sim = new Simulation(); sim.start(); sim.health = 1; sim.traffic = [obstacle()];
    sim.update(1 / 60, straight);
    expect(sim.health).toBe(0); expect(sim.status).toBe('lost');
    expect(sim.events.some(event => event.type === 'crash')).toBe(true);
  });
});

describe('handling and hazards', () => {
  it('makes higher-authority traffic yield passively while horns clear room faster and cows remain seated', () => {
    const passive = new Simulation(4), honking = new Simulation(4), bike = new Simulation();
    for (const sim of [passive, honking, bike]) { sim.start(); sim.traffic = [obstacle({ kind: 'bus', z: -22, width: 2.4, length: 6, speed: 3 }), obstacle({ id: 9998, kind: 'cow', x: 2, z: -18 })]; }
    honking.horn(); advance(passive, 0.5); advance(honking, 0.5); advance(bike, 0.5);
    expect(Math.abs(passive.traffic[0].x)).toBeGreaterThan(0.1);
    expect(Math.abs(honking.traffic[0].x)).toBeGreaterThan(Math.abs(passive.traffic[0].x));
    expect(bike.traffic[0].x).toBe(0); expect(honking.traffic[1].x).toBe(2);
  });

  it('telegraphs a fixed paan target, shows a travelling projectile, then expires the splash', () => {
    const sim = new Simulation(0, 1, 1); sim.start();
    sim.traffic = [obstacle({ kind: 'pedestrian', behavior: 'paan-thrower', x: -5.75, z: -35 })];
    sim.update(1 / 60, straight);
    expect(sim.projectiles).toHaveLength(1);
    const p = sim.projectiles[0], target = [p.targetX, p.targetZ];
    expect(p.phase).toBe('telegraph'); sim.pause(); const frozen = JSON.stringify(sim); advance(sim, 4); expect(JSON.stringify(sim)).toBe(frozen); sim.resume(); advance(sim, 1, 1);
    expect([p.targetX, p.targetZ]).toEqual(target); expect(p.phase).toBe('telegraph');
    advance(sim, 1.2, 1); expect(p.phase).toBe('flying'); expect(p.x).toBeGreaterThan(p.sourceX);
    advance(sim, 0.5, 1); expect(p.phase).toBe('splash');
    advance(sim, 1, 1); expect(sim.projectiles).toHaveLength(0);
  });

  it('gives a rear bus three warning seconds, freezes its lane and crushes only after warning', () => {
    const sim = new Simulation(0, 1, 1); sim.start(); sim.distance = 190; sim.z = -190; sim.traffic = [];
    sim.update(1 / 60, straight); expect(sim.rearThreats).toHaveLength(1);
    const threat = sim.rearThreats[0], lane = threat.x;
    advance(sim, 2.9); expect(sim.health).toBe(3); expect(threat.phase).toBe('warning'); expect(threat.x).toBe(lane);
    const paused = JSON.stringify(sim); sim.pause(); const frozen = JSON.stringify(sim); advance(sim, 5); expect(JSON.stringify(sim)).toBe(frozen); sim.resume();
    expect(paused).not.toBe(frozen);
    advance(sim, 6); expect(sim.status).toBe('lost'); expect(sim.events.some(e => e.type === 'rear-warning')).toBe(true);
  });

  it('postpones a rear warning when front traffic leaves no physically reachable escape', () => {
    const sim = new Simulation(0, 1, 1); sim.start(); sim.distance = 190; sim.z = -190; sim.speed = 13;
    sim.traffic = [-3.5, 0, 3.5].map((x, id) => obstacle({ id, x, z: -207, width: 3.5, length: 5 }));
    sim.update(1 / 60, straight); expect(sim.rearThreats).toHaveLength(0);
    sim.traffic = []; sim.update(1 / 60, straight); expect(sim.rearThreats).toHaveLength(1);
  });

  it('does not demand a rear-lane change before the half-second reaction window clears', () => {
    const sim = new Simulation(0, 1, 1); sim.start(); sim.distance = 190; sim.z = -190; sim.speed = 13;
    sim.traffic = [obstacle({ x: 0, z: -194, width: 1.6 })];
    sim.update(1 / 60, straight); expect(sim.rearThreats).toHaveLength(0);
  });

  it('lets the player clear a warned rear lane without damage', () => {
    const sim = new Simulation(0, 1, 1); sim.start(); sim.distance = 190; sim.z = -190; sim.traffic = [];
    sim.update(1 / 60, straight); advance(sim, 2, 1); advance(sim, 7);
    expect(sim.health).toBe(3); expect(sim.status).toBe('playing'); expect(sim.rearThreats).toHaveLength(0);
  });

  it('awards a near-miss chain only for close clean passes and breaks it even on immune contact', () => {
    const sim = new Simulation(); sim.start(); sim.traffic = [obstacle({ x: 1.25, z: -1 })]; advance(sim, 2);
    expect(sim.nearMisses).toBe(1); expect(sim.combo).toBe(1); expect(sim.maxCombo).toBe(1);
    sim.invulnerable = 2; sim.traffic = [obstacle({ id: 10001, x: sim.x, z: sim.z })]; sim.update(1 / 60, straight);
    expect(sim.combo).toBe(0); expect(sim.maxCombo).toBe(1);
  });

  it('warns before a pedestrian starts crossing and keeps the crossing inside the road', () => {
    const sim = new Simulation(); sim.start();
    const walker = obstacle({ kind: 'pedestrian', x: -4.65, z: -30, width: 0.65, length: 0.65 });
    sim.traffic = [walker]; sim.update(1 / 60, straight);
    expect(walker.warn).toBe(true);
    expect(walker.x).toBe(-4.65);
    advance(sim, 0.4, 0, true); expect(walker.x).toBe(-4.65);
    advance(sim, 2, 0, true); expect(walker.x).toBeGreaterThan(-4.3);
    advance(sim, 12, 0, true);
    expect(walker.x).toBeLessThanOrEqual(4.975);
    expect(walker.x).toBeGreaterThanOrEqual(-4.975);
  });

  it('collision slows the rider and grants immunity against repeated damage', () => {
    const sim = new Simulation(); sim.start(); sim.speed = 10; sim.traffic = [obstacle({ kind: 'cng' })];
    sim.update(1 / 60, straight);
    expect(sim.health).toBe(2); expect(sim.speed).toBeLessThan(5);
    sim.traffic = [obstacle({ id: 10000, z: sim.z })]; sim.update(1 / 60, straight);
    expect(sim.health).toBe(2);
    sim.traffic.length = 0; advance(sim, 2.1);
    sim.traffic = [obstacle({ id: 10001, z: sim.z })]; sim.update(1 / 60, straight);
    expect(sim.health).toBe(1);
  });

  it('bumps over a grounded pothole: one heart, a 30% slowdown and a bump event', () => {
    const sim = new Simulation(); sim.start(); sim.speed = 10; sim.traffic = [obstacle()];
    sim.update(1 / 60, straight);
    expect(sim.health).toBe(2);
    expect(sim.speed).toBeGreaterThan(6.5); expect(sim.speed).toBeLessThan(7.5);
    expect(sim.events.some(e => e.type === 'bump')).toBe(true);
    const cow = new Simulation(); cow.start(); cow.speed = 10; cow.traffic = [obstacle({ kind: 'cow' })];
    cow.update(1 / 60, straight);
    expect(cow.events.some(e => e.type === 'bump')).toBe(false); expect(cow.speed).toBeLessThan(4);
  });

  it('does not award a clean pass for contact during collision immunity', () => {
    const sim = new Simulation(); sim.start(); sim.invulnerable = 2;
    sim.traffic = [obstacle()]; advance(sim, 2);
    expect(sim.health).toBe(3);
    expect(sim.overtakes).toBe(0);
    expect(sim.score).toBe(0);
  });

  it.each([0, 1, 2, 3, 4])('keeps vehicle %i completely inside both road edges', (index) => {
    const sim = new Simulation(index); sim.start(); sim.traffic.length = 0;
    advance(sim, 3, 1);
    expect(sim.x + VEHICLES[index].width / 2).toBeLessThanOrEqual(5.3);
    advance(sim, 6, -1);
    expect(sim.x - VEHICLES[index].width / 2).toBeGreaterThanOrEqual(-5.3);
  });

  it('braking meaningfully lowers speed and releasing it restores forward motion', () => {
    const sim = new Simulation(); sim.start(); sim.traffic.length = 0; advance(sim, 4);
    const fast = sim.speed; advance(sim, 2, 0, true);
    expect(sim.speed).toBeLessThan(fast * 0.4);
    advance(sim, 2); expect(sim.speed).toBeGreaterThan(fast * 0.6);
  });

  it('telegraphs an approaching paan hazard before contact', () => {
    const sim = new Simulation(); sim.start(); sim.traffic = [obstacle({ kind: 'paan', z: -18 })];
    sim.update(1 / 60, straight);
    expect(sim.traffic[0].warn).toBe(true); expect(sim.health).toBe(3);
    expect(sim.events.some(event => event.type === 'warning')).toBe(true);
  });

  it('awards one clean overtake per obstacle, never repeatedly', () => {
    const sim = new Simulation(); sim.start(); sim.traffic = [obstacle({ x: 3, z: -1 })];
    advance(sim, 2);
    expect(sim.overtakes).toBe(1); expect(sim.score).toBeGreaterThan(0);
    advance(sim, 1); expect(sim.overtakes).toBe(1);
  });
});

describe('horn hierarchy', () => {
  it('visibly clears the generated opening for a truck while a bicycle must steer through it', () => {
    const route = new Simulation(0, 27).traffic;
    const bicycle = new Simulation(0, 27), truck = new Simulation(4, 27);
    for (const sim of [bicycle, truck]) {
      sim.traffic = route.map(actor => ({ ...actor })); sim.start();
      for (let frame = 0; frame < 900 && sim.distance < 55; frame++) sim.update(1 / 60, straight);
    }
    expect(truck.health).toBe(3); expect(bicycle.health).toBeLessThan(truck.health);
    const originalRickshaw = route.find(t => t.kind === 'rickshaw')!;
    const yielded = truck.traffic.find(t => t.id === originalRickshaw.id)!;
    expect(Math.abs(yielded.x)).toBeGreaterThan(Math.abs(originalRickshaw.x) + 1.5);
  });

  it('a bicycle cannot move a bus; a truck gradually persuades the bus to yield', () => {
    const bus = () => obstacle({ kind: 'bus', z: -15, speed: 3, width: 2.4, length: 6 });
    const bike = new Simulation(0); bike.start(); bike.traffic = [bus()]; bike.horn(); advance(bike, 0.3);
    expect(bike.traffic[0].x).toBe(0);
    const truck = new Simulation(4); truck.start(); truck.traffic = [bus()]; truck.horn();
    expect(truck.traffic[0].x).toBe(0);
    advance(truck, 0.3);
    expect(Math.abs(truck.traffic[0].x)).toBeGreaterThan(0.1);
    expect(Math.abs(truck.traffic[0].x)).toBeLessThan(1.5);
  });

  it('enforces a horn cooldown and allows a later horn', () => {
    const sim = new Simulation(); sim.start(); sim.horn(); sim.horn();
    expect(sim.events.filter(event => event.type === 'horn')).toHaveLength(1);
    advance(sim, 3); sim.horn();
    expect(sim.events.filter(event => event.type === 'horn')).toHaveLength(2);
  });
});

describe('repeatable fair routes', () => {
  it('opens with a bus and smaller moving traffic and keeps the next street segment populated', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const sim = new Simulation(0, seed);
      const opening = sim.traffic.filter(actor => actor.z >= -45 && actor.z < 0);
      expect(opening.some(actor => actor.kind === 'bus')).toBe(true);
      expect(opening.some(actor => actor.kind === 'rickshaw' || actor.kind === 'cng')).toBe(true);
      expect(sim.traffic.filter(actor => actor.speed > 0 && actor.z >= -135).length).toBeGreaterThanOrEqual(6);
    }
  });

  it.each([0, 1, 2, 3, 4])('a visible-gap pilot can complete generated routes in vehicle %i without traffic closing the road', (index) => {
    for (let seed = 1; seed <= 10; seed++) {
      const sim = new Simulation(index, seed); sim.start();
      for (let frame = 0; frame < 120 * 60 && sim.status === 'playing'; frame++) {
        const visible = pilot(sim);
        if (frame % 60 !== 0) continue;
        const ahead135 = sim.traffic.filter(actor => sim.z - actor.z >= 0 && sim.z - actor.z <= 135);
        expect(ahead135.length).toBeLessThanOrEqual(12);
        for (const actor of visible) {
          const blocked = visible.filter(t => Math.abs(t.z - actor.z) < 7)
            .map(t => [t.x - t.width / 2, t.x + t.width / 2]).sort((a, b) => a[0] - b[0]);
          let edge = -5.3, gap = 0;
          for (const [left, right] of blocked) { gap = Math.max(gap, left - edge); edge = Math.max(edge, right); }
          gap = Math.max(gap, 5.3 - edge);
          expect(gap).toBeGreaterThan(2.8);
        }
      }
      expect(sim.status, `vehicle ${index}, seed ${seed}`).toBe('won');
    }
  });

  it('covers every bicycle-width straight corridor with a stationary hazard somewhere on the route', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const sim = new Simulation(0, seed);
      const hazards = sim.traffic.filter(t => t.kind === 'pothole' || t.kind === 'paan' || t.kind === 'cow');
      for (let x = -4.96; x <= 4.961; x += 0.08) {
        expect(hazards.some(t => Math.abs(t.x - x) < (t.width + 0.68) * 0.43)).toBe(true);
      }
    }
  });

  it('holding either steering direction or using no controls cannot complete the ride', () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (const steer of [-1, 0, 1]) {
        const sim = new Simulation(0, seed); sim.start(); advance(sim, 85, steer);
        expect(sim.status, `seed ${seed}, steer ${steer}`).toBe('lost');
      }
    }
  });

  it('keeps elapsed time and travel consistent at 30 and 60 updates per second', () => {
    const slow = new Simulation(), fast = new Simulation(); slow.start(); fast.start();
    slow.traffic = []; fast.traffic = [];
    for (let frame = 0; frame < 300; frame++) slow.update(1 / 30, straight);
    advance(fast, 10);
    expect(slow.distance).toBeCloseTo(fast.distance, 5);
    expect(slow.elapsed).toBeCloseTo(fast.elapsed, 5);
  });

  it('reproduces the same traffic and simulation given the same seed and input', () => {
    const a = new Simulation(2, 52), b = new Simulation(2, 52), other = new Simulation(2, 53);
    expect(a.traffic).not.toEqual(other.traffic);
    a.start(); b.start(); advance(a, 4, 0.2); advance(b, 4, 0.2);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it.each([0, 1, 2])('leaves a truck-width navigable gap in every starting traffic row of truck mission %i', (lesson) => {
    for (let seed = 1; seed <= 50; seed++) {
      const sim = new Simulation(4, seed, lesson);
      for (const actor of sim.traffic) {
        const blocked = sim.traffic.filter(t => Math.abs(t.z - actor.z) < 7)
          .map(t => [Math.max(-5.3, t.x - t.width / 2), Math.min(5.3, t.x + t.width / 2)])
          .sort((a, b) => a[0] - b[0]);
        let edge = -5.3, largestGap = 0;
        for (const [left, right] of blocked) { largestGap = Math.max(largestGap, left - edge); edge = Math.max(edge, right); }
        largestGap = Math.max(largestGap, 5.3 - edge);
        expect(largestGap).toBeGreaterThan(2.8);
      }
    }
  });

  it('starts each mission faster and keeps speeding up all the way to the finish', () => {
    const early = [0, 1, 2].map(lesson => { const sim = new Simulation(0, 3, lesson); sim.start(); sim.traffic.length = 0; advance(sim, 7); return sim.speed; });
    expect(early[1]).toBeGreaterThan(early[0] * 1.07); expect(early[2]).toBeGreaterThan(early[1] * 1.07);
    for (let lesson = 0; lesson < 3; lesson++) {
      const sim = new Simulation(0, 3, lesson);
      sim.distance = sim.routeLength * 0.25; const quarter = sim.maxSpeed;
      sim.distance = sim.routeLength * 0.97; expect(sim.maxSpeed, `lesson ${lesson}`).toBeGreaterThan(quarter * 1.1);
    }
    const ride = new Simulation(0, 3, 0); ride.start(); ride.traffic.length = 0;
    let quarterSpeed = 0;
    while (ride.status === 'playing' && ride.distance < ride.routeLength * 0.97) { advance(ride, 0.1); if (!quarterSpeed && ride.distance > ride.routeLength * 0.25) quarterSpeed = ride.speed; }
    expect(ride.speed).toBeGreaterThan(quarterSpeed * 1.1);
  });

  it('never exceeds 100 km/h and keeps hazard rows at least a second apart at full speed', () => {
    for (let stage = 0; stage < 15; stage++) {
      const sim = new Simulation(Math.floor(stage / 3), 5, stage % 3); sim.start(); sim.traffic.length = 0;
      let top = 0;
      while (sim.status === 'playing') { advance(sim, 0.25); top = Math.max(top, sim.speed); }
      expect(top, `stage ${stage}`).toBeLessThanOrEqual(SPEED_CAP + 1e-9);
      for (let seed = 1; seed <= 5; seed++) {
        const hazards = new Simulation(Math.floor(stage / 3), seed, stage % 3).traffic
          .filter(t => t.kind === 'pothole' || t.kind === 'paan' || t.kind === 'cow').map(t => -t.z).sort((a, b) => a - b);
        for (let i = 1; i < hazards.length; i++) expect((hazards[i] - hazards[i - 1]) / SPEED_CAP).toBeGreaterThanOrEqual(1 - 1e-9);
      }
    }
  });

  it('keeps hazards coming to the end of every ride, more of them in later missions', () => {
    for (let vehicle = 0; vehicle < 5; vehicle++) {
      const perMinute = [0, 1, 2].map(lesson => {
        let rate = 0;
        for (let seed = 1; seed <= 5; seed++) {
          const sim = new Simulation(vehicle, seed, lesson);
          const hazards = sim.traffic.filter(t => t.kind === 'pothole' || t.kind === 'paan' || t.kind === 'cow');
          const firstHalf = hazards.filter(t => -t.z < sim.routeLength / 2).length;
          // The opening is a dense teaching slalom; afterwards hazards keep coming right to the finish.
          expect(hazards.length - firstHalf, `vehicle ${vehicle} lesson ${lesson} seed ${seed}`).toBeGreaterThanOrEqual(firstHalf * 0.6);
          expect(hazards.some(t => -t.z > sim.routeLength * 0.75), `vehicle ${vehicle} lesson ${lesson} seed ${seed} final quarter`).toBe(true);
          rate += hazards.length / sim.stage.parTime;
        }
        return rate;
      });
      expect(perMinute[1]).toBeGreaterThan(perMinute[0]); expect(perMinute[2]).toBeGreaterThan(perMinute[1]);
      const perMetre = [0, 1, 2].map(lesson => { const sim = new Simulation(vehicle, 3, lesson); return sim.traffic.length / sim.routeLength; });
      expect(perMetre[1]).toBeGreaterThan(perMetre[0]); expect(perMetre[2]).toBeGreaterThan(perMetre[1]);
    }
  });

  it('rejects invalid time steps without corrupting the state', () => {
    const sim = new Simulation(); sim.start(); const before = JSON.stringify(sim);
    sim.update(NaN, straight); sim.update(-1, straight); sim.update(0, straight);
    expect(JSON.stringify(sim)).toBe(before);
  });

  it('keeps every ramped mission winnable across a broad spread of random ride seeds', () => {
    // Players get a fresh random seed every ride, so sample widely rather than seeds 1–7.
    const losses: string[] = [];
    for (let stage = 0; stage < 15; stage++) {
      let lost = 0;
      for (let i = 1; i <= 30; i++) {
        const sim = new Simulation(Math.floor(stage / 3), Math.imul(i, 2654435761) >>> 0, stage % 3); sim.start();
        for (let frame = 0; frame < 180 * 60 && sim.status === 'playing'; frame++) pilot(sim);
        if (sim.status !== 'won') lost++;
      }
      if (lost > 1) losses.push(`stage ${stage}: ${lost}/30`);
    }
    expect(losses).toEqual([]);
  }, 120000);

  it('completes all fifteen lessons across 105 seeded pilots with live rear and paan encounters', () => {
    let rearWarnings = 0, paanWarnings = 0;
    for (let vehicle = 0; vehicle < 5; vehicle++) for (let lesson = 0; lesson < 3; lesson++) for (let seed = 1; seed <= 7; seed++) {
      const sim = new Simulation(vehicle, seed, lesson); sim.start();
      for (let frame = 0; frame < 180 * 60 && sim.status === 'playing'; frame++) {
        pilot(sim);
        if (frame % 60 === 0) expect(sim.traffic.filter(t => sim.z - t.z >= 0 && sim.z - t.z <= 135).length).toBeLessThanOrEqual(14);
      }
      rearWarnings += sim.events.filter(e => e.type === 'rear-warning').length;
      paanWarnings += sim.events.filter(e => e.type === 'paan-warning').length;
      expect(sim.status, `vehicle ${vehicle}, lesson ${lesson}, seed ${seed}, distance ${sim.distance}, x ${sim.x}, events ${JSON.stringify(sim.events.slice(-4))}, rear ${JSON.stringify(sim.rearThreats)}`).toBe('won');
      expect(sim.stars).toBeGreaterThanOrEqual(1);
    }
    expect(rearWarnings).toBeGreaterThanOrEqual(100);
    expect(paanWarnings).toBeGreaterThanOrEqual(30);
  });
});

describe('jumping', () => {
  const splash = (sim: Simulation) => ({ id: 77, sourceId: 78, phase: 'splash' as const, sourceX: 5, sourceZ: sim.z, targetX: 0, targetZ: sim.z,
    x: 0, y: 0.03, z: sim.z, radius: 0.72, progress: 0, remaining: 0.8 });

  it('hops a bicycle over a pothole when timed and counts a clean pass', () => {
    const sim = new Simulation(0); sim.start(); sim.speed = 10; sim.traffic = [obstacle({ z: sim.z - 3 })];
    expect(sim.jump()).toBe(true); advance(sim, 1);
    expect(sim.health).toBe(3); expect(sim.overtakes).toBe(1);
    expect(sim.events.map(e => e.type)).toEqual(expect.arrayContaining(['jump', 'land']));
  });

  it('lands into a pothole after jumping too early', () => {
    const sim = new Simulation(0); sim.start(); sim.speed = 10; sim.traffic = [obstacle({ z: sim.z - 12 })];
    sim.jump(); advance(sim, 2);
    expect(sim.health).toBe(2);
  });

  it('lets a truck bounce a pothole but never clear a cow', () => {
    const bounce = new Simulation(4); bounce.start(); bounce.speed = 10; bounce.traffic = [obstacle({ z: bounce.z - 5 })];
    bounce.jump(); advance(bounce, 1);
    expect(bounce.health).toBe(3);
    const cow = new Simulation(4); cow.start(); cow.speed = 10; cow.traffic = [obstacle({ kind: 'cow', z: cow.z - 5, length: 2.1 })];
    cow.jump(); advance(cow, 1);
    expect(cow.health).toBe(2);
  });

  it.each([0, 1, 2, 3, 4])('never clears moving traffic in vehicle %i', (index) => {
    const sim = new Simulation(index); sim.start(); sim.speed = 10; sim.traffic = [obstacle({ kind: 'car', z: sim.z - 3, width: 1.8, length: 3.7 })];
    sim.jump(); advance(sim, 1);
    expect(sim.health).toBe(2);
  });

  it('jumps a paan splash on two wheels but not in a rickshaw', () => {
    for (const [index, health] of [[0, 3], [2, 3], [1, 2]]) {
      const sim = new Simulation(index); sim.start(); sim.traffic = []; sim.projectiles = [splash(sim)];
      sim.jump(); sim.update(1 / 60, straight);
      expect(sim.health, `vehicle ${index}`).toBe(health);
    }
  });

  it('follows each vehicle\'s jump arc and enforces a landing cooldown', () => {
    for (const vehicle of VEHICLES) {
      const sim = new Simulation(VEHICLES.indexOf(vehicle)); sim.start(); sim.traffic = [];
      const profile = JUMPS[vehicle.id];
      sim.jump(); advance(sim, profile.airtime / 2);
      expect(sim.y).toBeCloseTo(profile.height, 1);
      expect(sim.jump()).toBe(false);
      advance(sim, profile.airtime / 2 + 0.05);
      expect(sim.airborne).toBe(false); expect(sim.y).toBe(0);
      expect(sim.jump()).toBe(false);
      advance(sim, 0.4);
      expect(sim.jump()).toBe(true);
    }
  });

  it('steers with 60% authority in the air', () => {
    const ground = new Simulation(0), air = new Simulation(0);
    for (const sim of [ground, air]) { sim.start(); sim.traffic = []; }
    air.jump(); advance(ground, 0.2, 1); advance(air, 0.2, 1);
    expect(air.x).toBeCloseTo(ground.x * 0.6, 5);
  });

  it('ignores jump requests before the start, while paused and after the finish', () => {
    const sim = new Simulation(0);
    expect(sim.jump()).toBe(false);
    sim.start(); sim.pause(); expect(sim.jump()).toBe(false);
    sim.resume(); sim.traffic = []; sim.distance = sim.routeLength - 0.1; advance(sim, 0.1);
    expect(sim.status).toBe('won'); expect(sim.jump()).toBe(false);
  });

  it('freezes the hop while paused and finishes it after resuming', () => {
    const sim = new Simulation(0); sim.start(); sim.traffic = [];
    sim.jump(); advance(sim, 0.2); const height = sim.y;
    sim.pause(); sim.update(0.2, straight); expect(sim.y).toBe(height);
    sim.resume(); advance(sim, 1); expect(sim.airborne).toBe(false); expect(sim.y).toBe(0);
  });

  it('puts the rider back on the ground when the ride ends mid-air', () => {
    const won = new Simulation(0); won.start(); won.traffic = []; won.distance = won.routeLength - 0.5;
    won.jump(); advance(won, 0.2);
    expect(won.status).toBe('won'); expect(won.airborne).toBe(false); expect(won.y).toBe(0);
    const lost = new Simulation(0); lost.start(); lost.health = 1; lost.speed = 10; lost.traffic = [obstacle({ kind: 'car', z: lost.z - 2, width: 1.8, length: 3.7 })];
    lost.jump(); advance(lost, 0.5);
    expect(lost.status).toBe('lost'); expect(lost.airborne).toBe(false); expect(lost.y).toBe(0);
  });
});

describe('taka and street food', () => {
  const coin = (patch: Partial<Coin> = {}): Coin => ({ id: 501, group: 1, x: 0, y: COIN_HEIGHT, z: -3, value: 1, trail: 'safe', collected: false, gone: false, ...patch });
  const bare = (index = 0, lesson = 0) => { const sim = new Simulation(index, 1, lesson); sim.start(); sim.traffic = []; sim.coins = []; sim.snacks = []; return sim; };

  it('lays coin trails and snacks on every route', () => {
    for (let stage = 0; stage < 15; stage++) {
      const sim = new Simulation(Math.floor(stage / 3), 9, stage % 3);
      expect(sim.coins.length, `stage ${stage}`).toBeGreaterThan(20);
      expect(sim.snacks.length).toBeGreaterThan(0); expect(sim.snacks.length).toBeLessThanOrEqual(4);
    }
  });

  it('collects ground coins in its path and counts a quick chain', () => {
    const sim = bare(); sim.speed = 10;
    sim.coins = [coin({ id: 1, z: -3 }), coin({ id: 2, z: -4.2 }), coin({ id: 3, x: 4, z: -5 })];
    advance(sim, 0.6);
    expect(sim.taka).toBe(2);
    expect(sim.events.filter(e => e.type === 'coin').map(e => e.chain)).toEqual([1, 2]);
  });

  it('needs a jump to collect a raised arc coin', () => {
    for (const hop of [false, true]) {
      const sim = bare(); sim.speed = 10; sim.coins = [coin({ trail: 'arc', y: COIN_HEIGHT + 0.7, z: -3.5 })];
      if (hop) sim.jump();
      advance(sim, 0.6);
      expect(sim.taka, `jump ${hop}`).toBe(hop ? 1 : 0);
    }
  });

  it('pulls nearby coins in while the jhalmuri magnet is active', () => {
    for (const magnet of [0, 5]) {
      const sim = bare(); sim.speed = 10; sim.effects.magnet = magnet; sim.coins = [coin({ x: 2.2, z: -6 })];
      advance(sim, 1);
      expect(sim.taka, `magnet ${magnet}`).toBe(magnet ? 1 : 0);
    }
  });

  it('eats a cha for a speed boost and double street rep', () => {
    const sim = bare(); sim.snacks = [{ id: 1, kind: 'cha', x: 0, z: -2, eaten: false }];
    advance(sim, 3);
    expect(sim.events.some(e => e.type === 'snack' && e.kind === 'cha')).toBe(true);
    expect(sim.speed).toBeGreaterThan(sim.maxSpeed * 1.1);
    sim.traffic = [obstacle({ kind: 'cng', x: 2.5, z: sim.z - 2, width: 1.5, length: 2.5 })];
    const before = sim.score; advance(sim, 1);
    expect(sim.score - before).toBe(30);
  });

  it('never lets cha push past the 100 km/h cap', () => {
    const sim = bare(4, 2); sim.distance = sim.routeLength * 0.8; sim.speed = 27; sim.effects.boost = 5;
    let top = 0;
    for (let i = 0; i < 120 && sim.status === 'playing'; i++) { advance(sim, 1 / 60); top = Math.max(top, sim.speed); }
    expect(top).toBeLessThanOrEqual(SPEED_CAP + 1e-9);
  });

  it('lets a chaap full belly absorb exactly one ordinary hit', () => {
    const sim = bare(); sim.speed = 10; sim.effects.belly = true;
    sim.traffic = [obstacle({ kind: 'cng', id: 1 })]; sim.update(1 / 60, straight);
    expect(sim.health).toBe(3); expect(sim.effects.belly).toBe(false); expect(sim.events.some(e => e.type === 'belly')).toBe(true);
    advance(sim, 2.1); sim.traffic = [obstacle({ kind: 'cng', id: 2, z: sim.z })]; sim.update(1 / 60, straight);
    expect(sim.health).toBe(2);
  });

  it('slows and wobbles the rider with an upset stomach', () => {
    const calm = bare(), upset = bare(); upset.effects.stomachPending = 0.1;
    advance(calm, 3); advance(upset, 3);
    expect(upset.events.some(e => e.type === 'stomach')).toBe(true);
    expect(upset.speed).toBeLessThan(calm.speed * 0.8);
    expect(upset.x).not.toBe(0);
  });

  it('sweeps coins from a warned bus lane so they never lure a rider into it', () => {
    const sim = new Simulation(0);
    sim.coins = [coin({ id: 1, x: 0, z: -20 }), coin({ id: 2, x: 4, z: -20 }), coin({ id: 3, x: 0, z: -200 })];
    sim.sweepCoins(0.5);
    expect(sim.coins.map(c => c.gone)).toEqual([true, false, false]);
  });

  it('stops snack effects once the ride is over', () => {
    const sim = bare(); sim.effects.stomachPending = 0.5; sim.distance = sim.routeLength - 0.2;
    advance(sim, 1);
    expect(sim.status).toBe('won'); expect(sim.events.some(e => e.type === 'stomach')).toBe(false);
  });

  it('keeps every mission winnable with fully upgraded power-ups', () => {
    const maxed = powerUpStats({ cha: 4, jhalmuri: 4, chaap: 4 }), losses: string[] = [];
    for (let stage = 0; stage < 15; stage++) {
      let lost = 0;
      for (let i = 1; i <= 10; i++) {
        const sim = new Simulation(Math.floor(stage / 3), Math.imul(i, 2654435761) >>> 0, stage % 3, maxed); sim.start();
        for (let frame = 0; frame < 180 * 60 && sim.status === 'playing'; frame++) pilot(sim);
        if (sim.status !== 'won') lost++;
      }
      if (lost > 1) losses.push(`stage ${stage}: ${lost}/10`);
    }
    expect(losses).toEqual([]);
  }, 120000);

  it('lets a coin-following pilot collect at least 90% of safe-trail coins', () => {
    let safe = 0, got = 0;
    for (let stage = 0; stage < 15; stage++) for (let seed = 1; seed <= 4; seed++) {
      const sim = new Simulation(Math.floor(stage / 3), seed, stage % 3); sim.start();
      for (let frame = 0; frame < 180 * 60 && sim.status === 'playing'; frame++) pilot(sim, true);
      const trail = sim.coins.filter(c => c.trail === 'safe' && !c.gone && -c.z < sim.distance);
      safe += trail.length; got += trail.filter(c => c.collected).length;
    }
    expect(got / safe).toBeGreaterThanOrEqual(0.9);
  }, 120000);
});
