/* Headless runs of the real player physics on the real course: no renderer, just the simulation stepped at 60 fps. */
import './test-utils/fakeDom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ND } from './nd';
import './tricks';
import './world';
import './riders';
import './player';
import { C, H, setCoursePlan } from './course';

type Inp = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  space: boolean;
  trick: boolean;
  grab: boolean;
  flip: boolean;
  ax: number;
};
const idle = (): Inp => ({
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
const DT = 1 / 60;

function mkPlayer() {
  const p = new ND.Player(new THREE.Scene());
  const events: { n: string; d: Record<string, unknown> }[] = [];
  p.onEvent = (n: string, d: Record<string, unknown>) => events.push({ n, d });
  p.resetAll();
  return { p, events, names: () => events.map((e) => e.n) };
}
/** step the player; `input` may change the input per frame */
function run(
  p: { update: (dt: number, i: Inp) => void },
  seconds: number,
  input: (f: number) => Partial<Inp> = () => ({}),
) {
  const frames = Math.round(seconds / DT);
  for (let f = 0; f < frames; f++) p.update(DT, { ...idle(), ...input(f) });
}

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  ND.riderId = 'nova';
  // a flat, obstacle-free practice course keeps these runs about the rider, not the random hill
  setCoursePlan(() => 'clear');
});

describe('riding', () => {
  it('starts on the snow and picks up speed downhill', () => {
    const { p } = mkPlayer();
    expect(p.state).toBe('ride');
    const s0 = p.s;
    run(p, 3);
    expect(p.state).toBe('ride');
    expect(p.s).toBeGreaterThan(s0 + 20);
    expect(p.speed).toBeGreaterThan(8);
    expect(p.y).toBeCloseTo(H(p.x, p.s), 0);
  });

  it('steers with the arrows (and the stick)', () => {
    const a = mkPlayer().p;
    run(a, 1.2, () => ({ left: true }));
    const b = mkPlayer().p;
    run(b, 1.2, () => ({ ax: 1 }));
    expect(a.x).toBeLessThan(C(a.s) - 0.5);
    expect(b.x).toBeGreaterThan(C(b.s) + 0.5);
  });
});

describe('jumping', () => {
  it('a held-and-released Space is a charged jump, and you land back on the snow', () => {
    const { p, names } = mkPlayer();
    run(p, 1.5);
    run(p, 0.4, () => ({ space: true }));
    run(p, DT); // release
    expect(p.state).toBe('air');
    expect(names()).toContain('jump');
    run(p, 3);
    expect(p.state).toBe('ride');
    expect(names()).toContain('land');
  });

  it('a longer crouch jumps higher', () => {
    const peak = (hold: number) => {
      const { p } = mkPlayer();
      run(p, 1.5);
      run(p, hold, () => ({ space: true }));
      let best = 0;
      for (let f = 0; f < 120; f++) {
        p.update(DT, idle());
        best = Math.max(best, p.y - H(p.x, p.s));
      }
      return best;
    };
    expect(peak(0.4)).toBeGreaterThan(peak(0.05));
  });
});

describe('tricks', () => {
  it('a kickflip (← then FLIP) in the air scores once you land', () => {
    const { p, events, names } = mkPlayer();
    run(p, 1.5);
    run(p, 0.4, () => ({ space: true }));
    run(p, 0.12); // leave the ground
    run(p, DT, () => ({ left: true }));
    run(p, 2 * DT);
    run(p, DT, () => ({ flip: true }));
    const start = events.find((e) => e.n === 'trickStart');
    expect(start?.d.name).toBe('Kickflip');
    run(p, 3);
    expect(names()).toContain('land');
    expect(p.combo.entries + (names().includes('bank') ? 1 : 0)).toBeGreaterThan(0);
  });

  it('ignores trick buttons on the ground', () => {
    const { p, names } = mkPlayer();
    run(p, 1);
    run(p, DT, () => ({ flip: true }));
    run(p, DT, () => ({ grab: true }));
    expect(names()).not.toContain('trickStart');
  });
});

describe('riders', () => {
  it('VOLT is faster down the same hill than CHROME', () => {
    const dist = (id: string) => {
      ND.riderId = id;
      const { p } = mkPlayer();
      p.setRider(id);
      run(p, 6);
      return p.s;
    };
    expect(dist('volt')).toBeGreaterThan(dist('chrome'));
  });
});

