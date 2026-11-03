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
