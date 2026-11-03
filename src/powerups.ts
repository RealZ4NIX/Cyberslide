/* CYBERSLIDE - power-ups as pure data: where the pickups sit on the hill, what each one does and how long it lasts.
   Track pickups are common and small and sit on the snow or on ground rails. Sky pickups are rare and stronger and
   float where a committed jump off a kicker, big ramp, mega ramp or side quarterpipe will take you. Placement uses its
   own seeded random stream, so adding pickups never moves anything else on the course. pickups.ts draws them. */

import { base, C, H, HALF, MEGA_CAP, rampSum, railY, rng, seg, SEG } from './course';
import type { Segment, SegKind } from './course';

export type PowerKind = 'over' | 'x2' | 'shield' | 'grav' | 'time';
export const POWER_KINDS: PowerKind[] = ['over', 'x2', 'shield', 'grav', 'time'];

export interface PowerDef {
  name: string;
  /** hologram colour */
  color: number;
  css: string;
  /** seconds the effect lasts (shield: bails it absorbs, time: seconds it adds), [track, sky] */
  amount: [number, number];
}
export const POWER: Record<PowerKind, PowerDef> = {
  over: { name: 'OVERCLOCK', color: 0xff3b6b, css: '#ff3b6b', amount: [2, 3] },
  x2: { name: 'SCORE x2', color: 0xffd23f, css: '#ffd23f', amount: [6, 9] },
  shield: { name: 'COMBO SHIELD', color: 0x3bf0ff, css: '#3bf0ff', amount: [1, 2] },
  grav: { name: 'LOW-GRAV', color: 0xb07cff, css: '#b07cff', amount: [5, 7.5] },
  time: { name: 'TIME CHIP', color: 0x3dff8a, css: '#3dff8a', amount: [5, 10] },
};
/** how long a combo shield waits for a bail before it runs out (s), [track, sky] */
export const SHIELD_T: [number, number] = [20, 30];
/** instant speed an overclock pickup adds (m/s), [track, sky] */
export const OVER_KICK: [number, number] = [7, 10];
/** gravity while a low-grav field is on */
export const LOW_G = 0.58;

export interface Pickup {
  id: string;
  /** the segment it belongs to (it can float a little past that segment's end) */
  k: number;
  kind: PowerKind;
  /** what it turns into when there is no clock to add time to (endless mode) */
  alt: PowerKind;
  sky: boolean;
  x: number;
  /** centre of the hologram */
  y: number;
  s: number;
  /** how close the rider has to get */
  r: number;
}

const TRACK_W: [PowerKind, number][] = [
  ['over', 30],
  ['x2', 22],
  ['shield', 14],
  ['grav', 16],
  ['time', 18],
];
// sky pickups lean toward the big rewards: double points and extra time are worth the risk
const SKY_W: [PowerKind, number][] = [
  ['over', 14],
  ['x2', 26],
  ['shield', 15],
  ['grav', 20],
  ['time', 25],
];
function pick(r: () => number, w: [PowerKind, number][], skip?: PowerKind): PowerKind {
  const list = skip ? w.filter((q) => q[0] !== skip) : w;
  let v = r() * list.reduce((a, q) => a + q[1], 0);
  for (const [k, n] of list) if ((v -= n) < 0) return k;
  return list[list.length - 1][0];
}

/** chance of a track pickup in a segment of this kind */
const TRACK_P: Partial<Record<SegKind, number>> = {
  clear: 0.6,
  open: 0.6,
  land: 0.55,
  bend: 0.6,
  bendc: 0.6,
  kicker: 0.55,
  big: 0.5,
  mega: 0.5,
  rails: 0.7,
  railchain: 0.7,
  kickrail: 0.7,
  mid: 0.45,
  sky: 0.45,
  window: 0.45,
  pipe: 0.55,
};
/** chance of a sky pickup above this kind's launch */
const SKY_P: Partial<Record<SegKind, number>> = { kicker: 0.3, big: 0.5, mega: 0.45, pipe: 0.4 };
// where a sky pickup floats, measured from real jumps: metres past the ramp's end and height above the snow.
// An easy jump peaks a little below these, so you have to commit (more speed or a charged pop) to reach them.
const SKY_SPOT: Partial<Record<SegKind, [number, number]>> = {
  kicker: [20, 7.5],
  big: [22, 10.5],
};
// a mega ramp's launch is capped, so its arc hardly depends on speed: follow the same launch the rider gets
// (player.ts: hill speed + MEGA_CAP + 2 up, gravity 28) at a typical lip speed, a little above the arc's top
const MEGA_V = 36,
  MEGA_T = 0.72;