describe('side quarterpipe', () => {
  /** put the rider just above a side quarterpipe wall, falling, as if coming back down out of a pipe launch */
  function onWall(armed: boolean) {
    setCoursePlan(() => 'pipe');
    const { p, events, names } = mkPlayer();
    const w = ND.seg(1).walls[0];
    const s = w.s + 60,
      x = C(s) + w.side * (w.toe + 0.6 * (w.lip - w.toe));
    Object.assign(p, {
      x,
      s,
      y: H(x, s),
      state: 'air',
      vy: -20,
      speed: 28,
      heading: 0,
      airT: 2,
      peakAir: 15,
      perfectArm: armed,
      pipeAir: w.side,
    });
    p.land(H(x, s));
    return { p, events, names, w };
  }

  it('a perfect landing on the wall launches you back up, higher than off the lip', () => {
    const { p, names, w } = onWall(true);
    expect(names()).toContain('perfect');
    expect(names()).toContain('sky');
    expect(p.state).toBe('air');
    expect(p.megaAir).toBe(true);
    expect(p.pipeAir).toBe(w.side);
    let peak = 0;
    for (let f = 0; f < 600 && p.state === 'air'; f++) {
      p.update(DT, idle());
      peak = Math.max(peak, p.peakAir);
    }
    expect(peak).toBeGreaterThan(30); // a normal pipe launch tops out around 24 m
  });

  it('a normal landing on the wall just rolls back down', () => {
    const { p, names } = onWall(false);
    expect(names()).not.toContain('sky');
    expect(p.state).toBe('ride');
  });
});

describe('scoring', () => {
  const kickflip = () => ND.TRICKS.find((t: { name: string }) => t.name === 'Kickflip');

  it('a spin and a trick in one jump score as one mixed trick worth double their parts', () => {
    const { p, events } = mkPlayer();
    Object.assign(p, { state: 'air', airT: 1.2, yawRot: 2 * Math.PI, queued: [kickflip()] });
    p.creditAir(true);
    const tr = events.filter((e) => e.n === 'trick');
    expect(tr).toHaveLength(1);
    expect(tr[0].d.name).toBe('360 KICKFLIP');
    expect(tr[0].d.parts).toEqual(['360', 'Kickflip']);
    expect(tr[0].d.pts).toBe(2 * (480 + kickflip().pts));
    expect(p.combo.entries).toBe(2); // still counts both toward the combo multiplier
  });

  it('three parts pay x2.5, a lone trick pays its own value', () => {
    const a = mkPlayer();
    Object.assign(a.p, {
      state: 'air',
      airT: 1.2,
      yawRot: Math.PI,
      flipRot: -2 * Math.PI,
      queued: [kickflip()],
    });
    a.p.creditAir(true);
    expect(a.events.find((e) => e.n === 'trick')?.d.pts).toBe(
      Math.round(2.5 * (200 + 600 + kickflip().pts)),
    );
    const b = mkPlayer();
    Object.assign(b.p, { state: 'air', airT: 1.2, queued: [kickflip()] });
    b.p.creditAir(true);
    expect(b.events.find((e) => e.n === 'trick')?.d).toMatchObject({
      name: 'Kickflip',
      pts: kickflip().pts,
    });
  });

  it('perfect landings in a row stack, a normal landing resets the streak', () => {
    const { p, events } = mkPlayer();
    const jump = (armed: boolean) => {
      const y = H(p.x, p.s);
      Object.assign(p, { state: 'air', airT: 1.5, peakAir: 6, perfectArm: armed, y });
      p.land(y);
    };
    jump(true);
    jump(true);
    jump(true);
    const perf = () => events.filter((e) => e.n === 'perfect').map((e) => e.d.pts);
    expect(perf()).toEqual([600, 1200, 1800]);
    jump(false);
    jump(true);
    expect(perf().at(-1)).toBe(600);
  });
});

describe('grinds never slow you down', () => {
  const rail = (s: number, tier: 0 | 1 | 2 | 3) => ({
    x: C(s),
    x1: C(s),
    s,
    len: 40,
    tier,
    h: 3,
    h1: 3,
    inc: 6,
    rise: 1.5,
    tol: 1.8,
  });
  for (const v of [18, 40, 64, 80]) {
    it('entering at ' + v + ' m/s: on the rail, along it and off the end', () => {
      const { p } = mkPlayer();
      p.s = 100;
      p.x = C(p.s);
      p.speed = v;
      p.startGrind(rail(p.s, 1));
      expect(p.speed).toBeGreaterThanOrEqual(v);
      let prev = p.speed;
      for (let f = 0; f < 240 && p.state === 'grind'; f++) {
        p.update(DT, idle());
        expect(p.speed).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = p.speed;
      }
      expect(p.state).toBe('air');
      expect(p.speed).toBeGreaterThanOrEqual(v);
    });
  }
  it('jumping off a rail fast keeps the speed too', () => {
    const { p } = mkPlayer();
    p.s = 100;
    p.x = C(p.s);
    p.speed = 80;
    p.startGrind(rail(p.s, 0));
    run(p, 0.2);
    run(p, 0.05, () => ({ space: true }));
    expect(p.state).toBe('air');
    expect(p.speed).toBeGreaterThanOrEqual(80);
  });
});
