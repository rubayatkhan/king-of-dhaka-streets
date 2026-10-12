import { getStage, NEIGHBORHOODS, SPEED_CAP, type Neighborhood, type StageProfile } from './campaign';
import { BASE_POWER_UPS, CHA_SPEED, COIN_HEIGHT, SNACK_TEXT, STOMACH_SPEED, eatSnack, newEffects, placePickups, tickEffects, type Coin, type Effects, type PowerUpStats, type Snack } from './pickups';
export type VehicleKind = 'bicycle' | 'rickshaw' | 'motorbike' | 'car' | 'truck';
export interface VehicleProfile {
  id: VehicleKind; name: string; bangla: string; tagline: string;
  maxSpeed: number; width: number; length: number; steering: number; authority: number; color: number;
}
export const VEHICLES: VehicleProfile[] = [
  { id: 'bicycle', name: 'Bicycle', bangla: 'সাইকেল', tagline: 'Small bell. Big dreams.', maxSpeed: 13, width: 0.68, length: 1.8, steering: 5.5, authority: 0, color: 0x38baa1 },
  { id: 'rickshaw', name: 'Rickshaw', bangla: 'রিকশা', tagline: 'Carry the city. Find your rhythm.', maxSpeed: 14, width: 1.55, length: 2.8, steering: 4.7, authority: 1, color: 0xe7ac39 },
  { id: 'motorbike', name: 'Motorbike', bangla: 'মোটরবাইক', tagline: 'A little throttle. A lot of nerve.', maxSpeed: 19, width: 0.86, length: 2, steering: 6.1, authority: 2, color: 0xd84c3d },
  { id: 'car', name: 'Car', bangla: 'গাড়ি', tagline: 'Own your lane. Read the gaps.', maxSpeed: 21, width: 1.8, length: 3.7, steering: 4.4, authority: 3, color: 0xf2dbad },
  { id: 'truck', name: 'Truck', bangla: 'ট্রাক', tagline: 'The street hears you coming.', maxSpeed: 23, width: 2.5, length: 6.2, steering: 3.8, authority: 5, color: 0x259b99 },
];
export type JumpClear = 'pothole' | 'paan' | 'splash';
export interface JumpProfile { airtime: number; height: number; clears: JumpClear[] }
// Every vehicle hops; smaller ones fly higher and clear more. Nothing clears traffic, cows or people.
export const JUMPS: Record<VehicleKind, JumpProfile> = {
  bicycle: { airtime: 0.6, height: 0.9, clears: ['pothole', 'paan', 'splash'] },
  motorbike: { airtime: 0.55, height: 0.8, clears: ['pothole', 'paan', 'splash'] },
  rickshaw: { airtime: 0.45, height: 0.5, clears: ['pothole', 'paan'] },
  car: { airtime: 0.35, height: 0.25, clears: ['pothole'] },
  truck: { airtime: 0.3, height: 0.15, clears: ['pothole'] },
};
const JUMP_COOLDOWN = 0.35, AIR_STEERING = 0.6;
export type Traffic = {
  id: number; kind: VehicleKind | 'bus' | 'cng' | 'pedestrian' | 'pothole' | 'paan' | 'cow';
  x: number; z: number; speed: number; width: number; length: number; passed: boolean; warn: boolean;
  behavior?: 'rear-threat' | 'paan-thrower' | 'crossing'; phase?: 'warning' | 'active' | 'passed'; warningRemaining?: number;
};
export interface RearThreat {
  actorId: number; kind: 'bus' | 'truck'; x: number; z: number;
  urgency: number; timeToContact: number; warningRemaining: number; phase: 'warning' | 'passing';
}
export interface Projectile {
  id: number; sourceId: number; phase: 'telegraph' | 'flying' | 'splash';
  sourceX: number; sourceZ: number; targetX: number; targetZ: number;
  x: number; y: number; z: number; radius: number; progress: number; remaining: number;
}
export interface GameEvent { type: string; text: string; x?: number; z?: number; actorId?: number; priority?: 'normal' | 'urgent'; value?: number; chain?: number; kind?: string }
export interface Input { steer: number; brake: boolean }
export const ROAD_HALF_WIDTH = 5.3;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const authority = (kind: Traffic['kind']) => kind === 'bus' ? 4 : kind === 'cng' ? 2 : kind === 'pedestrian' ? -1 : VEHICLES.find(v => v.id === kind)?.authority ?? 99;