function megaSpot(x: number, se: number): [number, number] {
  const hillV = (base(x, se + 1) - base(x, se)) * MEGA_V,
    vy = hillV + MEGA_CAP + 2;
  return [se + MEGA_V * MEGA_T, H(x, se - 0.01) + vy * MEGA_T - 14 * MEGA_T * MEGA_T + 1.6];
}
const TRACK_Y = 1.4,
  TRACK_R = 1.9,
  SKY_R = 2.8;

function clearOfBlocks(g: Segment, x: number, s: number): boolean {
  return g.blocks.every(
    (b) => Math.abs(s - b.s) > b.d / 2 + 4 || Math.abs(x - b.x) > b.w / 2 + 2.2,
  );
}

function place(g: Segment): Pickup[] {
  const out: Pickup[] = [];
  const kind = g.kind;
  if (g.k < 3 || kind.startsWith('tut') || kind === 'start') return out;
  const r = rng(g.k * 48271 + 991);
  const add = (sky: boolean, x: number, y: number, s: number): void => {
    const k = pick(r, sky ? SKY_W : TRACK_W);
    out.push({
      id: g.k + ':' + out.length,
      k: g.k,
      kind: k,
      alt: k === 'time' ? pick(r, sky ? SKY_W : TRACK_W, 'time') : k,
      sky,
      x,
      y,
      s,
      r: sky ? SKY_R : TRACK_R,
    });
  };
  // track pickup
  if (r() < (TRACK_P[kind] || 0)) {
    const rail = g.rails.find((q) => q.tier === 0 && q.x === q.x1 && q.len >= 15);
    const ramp = g.ramps[0];
    if (rail) {
      // on top of a ground rail: grind through it
      const s = rail.s + rail.len * (0.35 + r() * 0.3);
      add(false, rail.x, railY(rail, s) + 1.2, s);
    } else if (ramp && kind !== 'pipe') {
      // on the run-in, lining you up with the ramp
      const s = ramp.s - 8 - r() * 6;
      add(false, ramp.x, H(ramp.x, s) + TRACK_Y, s);
    } else {
      for (let tries = 0; tries < 4; tries++) {
        const s = g.s0 + 10 + r() * 50,
          x = C(s) + (r() - 0.5) * 2 * (HALF - 8);
        if (rampSum(x, s) > 0.05 || !clearOfBlocks(g, x, s)) continue;
        add(false, x, H(x, s) + TRACK_Y, s);
        break;
      }
    }
  }
  // sky pickup
  if (r() < (SKY_P[kind] || 0)) {
    const spot = SKY_SPOT[kind],
      ramp = g.ramps[0],
      wall = g.walls[0];
    if (kind === 'mega' && ramp) {
      const [s, y] = megaSpot(ramp.x, ramp.s + ramp.len);
      add(true, ramp.x, y, s);
    } else if (spot && ramp) {
      const s = ramp.s + ramp.len + spot[0];
      add(true, ramp.x, H(ramp.x, s) + spot[1], s);
    } else if (wall) {
      // high above a side quarterpipe, where a launch off its lip goes straight up
      const s = wall.s + 40 + r() * (wall.len - 90),
        x = C(s) + wall.side * 10;
      add(true, x, H(x, s) + 20 + r() * 4, s);
    }
  }
  return out;
}

const cache = new WeakMap<Segment, Pickup[]>();
/** the pickups in segment k (follows the course cache, so a new course plan gives new pickups) */
export function pickupsAt(k: number): Pickup[] {
  const g = seg(k);
  let p = cache.get(g);
  if (!p) {
    p = place(g);
    cache.set(g, p);
  }
  return p;
}
/** pickups that can be touched around distance s (this segment and its neighbours) */
export function pickupsNear(s: number): Pickup[] {
  const k = Math.floor(s / SEG);
  return pickupsAt(k - 1).concat(pickupsAt(k), pickupsAt(k + 1));
}
/** the power a pickup gives: time chips only exist on the clock; without one they are something else */
export const pickupKind = (p: Pickup, timed: boolean): PowerKind =>
  p.kind === 'time' && !timed ? p.alt : p.kind;

