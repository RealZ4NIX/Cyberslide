import { afterEach, describe, expect, it } from 'vitest';
import {
  base,
  C,
  DECK,
  DIST_SEGS,
  DISTRICTS,
  dipAt,
  districtAt,
  H,
  HALF,
  kindAt,
  megaAt,
  railsNear,
  railX,
  railY,
  rampSum,
  rng,
  seg,
  SEG,
  setCoursePlan,
  setRunSeed,
  sm,
  wallSum,
  type Rail,
  type SegKind,
} from './course';

afterEach(() => {
  setCoursePlan(null);
  setRunSeed(0);
});

const SEEDS = [0, 1, 7, 12345, -987654321, 0x7fffffff];
const kinds = (n: number) => Array.from({ length: n }, (_, k) => kindAt(k));

describe('rng', () => {
  it('is deterministic per seed and stays in 0..1', () => {
    const a = rng(42),
      b = rng(42),
      c = rng(43);
    const xs = Array.from({ length: 200 }, () => a());
    expect(xs).toEqual(Array.from({ length: 200 }, () => b()));
    expect(c()).not.toBe(xs[0]);
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe('smoothstep', () => {
  it('clamps and eases', () => {
    expect(sm(-1)).toBe(0);
    expect(sm(2)).toBe(1);
    expect(sm(0.5)).toBe(0.5);
  });
});

describe('course layout', () => {
  it('always starts with one easy start segment (70 m run-in)', () => {
    for (const seed of SEEDS) {
      setRunSeed(seed);
      expect(kindAt(0)).toBe('start');
      expect(kindAt(1)).not.toBe('start');
      expect(seg(0).ramps).toEqual([]);
      expect(seg(0).rails).toEqual([]);
    }
  });

  it('builds the same hill from the same seed', () => {
    for (const seed of SEEDS) {
      setRunSeed(seed);
      const first = kinds(80);
      const snap = JSON.stringify(seg(7));
      setRunSeed(seed); // forget everything and regenerate
      expect(kinds(80)).toEqual(first);
      expect(JSON.stringify(seg(7))).toBe(snap);
    }
  });

  it('builds a different hill from a different seed', () => {
    const maps = new Set(
      SEEDS.map((seed) => {
        setRunSeed(seed);
        return JSON.stringify(kinds(40)) + JSON.stringify(seg(5));
      }),
    );
    expect(maps.size).toBe(SEEDS.length);
  });

  it('a tutorial plan ignores the seed', () => {
    const plan = (i: number): SegKind => (i % 2 ? 'tutramp' : 'clear');
    setCoursePlan(plan);
    const a = JSON.stringify([0, 1, 2, 3].map(seg));
    setRunSeed(99);
    setCoursePlan(plan);
    expect(JSON.stringify([0, 1, 2, 3].map(seg)).replace(/"bld":\[[^\]]*\]/g, '')).toBe(
      a.replace(/"bld":\[[^\]]*\]/g, ''),
    );
  });

  it('follows a high rail with a landing slope and a big jump with a clear stretch', () => {
    for (const seed of SEEDS) {
      setRunSeed(seed);
      for (let k = 2; k < 400; k++) {
        const prev = kindAt(k - 1);
        if (prev === 'sky' || prev === 'mid') expect(kindAt(k)).toBe('land');
        if (prev === 'big' || prev === 'mega' || prev === 'window' || prev === 'railchain')
          expect(kindAt(k)).toBe('clear');
        if (kindAt(k) === 'pipe') for (let j = 1; j <= 3; j++) expect(kindAt(k + j)).toBe('clear');
      }
    }
  });

  it('keeps the bending path within reach of the middle', () => {
    for (const seed of SEEDS) {
      setRunSeed(seed);
      for (let s = 0; s < 400 * SEG; s += 5) expect(Math.abs(C(s))).toBeLessThan(45);
    }
  });

  it('bends smoothly (no jumps in the corridor centre)', () => {
    for (const seed of SEEDS) {
      setRunSeed(seed);
      for (let s = 0; s < 200 * SEG; s += 0.5)
        expect(Math.abs(C(s + 0.5) - C(s))).toBeLessThan(0.6);
    }
  });

  it('keeps rails inside the corridor except window rails that start in a building', () => {
    for (const seed of SEEDS) {
      setRunSeed(seed);
      for (let k = 0; k < 300; k++)
        for (const r of seg(k).rails) {
          const lim = r.tier === 3 ? HALF + 1 : HALF;
          expect(Math.abs(r.x - C(r.s))).toBeLessThanOrEqual(lim);
        }
    }
  });

  it('only remembers the last 60 segments but regenerates them identically', () => {
    const early = JSON.stringify(seg(2));
    for (let k = 100; k < 200; k++) seg(k);
    expect(JSON.stringify(seg(2))).toBe(early);
  });
});

/** the features dealt from the deck, in order (forced landing / clear segments and bend halves left out) */
function dealt(n: number): string[] {
  const out: string[] = [];
  for (let k = 1; out.length < n; k++) {
    const kind = kindAt(k),
      prev = kindAt(k - 1);
    const forced =
      kind === 'bendc' ||
      kind === 'land' ||
      ['big', 'window', 'mega', 'pipe', 'railchain'].includes(prev) ||
      (k >= 2 && kindAt(k - 2) === 'pipe') ||
      (k >= 3 && kindAt(k - 3) === 'pipe') ||
      (prev === 'kicker' && seg(k - 1).dips.length > 0);
    if (!forced) out.push(kind);
  }
  return out;
}

describe('feature deck', () => {
  const size = Object.values(DECK).reduce((a, b) => a + b!, 0);

  it('deals every feature in its share, deck after deck', () => {
    for (const seed of SEEDS) {
      setRunSeed(seed);
      const cards = dealt(size * 8);
      const count: Record<string, number> = {};
      for (const c of cards) count[c] = (count[c] || 0) + 1;
      for (const [kind, n] of Object.entries(DECK)) {
        // a card can slip into the next deck to dodge a repeat, so allow one card of drift
        expect(Math.abs(count[kind] - n! * 8)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('gives every stretch of two decks at least one of every feature', () => {
    for (const seed of SEEDS) {
      setRunSeed(seed);
      const cards = dealt(size * 12);
      for (let i = 0; i + size * 2 <= cards.length; i += size)
        for (const kind of Object.keys(DECK)) expect(cards.slice(i, i + size * 2)).toContain(kind);
    }
  });

  it('never deals the same feature twice in a row, except bends', () => {
    for (const seed of SEEDS) {
      setRunSeed(seed);
      const cards = dealt(size * 10);
      for (let i = 1; i < cards.length; i++)
        if (cards[i] !== 'bend') expect(cards[i]).not.toBe(cards[i - 1]);
    }
  });
});

describe('districts', () => {
  it('last 420 m each', () => {
    expect(DIST_SEGS * SEG).toBe(420);
    for (const seed of SEEDS) {
      setRunSeed(seed);
      for (let k = 0; k < 300; k++)
        expect(districtAt(k)).toBe(districtAt(Math.floor(k / DIST_SEGS) * DIST_SEGS));
    }
  });

  it('come from a shuffle bag: all five before any repeat, never the same twice in a row', () => {
    for (const seed of SEEDS) {
      setRunSeed(seed);
      const order = Array.from({ length: 40 }, (_, i) => districtAt(i * DIST_SEGS));
      for (let b = 0; b < order.length; b += DISTRICTS)
        expect([...order.slice(b, b + DISTRICTS)].sort()).toEqual([0, 1, 2, 3, 4]);
      for (let i = 1; i < order.length; i++) expect(order[i]).not.toBe(order[i - 1]);
    }
  });

  it('open in a different district depending on the seed', () => {
    const firsts = new Set<number>();
    for (let seed = 1; seed < 60; seed++) {
      setRunSeed(seed);
      firsts.add(districtAt(0));
    }
    expect(firsts.size).toBe(DISTRICTS);
  });
});

describe('tutorial plans', () => {
  it('replaces the hill with a repeating course and can switch back', () => {
    const normal = kindAt(5);
    setCoursePlan((i) => (i % 2 ? 'tutramp' : 'clear'));
    expect([0, 1, 2, 3].map(kindAt)).toEqual(['clear', 'tutramp', 'clear', 'tutramp']);
    expect(seg(1).ramps).toHaveLength(1);
    expect(seg(1).dips).toHaveLength(1);
    expect(C(500)).toBe(0); // tutorial courses are straight
    setCoursePlan(null);
    expect(kindAt(5)).toBe(normal);
  });
});

describe('height field', () => {
  it('goes downhill', () => {
    expect(H(0, 1000)).toBeLessThan(H(0, 0) - 300);
  });

  it('is continuous down the slope apart from ramp lips', () => {
    // ramps end in a sheer lip on purpose (that's the kicker), so check the snow without them
    const snow = (x: number, s: number) => H(x, s) - rampSum(x, s);
    for (let s = 0; s < 120 * SEG; s += 0.7) {
      const x = C(s);
      expect(Math.abs(snow(x, s + 0.35) - snow(x, s))).toBeLessThan(0.6);
      expect(Number.isFinite(H(x + 9, s))).toBe(true);
    }
  });

  it('rises at the edges of the corridor', () => {
    const s = 50;
    expect(base(C(s) + HALF + 6, s)).toBeGreaterThan(base(C(s), s));
    expect(base(C(s) - HALF - 6, s)).toBeGreaterThan(base(C(s), s));
  });

  it('lifts the snow on ramps and lowers it in landing slopes', () => {
    let sawRamp = false,
      sawDip = false;
    for (let k = 2; k < 200 && !(sawRamp && sawDip); k++) {
      const g = seg(k);
      for (const r of g.ramps) {
        const s = r.s + r.len * 0.9;
        expect(H(r.x, s)).toBeGreaterThan(base(r.x, s) - dipAt(r.x, s) + wallSum(r.x, s));
        sawRamp = true;
      }
      for (const d of g.dips) {
        expect(dipAt(d.x, d.s + d.len * d.t0)).toBeGreaterThan(0.5);
        sawDip = true;
      }
    }
    expect(sawRamp && sawDip).toBe(true);
  });

  it('finds mega quarterpipes', () => {
    let k = 2;
    while (kindAt(k) !== 'mega') k++;
    const r = seg(k).ramps.find((x) => x.mega);
    expect(r).toBeDefined();
    expect(megaAt(r!.x, r!.s + r!.len / 2)).toEqual({ cap: 19, side: 0 });
    expect(megaAt(r!.x + 30, r!.s + r!.len / 2)).toBeNull();
  });
});

describe('rails', () => {
  const rail: Rail = {
    x: 0,
    x1: 4,
    s: 100,
    len: 20,
    tier: 0,
    h: 3,
    h1: 3,
    inc: 0,
    rise: 0,
    tol: 1.6,
  };

  it('drifts sideways from x to x1, clamped at the ends', () => {
    expect(railX(rail, 90)).toBe(0);
    expect(railX(rail, 110)).toBe(2);
    expect(railX(rail, 130)).toBe(4);
    expect(railX({ ...rail, x1: 0 }, 110)).toBe(0);
  });

  it('sits a fixed height above the bare hill, with a kicked-up end when it has one', () => {
    expect(railY(rail, 105)).toBeCloseTo(base(railX(rail, 105), 105) + 3, 9);
    const kick = { ...rail, inc: 6, rise: 1.5 };
    expect(railY(kick, 120) - railY(rail, 120)).toBeCloseTo(1.5, 9);
    expect(railY(kick, 110)).toBeCloseTo(railY(rail, 110), 9);
  });

  it('railsNear includes long rails reaching in from the previous segment', () => {
    for (let k = 3; k < 300; k++) {
      for (const r of seg(k - 1).spill) {
        expect(railsNear(k * SEG + 1)).toContain(r);
        return;
      }
    }
    throw new Error('no spilling rail found in the first 300 segments');
  });
});
