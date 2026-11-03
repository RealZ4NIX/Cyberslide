// @ts-nocheck -- ported as-is from index.html; typed step by step

/* CYBERSLIDE - world: heightfield hill, ramps, rails, obstacles, neon city */

import * as THREE from 'three';
import { ND } from './nd';

const SEG = 70;      // length of one hill segment (m along the slope)
const HALF = 17;     // half width of the rideable corridor
const SLOPE = 0.4;   // hill drop per metre
ND.SEG = SEG; ND.HALF = HALF; ND.SLOPE = SLOPE;

function rng(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(n) { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }

/* ---------- course layout: which kind of segment comes where, and where the path bends ---------- */
const segCache = new Map();
const SKY_OFF = 41, MID_OFF = 33, MEGA_DIP = 48, MEGA_D = 8, MEGA_CAP = 19;   // where the elevated rails start inside their segment
const sm = (t) => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const infos = [];
let lastDir = 1;

let plan = null;   // tutorial courses: plan(i) -> segment kind, so a short course can repeat forever
function makeInfo(i) {
  if (plan) { infos.push({ kind: plan(i), bend: null, c: 0, cEnd: 0, hasDip: false }); return; }
  const prev = infos[i - 1];
  // second half of a long, smooth bend
  if (prev && prev.bend && prev.bend.k1 >= i) {
    const b = prev.bend;
    infos.push({ kind: 'bendc', bend: b, c: 0, cEnd: b.k1 === i ? b.c0 + b.dx : 0 });
    return;
  }
  const c = prev ? prev.cEnd : 0;
  const r = rng(i * 104729 + 7), p = r();
  let kind;
  if (i < 2) kind = 'start';
  else if (prev.kind === 'sky' || prev.kind === 'mid') kind = 'land';   // landing slope after leaving a high rail
  else if (prev.kind === 'big' || prev.kind === 'window' || prev.kind === 'mega' || prev.kind === 'pipe' || prev.kind === 'railchain' || prev.hasDip || (i >= 2 && infos[i - 2].kind === 'pipe') || (i >= 3 && infos[i - 3].kind === 'pipe')) kind = 'clear';   // a long landing slope / pipe wall spills into this one
  else if (p < 0.24) kind = 'bend';
  else if (p < 0.29) kind = 'kicker';
  else if (p < 0.33) kind = 'rails';
  else if (p < 0.39) kind = 'railchain';
  else if (p < 0.42) kind = 'big';
  else if (p < 0.46) kind = 'kickrail';
  else if (p < 0.50) kind = 'sky';
  else if (p < 0.54) kind = 'mid';
  else if (p < 0.59) kind = 'window';
  else if (p < 0.75) kind = 'mega';
  else if (p < 0.90) kind = 'pipe';
  else if (p < 0.96) kind = 'open';
  else kind = 'clear';
  if (kind !== 'bend') { infos.push({ kind, bend: null, c, cEnd: c, hasDip: kind === 'kicker' && r() < 0.6 }); return; }
  // bends: mostly smooth, long ones, some tighter ones. They steer back and forth around the middle.
  const q = r(), flav = q < 0.28 ? 'smooth' : q < 0.82 ? 'long' : 'sharp';
  const n = flav === 'long' ? 2 : 1;
  let mag = flav === 'smooth' ? 9 + r() * 4 : flav === 'long' ? 16 + r() * 10 : 18 + r() * 8;
  let dir = r() < 0.65 ? -lastDir : lastDir;
  if (c > 14) dir = -1; else if (c < -14) dir = 1;
  mag = Math.min(mag, Math.max(6, 34 - dir * c));
  lastDir = dir;
  const b = { s0: i * SEG, len: n * SEG, dx: dir * mag, c0: c, k1: i + n - 1, flav };
  infos.push({ kind: 'bend', bend: b, c, cEnd: n === 1 ? c + b.dx : 0 });
}
function info(k) { if (k < 0) k = 0; while (infos.length <= k) makeInfo(infos.length); return infos[k]; }
// x of the middle of the rideable corridor at distance s down the hill
ND.C = function (s) {
  const f = info(Math.floor(s / SEG));
  if (f.bend) { const b = f.bend; return b.c0 + b.dx * sm((s - b.s0) / b.len); }
  return f.c;
};
ND.kindAt = (k) => info(k).kind;

function barrier(s, x, wide) { return { kind: 'barrier', x, s, w: wide ? 4.4 : 3.2, d: 1.2, h: 1.15 }; }
function pylon(s, x) { return { kind: 'pylon', x, s, w: 1.3, d: 1.3, h: 5 }; }
// landing slope: the hill drops away, then eases back into its normal slope
function mkDip(x, s, len, d, t0) { return { x, s, len, d, t0: t0 || 0.6, w: 24 }; }

// tier 0 = ground rail, 1 = mid rail (needs a charged jump), 2 = sky rail (needs a big ramp), 3 = window rail (out of a building, slopes down into the course)
function mkRail(r, x, s, len, tier, inc, o) {
  const h = [3.0, 5.0, 7.0, 9.0][tier] + (tier && tier < 3 ? (r() - 0.5) * 0.5 : 0);
  return Object.assign({ x, x1: x, s, len, tier, h, h1: h, inc: inc ? 6 : 0, rise: inc ? 1.3 + r() * 0.5 : 0, tol: [1.6, 1.8, 2.1, 2.1][tier] }, o || {});
}

function gen(k) {
  const r = rng(k * 7919 + 13);
  const s0 = k * SEG, inf = info(k), kind = inf.kind, cx = inf.c;
  const g = { k, s0, kind, ramps: [], rails: [], blocks: [], bld: [], dips: [], dspill: [], spill: [], posts: [], walls: [], wspill: [], wspill2: [] };
  const o = (v) => cx + v;
  if (kind === 'kicker') {                  // kicker, sometimes with a landing slope, rarely a lone barrier off to one side
    const x = o(Math.round((r() - 0.5) * 14));
    g.ramps.push({ x, s: s0 + (inf.hasDip ? 6 : 12), len: 11, w: 8, h: 1.8 + r() * 0.7 });
    if (inf.hasDip) g.dips.push(mkDip(x, s0 + 31, 66, 3.0 + r() * 0.6, 0.6));
    else if (r() < 0.2) g.blocks.push(barrier(s0 + 52, o((r() < 0.5 ? -1 : 1) * (6 + r() * 6)), true));
  } else if (kind === 'rails') {            // mostly ground rails, some mid-height ones that need a charged jump
    const n = 1 + (r() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const tier = r() < 0.3 ? 1 : 0;
      g.rails.push(mkRail(r, o(Math.round((r() - 0.5) * 20)), s0 + 8 + i * 30 + Math.floor(r() * 4), tier ? 20 : 15 + Math.floor(r() * 5), tier, r() < 0.55));
    }
  } else if (kind === 'railchain') {        // kicker, then a row of rails with short gaps: grind, hop, grind, hop
    const x0 = o(Math.round((r() - 0.5) * 8));
    g.ramps.push({ x: x0, s: s0 + 8, len: 10, w: 8, h: 1.6 });
    let rs = s0 + 28, rx = x0;
    for (let i = 0; i < 4; i++) {
      const nx = Math.max(o(-9), Math.min(o(9), rx + (r() - 0.5) * 5)), last = i === 3;
      const ln = i ? 15 : 26;
      g.rails.push(mkRail(r, rx, rs, ln, 0, last, { x1: nx }));
      rx = nx; rs += ln + 8 + Math.floor(r() * 3);
    }
  } else if (kind === 'big') {              // big air into a landing slope
    const x = o(Math.round((r() - 0.5) * 8));
    g.ramps.push({ x, s: s0 + 10, len: 15, w: 11, h: 3.4 + r() * 0.8 });
    g.dips.push(mkDip(x, s0 + 45, 70, 5 + r() * 1.0, 0.62));
  } else if (kind === 'kickrail') {         // kicker into a long ground rail
    const x = o(Math.round((r() - 0.5) * 12));
    g.ramps.push({ x, s: s0 + 8, len: 10, w: 8, h: 2.0 });
    g.rails.push(mkRail(r, x, s0 + 30, 32, 0, r() < 0.5));
  } else if (kind === 'sky') {              // big ramp, then a high rail with a ramp end
    const x = o(Math.round((r() - 0.5) * 10));
    g.ramps.push({ x, s: s0 + 4, len: 15, w: 11, h: 3.9 + r() * 0.4 });
    g.rails.push(mkRail(r, x, s0 + SKY_OFF, 50, 2, true));
  } else if (kind === 'mid') {              // mid rail after a kicker
    const x = o(Math.round((r() - 0.5) * 12));
    g.ramps.push({ x, s: s0 + 8, len: 11, w: 8, h: 2.0 + r() * 0.4 });
    g.rails.push(mkRail(r, x, s0 + MID_OFF, 44, 1, r() < 0.6));
  } else if (kind === 'window') {           // big ramp, then a rail from a building window angling down into the course
    const side = r() < 0.5 ? -1 : 1;
    g.ramps.push({ x: o(side * 11), s: s0 + 4, len: 15, w: 10, h: 2.6 + r() * 0.3 });
    g.rails.push(mkRail(r, o(side * (HALF + 0.2)), s0 + 12, 68, 3, true, { x1: o(side * 8.5), h: 9, h1: 2.6, rise: 1.7, win: side }));
  } else if (kind === 'mega') {             // mega quarterpipe straight ahead: huge air, long landing slope
    const x = o(Math.round((r() - 0.5) * 6));
    g.ramps.push({ x, s: s0 + 6, len: 13, w: 12, h: 8 + r() * 0.6, p: 2.3, mega: true });
    g.dips.push(mkDip(x, s0 + MEGA_DIP, 92, MEGA_D + r() * 0.8, 0.6));
  } else if (kind === 'pipe') {             // mega quarterpipe along one side of the course: launch off the lip, land back on the wall
    g.walls.push({ side: r() < 0.5 ? -1 : 1, s: s0 + 4, len: 270, H: 10, toe: 7.5, lip: HALF });
  } else if (kind === 'tutramp') {          // tutorial: one friendly ramp straight ahead with a long landing slope
    g.ramps.push({ x: cx, s: s0 + 10, len: 11, w: 9, h: 2.3 });
    g.dips.push(mkDip(cx, s0 + 31, 66, 3.4, 0.6));
  } else if (kind === 'tutbar') {           // tutorial: a short row of wide-spaced barriers to steer around
    g.blocks.push(barrier(s0 + 18, cx - 6, true), barrier(s0 + 34, cx + 6, true), barrier(s0 + 50, cx - 5, true));
  } else if (kind === 'tutrail') {          // tutorial: ramp straight into one ground rail with a ramp end
    g.ramps.push({ x: cx, s: s0 + 6, len: 10, w: 9, h: 2.0 });
    g.rails.push(mkRail(r, cx, s0 + 28, 36, 0, true));
  } else if (kind === 'open') {             // open stretch, two wide-spaced barriers
    g.blocks.push(barrier(s0 + 22, o(-(4 + r() * 8)), true));
    g.blocks.push(barrier(s0 + 48, o(4 + r() * 8), true));
  } else if (kind === 'land') {             // landing slope for whoever just left a high rail
    const prev = seg(k - 1).rails[0];
    const x = prev ? prev.x : cx;
    const sky = prev && prev.tier === 2;
    g.dips.push(mkDip(x, s0 + (sky ? 30 : 14), sky ? 40 : 50, 3 + r() * 0.5, 0.7));
  }
  g.spill = g.rails.filter((q) => q.s + q.len > s0 + SEG);
  g.dspill = g.dips.filter((q) => q.s + q.len > s0 + SEG);
  g.wspill = g.walls.filter((q) => q.s + q.len > s0 + SEG);
  g.wspill2 = g.walls.filter((q) => q.s + q.len > s0 + 2 * SEG);
  if (kind === 'bend' || kind === 'bendc') {   // guide lights along both edges so the bend reads from far away
    for (let s = s0 + 3; s < s0 + SEG; s += 7) for (const side of [-1, 1]) g.posts.push({ x: ND.C(s) + side * (HALF + 0.9), s, c: side > 0 ? 0 : 1 });
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const s = s0 + i * (SEG / 4) + r() * 8;
      g.bld.push({
        x: ND.C(s) + side * (33 + r() * 13), s,
        w: 10 + r() * 10, d: 12 + r() * 8, h: 28 + r() * 62,
        tint: Math.floor(r() * 4), sign: r() < 0.55 ? (r() < 0.5 ? 0 : 1) : -1, signH: r()
      });
    }
  }
  return g;
}
function seg(k) {
  let g = segCache.get(k);
  if (!g) {
    g = gen(k); segCache.set(k, g);
    if (segCache.size > 60) segCache.delete(segCache.keys().next().value);
  }
  return g;
}
ND.seg = seg;