/** did the rider pass through this pickup moving from a to b? (rider position is the board; the body sits above it) */
export function touches(
  p: Pickup,
  ax: number,
  ay: number,
  as: number,
  bx: number,
  by: number,
  bs: number,
): boolean {
  ay += 0.9;
  by += 0.9;
  const dx = bx - ax,
    dy = by - ay,
    ds = bs - as;
  const L = dx * dx + dy * dy + ds * ds;
  let t = L > 1e-9 ? ((p.x - ax) * dx + (p.y - ay) * dy + (p.s - as) * ds) / L : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = ax + dx * t - p.x,
    ey = (ay + dy * t - p.y) * 0.8, // a little more forgiving up and down: body height
    es = as + ds * t - p.s;
  return ex * ex + ey * ey + es * es <= p.r * p.r;
}

/* ---------- active power-ups on the rider ---------- */
export interface Grant {
  kind: PowerKind;
  sky: boolean;
  amount: number;
}
/** timed effects on the rider; grabbing one that is already running refreshes it to full */
export class Powers {
  over = 0;
  overMax = 0;
  x2 = 0;
  x2Max = 0;
  grav = 0;
  gravMax = 0;
  /** bails the shield will still absorb, and how long it lasts */
  shield = 0;
  shieldT = 0;
  shieldMax = 0;

  reset(): void {
    this.over = this.overMax = this.x2 = this.x2Max = this.grav = this.gravMax = 0;
    this.shield = this.shieldT = this.shieldMax = 0;
  }
  tick(dt: number): void {
    if (this.over > 0) this.over = Math.max(0, this.over - dt);
    if (this.x2 > 0) this.x2 = Math.max(0, this.x2 - dt);
    if (this.grav > 0) this.grav = Math.max(0, this.grav - dt);
    if (this.shieldT > 0) {
      this.shieldT = Math.max(0, this.shieldT - dt);
      if (this.shieldT <= 0) this.shield = 0;
    }
  }
  grant(kind: PowerKind, sky: boolean): Grant {
    const amount = POWER[kind].amount[sky ? 1 : 0];
    if (kind === 'over') this.over = this.overMax = amount;
    else if (kind === 'x2') this.x2 = this.x2Max = amount;
    else if (kind === 'grav') this.grav = this.gravMax = amount;
    else if (kind === 'shield') {
      this.shield = Math.max(this.shield, amount);
      this.shieldT = this.shieldMax = SHIELD_T[sky ? 1 : 0];
    }
    return { kind, sky, amount };
  }
  /** overclock strength 0..1, easing out over its last 0.4 s */
  get overNow(): number {
    return this.over > 0 ? Math.min(1, this.over / 0.4) : 0;
  }
  get scoreMult(): number {
    return this.x2 > 0 ? 2 : 1;
  }
  /** gravity scale; eases back to normal over the last 0.5 s so the fall doesn't jolt */
  get gravScale(): number {
    return this.grav > 0 ? 1 - (1 - LOW_G) * Math.min(1, this.grav / 0.5) : 1;
  }
  /** use up one shield charge if there is one */
  absorb(): boolean {
    if (this.shield <= 0) return false;
    this.shield--;
    if (this.shield <= 0) this.shieldT = 0;
    return true;
  }
  /** what is running, for the HUD: kind, fraction of its time left (shield: also the bails it still takes) */
  list(): { kind: PowerKind; left: number; n?: number }[] {
    const a: { kind: PowerKind; left: number; n?: number }[] = [];
    if (this.over > 0) a.push({ kind: 'over', left: this.over / this.overMax });
    if (this.x2 > 0) a.push({ kind: 'x2', left: this.x2 / this.x2Max });
    if (this.grav > 0) a.push({ kind: 'grav', left: this.grav / this.gravMax });
    if (this.shield > 0)
      a.push({ kind: 'shield', left: this.shieldT / this.shieldMax, n: this.shield });
    return a;
  }
}