export class Simulation {
  vehicleIndex = 0; x = 0; z = 0; speed = 0; elapsed = 0; distance = 0;
  health = 3; score = 0; combo = 0; overtakes = 0; remaining = 650;
  status: 'ready' | 'playing' | 'paused' | 'won' | 'lost' = 'ready';
  traffic: Traffic[] = []; events: GameEvent[] = [];
  rearThreats: RearThreat[] = []; projectiles: Projectile[] = [];
  nearMisses = 0; maxCombo = 0; stars: 0 | 1 | 2 | 3 = 0; rank = 'Learner';
  readonly stage: StageProfile; readonly stageIndex: 0 | 1 | 2;
  invulnerable = 0; hornCooldown = 0;
  y = 0; airTime = -1; jumpCooldown = 0;
  coins: Coin[] = []; snacks: Snack[] = []; effects: Effects = newEffects(); taka = 0; banked = false;
  readonly powerUps: PowerUpStats;
  private coinChain = 0; private lastCoinAt = -10;
  readonly routeLength: number;
  private rng: number;
  private yielding = new Map<number, { x: number; until: number }>();
  private passiveSides = new Map<number, number>();
  private crossing = new Map<number, { target: number; startsAt: number }>();
  private hit = new Set<number>();
  private contacted = new Set<number>();
  private cleared = new Set<number>();
  private thrown = new Set<number>();
  private encounterId = 1000;
  private rearEncounters = 0;
  private paanEncounters = 0;
  private nextReactiveTime = 0;
  private chainUntil = 0;
  private rearDelays = new Map<number, number>();

  constructor(index = 0, seed = 1, stageIndex = 0, powerUps: PowerUpStats = BASE_POWER_UPS) {
    this.vehicleIndex = Number.isFinite(index) ? clamp(Math.floor(index), 0, VEHICLES.length - 1) : 0;
    this.stage = getStage(this.vehicleIndex, stageIndex); this.stageIndex = this.stage.lessonIndex;
    this.rng = ((seed + this.stage.id * 7919) >>> 0) || 1;
    this.routeLength = this.stage.routeLength;
    this.remaining = this.routeLength;
    this.powerUps = powerUps;
    this.createTraffic();
    const jump = JUMPS[VEHICLES[this.vehicleIndex].id];
    ({ coins: this.coins, snacks: this.snacks } = placePickups({ traffic: this.traffic, routeLength: this.routeLength, startSpeed: this.maxSpeed, ambushes: this.stageIndex,
      arcHeight: jump.height, arcClears: jump.clears.filter(kind => kind !== 'splash'), random: () => this.random() }));
  }
  neighborhoodAt(distance: number): Neighborhood {
    const zone = Math.floor(Math.max(0, Number.isFinite(distance) ? distance : 0) / 210);
    return NEIGHBORHOODS[(NEIGHBORHOODS.indexOf(this.stage.neighborhood) + zone) % NEIGHBORHOODS.length];
  }
  get neighborhood(): Neighborhood { return this.neighborhoodAt(this.distance); }
  // Speed builds steadily from the mission's starting pace to its finish boost.
  get maxSpeed(): number {
    const start = VEHICLES[this.vehicleIndex].maxSpeed * this.stage.speedScale;
    const progress = clamp(this.distance / this.routeLength, 0, 1);
    return Math.min(SPEED_CAP, start * (1 + (this.stage.finishBoost - 1) * progress));
  }
  get airborne(): boolean { return this.airTime >= 0; }
  get repMultiplier(): number { return this.effects.boost > 0 ? 2 : 1; }

  // A warned bus or truck clears loose coins from its lane so they never lure a rider into it.
  sweepCoins(x: number): void {
    for (const coin of this.coins) if (!coin.collected && Math.abs(coin.x - x) < 2.6 && coin.z < this.z + 6 && coin.z > this.z - 120) coin.gone = true;
  }

  // Chaap's full belly soaks up one ordinary hit: no heart lost.
  private absorbHit(id: number, x: number, z: number): boolean {
    if (!this.effects.belly) return false;
    this.effects.belly = false; this.hit.add(id); this.invulnerable = 2; this.speed *= 0.6; this.combo = 0;
    this.events.push({ type: 'belly', text: 'Full belly! Bounced right off.', x, z, actorId: id });
    return true;
  }