/* ---------- height field ---------- */
function base(x, s) {
  const xr = x - ND.C(s);
  let h = -SLOPE * s + 1.1 * Math.sin(s * 0.045) + 0.7 * Math.sin(s * 0.11 + xr * 0.05);
  const ax = Math.abs(xr);
  if (ax > HALF) h += 3.2 * (1 - Math.exp(-(ax - HALF) * 0.5));
  else h += 0.004 * xr * xr;
  return h;
}
function rampAdd(r, x, s) {
  const t = (s - r.s) / r.len;
  if (t < 0 || t > 1) return 0;
  const f = Math.max(0, Math.min(1, (r.w / 2 - Math.abs(x - r.x)) / 1.2));
  return r.h * Math.pow(t, r.p || 1.6) * f;
}
function dipOne(d, x, s) {
  const t = (s - d.s) / d.len;
  if (t <= 0 || t >= 1) return 0;
  const T0 = d.t0;
  const f = t < T0 ? 0.5 - 0.5 * Math.cos(Math.PI * t / T0) : 0.5 + 0.5 * Math.cos(Math.PI * (t - T0) / (1 - T0));
  return d.d * f * sm((d.w / 2 - Math.abs(x - d.x)) / 5);
}
function dipAt(x, s) {
  const k = Math.floor(s / SEG);
  let v = 0;
  const a = seg(k).dips, b = seg(k - 1).dspill;
  for (let i = 0; i < a.length; i++) v += dipOne(a[i], x, s);
  for (let i = 0; i < b.length; i++) v += dipOne(b[i], x, s);
  return v;
}
// quarterpipe wall along the edge of the course: a circular transition rising to a near-vertical lip, then a flat deck
function wallOne(w, x, s) {
  if (s <= w.s || s >= w.s + w.len) return 0;
  const xr = x - ND.C(s);
  if (xr * w.side <= 0) return 0;
  const a = xr * w.side, f = sm((s - w.s) / 10) * sm((w.s + w.len - s) / 10);
  if (f <= 0 || a <= w.toe) return 0;
  const q = Math.min(0.975, (a - w.toe) / (w.lip - w.toe));
  return w.H * f * (1 - Math.sqrt(1 - q * q));
}
function wallSum(x, s) {
  const k = Math.floor(s / SEG);
  let h = 0;
  for (let j = 0; j < 4; j++) {            // a wall can start up to three segments back
    const a = seg(k - j).walls;
    for (let i = 0; i < a.length; i++) h += wallOne(a[i], x, s);
  }
  return h;
}
ND.wallSum = wallSum;
// is the rider on (or at the lip of) a mega quarterpipe? gives the launch strength and which side the wall is on
ND.megaAt = (x, s) => {
  const k = Math.floor(s / SEG), sg = seg(k);
  for (const r of sg.ramps) if (r.mega && s >= r.s && s <= r.s + r.len + 3 && Math.abs(x - r.x) < r.w / 2 + 1) return { cap: MEGA_CAP, side: 0 };
  const ws = sg.walls.concat(seg(k - 1).walls, seg(k - 2).walls, seg(k - 3).walls), xr = x - ND.C(s);
  for (const w of ws) if (xr * w.side > w.toe && s >= w.s + 1 && s <= w.s + w.len - 1) return { cap: MEGA_CAP + 3, side: w.side };
  return null;
};
function rampSum(x, s) {
  const a = seg(Math.floor(s / SEG)).ramps;
  let h = 0;
  for (let i = 0; i < a.length; i++) h += rampAdd(a[i], x, s);
  return h;
}
ND.base = base;
ND.dipAt = dipAt;
// how much the landing slope drops (+) or climbs (-) per metre of travel right here
ND.bowlDown = (x, s) => dipAt(x, s + 1) - dipAt(x, s);
ND.H = function (x, s) { return base(x, s) - dipAt(x, s) + rampSum(x, s) + wallSum(x, s); };
ND.blocksNear = (s) => seg(Math.floor(s / SEG)).blocks;
ND.railsNear = (s) => {
  const k = Math.floor(s / SEG), a = seg(k).rails, sp = seg(k - 1).spill;
  return sp.length ? sp.concat(a) : a;
};
ND.railX = (rail, s) => {
  if (rail.x1 === rail.x) return rail.x;
  const t = (s - rail.s) / rail.len;
  return rail.x + (rail.x1 - rail.x) * (t < 0 ? 0 : t > 1 ? 1 : t);
};
ND.railY = (rail, s) => {
  const t = (s - rail.s) / rail.len;
  let y = base(ND.railX(rail, s), s) + rail.h + (rail.h1 - rail.h) * (t < 0 ? 0 : t > 1 ? 1 : t);
  if (rail.inc) { const u = (s - (rail.s + rail.len - rail.inc)) / rail.inc; if (u > 0) y += rail.rise * Math.pow(Math.min(1, u), 1.4); }
  return y;
};

