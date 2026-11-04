/* Power-ups: placement on the real hill, the effect timers, and the effects on the real player physics. */
import './test-utils/fakeDom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ND } from './nd';
import './tricks';
import './world';
import './riders';
import './player';
import { C, H, kindAt, seg, setCoursePlan, setRunSeed } from './course';
import {
  LOW_G,
  pickupKind,
  pickupsAt,
  POWER,
  Powers,
  SHIELD_T,
  touches,
  type Pickup,
} from './powerups';

const idle = () => ({
  left: false,
  right: false,
  up: false,
  down: false,
  space: false,
  trick: false,
  grab: false,
  flip: false,
  ax: 0,
});
type Inp = ReturnType<typeof idle>;
const DT = 1 / 60;
function mkPlayer() {
  const p = new ND.Player(new THREE.Scene());
  const events: { n: string; d: Record<string, unknown> }[] = [];
  p.onEvent = (n: string, d: Record<string, unknown>) => events.push({ n, d });
  p.resetAll();
  return { p, events };
}

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  ND.riderId = 'nova';
});
afterEach(() => {
  setCoursePlan(null);
  setRunSeed(0);
});
/** every run rolls a new hill, so placement rules are checked on a few of them */
const SEEDS = [0, 3, 2024, -55555];

const N = 400;
function all(): Pickup[] {
  const out: Pickup[] = [];
  for (let k = 0; k < N; k++) out.push(...pickupsAt(k));
  return out;
}

describe('placement', () => {
  it('is deterministic and leaves the course itself untouched', () => {
    setCoursePlan(null);
    const before = JSON.stringify(Array.from({ length: 60 }, (_, k) => seg(k)));
    const a = JSON.stringify(Array.from({ length: 60 }, (_, k) => pickupsAt(k)));
    expect(JSON.stringify(Array.from({ length: 60 }, (_, k) => seg(k)))).toBe(before);
    setCoursePlan(null);
    expect(JSON.stringify(Array.from({ length: 60 }, (_, k) => pickupsAt(k)))).toBe(a);
  });

  it('keeps the start clear, track ones common, sky ones rare', () => {
    for (const seed of SEEDS) {
      setRunSeed(seed);
      for (let k = 0; k < 3; k++) expect(pickupsAt(k)).toEqual([]);
      const p = all(),
        track = p.filter((q) => !q.sky),
        sky = p.filter((q) => q.sky);
      expect(track.length / N).toBeGreaterThan(0.4);
      expect(track.length / N).toBeLessThan(0.75);
      expect(sky.length / N).toBeGreaterThan(0.04);
      expect(sky.length).toBeLessThan(track.length / 3);
      for (const k of ['over', 'x2', 'shield', 'grav', 'time'] as const) {
        expect(track.some((q) => q.kind === k)).toBe(true);
        expect(sky.some((q) => q.kind === k)).toBe(true);
      }
      expect(new Set(p.map((q) => q.id)).size).toBe(p.length);
    }
  });

  it('puts track ones just above the snow or a rail, clear of barriers, inside the course', () => {
    for (const seed of SEEDS) {
      setRunSeed(seed);
      for (const q of all().filter((x) => !x.sky)) {
        const above = q.y - H(q.x, q.s);
        expect(above).toBeGreaterThan(0.9);
        expect(above).toBeLessThan(6);
        // a run-in pickup lines up with a window ramp (11 m off centre) and can sit back in a bend before it
        expect(Math.abs(q.x - C(q.s))).toBeLessThan(14);
        const g = seg(q.k);
        for (const b of g.blocks)
          expect(Math.abs(q.s - b.s) > 3 || Math.abs(q.x - b.x) > b.w / 2 + 1).toBe(true);
      }
    }
  });

  it('only places sky ones high over launches', () => {
    for (const seed of SEEDS) {
      setRunSeed(seed);
      for (const q of all().filter((x) => x.sky)) {
        expect(['kicker', 'big', 'mega', 'pipe']).toContain(kindAt(q.k));
        expect(q.y - H(q.x, q.s)).toBeGreaterThan(7);
        expect(q.r).toBeGreaterThan(2);
      }
    }
  });

  it('turns time chips into another power when there is no clock', () => {
    setCoursePlan(null);
    const times = all().filter((q) => q.kind === 'time');
    expect(times.length).toBeGreaterThan(0);
    for (const q of times) {
      expect(pickupKind(q, true)).toBe('time');
      expect(pickupKind(q, false)).not.toBe('time');
    }
  });

  it('never gives the same power twice in a row, or even two apart', () => {
    for (const seed of SEEDS) {
      setRunSeed(seed);
      const line = all().sort((a, b) => a.s - b.s);
      for (const timed of [true, false]) {
        const kinds = line.map((q) => pickupKind(q, timed));
        for (let i = 2; i < kinds.length; i++)
          expect(new Set(kinds.slice(i - 2, i + 1)).size).toBe(3);
        if (!timed) expect(kinds).not.toContain('time');
      }
    }
  });

  it('deals the same powers however the segments are asked for', () => {
    setRunSeed(77);
    const ahead = JSON.stringify(pickupsAt(120)); // jump far ahead first
    const inOrder = JSON.stringify(Array.from({ length: 60 }, (_, k) => pickupsAt(k)));
    setRunSeed(77);
    expect(JSON.stringify(Array.from({ length: 60 }, (_, k) => pickupsAt(k)))).toBe(inOrder);
    expect(JSON.stringify(pickupsAt(120))).toBe(ahead);
    // forgotten segments (the course keeps only 60) come back with the same powers
    for (let k = 0; k < 200; k++) seg(k);
    expect(JSON.stringify(Array.from({ length: 60 }, (_, k) => pickupsAt(k)))).toBe(inOrder);
  });

  it('has no pickups on a practice plan (tutorial kinds)', () => {
    setCoursePlan((i) => (i % 2 ? 'tutramp' : 'tutbar'));
    for (let k = 0; k < 20; k++) expect(pickupsAt(k)).toEqual([]);
  });
});