  private updatePickups(dt: number): void {
    const vehicle = VEHICLES[this.vehicleIndex];
    if (tickEffects(this.effects, dt, this.rearThreats.length > 0)) this.events.push({ type: 'stomach', text: 'পেট গুড়গুড়! Tummy trouble — hold steady.', x: this.x, z: this.z, priority: 'urgent' });
    const reachX = vehicle.width / 2 + 0.45, reachZ = vehicle.length / 2 + 0.3;
    for (const coin of this.coins) {
      if (coin.collected || coin.gone) continue;
      const ahead = this.z - coin.z;
      if (ahead < -reachZ - 2 || ahead > 30) continue;
      if (this.effects.magnet > 0 && coin.trail !== 'arc') {
        const gap = Math.hypot(coin.x - this.x, ahead);
        if (gap > 1e-6 && gap < this.powerUps.magnetRadius + reachX) {
          const pull = Math.min(1, 14 * dt / gap);
          coin.x += (this.x - coin.x) * pull; coin.z += (this.z - coin.z) * pull; coin.y += (COIN_HEIGHT + this.y - coin.y) * pull;
        }
      }
      if (Math.abs(coin.x - this.x) < reachX && Math.abs(this.z - coin.z) < reachZ && coin.y - COIN_HEIGHT <= this.y + 0.25 && (coin.trail !== 'arc' || this.airborne)) {
        coin.collected = true; this.taka += coin.value;
        this.coinChain = this.elapsed - this.lastCoinAt <= 0.6 ? this.coinChain + 1 : 1; this.lastCoinAt = this.elapsed;
        this.events.push({ type: 'coin', text: `৳${coin.value}`, x: coin.x, z: coin.z, value: coin.value, chain: this.coinChain });
      }
    }
    for (const snack of this.snacks) {
      if (snack.eaten || Math.abs(snack.x - this.x) >= vehicle.width / 2 + 0.5 || Math.abs(this.z - snack.z) >= vehicle.length / 2 + 0.4) continue;
      snack.eaten = true;
      eatSnack(this.effects, snack.kind, this.powerUps, this.random());
      this.events.push({ type: 'snack', text: SNACK_TEXT[snack.kind], kind: snack.kind, x: snack.x, z: snack.z });
    }
  }

  jump(): boolean {
    if (this.status !== 'playing' || this.airborne || this.jumpCooldown > 0) return false;
    this.airTime = 0;
    this.events.push({ type: 'jump', text: 'Hop!', x: this.x, z: this.z });
    return true;
  }

  private get jumpProfile(): JumpProfile { return JUMPS[VEHICLES[this.vehicleIndex].id]; }

  private updateJump(dt: number): void {
    if (!this.airborne) { this.jumpCooldown = Math.max(0, this.jumpCooldown - dt); return; }
    const profile = this.jumpProfile;
    this.airTime += dt;
    const t = this.airTime / profile.airtime;
    if (t < 1) { this.y = 4 * profile.height * t * (1 - t); return; }
    this.airTime = -1; this.y = 0; this.jumpCooldown = JUMP_COOLDOWN;
    this.events.push({ type: 'land', text: '', x: this.x, z: this.z });
  }

  private clears(kind: string): boolean {
    return this.airborne && (this.jumpProfile.clears as string[]).includes(kind);
  }

  private random(): number {
    this.rng = (Math.imul(this.rng, 1664525) + 1013904223) >>> 0;
    return this.rng / 4294967296;
  }