/* ---------- textures ---------- */
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
const gridTex = canvasTex(64, 64, (g, w, h) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#a58cff'; g.fillRect(0, 0, w, 1); g.fillRect(0, 0, 1, h);
}, true);
const winPalettes = [['#ff3fd0', '#ffd23f'], ['#2ff0ff', '#ff3fd0'], ['#ffd23f', '#ffffff'], ['#a35bff', '#2ff0ff']];
const winMats = winPalettes.map((pal, i) => {
  const rr = rng(100 + i);
  const t = canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = ['#0d0720', '#0a0f26', '#14081f', '#090a1c'][i]; g.fillRect(0, 0, w, h);
    for (let y = 4; y < h - 4; y += 8) for (let x = 4; x < w - 4; x += 8) {
      const v = rr();
      if (v < 0.42) { g.fillStyle = v < 0.1 ? pal[1] : pal[0]; g.globalAlpha = 0.55 + rr() * 0.45; g.fillRect(x, y, 4, 5); g.globalAlpha = 1; }
    }
  }, true);
  return new THREE.MeshBasicMaterial({ map: t });
});
const terrainMat = new THREE.MeshPhongMaterial({ vertexColors: true, map: gridTex, flatShading: true, shininess: 0, specular: 0x000000, side: THREE.DoubleSide });
const mBarrier = new THREE.MeshPhongMaterial({ color: 0x2b2a5e, flatShading: true, shininess: 0 });
const mBarrierTop = new THREE.MeshBasicMaterial({ color: 0xffd23f });
const mPylon = new THREE.MeshPhongMaterial({ color: 0x1c1a3d, flatShading: true, shininess: 0 });
const mPylonGlow = new THREE.MeshBasicMaterial({ color: 0x2ff0ff });
const mRails = [0xff3fd0, 0x2ff0ff, 0xffd23f, 0x7dff4a].map((c) => new THREE.MeshBasicMaterial({ color: c }));
const mPost = new THREE.MeshPhongMaterial({ color: 0x302c58, flatShading: true, shininess: 0 });
const mSign = [new THREE.MeshBasicMaterial({ color: 0xff3fd0 }), new THREE.MeshBasicMaterial({ color: 0x2ff0ff })];
const mSignBack = new THREE.MeshBasicMaterial({ color: 0x0a0618 });