describe('touching', () => {
  const p: Pickup = {
    id: 't',
    k: 0,
    kind: 'over',
    alt: 'over',
    sky: false,
    x: 0,
    y: 2,
    s: 50,
    r: 1.8,
  };
  it('catches a rider passing straight through, even fast', () => {
    expect(touches(p, 0, 1.1, 40, 0, 1.1, 60)).toBe(true);
  });
  it('misses a rider going past to the side or underneath', () => {
    expect(touches(p, 3, 1.1, 40, 3, 1.1, 60)).toBe(false);
    expect(touches(p, 0, -3, 40, 0, -3, 60)).toBe(false);
    expect(touches(p, 0, 1.1, 30, 0, 1.1, 40)).toBe(false);
  });
});

describe('timers', () => {
  it('runs out, and grabbing one again refreshes it to full instead of adding', () => {
    const w = new Powers();
    w.grant('x2', false);
    expect(w.scoreMult).toBe(2);
    w.tick(4);
    w.grant('x2', false);
    expect(w.x2).toBe(POWER.x2.amount[0]);
    w.tick(POWER.x2.amount[0] + 0.01);
    expect(w.scoreMult).toBe(1);
  });
  it('sky ones last longer and the shield takes as many bails as it has charges', () => {
    const w = new Powers();
    w.grant('grav', true);
    expect(w.grav).toBe(POWER.grav.amount[1]);
    expect(POWER.grav.amount[1]).toBeGreaterThan(POWER.grav.amount[0]);
    expect(w.gravScale).toBeCloseTo(LOW_G);
    w.grant('shield', true);
    expect(w.absorb()).toBe(true);
    expect(w.absorb()).toBe(true);
    expect(w.absorb()).toBe(false);
    expect(w.list().find((q) => q.kind === 'shield')).toBeUndefined();
  });
  it('an unused shield runs out after its time (longer from the sky)', () => {
    const w = new Powers();
    w.grant('shield', false);
    w.tick(SHIELD_T[0] - 0.5);
    expect(w.list().find((q) => q.kind === 'shield')?.left).toBeCloseTo(0.5 / SHIELD_T[0]);
    w.tick(1);
    expect(w.absorb()).toBe(false);
    w.grant('shield', true);
    w.tick(SHIELD_T[0] + 1);
    expect(w.absorb()).toBe(true);
    expect(SHIELD_T[1]).toBeGreaterThan(SHIELD_T[0]);
  });
});