  private createTraffic(): void {
    const kinds: Traffic['kind'][] = ['rickshaw', 'bus', 'cng', 'bicycle', 'car'];
    // Sweep the full road over successive encounters: neither curb is a safe autopilot lane.
    // Each obstacle has a separate row. Repeated curb/center encounters prevent
    // a held steering key or no input from unlocking the next vehicle automatically.
    const hazardLines: (number | null)[] = [-4.55, 4.55, 0, null, -2.8, 2.8, null,
      -4.55, 4.55, 0, null, -1.4, 1.4, null, -4.55, 4.55, 0, null];
    const lateLines = [-2.8, 2.8, 0, -4.55, 4.55, -1.4, 1.4];
    const lateKinds = ['pothole', 'paan', 'cow'] as const;
    const mirror = this.random() < 0.5 ? -1 : 1;
    let id = 0;
    const addMoving = (kind: VehicleKind | 'bus' | 'cng', distance: number, x: number) => {
      const profile = VEHICLES.find(vehicle => vehicle.id === kind);
      this.traffic.push({ id: id++, kind, x, z: -distance, width: profile?.width ?? (kind === 'bus' ? 2.4 : 1.5),
        length: profile?.length ?? (kind === 'bus' ? 6.5 : 2.5), speed: 3, passed: false, warn: false });
    };
    // A readable opening tableau: the rider is immediately part of moving Dhaka traffic.
    addMoving('cng', 14, 1.8 * mirror);
    addMoving('bus', 28, -2.7 * mirror);
    addMoving('rickshaw', 42, 0.4 * mirror);
    // Hazard rows keep their 28 m rhythm; later missions add moving traffic between them.
    const busier = this.stage.densityScale > 1, busiest = this.stage.densityScale > 1.2;
    for (let distance = 42, row = 0; distance < this.routeLength - 25; distance += 28, row++) {
        // After the scripted opening, hazards keep coming to the finish, more often in later missions.
        const lateHazard = row % 7 !== 3 && (this.stageIndex === 0 ? row % 2 === 0 : row % 3 !== 2);
        const hazardX = row < hazardLines.length ? hazardLines[row] : lateHazard ? lateLines[row % lateLines.length] : null;
        const hazard = hazardX !== null;
        const pedestrian = !hazard && row % 7 === 3;
        const kind = hazard ? (row >= hazardLines.length ? lateKinds[row % 3] : row === 11 ? 'cow' : row % 2 === 0 ? 'pothole' : 'paan') : pedestrian ? 'pedestrian' : kinds[Math.floor(this.random() * kinds.length)];
        const profile = VEHICLES.find(vehicle => vehicle.id === kind);
        const width = profile?.width ?? (kind === 'bus' ? 2.4 : kind === 'cng' ? 1.5 : kind === 'pedestrian' ? 0.65 : 1.65);
        const length = profile?.length ?? (kind === 'bus' ? 6.5 : kind === 'cng' ? 2.5 : kind === 'pedestrian' ? 0.65 : kind === 'cow' ? 2.1 : 1.4);
        const side = this.random() < 0.5 ? -1 : 1;
        const thrower = pedestrian && this.stageIndex > 0 && row % 2 === 1;
        const x = hazard ? hazardX * mirror : side * (pedestrian ? (thrower ? 5.75 : 4.65) : 3.9 + this.random() * 0.15);
        this.traffic.push({ id: id++, kind, x, z: -distance, width, length,
          ...(pedestrian ? { behavior: thrower ? 'paan-thrower' as const : 'crossing' as const } : {}),
          // Equal traffic speeds prevent seeded rows bunching into unplanned moving walls.
          speed: hazard || pedestrian ? 0 : 3, passed: false, warn: false });
        // Intermediate rows add city life without stacking actors across the road.
        // Nearby moving vehicles share a side in small groups; hazards still make
        // every straight corridor unsafe somewhere along the complete route.
        if ((row % 4 !== 3 || busier) && distance + 14 < this.routeLength - 25) {
          const lightTraffic: (VehicleKind | 'cng')[] = ['rickshaw', 'cng', 'bicycle'];
          const trafficKind = lightTraffic[(row + Math.floor(this.random() * 3)) % lightTraffic.length];
          const trafficSide = (Math.floor(row / 3) % 2 === 0 ? 1 : -1) * mirror;
          const inner = row % (this.stageIndex === 2 ? 3 : 5) === 0;
          const innerKind = this.stageIndex === 2 && row % 2 ? trafficKind : 'bicycle';
          addMoving(inner ? innerKind : trafficKind, distance + 14, inner ? trafficSide * (1 + this.random() * 0.35) : trafficSide * (3.9 + this.random() * 0.15));
        }
        // The busiest missions add a curbside vehicle on the opposite side every eighth row.
        if (busiest && row % 8 === 1 && distance + 20.5 < this.routeLength - 25) {
          const side = (Math.floor(row / 3) % 2 === 0 ? -1 : 1) * mirror;
          addMoving(row % 16 === 1 ? 'rickshaw' : 'cng', distance + 20.5, side * (3.9 + this.random() * 0.15));
        }
    }
  }

  start(): void {
    if (this.status !== 'ready') return;
    this.status = 'playing';
    this.speed = 3;
    this.events.push({ type: 'start', text: 'Find your gap. The city is moving.' });
  }