/* ---------- chunk meshes ---------- */
function buildTerrain(k) {
  const fine = seg(k).walls.length || seg(k - 1).walls.length || seg(k - 2).walls.length || seg(k - 3).walls.length;
  const NX = fine ? 100 : 50, NS = 70, W = 100, s0 = k * SEG;
  // lattice follows the bending path, snapped to the 2 m grid so neighbouring chunks line up
  const cxm = Math.round(ND.C(s0 + SEG / 2) / 2) * 2;
  const P = new Float32Array((NX + 1) * (NS + 1) * 3);
  const C = new Float32Array((NX + 1) * (NS + 1) * 3);
  const UV = new Float32Array((NX + 1) * (NS + 1) * 2);
  let p = 0, u = 0;
  for (let j = 0; j <= NS; j++) {
    const s = s0 + j * (SEG / NS), cs = ND.C(s);
    for (let i = 0; i <= NX; i++) {
      const x = cxm - W / 2 + i * (W / NX);
      const dp = dipAt(x, s), rp = rampSum(x, s), wp = wallSum(x, s), y = base(x, s) - dp + rp + wp;
      const ax = Math.abs(x - cs), hv = hash(i * 31 + j * 17 + k * 7);
      let r, gg, b;
      if (wp > 0.03 && ax <= HALF) {                           // quarterpipe wall: dark face with neon bands, bright coping at the lip
        const stripe = Math.floor(s / 4) % 2, hi = wp > 5.6;
        if (hi) { r = 0.3; gg = 1.0; b = 1.0; } else if (stripe) { r = 0.55; gg = 0.12; b = 0.75; } else { r = 0.1; gg = 0.2; b = 0.55; }
      } else if (rp > 0.04) { r = 0.25; gg = 0.95; b = 1.0; }
      else if (ax > HALF + 0.2) {
        if (ax < HALF + 2.2) { r = 1.0; gg = 0.2; b = 0.7; }
        else { r = 0.22 + 0.05 * hv; gg = 0.2; b = 0.36; }
      } else {
        const v = 0.9 + 0.1 * hv; r = 0.78 * v; gg = 0.83 * v; b = 0.98 * v;
        if (dp > 0.02) {                       // landing slopes are striped mint
          const m = Math.min(1, dp / 0.45) * (Math.floor(s / 3) % 2 ? 0.8 : 0.55);
          r += (0.2 - r) * m; gg += (1.0 - gg) * m; b += (0.7 - b) * m;
        }
      }
      P[p] = x; P[p + 1] = y; P[p + 2] = -s;
      C[p] = r; C[p + 1] = gg; C[p + 2] = b; p += 3;
      UV[u++] = x / 8 + 0.5; UV[u++] = s / 8;
    }
  }
  const idx = [];
  for (let j = 0; j < NS; j++) for (let i = 0; i < NX; i++) {
    const a = j * (NX + 1) + i, b2 = a + 1, c = a + NX + 1, d = c + 1;
    idx.push(a, b2, c, b2, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(C, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, terrainMat);
}

const mWinDark = new THREE.MeshBasicMaterial({ color: 0x05020f });
const mWinGlow = new THREE.MeshBasicMaterial({ color: 0x7dff4a });
const mWinPink = new THREE.MeshBasicMaterial({ color: 0xff3fd0 });
const mWinCyan = new THREE.MeshBasicMaterial({ color: 0x2ff0ff });
function addRailClassic(group, rail) {
  const step = 2, wd = [0.3, 0.36, 0.42, 0.46][rail.tier];
  for (let s = rail.s; s < rail.s + rail.len; s += step) {
    const x0 = ND.railX(rail, s), x1 = ND.railX(rail, s + step), y0 = ND.railY(rail, s), y1 = ND.railY(rail, s + step);
    const len = Math.hypot(x1 - x0, y1 - y0, step);
    const m = new THREE.Mesh(new THREE.BoxGeometry(wd, 0.24, len + 0.1), mRails[rail.tier]);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2 - 0.12, -(s + step / 2));
    m.lookAt(x1, y1 - 0.12, -(s + step));
    group.add(m);
  }
  const gap = rail.tier ? 8 : 6;
  for (let s = rail.s + 1; s < rail.s + rail.len - (rail.inc ? 4 : 0); s += gap) {
    const px = ND.railX(rail, s), top = ND.railY(rail, s) - 0.24, gy = ND.H(px, s), hh = Math.max(0.1, top - gy);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.22 + 0.06 * Math.min(2, rail.tier), hh, 0.22 + 0.06 * Math.min(2, rail.tier)), mPost);
    m.position.set(px, gy + hh / 2, -s);
    group.add(m);
    if (rail.tier) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.6), mRails[rail.tier]);
      cap.position.set(px, top - 0.02, -s); group.add(cap);
    }
  }
}
// ---- rail looks (ND.RAIL_STYLE: 0 classic, 1 neon tube, 2 industrial pipe, 3 hover light-rail, 4 truss girder, 5 lacquer beam) ----
const TIERC = [0xff3fd0, 0x2ff0ff, 0xffd23f, 0x7dff4a];
const mk = (c, add, op) => new THREE.MeshBasicMaterial(add ? { color: c, transparent: true, opacity: op || 0.3, blending: THREE.AdditiveBlending, depthWrite: false } : { color: c });
const RM = {};
const rm = (k, c, add, op) => RM[k] || (RM[k] = mk(c, add, op));
const cylZ = (r, len, n) => new THREE.CylinderGeometry(r, r, len, n || 8).rotateX(Math.PI / 2);
function placeBetween(group, geo, mat, x0, y0, z0, x1, y1, z1) {
  const m = new THREE.Mesh(geo, mat); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); m.lookAt(x1, y1, z1); group.add(m); return m;
}
// fold a temporary group of small meshes into one mesh per material (rails are hundreds of pieces)
function mergeInto(target, tmp) {
  const by = new Map();
  tmp.children.forEach((m) => {
    m.updateMatrix(); const g = m.geometry.clone(); g.applyMatrix4(m.matrix);
    const e = by.get(m.material) || { p: [], i: [], n: 0 }, pos = g.attributes.position.array, idx = g.index.array;
    for (let k = 0; k < pos.length; k++) e.p.push(pos[k]);
    for (let k = 0; k < idx.length; k++) e.i.push(idx[k] + e.n);
    e.n += pos.length / 3; by.set(m.material, e); g.dispose(); m.geometry.dispose();
  });
  by.forEach((e, mat) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(e.p), 3));
    geo.setIndex(new THREE.BufferAttribute(e.n > 65000 ? new Uint32Array(e.i) : new Uint16Array(e.i), 1));
    geo.computeBoundingSphere(); target.add(new THREE.Mesh(geo, mat));
  });
}
function addRail(realGroup, rail) {
  // rail look follows the district it sits in (ND.RAIL_STYLE overrides for previews)
  const style = ND.RAIL_STYLE != null ? ND.RAIL_STYLE : (ND.city && ND.city.railStyle ? ND.city.railStyle(rail.s) : 0);
  const wing = () => { if (rail.win) addWindowWing(realGroup, rail); };
  if (style === 0) { addRailClassic(realGroup, rail); wing(); return; }
  const group = new THREE.Group(), tc = TIERC[rail.tier], T = rail.tier, step = 2;
  const top = (px, s) => ND.railY(px, s);
  // main line, 2 m pieces following the rail's slope and sideways drift
  for (let s = rail.s; s < rail.s + rail.len; s += step) {
    const x0 = ND.railX(rail, s), x1 = ND.railX(rail, s + step), y0 = ND.railY(rail, s), y1 = ND.railY(rail, s + step), z0 = -s, z1 = -(s + step), len = Math.hypot(x1 - x0, y1 - y0, step) + 0.08;
    if (style === 1) {            // neon tube: bright core, soft halo
      placeBetween(group, cylZ(0.13, len, 8), rm('tc' + T, tc), x0, y0 - 0.14, z0, x1, y1 - 0.14, z1);
      placeBetween(group, cylZ(0.06, len, 6), rm('tw', 0xffffff), x0, y0 - 0.12, z0, x1, y1 - 0.12, z1);
      placeBetween(group, cylZ(0.34, len, 8), rm('th' + T, tc, true, 0.28), x0, y0 - 0.14, z0, x1, y1 - 0.14, z1);
    } else if (style === 2) {     // industrial pipe with colour bands
      placeBetween(group, cylZ(0.2, len, 10), rm('pp', 0x8e97bd), x0, y0 - 0.2, z0, x1, y1 - 0.2, z1);
      if (((s - rail.s) / step) % 2 === 0) placeBetween(group, cylZ(0.25, 0.7, 10), rm('pb' + T, tc), x0, y0 - 0.2, z0, x0 + (x1 - x0) * 0.35, y0 + (y1 - y0) * 0.35 - 0.2, z0 - 0.7);
    } else if (style === 3) {     // hover light-rail: floating slab, light strip, chevrons, underglow
      placeBetween(group, new THREE.BoxGeometry(0.95, 0.2, len), rm('hs', 0x15122e), x0, y0 - 0.14, z0, x1, y1 - 0.14, z1);
      placeBetween(group, new THREE.BoxGeometry(0.46, 0.06, len), rm('hl' + T, tc), x0, y0 - 0.02, z0, x1, y1 - 0.02, z1);
      placeBetween(group, new THREE.BoxGeometry(1.3, 0.5, len), rm('hg' + T, tc, true, 0.32), x0, y0 - 0.38, z0, x1, y1 - 0.38, z1);
      const cm = placeBetween(group, new THREE.BoxGeometry(0.6, 0.04, 0.12), rm('hc', 0xffffff), x0, y0 + 0.02, z0 - 0.6, x1, y1 + 0.02, z1 - 0.6);
      cm.rotateY(0.6); placeBetween(group, new THREE.BoxGeometry(0.6, 0.04, 0.12), rm('hc', 0xffffff), x0, y0 + 0.02, z0 - 1.1, x1, y1 + 0.02, z1 - 1.1).rotateY(-0.6);
    } else if (style === 4) {     // truss girder: neon top chord, lower chord, zig-zag struts
      const dh = 0.95, sx = (x0 + x1) / 2, sy = (y0 + y1) / 2;
      placeBetween(group, cylZ(0.11, len, 6), rm('tc' + T, tc), x0, y0 - 0.12, z0, x1, y1 - 0.12, z1);
      placeBetween(group, cylZ(0.08, len, 6), rm('gs', 0x3a3d66), x0, y0 - dh, z0, x1, y1 - dh, z1);
      const up = (Math.round((s - rail.s) / step) % 2) === 0;
      placeBetween(group, new THREE.BoxGeometry(0.07, 0.07, 1), rm('gs', 0x3a3d66), x0, up ? y0 - dh : y0 - 0.14, z0, x1, up ? y1 - 0.14 : y1 - dh, z1).scale.z = Math.hypot(x1 - x0, dh, step);
      const vp = new THREE.Mesh(new THREE.BoxGeometry(0.07, dh - 0.14, 0.07), rm('gs', 0x3a3d66)); vp.position.set(x0, y0 - 0.12 - dh / 2, z0); group.add(vp);
    } else {                      // lacquer beam: red beam, gold edge, tier-coloured inlay
      placeBetween(group, new THREE.BoxGeometry(0.5, 0.3, len), rm('lb', 0xb0142a), x0, y0 - 0.17, z0, x1, y1 - 0.17, z1);
      placeBetween(group, new THREE.BoxGeometry(0.3, 0.05, len), rm('lt' + T, tc), x0, y0 - 0.005, z0, x1, y1 - 0.005, z1);
      placeBetween(group, new THREE.BoxGeometry(0.54, 0.06, len), rm('lg', 0xffc23f), x0, y0 - 0.32, z0, x1, y1 - 0.32, z1);
    }
  }
  // supports
  const gap = style === 3 ? 10 : T ? 8 : 6;
  for (let s = rail.s + 1; s < rail.s + rail.len - (rail.inc ? 4 : 0); s += gap) {
    const px = ND.railX(rail, s), ty = ND.railY(rail, s) - 0.28, gy = ND.H(px, s), hh = Math.max(0.1, ty - gy);
    if (style === 1) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, hh, 0.16), rm('dp', 0x2a2850)); m.position.set(px, gy + hh / 2, -s); group.add(m);
      const ring = new THREE.Mesh(cylZ(0.3, 0.14, 10).rotateX(Math.PI / 2), rm('th' + T, tc, true, 0.6)); ring.position.set(px, ty - 0.12, -s); group.add(ring);
    } else if (style === 2) {
      for (const dx of [-0.55, 0.55]) { const l = placeBetween(group, new THREE.BoxGeometry(0.16, 0.16, 1), rm('pl', 0x56608a), px + dx, gy, -s, px, ty - 0.3, -s); l.scale.z = Math.hypot(dx, ty - 0.3 - gy); }
      const f = new THREE.Mesh(cylZ(0.34, 0.14, 10), rm('pf', 0x56608a)); f.position.set(px, ty - 0.2, -s); group.add(f);
      for (const dx of [-0.55, 0.55]) { const foot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), rm('pf', 0x56608a)); foot.position.set(px + dx, gy + 0.05, -s); group.add(foot); }
    } else if (style === 3) {
      const pod = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.7), rm('hs', 0x15122e)); pod.position.set(px, gy + 0.2, -s); group.add(pod);
      const bm = new THREE.Mesh(new THREE.BoxGeometry(0.1, hh, 0.1), rm('hb' + T, tc, true, 0.55)); bm.position.set(px, gy + hh / 2, -s); group.add(bm);
      const em = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.4), rm('hl' + T, tc)); em.position.set(px, gy + 0.42, -s); group.add(em);
    } else if (style === 4) {
      for (const dz of [-0.8, 0.8]) { const l = placeBetween(group, new THREE.BoxGeometry(0.13, 0.13, 1), rm('gs', 0x3a3d66), px, gy, -s + dz * 1.4, px, ty - 0.9, -s); l.scale.z = Math.hypot(dz * 1.4, ty - 0.9 - gy); }
      const nd = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), rm('hl' + T, tc)); nd.position.set(px, ty - 0.9, -s); group.add(nd);
    } else {
      const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, hh, 8), rm('lb', 0xb0142a)); pil.position.set(px, gy + hh / 2, -s); group.add(pil);
      for (const yy of [gy + 0.25, ty - 0.35]) { const band = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.14, 8), rm('lg', 0xffc23f)); band.position.set(px, yy, -s); group.add(band); }
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.14, 0.4), rm('lc', 0x0e6670)); b1.position.set(px, ty - 0.1, -s); group.add(b1);
      if (((s - rail.s) / gap) % 2 < 1) { const lan = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.36, 8), rm('ll', 0xff3a4a)); lan.position.set(px + 0.8, ty - 0.1, -s); group.add(lan); const lg = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.05), rm('lgl', 0xff6a4a, true, 0.35)); lg.position.set(px + 0.8, ty - 0.1, -s + 0.3); group.add(lg); }
    }
  }
  mergeInto(realGroup, group); wing();
}
// a tower block at the edge of the course with a neon-trimmed window the rail comes out of
function addWindowWing(group, rail) {
  const side = rail.win, cs = ND.C(rail.s), face = cs + side * (HALF + 0.9), wingW = 12, wingD = 20;
  const yR = ND.railY(rail, rail.s), s0 = rail.s - 2, ymin = base(face, s0) - 6, hTop = yR + 14 - ymin;
  const wgeo = new THREE.BoxGeometry(wingW, hTop, wingD), uv = wgeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * wingD / 10, uv.getY(i) * hTop / 14);
  const wing = new THREE.Mesh(wgeo, winMats[3]);
  wing.position.set(face + side * wingW / 2, ymin + hTop / 2, -(rail.s + 6)); group.add(wing);
  // window opening: dark pane + neon frame, on the face toward the course
  const wy = yR + 0.2, wz = -(rail.s + 0.5), px = face - side * 0.08;
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 4.2), mWinDark);
  pane.rotation.y = -side * Math.PI / 2; pane.position.set(px, wy, wz); group.add(pane);
  const fr = (w, h, dx, dy, mat) => { const f = new THREE.Mesh(new THREE.BoxGeometry(0.25, h, w), mat); f.position.set(px - side * 0.1, wy + dy, wz + dx); group.add(f); };
  fr(5.8, 0.28, 0, 2.2, mWinGlow); fr(5.8, 0.28, 0, -2.2, mWinGlow); fr(0.28, 4.7, 2.8, 0, mWinPink); fr(0.28, 4.7, -2.8, 0, mWinPink);
  // vertical neon trim up the corner of the block and a roof line
  for (const dz of [-wingD / 2 + 6, wingD / 2 + 6]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.3, hTop, 0.3), mWinCyan);
    t.position.set(face - side * 0.1, ymin + hTop / 2, -(rail.s) - dz); group.add(t);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, wingD), mWinPink);
  roof.position.set(face - side * 0.1, ymin + hTop - 0.2, -(rail.s + 6)); group.add(roof);
  for (let i = 1; i <= 3; i++) {   // light bars above the window
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, wingD - 2), i % 2 ? mWinCyan : mWinPink);
    bar.position.set(face - side * 0.1, wy + 2.6 + i * 2.6, -(rail.s + 6)); group.add(bar);
  }
}
function addBlock(group, b) {
  const gy = ND.H(b.x, b.s);
  if (b.kind === 'barrier') {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), mBarrier);
    m.position.set(b.x, gy + b.h / 2, -b.s); group.add(m);
    const t = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.05, 0.18, b.d + 0.05), mBarrierTop);
    t.position.set(b.x, gy + b.h - 0.05, -b.s); group.add(t);
  } else {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), mPylon);
    m.position.set(b.x, gy + b.h / 2, -b.s); group.add(m);
    const t = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.1, 0.7, b.d + 0.1), mPylonGlow);
    t.position.set(b.x, gy + b.h - 0.4, -b.s); group.add(t);
  }
}
function addBuilding(group, b) {
  const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
  const uv = geo.attributes.uv, sc = Math.max(b.w, b.d) / 10, sv = b.h / 14;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sc, uv.getY(i) * sv);
  const y0 = base(b.x, b.s) - 5;
  const m = new THREE.Mesh(geo, winMats[b.tint]);
  m.position.set(b.x, y0 + b.h / 2, -b.s); group.add(m);
  if (b.sign >= 0) {
    const side = b.x > 0 ? -1 : 1;
    const sy = y0 + 14 + b.signH * Math.max(2, b.h - 22);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(b.d * 0.62, 4.2), mSignBack);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(b.d * 0.56, 3.2), mSign[b.sign]);
    const px = b.x + side * (b.w / 2 + 0.08);
    for (const o of [back, sign]) { o.rotation.y = side * Math.PI / 2; o.position.set(px, sy, -b.s); }
    sign.position.x += side * 0.05;
    group.add(back); group.add(sign);
  }
}