describe('effects on the rider', () => {
  beforeEach(() => setCoursePlan(() => 'clear'));
  const ride = (
    p: { update: (dt: number, i: Inp) => void },
    sec: number,
    f: (i: number) => Partial<Inp> = () => ({}),
  ) => {
    for (let i = 0; i < Math.round(sec / DT); i++) p.update(DT, { ...idle(), ...f(i) });
  };

  it('score chip doubles the points tricks add', () => {
    const { p, events } = mkPlayer();
    p.addCombo('KICKFLIP', 500);
    p.power('x2', false);
    p.addCombo('KICKFLIP', 500);
    expect(p.combo.pts).toBe(1500);
    expect(events.filter((e) => e.n === 'trick').map((e) => e.d.x2)).toEqual([false, true]);
  });

  it('combo shield keeps the combo through one bail, then is gone', () => {
    const { p, events } = mkPlayer();
    p.power('shield', false);
    p.addCombo('KICKFLIP', 500);
    p.crash('Bad landing');
    expect(p.combo.pts).toBe(500);
    expect(p.combo.active).toBe(true);
    expect(events.find((e) => e.n === 'crash')?.d.shielded).toBe(true);
    ride(p, 1.5);
    p.addCombo('KICKFLIP', 500);
    p.crash('Bad landing');
    expect(p.combo.pts).toBe(0);
  });

  it('a bail with no combo running does not use the shield up', () => {
    const { p } = mkPlayer();
    p.power('shield', false);
    p.crash('Hit a barrier');
    expect(p.pw.shield).toBe(1);
  });

  it('overclock makes you much faster than riding without it', () => {
    const a = mkPlayer().p;
    ride(a, 1.5);
    const b = mkPlayer().p;
    ride(b, 1.5);
    a.power('over', false);
    ride(a, 2);
    ride(b, 2);
    expect(a.speed).toBeGreaterThan(b.speed + 8);
    expect(a.pw.over).toBeLessThan(1e-9);
  });

  it('low-grav field gives a higher, longer jump', () => {
    const jumpOf = (grav: boolean) => {
      const { p } = mkPlayer();
      ride(p, 1);
      if (grav) p.power('grav', false);
      ride(p, 0.4, () => ({ space: true }));
      let air = 0,
        peak = 0;
      for (let i = 0; i < 400; i++) {
        p.update(DT, idle());
        if (p.state === 'air') {
          air += DT;
          peak = Math.max(peak, p.peakAir);
        } else if (air > 0) break;
      }
      return { air, peak };
    };
    const n = jumpOf(false),
      g = jumpOf(true);
    expect(g.peak).toBeGreaterThan(n.peak * 1.4);
    expect(g.air).toBeGreaterThan(n.air * 1.3);
  });
});

describe('sky pickups can be reached', () => {
  it('a real jump off the launch below goes through each one', () => {
    for (const seed of SEEDS) {
      setRunSeed(seed);
      const sky = all().filter((q) => q.sky);
      const { p } = mkPlayer();
      const reached = (q: Pickup): boolean => {
        const kind = kindAt(q.k);
        const g = seg(q.k);
        for (const v of [22, 28, 34, 40, 46])
          for (const pre of [0, 5, 10, 16]) {
            for (const back of kind === 'pipe' ? [20, 30, 40, 50, 60] : [0]) {
              p.resetAll();
              if (kind === 'pipe') {
                p.s = q.s - back;
                p.x = C(p.s);
              } else {
                const r = g.ramps[0];
                p.s = r.s - 25;
                p.x = r.x;
              }
              p.y = H(p.x, p.s);
              p.speed = v;
              p.prevGv = -v * 0.4;
              const side = kind === 'pipe' ? g.walls[0].side : 0;
              let launched = false;
              for (let f = 0; f < 500; f++) {
                const i = idle();
                if (side && !launched) {
                  if (side > 0) i.right = true;
                  else i.left = true;
                }
                const r = g.ramps[0];
                // hold Space for the last `pre` metres of the run-in and let go at the lip: a charged pop
                if (
                  !side &&
                  pre &&
                  p.state === 'ride' &&
                  p.s > r.s + r.len - pre &&
                  p.s < r.s + r.len - 0.6
                )
                  i.space = true;
                const a = { x: p.x, y: p.y, s: p.s };
                p.update(DT, i);
                if (p.state === 'air') launched = true;
                if (touches(q, a.x, a.y, a.s, p.x, p.y, p.s)) return true;
                if (launched && p.state !== 'air') break;
                if (p.s > q.s + 40) break;
              }
            }
          }
        return false;
      };
      const miss = sky.filter((q) => !reached(q));
      expect(miss.map((q) => seed + ' ' + q.id + ' ' + kindAt(q.k))).toEqual([]);
    }
  });
});
