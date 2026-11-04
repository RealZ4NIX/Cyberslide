/* CYBERSLIDE - course: the endless hill as pure data. Which kind of segment comes where, where the path bends,
   the ramps, rails, dips, walls and obstacles in each segment, which district each one sits in, and the height of
   the snow at any point. Every run rolls a new seed (setRunSeed); the same seed always builds the same hill.
   Nothing here touches three.js or the DOM, so it is fully deterministic and testable. world.ts turns it into meshes. */

export const SEG = 70; // length of one hill segment (m along the slope)
export const HALF = 17; // half width of the rideable corridor
export const SLOPE = 0.4; // hill drop per metre

/** mulberry32: small seeded PRNG, returns 0..1 */
export function rng(seed: number): () => number {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash(n: number): number {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}
/** smoothstep on 0..1 (clamped) */
export const sm = (t: number): number => {
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * (3 - 2 * t);
};

export type SegKind =
  | 'start'
  | 'land'
  | 'clear'
  | 'bend'
  | 'bendc'
  | 'kicker'
  | 'rails'
  | 'railchain'
  | 'big'
  | 'kickrail'
  | 'sky'
  | 'mid'
  | 'window'
  | 'mega'
  | 'pipe'
  | 'open'
  | 'tutramp'
  | 'tutbar'
  | 'tutrail';

export interface Bend {
  s0: number;
  len: number;
  dx: number;
  c0: number;
  /** index of the last segment the bend covers */
  k1: number;
  flav: 'smooth' | 'long' | 'sharp';
}
export interface SegInfo {
  kind: SegKind;
  bend: Bend | null;
  /** corridor centre at the start (straight segments keep it) and at the end */
  c: number;
  cEnd: number;
  hasDip?: boolean;
}
export interface Ramp {
  x: number;
  s: number;
  len: number;
  w: number;
  h: number;
  /** curve exponent (default 1.6) */
  p?: number;
  mega?: boolean;
}
export interface Dip {
  x: number;
  s: number;
  len: number;
  d: number;
  t0: number;
  w: number;
}
export interface Wall {
  side: -1 | 1;
  s: number;
  len: number;
  H: number;
  toe: number;
  lip: number;
}
/** tier 0 = ground rail, 1 = mid rail (charged jump), 2 = sky rail (big ramp), 3 = window rail (out of a building) */
export interface Rail {
  x: number;
  x1: number;
  s: number;
  len: number;
  tier: 0 | 1 | 2 | 3;
  h: number;
  h1: number;
  /** length of the kicked-up ramp end (0 = flat end) */
  inc: number;
  rise: number;
  /** how far off the rail line you can be and still lock on */
  tol: number;
  /** window rail: which side's building it comes out of */
  win?: -1 | 1;
}
export interface Block {
  kind: 'barrier' | 'pylon';
  x: number;
  s: number;
  w: number;
  d: number;
  h: number;
}
export interface Building {
  x: number;
  s: number;
  w: number;
  d: number;
  h: number;
  tint: number;
  sign: number;
  signH: number;
}
export interface Post {
  x: number;
  s: number;
  c: number;
}
export interface Segment {
  k: number;
  s0: number;
  kind: SegKind;
  ramps: Ramp[];
  rails: Rail[];
  blocks: Block[];
  bld: Building[];
  dips: Dip[];
  /** pieces that reach into the next segment(s) */
  dspill: Dip[];
  spill: Rail[];
  posts: Post[];
  walls: Wall[];
  wspill: Wall[];
  wspill2: Wall[];
}
/** a short repeating course (tutorial): segment index -> kind */
export type CoursePlan = (i: number) => SegKind;

/* ---------- run seed: every run rolls a new one, so the same code builds a different hill ---------- */
let runSeed = 0;
/** mixes the run seed into a per-item seed; seed 0 leaves it unchanged */
export const mixSeed = (n: number): number => (n ^ Math.imul(runSeed, 0x9e3779b1)) | 0;
export const getRunSeed = (): number => runSeed;
/** a fresh random seed (never 0, which is the fixed hill the tests and the tutorial use) */
export const randomSeed = (): number => ((Math.random() * 0xfffffffe) | 0) + 1 || 1;

/* ---------- feature deck: today's share of each feature, shuffled and dealt, reshuffled when empty ---------- */
/** 25 cards in the same proportions the old weighted roll had (rare ones rounded to a whole card) */
export const DECK: Partial<Record<SegKind, number>> = {
  bend: 6,
  mega: 4,
  pipe: 4,
  railchain: 2,
  kicker: 1,
  rails: 1,
  big: 1,
  kickrail: 1,
  sky: 1,
  mid: 1,
  window: 1,
  open: 1,
  clear: 1,
};
let deck: SegKind[] = [];
let deckRng: () => number = rng(0x5eed);
let lastCard: SegKind | null = null;
function freshDeck(): SegKind[] {
  const d: SegKind[] = [];
  for (const k in DECK) for (let n = DECK[k as SegKind]!; n > 0; n--) d.push(k as SegKind);
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(deckRng() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}
/** the next card (dealt from the end); the same feature never comes twice in a row, except bends, which snake */
function draw(): SegKind {
  if (!deck.length) deck = freshDeck();
  const top = deck.length - 1;
  if (deck[top] === lastCard && lastCard !== 'bend') {
    let j = deck.findIndex((c) => c !== lastCard);
    if (j < 0) {
      // only repeats are left: they go to the bottom of the next deck
      deck = deck.concat(freshDeck());
      j = deck.findIndex((c, i) => i > top && c !== lastCard);
    }
    const t = deck.length - 1;
    [deck[j], deck[t]] = [deck[t], deck[j]];
  }
  lastCard = deck.pop()!;
  return lastCard;
}

/* ---------- districts: a shuffle bag of all five, each 6 segments (420 m) ---------- */
export const DISTRICTS = 5;
export const DIST_SEGS = 6;
const bags: number[][] = [];
function bag(b: number): number[] {
  while (bags.length <= b) {
    const n = bags.length,
      r = rng(mixSeed(n * 2654435 + 101)),
      a = Array.from({ length: DISTRICTS }, (_, i) => i);
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    const prev = bags[n - 1];
    // never the same district across a reshuffle: swap the opener with a random later one
    if (prev && a[0] === prev[DISTRICTS - 1]) {
      const j = 1 + Math.floor(r() * (DISTRICTS - 1));
      [a[0], a[j]] = [a[j], a[0]];
    }
    bags.push(a);
  }
  return bags[b];
}
/** which district (0..4) segment k sits in */
export function districtAt(k: number): number {
  const i = Math.floor(Math.max(0, k) / DIST_SEGS);
  return bag(Math.floor(i / DISTRICTS))[i % DISTRICTS];
}

/* ---------- course layout: which kind of segment comes where, and where the path bends ---------- */
const segCache = new Map<number, Segment>();
export const SKY_OFF = 41,
  MID_OFF = 33,
  MEGA_DIP = 48,
  MEGA_D = 8,
  MEGA_CAP = 19; // where the elevated rails start inside their segment
const infos: SegInfo[] = [];
let lastDir = 1;

let plan: CoursePlan | null = null;
function makeInfo(i: number): void {
  if (plan) {
    infos.push({ kind: plan(i), bend: null, c: 0, cEnd: 0, hasDip: false });
    return;
  }
  const prev = infos[i - 1];
  // second half of a long, smooth bend
  if (prev && prev.bend && prev.bend.k1 >= i) {
    const b = prev.bend;
    infos.push({ kind: 'bendc', bend: b, c: 0, cEnd: b.k1 === i ? b.c0 + b.dx : 0 });
    return;
  }
  const c = prev ? prev.cEnd : 0;
  const r = rng(mixSeed(i * 104729 + 7));
  let kind: SegKind;
  if (i < 1) kind = 'start';
  else if (prev.kind === 'sky' || prev.kind === 'mid')
    kind = 'land'; // landing slope after leaving a high rail
  else if (
    prev.kind === 'big' ||
    prev.kind === 'window' ||
    prev.kind === 'mega' ||
    prev.kind === 'pipe' ||
    prev.kind === 'railchain' ||
    prev.hasDip ||
    (i >= 2 && infos[i - 2].kind === 'pipe') ||
    (i >= 3 && infos[i - 3].kind === 'pipe')
  )
    kind = 'clear'; // a long landing slope / pipe wall spills into this one
  else kind = draw();
  if (kind !== 'bend') {
    infos.push({ kind, bend: null, c, cEnd: c, hasDip: kind === 'kicker' && r() < 0.6 });
    return;
  }
  // bends: mostly smooth, long ones, some tighter ones. They steer back and forth around the middle.
  const q = r(),
    flav: Bend['flav'] = q < 0.28 ? 'smooth' : q < 0.82 ? 'long' : 'sharp';
  const n = flav === 'long' ? 2 : 1;
  let mag = flav === 'smooth' ? 9 + r() * 4 : flav === 'long' ? 16 + r() * 10 : 18 + r() * 8;
  let dir = r() < 0.65 ? -lastDir : lastDir;
  if (c > 14) dir = -1;
  else if (c < -14) dir = 1;
  mag = Math.min(mag, Math.max(6, 34 - dir * c));
  lastDir = dir;
  const b: Bend = { s0: i * SEG, len: n * SEG, dx: dir * mag, c0: c, k1: i + n - 1, flav };
  infos.push({ kind: 'bend', bend: b, c, cEnd: n === 1 ? c + b.dx : 0 });
}
function info(k: number): SegInfo {
  if (k < 0) k = 0;
  while (infos.length <= k) makeInfo(infos.length);
  return infos[k];
}
/** x of the middle of the rideable corridor at distance s down the hill */
export function C(s: number): number {
  const f = info(Math.floor(s / SEG));
  if (f.bend) {
    const b = f.bend;
    return b.c0 + b.dx * sm((s - b.s0) / b.len);
  }
  return f.c;
}
export const kindAt = (k: number): SegKind => info(k).kind;

/** swap in a short repeating course (tutorial) or go back to the normal hill with null; forgets all generated segments */
export function setCoursePlan(fn: CoursePlan | null | undefined): void {
  plan = fn || null;
  forget();
}
/** start a new hill from this seed (0 = the fixed one); keeps any tutorial plan; forgets all generated segments */
export function setRunSeed(seed: number): void {
  runSeed = seed | 0;
  bags.length = 0;
  forget();
}
let planGen = 0;
/** bumps every time the hill is forgotten (new seed or plan), so caches built on top of the course know to start over */
export const courseGen = (): number => planGen;
function forget(): void {
  planGen++;
  infos.length = 0;
  segCache.clear();
  lastDir = 1;
  deck = [];
  deckRng = rng(mixSeed(0x5eed));
  lastCard = null;
}

function barrier(s: number, x: number, wide: boolean): Block {
  return { kind: 'barrier', x, s, w: wide ? 4.4 : 3.2, d: 1.2, h: 1.15 };
}
// landing slope: the hill drops away, then eases back into its normal slope
function mkDip(x: number, s: number, len: number, d: number, t0?: number): Dip {
  return { x, s, len, d, t0: t0 || 0.6, w: 24 };
}

function mkRail(
  r: () => number,
  x: number,
  s: number,
  len: number,
  tier: Rail['tier'],
  inc: boolean,
  o?: Partial<Rail>,
): Rail {
  const h = [3.0, 5.0, 7.0, 9.0][tier] + (tier && tier < 3 ? (r() - 0.5) * 0.5 : 0);
  return Object.assign(
    {
      x,
      x1: x,
      s,
      len,
      tier,
      h,
      h1: h,
      inc: inc ? 6 : 0,
      rise: inc ? 1.3 + r() * 0.5 : 0,
      tol: [1.6, 1.8, 2.1, 2.1][tier],
    },
    o || {},
  );
}

function gen(k: number): Segment {
  const r = rng(mixSeed(k * 7919 + 13));
  const s0 = k * SEG,
    inf = info(k),
    kind = inf.kind,
    cx = inf.c;
  const g: Segment = {
    k,
    s0,
    kind,
    ramps: [],
    rails: [],
    blocks: [],
    bld: [],
    dips: [],
    dspill: [],
    spill: [],
    posts: [],
    walls: [],
    wspill: [],
    wspill2: [],
  };
  const o = (v: number) => cx + v;
  if (kind === 'kicker') {
    // kicker, sometimes with a landing slope, rarely a lone barrier off to one side
    const x = o(Math.round((r() - 0.5) * 14));
    g.ramps.push({ x, s: s0 + (inf.hasDip ? 6 : 12), len: 11, w: 8, h: 1.8 + r() * 0.7 });
    if (inf.hasDip) g.dips.push(mkDip(x, s0 + 31, 66, 3.0 + r() * 0.6, 0.6));
    else if (r() < 0.2)
      g.blocks.push(barrier(s0 + 52, o((r() < 0.5 ? -1 : 1) * (6 + r() * 6)), true));
  } else if (kind === 'rails') {
    // mostly ground rails, some mid-height ones that need a charged jump
    const n = 1 + (r() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const tier = r() < 0.3 ? 1 : 0;
      g.rails.push(
        mkRail(
          r,
          o(Math.round((r() - 0.5) * 20)),
          s0 + 8 + i * 30 + Math.floor(r() * 4),
          tier ? 20 : 15 + Math.floor(r() * 5),
          tier,
          r() < 0.55,
        ),
      );
    }
  } else if (kind === 'railchain') {
    // kicker, then a row of rails with short gaps: grind, hop, grind, hop
    const x0 = o(Math.round((r() - 0.5) * 8));
    g.ramps.push({ x: x0, s: s0 + 8, len: 10, w: 8, h: 1.6 });
    let rs = s0 + 28,
      rx = x0;
    for (let i = 0; i < 4; i++) {
      const nx = Math.max(o(-9), Math.min(o(9), rx + (r() - 0.5) * 5)),
        last = i === 3;
      const ln = i ? 15 : 26;
      g.rails.push(mkRail(r, rx, rs, ln, 0, last, { x1: nx }));
      rx = nx;
      rs += ln + 8 + Math.floor(r() * 3);
    }
  } else if (kind === 'big') {
    // big air into a landing slope
    const x = o(Math.round((r() - 0.5) * 8));
    g.ramps.push({ x, s: s0 + 10, len: 15, w: 11, h: 3.4 + r() * 0.8 });
    g.dips.push(mkDip(x, s0 + 45, 70, 5 + r() * 1.0, 0.62));
  } else if (kind === 'kickrail') {
    // kicker into a long ground rail
    const x = o(Math.round((r() - 0.5) * 12));
    g.ramps.push({ x, s: s0 + 8, len: 10, w: 8, h: 2.0 });
    g.rails.push(mkRail(r, x, s0 + 30, 32, 0, r() < 0.5));
  } else if (kind === 'sky') {
    // big ramp, then a high rail with a ramp end
    const x = o(Math.round((r() - 0.5) * 10));
    g.ramps.push({ x, s: s0 + 4, len: 15, w: 11, h: 3.9 + r() * 0.4 });
    g.rails.push(mkRail(r, x, s0 + SKY_OFF, 50, 2, true));
  } else if (kind === 'mid') {
    // mid rail after a kicker
    const x = o(Math.round((r() - 0.5) * 12));
    g.ramps.push({ x, s: s0 + 8, len: 11, w: 8, h: 2.0 + r() * 0.4 });
    g.rails.push(mkRail(r, x, s0 + MID_OFF, 44, 1, r() < 0.6));
  } else if (kind === 'window') {
    // big ramp, then a rail from a building window angling down into the course
    const side = r() < 0.5 ? -1 : 1;
    g.ramps.push({ x: o(side * 11), s: s0 + 4, len: 15, w: 10, h: 2.6 + r() * 0.3 });
    g.rails.push(
      mkRail(r, o(side * (HALF + 0.2)), s0 + 12, 68, 3, true, {
        x1: o(side * 8.5),
        h: 9,
        h1: 2.6,
        rise: 1.7,
        win: side,
      }),
    );
  } else if (kind === 'mega') {
    // mega quarterpipe straight ahead: huge air, long landing slope
    const x = o(Math.round((r() - 0.5) * 6));
    g.ramps.push({ x, s: s0 + 6, len: 13, w: 12, h: 8 + r() * 0.6, p: 2.3, mega: true });
    g.dips.push(mkDip(x, s0 + MEGA_DIP, 92, MEGA_D + r() * 0.8, 0.6));
  } else if (kind === 'pipe') {
    // mega quarterpipe along one side of the course: launch off the lip, land back on the wall
    g.walls.push({ side: r() < 0.5 ? -1 : 1, s: s0 + 4, len: 270, H: 10, toe: 7.5, lip: HALF });
  } else if (kind === 'tutramp') {
    // tutorial: one friendly ramp straight ahead with a long landing slope
    g.ramps.push({ x: cx, s: s0 + 10, len: 11, w: 9, h: 2.3 });
    g.dips.push(mkDip(cx, s0 + 31, 66, 3.4, 0.6));
  } else if (kind === 'tutbar') {
    // tutorial: a short row of wide-spaced barriers to steer around
    g.blocks.push(
      barrier(s0 + 18, cx - 6, true),
      barrier(s0 + 34, cx + 6, true),
      barrier(s0 + 50, cx - 5, true),
    );
  } else if (kind === 'tutrail') {
    // tutorial: ramp straight into one ground rail with a ramp end
    g.ramps.push({ x: cx, s: s0 + 6, len: 10, w: 9, h: 2.0 });
    g.rails.push(mkRail(r, cx, s0 + 28, 36, 0, true));
  } else if (kind === 'open') {
    // open stretch, two wide-spaced barriers
    g.blocks.push(barrier(s0 + 22, o(-(4 + r() * 8)), true));
    g.blocks.push(barrier(s0 + 48, o(4 + r() * 8), true));
  } else if (kind === 'land') {
    // landing slope for whoever just left a high rail
    const prev = seg(k - 1).rails[0];
    const x = prev ? prev.x : cx;
    const sky = prev && prev.tier === 2;
    g.dips.push(mkDip(x, s0 + (sky ? 30 : 14), sky ? 40 : 50, 3 + r() * 0.5, 0.7));
  }
  g.spill = g.rails.filter((q) => q.s + q.len > s0 + SEG);
  g.dspill = g.dips.filter((q) => q.s + q.len > s0 + SEG);
  g.wspill = g.walls.filter((q) => q.s + q.len > s0 + SEG);
  g.wspill2 = g.walls.filter((q) => q.s + q.len > s0 + 2 * SEG);
  if (kind === 'bend' || kind === 'bendc') {
    // guide lights along both edges so the bend reads from far away
    for (let s = s0 + 3; s < s0 + SEG; s += 7)
      for (const side of [-1, 1])
        g.posts.push({ x: C(s) + side * (HALF + 0.9), s, c: side > 0 ? 0 : 1 });
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const s = s0 + i * (SEG / 4) + r() * 8;
      g.bld.push({
        x: C(s) + side * (33 + r() * 13),
        s,
        w: 10 + r() * 10,
        d: 12 + r() * 8,
        h: 28 + r() * 62,
        tint: Math.floor(r() * 4),
        sign: r() < 0.55 ? (r() < 0.5 ? 0 : 1) : -1,
        signH: r(),
      });
    }
  }
  return g;
}
/** the content of segment k (cached; the oldest of 60 is forgotten) */
export function seg(k: number): Segment {
  let g = segCache.get(k);
  if (!g) {
    g = gen(k);
    segCache.set(k, g);
    if (segCache.size > 60) segCache.delete(segCache.keys().next().value as number);
  }
  return g;
}

/* ---------- height field ---------- */
/** the bare hill: slope, gentle rolls, a little bowl across the corridor, banks rising at the edges */
export function base(x: number, s: number): number {
  const xr = x - C(s);
  let h = -SLOPE * s + 1.1 * Math.sin(s * 0.045) + 0.7 * Math.sin(s * 0.11 + xr * 0.05);
  const ax = Math.abs(xr);
  if (ax > HALF) h += 3.2 * (1 - Math.exp(-(ax - HALF) * 0.5));
  else h += 0.004 * xr * xr;
  return h;
}
export function rampAdd(r: Ramp, x: number, s: number): number {
  const t = (s - r.s) / r.len;
  if (t < 0 || t > 1) return 0;
  const f = Math.max(0, Math.min(1, (r.w / 2 - Math.abs(x - r.x)) / 1.2));
  return r.h * Math.pow(t, r.p || 1.6) * f;
}
export function dipOne(d: Dip, x: number, s: number): number {
  const t = (s - d.s) / d.len;
  if (t <= 0 || t >= 1) return 0;
  const T0 = d.t0;
  const f =
    t < T0
      ? 0.5 - 0.5 * Math.cos((Math.PI * t) / T0)
      : 0.5 + 0.5 * Math.cos((Math.PI * (t - T0)) / (1 - T0));
  return d.d * f * sm((d.w / 2 - Math.abs(x - d.x)) / 5);
}
/** how deep the landing slopes cut into the hill here */
export function dipAt(x: number, s: number): number {
  const k = Math.floor(s / SEG);
  let v = 0;
  const a = seg(k).dips,
    b = seg(k - 1).dspill;
  for (let i = 0; i < a.length; i++) v += dipOne(a[i], x, s);
  for (let i = 0; i < b.length; i++) v += dipOne(b[i], x, s);
  return v;
}
// quarterpipe wall along the edge of the course: a circular transition rising to a near-vertical lip, then a flat deck
export function wallOne(w: Wall, x: number, s: number): number {
  if (s <= w.s || s >= w.s + w.len) return 0;
  const xr = x - C(s);
  if (xr * w.side <= 0) return 0;
  const a = xr * w.side,
    f = sm((s - w.s) / 10) * sm((w.s + w.len - s) / 10);
  if (f <= 0 || a <= w.toe) return 0;
  const q = Math.min(0.975, (a - w.toe) / (w.lip - w.toe));
  return w.H * f * (1 - Math.sqrt(1 - q * q));
}
export function wallSum(x: number, s: number): number {
  const k = Math.floor(s / SEG);
  let h = 0;
  for (let j = 0; j < 4; j++) {
    // a wall can start up to three segments back
    const a = seg(k - j).walls;
    for (let i = 0; i < a.length; i++) h += wallOne(a[i], x, s);
  }
  return h;
}
export interface MegaHit {
  /** launch speed cap */
  cap: number;
  /** 0 = ramp straight ahead, -1 / 1 = quarterpipe wall on that side */
  side: number;
}
/** is the rider on (or at the lip of) a mega quarterpipe? gives the launch strength and which side the wall is on */
export function megaAt(x: number, s: number): MegaHit | null {
  const k = Math.floor(s / SEG),
    sg = seg(k);
  for (const r of sg.ramps)
    if (r.mega && s >= r.s && s <= r.s + r.len + 3 && Math.abs(x - r.x) < r.w / 2 + 1)
      return { cap: MEGA_CAP, side: 0 };
  const ws = sg.walls.concat(seg(k - 1).walls, seg(k - 2).walls, seg(k - 3).walls),
    xr = x - C(s);
  for (const w of ws)
    if (xr * w.side > w.toe && s >= w.s + 1 && s <= w.s + w.len - 1)
      return { cap: MEGA_CAP + 3, side: w.side };
  return null;
}
export function rampSum(x: number, s: number): number {
  const a = seg(Math.floor(s / SEG)).ramps;
  let h = 0;
  for (let i = 0; i < a.length; i++) h += rampAdd(a[i], x, s);
  return h;
}
/** how much the landing slope drops (+) or climbs (-) per metre of travel right here */
export const bowlDown = (x: number, s: number): number => dipAt(x, s + 1) - dipAt(x, s);
/** snow height at (x, s) with everything on it */
export function H(x: number, s: number): number {
  return base(x, s) - dipAt(x, s) + rampSum(x, s) + wallSum(x, s);
}
export const blocksNear = (s: number): Block[] => seg(Math.floor(s / SEG)).blocks;
/** rails in this segment, plus long ones reaching in from the previous one */
export const railsNear = (s: number): Rail[] => {
  const k = Math.floor(s / SEG),
    a = seg(k).rails,
    sp = seg(k - 1).spill;
  return sp.length ? sp.concat(a) : a;
};
export const railX = (rail: Rail, s: number): number => {
  if (rail.x1 === rail.x) return rail.x;
  const t = (s - rail.s) / rail.len;
  return rail.x + (rail.x1 - rail.x) * (t < 0 ? 0 : t > 1 ? 1 : t);
};
export const railY = (rail: Rail, s: number): number => {
  const t = (s - rail.s) / rail.len;
  let y = base(railX(rail, s), s) + rail.h + (rail.h1 - rail.h) * (t < 0 ? 0 : t > 1 ? 1 : t);
  if (rail.inc) {
    const u = (s - (rail.s + rail.len - rail.inc)) / rail.inc;
    if (u > 0) y += rail.rise * Math.pow(Math.min(1, u), 1.4);
  }
  return y;
};