  update(dt: number, input: Input): void {
    if (this.status !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    // Bound tab-resume spikes and use short steps for collision stability.
    let left = Math.min(dt, 0.25);
    while (left > 1e-8 && this.status === 'playing') {
      const step = Math.min(left, 1 / 60);
      this.step(step, input);
      left -= step;
    }
    // Results always show the rider on the road.
    const status = this.status as Simulation['status']; // step() may have ended the ride
    if (status === 'won' || status === 'lost') { this.airTime = -1; this.y = 0; }
  }

  private step(dt: number, input: Input): void {
    const vehicle = VEHICLES[this.vehicleIndex];
    this.elapsed += dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.hornCooldown = Math.max(0, this.hornCooldown - dt);
    this.updateJump(dt);
    if (this.elapsed > this.chainUntil) this.combo = 0;
    const pace = Math.min(SPEED_CAP, this.maxSpeed * (this.effects.boost > 0 ? CHA_SPEED : 1)) * (this.effects.stomach > 0 ? STOMACH_SPEED : 1);
    const targetSpeed = input.brake ? 1.4 : pace;
    const response = input.brake ? 3.5 : 1.05;
    this.speed += (targetSpeed - this.speed) * (1 - Math.exp(-response * dt));
    const wobble = this.effects.stomach > 0 ? Math.sin(this.elapsed * 7) * 0.35 : 0;
    const steer = clamp((Number.isFinite(input.steer) ? clamp(input.steer, -1, 1) : 0) + wobble, -1, 1) * (this.airborne ? AIR_STEERING : 1);
    this.x = clamp(this.x + steer * vehicle.steering * (0.45 + 0.55 * this.speed / this.maxSpeed) * dt,
      -ROAD_HALF_WIDTH + vehicle.width / 2, ROAD_HALF_WIDTH - vehicle.width / 2);
    this.distance = Math.min(this.routeLength, this.distance + this.speed * dt);
    this.z = -this.distance;
    this.remaining = Math.max(0, this.routeLength - this.distance);
    this.updateRearThreats(dt);
    this.updateProjectiles(dt);
    if (this.status !== 'playing') return;
    this.updatePickups(dt);

    for (const actor of this.traffic) {
      if (actor.behavior === 'rear-threat') continue;
      actor.z -= actor.speed * dt;
      const yieldTo = this.yielding.get(actor.id);
      if (yieldTo) {
        if (yieldTo.until < this.elapsed) this.yielding.delete(actor.id);
        else actor.x += clamp(yieldTo.x - actor.x, -(1.8 + vehicle.authority * 0.26) * dt, (1.8 + vehicle.authority * 0.26) * dt);
      }
      const ahead = this.z - actor.z;
      if (!yieldTo && actor.speed > 0 && authority(actor.kind) < vehicle.authority && ahead > -3 && ahead < 8 + vehicle.authority * 8) {
        const side = this.passiveSides.get(actor.id) ?? (actor.x === this.x ? (actor.id % 2 === 0 ? 1 : -1) : Math.sign(actor.x - this.x));
        this.passiveSides.set(actor.id, side);
        const edge = ROAD_HALF_WIDTH - actor.width / 2 - 0.1;
        const target = side * edge;
        const shift = (0.2 + vehicle.authority * 0.35) * dt;
        // Yield only outward; never pull an already-clear vehicle into the rider's line.
        if (side * (target - actor.x) > 0) actor.x += clamp(target - actor.x, -shift, shift);
      }
      if (actor.behavior === 'paan-thrower') {
        if (this.elapsed >= this.nextReactiveTime && this.paanEncounters < this.stageIndex && !this.thrown.has(actor.id) && this.projectiles.length === 0 && this.rearThreats.length === 0 && ahead > 12 && ahead < Math.max(38, this.speed * 3.2)) this.throwPaan(actor);
        continue;
      }
      const warningDistance = actor.kind === 'pedestrian' ? 38 : Math.max(24, this.speed * 1.6);
      if (!actor.warn && ahead > 0 && ahead < warningDistance && (actor.kind === 'paan' || actor.kind === 'pothole' || actor.kind === 'bus' || actor.kind === 'pedestrian' || actor.kind === 'cow')) {
        actor.warn = true;
        if (actor.kind === 'pedestrian') this.crossing.set(actor.id, { target: actor.x <= 0 ? 4.65 : -4.65, startsAt: this.elapsed + 0.85 });
        const text = actor.kind === 'cow' ? 'A cow is resting ahead. Give it room.' : actor.kind === 'paan' ? 'Paan spill ahead — mind the red!' : actor.kind === 'pothole' ? 'Pothole ahead — pick your line.' : actor.kind === 'pedestrian' ? 'Someone crossing — give them room.' : 'Ostad, baame plastic!';
        this.events.push({ type: 'warning', text, x: actor.x, z: actor.z, actorId: actor.id, priority: 'normal' });
      }
      const walk = this.crossing.get(actor.id);
      if (actor.kind === 'pedestrian' && walk && this.elapsed > walk.startsAt && !yieldTo) {
        actor.x = clamp(actor.x + clamp(walk.target - actor.x, -0.95 * dt, 0.95 * dt),
          -ROAD_HALF_WIDTH + actor.width / 2, ROAD_HALF_WIDTH - actor.width / 2);
      }
      // Ground hazards have irregular painted edges; require the wheel path to
      // enter the solid center, rather than punishing a barely grazed outline.
      const lateralContact = actor.kind === 'pothole' || actor.kind === 'paan' ? 0.38 : 0.43;
      const overlapX = Math.abs(this.x - actor.x) < (vehicle.width + actor.width) * lateralContact;
      const overlapZ = Math.abs(ahead) < (vehicle.length + actor.length) * 0.43;
      // Being airborne at first overlap clears the hazard for the whole pass.
      if (overlapX && overlapZ && !this.hit.has(actor.id) && this.clears(actor.kind)) this.cleared.add(actor.id);
      const contact = overlapX && overlapZ && !this.cleared.has(actor.id);
      if (contact) { this.contacted.add(actor.id); this.combo = 0; }
      if (contact && this.invulnerable <= 0 && !this.hit.has(actor.id) && this.absorbHit(actor.id, actor.x, actor.z)) continue;
      if (contact && this.invulnerable <= 0 && !this.hit.has(actor.id)) {
        this.hit.add(actor.id);
        this.health = Math.max(0, this.health - 1);
        const pothole = actor.kind === 'pothole';
        this.speed *= pothole ? 0.7 : 0.28;
        if (pothole) this.events.push({ type: 'bump', text: 'Bump!', x: actor.x, z: actor.z, actorId: actor.id });
        this.invulnerable = 2;
        this.combo = 0;
        this.events.push({ type: 'crash', text: actor.kind === 'paan' ? 'Paan on the road! Shake it off.' : actor.kind === 'pothole' ? 'Oof! Watch those potholes.' : 'Easy, boss! Find a little space.', x: actor.x, z: actor.z, actorId: actor.id, priority: 'urgent' });
        if (this.health === 0) {
          this.status = 'lost';
          this.speed = 0;
          this.events.push({ type: 'lose', text: 'A tough street. One more ride?' });
          break;
        }
      }
      if (!actor.passed && ahead < -(vehicle.length + actor.length) / 2 - 0.8) {
        actor.passed = true;
        if (!this.contacted.has(actor.id)) {
          this.overtakes++;
          const gap = Math.abs(this.x - actor.x) - (vehicle.width + actor.width) / 2;
          const close = gap > 0 && gap < 0.9;
          if (close) {
            this.nearMisses++; this.combo = Math.min(9, this.combo + 1); this.maxCombo = Math.max(this.maxCombo, this.combo); this.chainUntil = this.elapsed + 5;
            this.score += 35 * this.combo * this.repMultiplier;
            this.events.push({ type: 'near-miss', text: `Close shave! ×${this.combo}`, x: actor.x, z: actor.z, actorId: actor.id });
          } else { this.score += 15 * this.repMultiplier; this.events.push({ type: 'pass', text: 'Clean pass', x: actor.x, z: actor.z, actorId: actor.id }); }
        }
      }
    }
    if (this.remaining <= 0 && this.status === 'playing') {
      this.status = 'won';
      this.speed = 0;
      this.score += 500 + this.health * 150;
      this.stars = this.health >= 2 ? 2 : 1;
      if (this.health === 3 && this.nearMisses >= this.stage.nearMissTarget && this.elapsed <= this.stage.parTime) this.stars = 3;
      this.rank = this.stars === 3 ? 'Street Royalty' : this.stars === 2 ? 'Streetwise' : 'Road Learner';
      this.events.push({ type: 'win', text: this.stage.id === 14 ? 'King of Dhaka Streets!' : 'Lesson complete. The next ride awaits.' });
    }
  }

  private throwPaan(actor: Traffic): void {
    this.paanEncounters++;
    this.thrown.add(actor.id); actor.warn = true;
    const targetX = clamp(this.x, -4.45, 4.45), targetZ = this.z - Math.max(10, this.speed * 2.65);
    this.projectiles.push({ id: this.encounterId++, sourceId: actor.id, phase: 'telegraph', sourceX: actor.x, sourceZ: actor.z,
      targetX, targetZ, x: actor.x, y: 1.35, z: actor.z, radius: 0.72, progress: 0, remaining: 2 });
    this.events.push({ type: 'paan-warning', text: 'Paan incoming! Watch the red circle.', x: targetX, z: targetZ, actorId: actor.id, priority: 'urgent' });
  }

  private updateProjectiles(dt: number): void {
    const vehicle = VEHICLES[this.vehicleIndex];
    for (const p of this.projectiles) {
      p.remaining = Math.max(0, p.remaining - dt);
      const duration = p.phase === 'telegraph' ? 2 : p.phase === 'flying' ? 0.65 : 0.8;
      p.progress = clamp(1 - p.remaining / duration, 0, 1);
      if (p.phase === 'telegraph' && p.remaining <= 1e-8) {
        p.phase = 'flying'; p.remaining = 0.65; p.progress = 0;
        this.events.push({ type: 'paan-launch', text: 'Heads up — paan splash!', x: p.sourceX, z: p.sourceZ, actorId: p.sourceId });
      } else if (p.phase === 'flying') {
        p.x = p.sourceX + (p.targetX - p.sourceX) * p.progress;
        p.z = p.sourceZ + (p.targetZ - p.sourceZ) * p.progress;
        p.y = 1.35 * (1 - p.progress) + Math.sin(Math.PI * p.progress) * 1.25;
        if (p.remaining <= 1e-8) { p.phase = 'splash'; p.remaining = 0.8; p.progress = 0; p.x = p.targetX; p.z = p.targetZ; p.y = 0.03; }
      }
      if (p.phase === 'splash' && !this.clears('splash') && Math.abs(this.x - p.x) < vehicle.width / 2 + p.radius && Math.abs(this.z - p.z) < vehicle.length / 2 + p.radius) {
        this.contacted.add(p.id); this.combo = 0;
        if (this.invulnerable <= 0 && !this.hit.has(p.id) && !this.absorbHit(p.id, p.x, p.z)) {
          this.hit.add(p.id); this.health = Math.max(0, this.health - 1); this.speed *= 0.4; this.invulnerable = 2;
          this.events.push({ type: 'crash', text: 'Paan ambush! Shake it off.', x: p.x, z: p.z, actorId: p.sourceId, priority: 'urgent' });
          if (this.health === 0) { this.status = 'lost'; this.speed = 0; this.events.push({ type: 'lose', text: 'A tough street. One more try?' }); }
        }
      }
    }
    const active = this.projectiles.filter(p => !(p.phase === 'splash' && p.remaining <= 1e-8));
    if (active.length < this.projectiles.length) this.nextReactiveTime = this.elapsed + 3;
    this.projectiles = active;
  }

  private escapeExists(threat: RearThreat): boolean {
    const vehicle = VEHICLES[this.vehicleIndex];
    const threatWidth = threat.kind === 'bus' ? 2.4 : 2.5;
    const edge = ROAD_HALF_WIDTH - vehicle.width / 2 - 0.1;
    if (this.traffic.some(t => t.behavior !== 'rear-threat' && t.behavior !== 'paan-thrower' && !t.passed &&
      this.z - t.z > -(t.length + vehicle.length) / 2 && this.z - t.z < Math.max(0, this.speed - t.speed) * 0.5 + (t.length + vehicle.length) / 2 &&
      Math.abs(t.x - this.x) < (t.width + vehicle.width) / 2 + 0.15)) return false;
    const positions = [-edge, -2.5, 0, 2.5, edge];
    return positions.some(x => {
      if (Math.abs(x) > edge || Math.abs(x - threat.x) < (vehicle.width + threatWidth) / 2 + 0.4) return false;
      // Include half a second to react, then enough room to steer at low-speed response.
      const reactionAndSteering = 0.5 + Math.abs(x - this.x) / (vehicle.steering * 0.45);
      if (reactionAndSteering > 3) return false;
      return !this.traffic.some(t => {
        if (t.behavior === 'rear-threat' || t.behavior === 'paan-thrower' || t.passed) return false;
        const ahead = this.z - t.z;
        if (ahead < -(t.length + vehicle.length) / 2 || ahead > Math.max(10, this.speed * (reactionAndSteering + 0.6))) return false;
        if (Math.abs(t.x - x) < (t.width + vehicle.width) / 2 + 0.3) return true;
        const crossingTime = Math.max(0, ahead - (t.length + vehicle.length) / 2) / Math.max(1, this.speed - t.speed);
        const pathX = this.x + clamp(x - this.x, -Math.max(0, crossingTime - 0.5) * vehicle.steering * 0.45, Math.max(0, crossingTime - 0.5) * vehicle.steering * 0.45);
        return Math.abs(t.x - pathX) < (t.width + vehicle.width) / 2 + 0.15;
      });
    });
  }

  private updateRearThreats(dt: number): void {
    const vehicle = VEHICLES[this.vehicleIndex];
    const encounterCount = this.stageIndex === 0 ? 0 : this.stageIndex === 1 ? 1 : 2;
    if (this.elapsed >= this.nextReactiveTime && this.rearEncounters < encounterCount && this.distance >= 180 + this.rearEncounters * 280 && this.remaining > 140 && this.rearThreats.length === 0 && this.projectiles.length === 0) {
      const kind = this.vehicleIndex < 2 ? 'bus' : 'truck';
      const actorId = this.encounterId, x = clamp(this.x, -2, 2), z = this.z + 36;
      const candidate: RearThreat = { actorId, kind, x, z, warningRemaining: 3 + dt, timeToContact: 7, urgency: 0, phase: 'warning' };
      if (this.escapeExists(candidate)) {
      this.rearEncounters++; this.encounterId++;
      this.rearThreats.push(candidate);
      this.traffic.push({ id: actorId, kind, x, z, speed: this.maxSpeed + 9, width: kind === 'bus' ? 2.4 : 2.5, length: 6.5,
        passed: false, warn: true, behavior: 'rear-threat', phase: 'warning', warningRemaining: 3 });
      this.events.push({ type: 'rear-warning', text: kind === 'bus' ? 'Bus behind! Move out of the marked lane.' : 'Truck behind! Clear its lane.', x, z, actorId, priority: 'urgent' });
      }
    }
    const done = new Set<number>();
    for (const threat of this.rearThreats) {
      const actor = this.traffic.find(t => t.id === threat.actorId);
      if (!actor) { done.add(threat.actorId); continue; }
      this.sweepCoins(threat.x); // every step, so coins that scroll into range mid-encounter are cleared too
      if (threat.phase === 'warning') {
        threat.warningRemaining = Math.max(0, threat.warningRemaining - dt);
        threat.z = this.z + 36;
        if (threat.warningRemaining <= 1e-8) {
          if (this.escapeExists(threat)) { threat.phase = 'passing'; actor.phase = 'active'; }
          else {
            const delay = (this.rearDelays.get(threat.actorId) ?? 0) + 0.25;
            this.rearDelays.set(threat.actorId, delay);
            if (delay >= 1.25) {
              done.add(threat.actorId); actor.behavior = undefined; actor.phase = 'passed'; actor.passed = true; actor.speed = 1;
              this.events.push({ type: 'warning', text: 'Heavy traffic has slowed behind you. Keep moving.', x: threat.x, z: threat.z, actorId: actor.id });
            } else threat.warningRemaining = 0.25;
          }
        }
      } else {
        threat.z -= actor.speed * dt;
        const overlap = Math.abs(this.x - threat.x) < (vehicle.width + actor.width) * 0.43 && Math.abs(this.z - threat.z) < (vehicle.length + actor.length) * 0.43;
        if (overlap) {
          this.contacted.add(actor.id); this.combo = 0; this.health = 0; this.speed = 0; this.status = 'lost';
          this.events.push({ type: 'crash', text: 'Caught by the heavy traffic behind you!', x: threat.x, z: threat.z, actorId: actor.id, priority: 'urgent' });
          this.events.push({ type: 'lose', text: 'Listen for the rear warning and clear the marked lane.' });
        }
        if (this.z - threat.z > 12) { done.add(threat.actorId); actor.behavior = undefined; actor.phase = 'passed'; actor.passed = true; this.score += 50 * this.repMultiplier; }
      }
      actor.x = threat.x; actor.z = threat.z; actor.warningRemaining = threat.warningRemaining;
      threat.timeToContact = Math.max(0, threat.z - this.z) / Math.max(1, actor.speed - this.speed) + threat.warningRemaining;
      threat.urgency = clamp(1 - threat.timeToContact / 7, 0, 1);
    }
    if (done.size) this.nextReactiveTime = this.elapsed + 3;
    this.rearThreats = this.rearThreats.filter(t => !done.has(t.actorId));
  }

  horn(): void {
    if (this.status !== 'playing' || this.hornCooldown > 0) return;
    const vehicle = VEHICLES[this.vehicleIndex];
    this.hornCooldown = this.vehicleIndex < 2 ? 0.85 : 1.4;
    this.events.push({ type: 'horn', text: this.vehicleIndex < 2 ? 'Ting ting! A little room, please.' : this.vehicleIndex === 4 ? 'The King is coming through!' : 'Coming through!', x: this.x, z: this.z });
    for (const actor of this.traffic) {
      const ahead = this.z - actor.z;
      if (actor.behavior === 'rear-threat' || actor.behavior === 'paan-thrower' || ahead < -4 || ahead > 38 + vehicle.authority * 4 || authority(actor.kind) >= vehicle.authority) continue;
      const side = actor.x === this.x ? (actor.id % 2 === 0 ? 1 : -1) : Math.sign(actor.x - this.x);
      const edge = ROAD_HALF_WIDTH - actor.width / 2 - 0.1;
      this.yielding.set(actor.id, { x: side * edge, until: this.elapsed + 3.5 });
    }
  }

  pause(): void { if (this.status === 'playing') this.status = 'paused'; }
  resume(): void { if (this.status === 'paused') this.status = 'playing'; }
}