function buildChunk(k) {
  const g = seg(k), group = new THREE.Group();
  group.add(buildTerrain(k));
  g.rails.forEach((r) => addRail(group, r));
  g.blocks.forEach((b) => addBlock(group, b));
  if (ND.city) ND.city.build(group, k, g); else g.bld.forEach((b) => addBuilding(group, b));
  g.posts.forEach((q) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.7, 0.3), mRails[q.c ? 1 : 0]);
    m.position.set(q.x, ND.H(q.x, q.s) + 0.85, -q.s); group.add(m);
  });
  return group;
}

/* ---------- streaming ---------- */
const active = new Map();
ND.world = {
  scene: null,
  init(scene) { this.scene = scene; this.clear(); },
  /* swap in a short repeating course (tutorial) or go back to the normal hill with null */
  setPlan(fn) { plan = fn || null; infos.length = 0; segCache.clear(); lastDir = 1; this.clear(); },
  clear() {
    active.forEach((grp) => this.drop(grp));
    active.clear();
  },
  drop(grp) {
    this.scene.remove(grp);
    grp.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  },
  update(s) {
    const k = Math.floor(s / SEG), lo = k - 1, hi = k + 3;
    for (let i = lo; i <= hi; i++) if (!active.has(i)) { const grp = buildChunk(i); active.set(i, grp); this.scene.add(grp); }
    active.forEach((grp, i) => { if (i < lo || i > hi) { this.drop(grp); active.delete(i); } });
  }
};
