
/* CYBERSLIDE - world: turns the course (course.ts) into meshes: terrain, rails, obstacles, buildings, and streams
   chunks in and out around the rider. */

import * as THREE from 'three';
import { ND } from './nd';
import {
  SEG, HALF, SLOPE, rng, hash, C, kindAt, seg, base, dipAt, rampSum, wallSum, megaAt, bowlDown, H,
  blocksNear, railsNear, railX, railY, setCoursePlan, setRunSeed, randomSeed, districtAt,
} from './course';
import type { Rail, Block, Building, CoursePlan } from './course';

type Draw2D = (g: CanvasRenderingContext2D, w: number, h: number) => void;
type Mat = THREE.Material;
type AnyMesh = THREE.Mesh<THREE.BufferGeometry, Mat>;

// the rest of the game still reads the course through ND
Object.assign(ND, { SEG, HALF, SLOPE, C, kindAt, seg, base, dipAt, wallSum, megaAt, bowlDown, H, blocksNear, railsNear, railX, railY, districtAt });

/* ---------- textures ---------- */
function canvasTex(w: number, h: number, draw: Draw2D, repeat?: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d') as CanvasRenderingContext2D, w, h);
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
function buildTerrain(k: number): THREE.Mesh {
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
      let r: number, gg: number, b: number;
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
  const idx: number[] = [];
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
function addRailClassic(group: THREE.Object3D, rail: Rail): void {
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
const mk = (c: number, add?: boolean, op?: number) => new THREE.MeshBasicMaterial(add ? { color: c, transparent: true, opacity: op || 0.3, blending: THREE.AdditiveBlending, depthWrite: false } : { color: c });
const RM: Record<string, THREE.MeshBasicMaterial> = {};
const rm = (k: string, c: number, add?: boolean, op?: number) => RM[k] || (RM[k] = mk(c, add, op));
const cylZ = (r: number, len: number, n?: number) => new THREE.CylinderGeometry(r, r, len, n || 8).rotateX(Math.PI / 2);
function placeBetween(group: THREE.Object3D, geo: THREE.BufferGeometry, mat: Mat, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): AnyMesh {
  const m = new THREE.Mesh(geo, mat); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); m.lookAt(x1, y1, z1); group.add(m); return m;
}
// fold a temporary group of small meshes into one mesh per material (rails are hundreds of pieces)
function mergeInto(target: THREE.Object3D, tmp: THREE.Group): void {
  const by = new Map<Mat, { p: number[]; i: number[]; n: number }>();
  (tmp.children as AnyMesh[]).forEach((m) => {
    m.updateMatrix(); const g = m.geometry.clone(); g.applyMatrix4(m.matrix);
    const e = by.get(m.material) || { p: [], i: [], n: 0 }, pos = g.attributes.position.array, idx = (g.index as THREE.BufferAttribute).array;
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
function addRail(realGroup: THREE.Object3D, rail: Rail): void {
  // rail look follows the district it sits in (ND.RAIL_STYLE overrides for previews)
  const style = ND.RAIL_STYLE != null ? ND.RAIL_STYLE : (ND.city && ND.city.railStyle ? ND.city.railStyle(rail.s) : 0);
  const wing = () => { if (rail.win) addWindowWing(realGroup, rail); };
  if (style === 0) { addRailClassic(realGroup, rail); wing(); return; }
  const group = new THREE.Group(), tc = TIERC[rail.tier], T = rail.tier, step = 2;
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
      const dh = 0.95;
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
function addWindowWing(group: THREE.Object3D, rail: Rail): void {
  const side = rail.win as -1 | 1, cs = ND.C(rail.s), face = cs + side * (HALF + 0.9), wingW = 12, wingD = 20;
  const yR = ND.railY(rail, rail.s), s0 = rail.s - 2, ymin = base(face, s0) - 6, hTop = yR + 14 - ymin;
  const wgeo = new THREE.BoxGeometry(wingW, hTop, wingD), uv = wgeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * wingD / 10, uv.getY(i) * hTop / 14);
  const wing = new THREE.Mesh(wgeo, winMats[3]);
  wing.position.set(face + side * wingW / 2, ymin + hTop / 2, -(rail.s + 6)); group.add(wing);
  // window opening: dark pane + neon frame, on the face toward the course
  const wy = yR + 0.2, wz = -(rail.s + 0.5), px = face - side * 0.08;
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 4.2), mWinDark);
  pane.rotation.y = -side * Math.PI / 2; pane.position.set(px, wy, wz); group.add(pane);
  const fr = (w: number, h: number, dx: number, dy: number, mat: Mat) => { const f = new THREE.Mesh(new THREE.BoxGeometry(0.25, h, w), mat); f.position.set(px - side * 0.1, wy + dy, wz + dx); group.add(f); };
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
function addBlock(group: THREE.Object3D, b: Block): void {
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
function addBuilding(group: THREE.Object3D, b: Building): void {
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

function buildChunk(k: number): THREE.Group {
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
const active = new Map<number, THREE.Group>();
export const world = {
  scene: null as THREE.Scene | null,
  init(scene: THREE.Scene): void { this.scene = scene; this.clear(); },
  /* swap in a short repeating course (tutorial) or go back to the normal hill with null */
  setPlan(fn: CoursePlan | null | undefined): void { setCoursePlan(fn); this.clear(); },
  /* a new hill: a fresh random one, or the fixed hill with 0 (tutorial) */
  reseed(seed: number = randomSeed()): void { setRunSeed(seed); this.clear(); },
  clear(): void {
    active.forEach((grp) => this.drop(grp));
    active.clear();
  },
  drop(grp: THREE.Group): void {
    this.scene?.remove(grp);
    grp.traverse((o) => { const g = (o as THREE.Mesh).geometry; if (g) g.dispose(); });
  },
  update(s: number): void {
    const k = Math.floor(s / SEG), lo = k - 1, hi = k + 3;
    for (let i = lo; i <= hi; i++) if (!active.has(i)) { const grp = buildChunk(i); active.set(i, grp); this.scene?.add(grp); }
    active.forEach((grp, i) => { if (i < lo || i > hi) { this.drop(grp); active.delete(i); } });
  }
};

ND.world = world;
