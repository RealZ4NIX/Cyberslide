// @ts-nocheck -- ported as-is from index.html; typed step by step

/* CYBERSLIDE - riders: four detailed rider models (blocky PS2 style) with idle animations, and their stats */

import * as THREE from 'three';
import { ND } from './nd';

const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const CYL = (r, h, n) => new THREE.CylinderGeometry(r, r, h, n || 8);
const MC = {};
const lam = (c) => MC['l' + c] || (MC['l' + c] = new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 }));
const chr = (c) => MC['c' + c] || (MC['c' + c] = new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 85, specular: 0x9ab8ff }));
const bas = (c) => MC['b' + c] || (MC['b' + c] = new THREE.MeshBasicMaterial({ color: c }));
const glo = (c, o) => MC['g' + c + '_' + o] || (MC['g' + c + '_' + o] = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false }));
const own = (c, o) => new THREE.MeshBasicMaterial(o == null ? { color: c } : { color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
const add = (p, g, m, x, y, z, rx, ry, rz) => {
  const o = new THREE.Mesh(g, m); o.position.set(x || 0, y || 0, z || 0);
  if (rx || ry || rz) o.rotation.set(rx || 0, ry || 0, rz || 0);
  p.add(o); return o;
};
const sin = Math.sin, PI = Math.PI;
const pulse = (t, f, ph) => 0.5 + 0.5 * sin(t * f + (ph || 0));

/* ---- shared pieces ---- */
function mkBoard(o) {
  const g = new THREE.Group();
  add(g, B(0.6, 0.08, 1.95), lam(o.deck), 0, 0, 0);
  add(g, B(0.14, 0.09, 1.75), bas(o.stripe), 0, 0.005, 0);
  add(g, B(0.64, 0.03, 2.0), bas(o.edge), 0, -0.05, 0);
  add(g, B(0.6, 0.08, 0.3), bas(o.tip), 0, 0.07, -1.0, 0.4, 0, 0);
  add(g, B(0.6, 0.08, 0.3), bas(o.tip), 0, 0.07, 1.0, -0.4, 0, 0);
  for (const z of [-0.42, 0.42]) add(g, B(0.44, 0.07, 0.26), lam(0x0a0714), 0, 0.1, z);   // bindings
  return g;
}
function mkRig() { return { board: null, body: new THREE.Group(), head: new THREE.Group(), armNear: null, armFar: null, tail: new THREE.Group(), tailSegs: [], fx: null, idle: null, trail: [[1, 0.2, 0.8], [0.15, 0.9, 1]], glow: 0xff2fb8 }; }
function mkArm(r, z, build) {
  const g = new THREE.Group(); g.position.set(0, 1.86, z); build(g); r.body.add(g); return g;
}
function mkTail(r, n, step, make) {
  let par = r.tail;
  for (let i = 0; i < n; i++) {
    const sg = new THREE.Group(); sg.position.x = i ? step : 0; par.add(sg);
    make(sg, i); r.tailSegs.push(sg); par = sg;
  }
}
function finish(r) {
  r.head.position.set(0, 2.3, 0); r.head.rotation.y = -0.5;
  r.tail.position.set(0.3, 0.08, 0); r.head.add(r.tail);
  r.body.add(r.head); r.body.rotation.y = -0.7;
  r.baseY = -0.7; r.headY = -0.5;
  return r;
}
/* neutral standing pose for the menu: board flat, arms down, then a rider's idle adds motion on top */
function stand(r, t, bob, sway) {
  r.board.position.y = 0; r.board.rotation.set(0, 0, 0);
  r.body.rotation.y = r.baseY + (sway || 0);
  r.body.position.y = bob; r.body.scale.y = 1 - 0.5 * bob;
  r.tail.rotation.z = -0.45 + 0.12 * sin(t * 2.1);
  for (let i = 0; i < r.tailSegs.length; i++) r.tailSegs[i].rotation.y = sin(t * 4 + i * 1.1) * 0.25;
}

/* ================= NOVA: the all-rounder, pink hoodie and visor ================= */
function nova() {
  const r = mkRig(), P = 0xff2fb8, C = 0x2ff0ff;
  r.board = mkBoard({ deck: 0x1a0f3a, stripe: P, edge: C, tip: P });
  for (const z of [-0.42, 0.42]) {
    add(r.board, B(0.38, 0.2, 0.5), lam(0x0e0a24), 0, 0.15, z);
    add(r.board, B(0.4, 0.05, 0.52), bas(C), 0, 0.06, z);
    add(r.board, B(0.32, 0.78, 0.34), lam(0x150c33), 0, 0.64, z);
    add(r.board, B(0.03, 0.78, 0.07), bas(C), 0.17, 0.64, z + 0.1);
    add(r.board, B(0.03, 0.78, 0.07), bas(P), -0.17, 0.64, z - 0.1);
    add(r.board, B(0.4, 0.17, 0.4), lam(0x2a1466), 0, 0.8, z);            // knee pad
    add(r.board, B(0.42, 0.03, 0.42), bas(C), 0, 0.89, z);
  }
  const b = r.body;
  add(b, B(0.5, 0.2, 0.62), lam(0x150c33), 0, 1.1, 0);
  add(b, B(0.5, 0.74, 0.8), lam(0x3a1a8a), 0, 1.58, 0);
  add(b, B(0.52, 0.09, 0.82), bas(C), 0, 1.88, 0);
  add(b, B(0.52, 0.07, 0.82), bas(P), 0, 1.24, 0);
  add(b, B(0.03, 0.1, 0.62), bas(P), 0.265, 1.74, 0);
  add(b, B(0.03, 0.1, 0.46), bas(C), 0.265, 1.56, 0);
  add(b, B(0.03, 0.1, 0.3), bas(P), 0.265, 1.38, 0);
  add(b, B(0.03, 0.26, 0.26), bas(P), -0.265, 1.62, 0);                   // chest emblem
  add(b, B(0.04, 0.1, 0.1), bas(0xffffff), -0.27, 1.62, 0);
  add(b, B(0.42, 0.14, 0.54), lam(0x2a1466), 0, 2.0, 0);
  add(b, B(0.3, 0.4, 0.5), lam(0x2a1466), 0.3, 1.93, 0);                  // hood hanging down the back
  add(b, B(0.04, 0.38, 0.04), bas(C), -0.27, 1.78, 0.1); add(b, B(0.04, 0.38, 0.04), bas(C), -0.27, 1.78, -0.1);   // drawstrings
  const pack = add(b, B(0.22, 0.5, 0.42), lam(0x1a0f3a), 0.42, 1.5, 0);   // small backpack with a blinking antenna
  add(pack, B(0.24, 0.06, 0.44), bas(P), 0, 0.1, 0);
  add(b, B(0.03, 0.55, 0.03), bas(C), 0.42, 2.0, 0.14);
  const bulb = own(0xffffff); add(b, B(0.08, 0.08, 0.08), bulb, 0.42, 2.3, 0.14);
  const mk = (z) => mkArm(r, z, (g) => {
    add(g, B(0.2, 0.62, 0.2), lam(0x3a1a8a), 0, -0.31, 0);
    add(g, B(0.22, 0.06, 0.22), bas(C), 0, -0.5, 0);
    add(g, B(0.22, 0.18, 0.22), lam(0x0e0a24), 0, -0.68, 0);
    add(g, B(0.24, 0.05, 0.24), bas(P), 0, -0.6, 0);                       // wrist band
  });
  r.armNear = mk(0.5); r.armFar = mk(-0.5);
  const h = r.head;
  add(h, new THREE.SphereGeometry(0.27, 7, 5), lam(0x1a1040), 0, 0, 0);
  const beanie = add(h, new THREE.SphereGeometry(0.3, 7, 5), lam(0x24124f), 0, 0.1, 0); beanie.scale.y = 0.78;
  add(h, CYL(0.3, 0.07, 8), bas(C), 0, 0.05, 0);
  add(h, B(0.08, 0.1, 0.4), bas(C), -0.26, -0.03, 0);
  add(h, B(0.06, 0.1, 0.34), bas(0xffffff), -0.28, -0.03, 0);              // glowing visor
  add(h, B(0.08, 0.04, 0.12), bas(P), -0.27, -0.14, 0);                    // mouth
  for (const z of [-0.31, 0.31]) { add(h, B(0.1, 0.2, 0.2), bas(P), 0, -0.02, z); add(h, B(0.04, 0.36, 0.04), bas(P), 0, 0.17, z); }
  add(h, B(0.05, 0.05, 0.62), bas(C), 0, 0.36, 0);
  add(h, new THREE.SphereGeometry(0.07, 6, 4), bas(P), 0, 0.46, 0);        // beanie pom
  mkTail(r, 4, 0.2, (sg, i) => add(sg, B(0.22, 0.1 + 0.02 * i, 0.12 + 0.02 * i), bas(i % 2 ? C : P), 0.1, 0, 0));
  finish(r);
  r.idle = (t) => {
    const b = 0.04 * sin(t * 3.2);
    stand(r, t, b, 0.05 * sin(t * 1.3));
    r.head.rotation.y = r.headY + 0.18 * sin(t * 0.9);
    const k = (t % 5) / 5;                                                  // every 5 s she tweaks her visor
    const up = k > 0.62 && k < 0.84 ? sin((k - 0.62) / 0.22 * PI) : 0;
    r.armNear.rotation.set(-0.12 + 0.5 * up, 0, -0.06 * sin(t * 3.2) - 1.9 * up);
    r.armFar.rotation.set(0.12 + 0.03 * sin(t * 1.7), 0, 0.05 * sin(t * 3.2 + 1));
    bulb.color.setHex(pulse(t, 5) > 0.7 ? 0xffffff : 0x551144);
  };
  r.fx = (t) => { bulb.color.setHex(pulse(t, 5) > 0.7 ? 0xffffff : 0x551144); };
  return r;
}

/* ================= VOLT: slim aero courier, thruster pack and light mohawk ================= */
function volt() {
  const r = mkRig(), C = 0x2ff0ff, W = 0xcff8ff;
  r.trail = [[0.2, 0.9, 1], [0.7, 0.6, 1]]; r.glow = 0x2ff0ff;
  r.board = mkBoard({ deck: 0x0b1224, stripe: C, edge: W, tip: C });
  for (const z of [-0.42, 0.42]) {
    add(r.board, B(0.34, 0.2, 0.52), lam(0x0a1226), 0, 0.15, z);
    add(r.board, B(0.36, 0.05, 0.54), bas(C), 0, 0.06, z);
    add(r.board, B(0.26, 0.82, 0.28), lam(0x0c1830), 0, 0.66, z);
    add(r.board, B(0.03, 0.82, 0.05), bas(C), 0.14, 0.66, z + 0.09);
    add(r.board, B(0.03, 0.82, 0.05), bas(C), -0.14, 0.66, z - 0.09);
    add(r.board, B(0.3, 0.3, 0.32), glo(C, 0.45), 0, 0.5, z);               // shin boosters
    add(r.board, B(0.28, 0.12, 0.3), lam(0x16284a), 0, 0.34, z);
    add(r.board, B(0.3, 0.1, 0.34), lam(0x16284a), 0, 0.98, z);
  }
  const b = r.body;
  add(b, B(0.42, 0.18, 0.56), lam(0x0c1830), 0, 1.1, 0);
  add(b, B(0.42, 0.7, 0.66), lam(0x0f1d3a), 0, 1.55, 0);
  add(b, B(0.44, 0.07, 0.68), bas(C), 0, 1.86, 0);
  add(b, B(0.44, 0.06, 0.6), bas(C), 0, 1.22, 0);
  add(b, B(0.03, 0.6, 0.08), bas(C), -0.225, 1.55, 0.18, 0, 0, 0.0);       // lightning stripe down the chest
  add(b, B(0.03, 0.3, 0.08), bas(W), -0.225, 1.66, -0.04, 0.5, 0, 0);
  add(b, B(0.03, 0.3, 0.08), bas(W), -0.225, 1.42, 0.06, -0.5, 0, 0);
  add(b, B(0.4, 0.12, 0.5), lam(0x16284a), 0, 1.98, 0);
  const pack = add(b, B(0.3, 0.52, 0.54), lam(0x0a1226), 0.36, 1.58, 0);   // thruster pack
  add(pack, B(0.32, 0.05, 0.56), bas(C), 0, 0.2, 0);
  const vents = [];
  for (const z of [-0.15, 0.15]) {
    add(pack, CYL(0.09, 0.14, 8), lam(0x16284a), 0.19, -0.1, z, 0, 0, PI / 2);
    const v = own(W, 0.9); add(pack, CYL(0.06, 0.05, 8), v, 0.27, -0.1, z, 0, 0, PI / 2);
    const cone = own(C, 0.35); add(pack, new THREE.ConeGeometry(0.08, 0.45, 6), cone, 0.5, -0.1, z, 0, 0, -PI / 2); vents.push(v, cone);
  }
  let gaunt = null;
  const mk = (z, far) => mkArm(r, z, (g) => {
    add(g, B(0.17, 0.64, 0.17), lam(0x0f1d3a), 0, -0.32, 0);
    add(g, B(0.19, 0.64, 0.03), bas(C), 0, -0.32, 0.1);
    add(g, B(0.2, 0.16, 0.2), lam(0x0a1226), 0, -0.7, 0);
    if (far) {                                                              // wrist gauntlet with a flashing screen
      add(g, B(0.26, 0.2, 0.26), lam(0x16284a), 0, -0.5, 0);
      gaunt = own(C); add(g, B(0.04, 0.12, 0.16), gaunt, -0.14, -0.5, 0);
    }
  });
  r.armNear = mk(0.5, false); r.armFar = mk(-0.5, true);
  const h = r.head;
  const hm = add(h, new THREE.SphereGeometry(0.28, 7, 5), lam(0x0c1830), 0, 0.02, 0); hm.scale.set(1.15, 1, 0.95);
  add(h, B(0.08, 0.13, 0.42), bas(C), -0.25, 0, 0);                         // wrap visor
  add(h, B(0.06, 0.06, 0.3), bas(W), -0.29, 0, 0);
  add(h, B(0.2, 0.06, 0.34), lam(0x16284a), 0.12, -0.08, 0);
  const fin = [];
  for (let i = 0; i < 5; i++) {                                              // tall light mohawk
    const f = add(h, B(0.14, 0.14 + 0.07 * (2 - Math.abs(i - 2)), 0.06), bas(i % 2 ? C : W), 0.18 - i * 0.12, 0.34 + 0.06 * (2 - Math.abs(i - 2)), 0);
    fin.push(f);
  }
  for (const z of [-0.29, 0.29]) add(h, CYL(0.1, 0.08, 6), bas(C), 0, -0.02, z, PI / 2, 0, 0);
  mkTail(r, 4, 0.22, (sg, i) => add(sg, B(0.26, 0.05, 0.05 + 0.02 * (3 - i)), bas(i % 2 ? W : C), 0.12, 0, 0));
  finish(r);
  const fxv = (t) => { vents.forEach((v, i) => { if (i % 2) v.opacity = 0.2 + 0.25 * pulse(t, 14, i); else v.opacity = 0.6 + 0.35 * pulse(t, 9, i); }); };
  r.fx = fxv;
  r.idle = (t) => {
    const sway = sin(t * 1.9);                                              // sprinter weight shift
    stand(r, t, 0.035 * Math.abs(sway) - 0.02, 0.08 * sway);
    r.body.rotation.z = 0.05 * sway;
    r.head.rotation.y = r.headY + 0.12 * sin(t * 1.1);
    const k = (t % 4) / 4, tap = k > 0.55 && k < 0.85 ? sin((k - 0.55) / 0.3 * PI) : 0;
    r.armFar.rotation.set(0.1 - 0.55 * tap, 0, -1.75 * tap + 0.05 * sin(t * 1.9));
    r.armNear.rotation.set(-0.15 + 0.12 * sway, 0, 0.1 * sway);
    gaunt.color.setHex(tap > 0.1 && Math.floor(t * 10) % 2 ? 0xffffff : pulse(t, 6) > 0.5 ? 0x2ff0ff : 0x0e6670);
    fin.forEach((f, i) => { f.scale.y = 1 + 0.18 * sin(t * 6 + i); });
    fxv(t);
  };
  return r;
}

/* ================= HEX: glitchy hacker, juggling holo cubes ================= */
function hex() {
  const r = mkRig(), V = 0x8a2bff, M = 0xff2fb8, G = 0x39ff88, C = 0x2ff0ff;
  r.trail = [[0.7, 0.2, 1], [0.2, 1, 0.5]]; r.glow = 0x8a2bff;
  r.board = mkBoard({ deck: 0x120a25, stripe: G, edge: V, tip: M });
  for (const z of [-0.42, 0.42]) {
    add(r.board, B(0.36, 0.2, 0.5), lam(0x0e0a24), 0, 0.15, z);
    add(r.board, B(0.38, 0.05, 0.52), bas(z < 0 ? G : M), 0, 0.06, z);
    add(r.board, B(0.3, 0.78, 0.32), lam(z < 0 ? 0x1c0b40 : 0x240a3a), 0, 0.64, z);
    add(r.board, B(0.03, 0.78, 0.06), bas(z < 0 ? G : M), 0.16, 0.64, z + 0.1);
    add(r.board, B(0.03, 0.3, 0.06), bas(V), -0.16, 0.45, z - 0.1);
    add(r.board, B(0.03, 0.2, 0.06), bas(C), -0.16, 0.85, z + 0.1);
  }
  const b = r.body;
  add(b, B(0.5, 0.2, 0.6), lam(0x1c0b40), 0, 1.1, 0);
  const slices = [];
  [[1.34, 0x1a0b3a, G], [1.58, 0x240d4e, M], [1.82, 0x1a0b3a, C]].forEach(([y, c, line]) => {   // torso in three slices that glitch sideways
    const s = new THREE.Group(); s.position.y = y; b.add(s); slices.push(s);
    add(s, B(0.5, 0.24, 0.78), lam(c), 0, 0, 0);
    add(s, B(0.52, 0.025, 0.8), bas(line), 0, 0.125, 0);
    add(s, B(0.03, 0.06, 0.5), bas(line), -0.265, 0, 0);
  });
  const aura = own(V, 0.16); add(b, B(0.6, 0.95, 0.92), aura, 0, 1.58, 0);
  add(b, B(0.46, 0.2, 0.6), lam(0x2a1466), 0, 2.0, 0);
  add(b, B(0.03, 0.2, 0.2), bas(G), -0.265, 1.62, 0.08); add(b, B(0.03, 0.2, 0.06), bas(G), -0.265, 1.62, -0.12);
  const mk = (z, c) => mkArm(r, z, (g) => {
    add(g, B(0.2, 0.62, 0.2), lam(0x1c0b40), 0, -0.31, 0);
    add(g, B(0.22, 0.05, 0.22), bas(c), 0, -0.2, 0); add(g, B(0.22, 0.05, 0.22), bas(c), 0, -0.45, 0);
    add(g, B(0.22, 0.16, 0.22), lam(0x0e0a24), 0, -0.68, 0);
    for (const dz of [-0.07, 0, 0.07]) add(g, B(0.04, 0.1, 0.03), bas(c), 0, -0.8, dz);   // glowing fingertips
  });
  r.armNear = mk(0.5, G); r.armFar = mk(-0.5, M);
  const h = r.head;
  add(h, new THREE.SphereGeometry(0.27, 7, 5), lam(0x1a1040), 0, 0, 0);
  const cowl = add(h, new THREE.SphereGeometry(0.31, 7, 5), lam(0x2a1466), 0.03, 0.06, 0); cowl.scale.y = 0.85;
  const mono = own(C, 0.9); add(h, B(0.05, 0.2, 0.2), mono, -0.27, 0, -0.04);   // holo monocle
  add(h, B(0.05, 0.03, 0.34), bas(M), -0.27, 0.1, 0);
  add(h, B(0.06, 0.03, 0.14), bas(G), -0.27, -0.12, 0.06);
  for (const z of [-0.34, 0.34]) {                                                // oversized headphones
    add(h, CYL(0.23, 0.15, 10), bas(M), 0, -0.02, z, PI / 2, 0, 0);
    add(h, CYL(0.15, 0.17, 10), bas(G), 0, -0.02, z, PI / 2, 0, 0);
    add(h, CYL(0.07, 0.19, 8), bas(0x120a25), 0, -0.02, z, PI / 2, 0, 0);
  }
  add(h, B(0.06, 0.06, 0.74), bas(M), 0, 0.34, 0);
  add(h, B(0.06, 0.26, 0.06), bas(M), 0, 0.2, -0.34); add(h, B(0.06, 0.26, 0.06), bas(M), 0, 0.2, 0.34);
  mkTail(r, 4, 0.24, (sg, i) => add(sg, B(0.3, 0.025, 0.2 - 0.02 * i), bas(i % 2 ? M : G), 0.14, 0, 0));
  const cubes = [], halos = [];
  const cm = [G, M, C, V, G, M];
  for (let i = 0; i < 6; i++) {                                                   // floating holo cubes
    const g = new THREE.Group(); b.add(g);
    add(g, B(0.15, 0.15, 0.15), bas(cm[i]), 0, 0, 0);
    add(g, B(0.26, 0.26, 0.26), glo(cm[i], 0.3), 0, 0, 0);
    cubes.push(g);
  }
  finish(r);
  let gl = 0, glT = 1.5;
  const glitch = (t, dt) => {
    glT -= dt; if (glT < 0) { gl = 0.14; glT = 1.4 + Math.random() * 1.8; }
    if (gl > 0) {
      gl -= dt; slices.forEach((s, i) => { s.position.x = (Math.random() - 0.5) * 0.28 * (i % 2 ? 1 : -1); });
      aura.opacity = 0.5; b.position.x = (Math.random() - 0.5) * 0.1;
    } else { slices.forEach((s) => { s.position.x = 0; }); aura.opacity = 0.12 + 0.07 * pulse(t, 7); b.position.x = 0; }
    mono.opacity = 0.65 + 0.3 * pulse(t, 11);
  };
  r.fx = (t, dt) => {                                                             // in a run: cubes orbit the rider
    for (let i = 0; i < 6; i++) {
      const a = t * 1.6 + i * (PI / 3), rad = 0.95 + 0.08 * (i % 2);
      cubes[i].position.set(Math.cos(a) * rad * 0.7, 1.6 + 0.5 * sin(t * 2 + i * 1.3), Math.sin(a) * rad);
      cubes[i].rotation.set(t * 2 + i, t * 1.4, 0);
    }
    glitch(t, dt || 0.016);
  };
  r.idle = (t, dt) => {
    stand(r, t, 0.07 + 0.06 * sin(t * 2.3), 0.04 * sin(t * 1.2));                // floats and bobs to the beat
    r.head.rotation.y = r.headY + 0.1 * sin(t * 1.5);
    r.head.rotation.z = 0.08 * sin(t * 1.5 * 2);
    r.body.position.y += 0.0;
    for (let i = 0; i < 2; i++) {                                                 // juggling: two cubes tossed hand to hand
      const p = (t * 0.85 + i * 0.5) % 1, dir = i ? -1 : 1;
      const z = (0.5 - p) * 1.1 * dir;
      cubes[i].position.set(-0.45, 1.25 + 1.15 * sin(p * PI), z);
      cubes[i].rotation.set(t * 3, t * 2, i);
    }
    for (let i = 2; i < 6; i++) {                                                 // the rest drift around the head
      const a = t * (0.9 + 0.2 * (i % 2)) + i * 1.6;
      cubes[i].position.set(Math.cos(a) * 0.62, 2.65 + 0.12 * sin(t * 2 + i) - (i - 2) * 0.06, Math.sin(a) * 0.62);
      cubes[i].rotation.set(t * 1.5 + i, t, 0);
    }
    const p0 = (t * 0.85) % 1;                                                    // hands follow the toss
    r.armNear.rotation.set(0.1 + 0.9 * (p0 > 0.5 ? 1 - (p0 - 0.5) * 2 : 0) * 0, 0, -0.9 - 0.25 * sin(t * 1.7 * PI));
    r.armFar.rotation.set(-0.1, 0, -0.9 - 0.25 * sin(t * 1.7 * PI + 1.5));
    glitch(t, dt || 0.016);
  };
  return r;
}

/* ================= CHROME: heavy cyborg grinder with a steaming back ================= */
function chrome() {
  const r = mkRig(), GD = 0xffc23f, OR = 0xff7a1a;
  r.trail = [[1, 0.8, 0.2], [1, 0.3, 0.1]]; r.glow = 0xffa020;
  r.board = mkBoard({ deck: 0x1a1a22, stripe: GD, edge: OR, tip: GD });
  for (const z of [-0.42, 0.42]) {
    add(r.board, B(0.46, 0.26, 0.58), chr(0x2a2d3c), 0, 0.18, z);
    add(r.board, B(0.48, 0.06, 0.6), bas(GD), 0, 0.06, z);
    add(r.board, B(0.4, 0.8, 0.42), lam(0x1c1c28), 0, 0.68, z);
    add(r.board, B(0.3, 0.5, 0.05), chr(0x4a4f66), 0, 0.58, z + (z < 0 ? -0.22 : 0.22));      // shin plates
    add(r.board, B(0.04, 0.8, 0.07), bas(GD), 0.21, 0.68, z);
    add(r.board, B(0.46, 0.22, 0.46), chr(0x4a4f66), 0, 0.96, z);          // heavy knee plates
    add(r.board, B(0.48, 0.04, 0.48), bas(OR), 0, 1.07, z);
  }
  const b = r.body;
  add(b, B(0.62, 0.22, 0.86), lam(0x15151d), 0, 1.1, 0);
  add(b, B(0.7, 0.5, 0.98), lam(0x15151d), 0, 0.92, 0);                    // long coat skirt
  add(b, B(0.04, 0.06, 0.98), bas(GD), -0.36, 0.72, 0); add(b, B(0.04, 0.5, 0.06), bas(OR), -0.36, 0.92, 0.3); add(b, B(0.04, 0.5, 0.06), bas(OR), -0.36, 0.92, -0.3);
  add(b, B(0.62, 0.8, 0.94), lam(0x23232f), 0, 1.6, 0);
  add(b, B(0.08, 0.5, 0.7), chr(0x4a4f66), -0.34, 1.62, 0);               // chest plate
  add(b, B(0.1, 0.08, 0.5), bas(GD), -0.36, 1.78, 0); add(b, B(0.1, 0.08, 0.3), bas(OR), -0.36, 1.46, 0);
  add(b, B(0.64, 0.07, 0.96), bas(GD), 0, 1.22, 0);
  add(b, B(0.5, 0.18, 0.62), lam(0x2a2a38), 0, 2.04, 0);
  for (const z of [-0.64, 0.64]) {                                          // pauldrons
    add(b, B(0.46, 0.22, 0.4), chr(0x4a4f66), 0, 2.0, z);
    add(b, B(0.48, 0.05, 0.42), bas(GD), 0, 2.12, z);
  }
  const pipes = [];
  for (const z of [-0.26, 0.26]) {                                          // exhaust pipes on the back
    add(b, CYL(0.11, 0.8, 8), chr(0x4a4f66), 0.5, 1.75, z);
    add(b, CYL(0.13, 0.08, 8), bas(GD), 0.5, 1.4, z);
    const tip = own(OR); add(b, CYL(0.08, 0.04, 8), tip, 0.5, 2.16, z); pipes.push({ z, tip });
  }
  add(b, B(0.2, 0.6, 0.7), lam(0x15151d), 0.42, 1.55, 0);
  const puffs = [];
  const pm = own(0xe8e0ff, 0.5);
  for (let i = 0; i < 8; i++) { const p = add(b, B(0.2, 0.2, 0.2), pm, 0.5, 2.2, i % 2 ? 0.26 : -0.26); p.visible = false; puffs.push({ m: p, a: i / 8 }); }
  r.armNear = mkArm(r, 0.62, (g) => {                                       // the chrome arm: thick, jointed, huge fist
    add(g, B(0.32, 0.38, 0.32), chr(0x4a4f66), 0, -0.2, 0);
    add(g, B(0.36, 0.06, 0.36), bas(GD), 0, -0.42, 0);
    add(g, B(0.28, 0.38, 0.28), chr(0x6a7090), 0, -0.64, 0);
    add(g, B(0.34, 0.28, 0.34), chr(0x4a4f66), 0, -0.9, 0);
    add(g, B(0.36, 0.05, 0.36), bas(OR), 0, -0.78, 0);
  });
  r.armFar = mkArm(r, -0.62, (g) => {
    add(g, B(0.24, 0.62, 0.24), lam(0x23232f), 0, -0.31, 0);
    add(g, B(0.26, 0.06, 0.26), bas(GD), 0, -0.52, 0);
    add(g, B(0.26, 0.2, 0.26), lam(0x0e0e14), 0, -0.72, 0);
  });
  const h = r.head;
  add(h, new THREE.SphereGeometry(0.28, 7, 5), lam(0x2a2a38), 0, 0, 0);
  const hel = add(h, new THREE.SphereGeometry(0.32, 7, 5), chr(0x4a4f66), 0.02, 0.08, 0); hel.scale.y = 0.8;
  add(h, B(0.07, 0.2, 0.42), chr(0x6a7090), -0.26, -0.03, 0);               // face plate
  add(h, B(0.04, 0.04, 0.36), bas(GD), -0.3, 0.1, 0);
  const eye = own(GD); const eyeBox = add(h, B(0.04, 0.07, 0.1), eye, -0.3, -0.02, 0);
  const eyeHalo = own(OR, 0.4); const halo = add(h, B(0.05, 0.14, 0.2), eyeHalo, -0.31, -0.02, 0);
  add(h, B(0.05, 0.14, 0.34), lam(0x15151d), -0.29, -0.14, 0);              // mouth grille
  for (const z of [-0.3, 0.3]) add(h, B(0.14, 0.24, 0.14), chr(0x4a4f66), 0.04, -0.04, z);
  mkTail(r, 3, 0.24, (sg, i) => { add(sg, B(0.26, 0.1, 0.1), bas(i % 2 ? OR : GD), 0.12, 0, -0.09); add(sg, B(0.26, 0.1, 0.1), bas(i % 2 ? GD : OR), 0.12, 0, 0.09); });
  finish(r);
  const steam = (t) => {
    pipes.forEach((p) => p.tip.color.setHex(pulse(t, 4, p.z * 9) > 0.5 ? 0xffa020 : 0xff5a10));
    puffs.forEach((p, i) => {
      const u = (t * 0.55 + p.a) % 1;                                      // rises, grows, shrinks away
      const zc = i % 2 ? 0.26 : -0.26;
      p.m.visible = true;
      p.m.position.set(0.5 + 0.35 * u + 0.05 * sin(t * 3 + i), 2.2 + 1.0 * u, zc + 0.1 * sin(t * 2 + i * 2));
      p.m.scale.setScalar(Math.max(0.01, sin(u * PI) * (0.5 + 1.1 * u)));
      p.m.rotation.set(t + i, t * 0.7, 0);
    });
  };
  r.fx = (t) => { steam(t); eye.color.setHex(0xffc23f); };
  r.idle = (t) => {
    const br = sin(t * 1.6);                                                // slow heavy breathing
    stand(r, t, 0.025 * br, 0.03 * sin(t * 0.7));
    r.body.scale.x = 1 + 0.015 * br;
    const sc = sin(t * 0.9);                                                // gold eye scans left and right
    eyeBox.position.z = 0.12 * sc; halo.position.z = 0.12 * sc;
    r.head.rotation.y = r.headY + 0.2 * sin(t * 0.9 - 0.4);
    const k = (t % 6) / 6, fl = k > 0.55 && k < 0.8 ? sin((k - 0.55) / 0.25 * PI) : 0;   // now and then he flexes the chrome arm
    r.armNear.rotation.set(0.3 * fl, 0, -1.0 * fl - 0.08 + 0.02 * br);
    r.armFar.rotation.set(0.12, 0, 0.04 * br);
    steam(t);
  };
  return r;
}

/* ---- roster and stats (1 to 5) ---- */
ND.STAT_KEYS = [['speed', 'SPEED'], ['carve', 'CARVE'], ['pop', 'POP'], ['spin', 'SPIN'], ['combo', 'COMBO'], ['landing', 'LANDING'], ['grind', 'GRIND']];
ND.RIDERS = [
  { id: 'nova', name: 'NOVA', role: 'ALL-ROUNDER', blurb: 'Balanced in everything. The place to learn the hill.', weak: 'No standout strength', build: nova, color: '#ff3fd0',
    stats: { speed: 3, carve: 3, pop: 3, spin: 3, combo: 3, landing: 3, grind: 3 } },
  { id: 'volt', name: 'VOLT', role: 'SPEED COURIER', blurb: 'Fastest down the hill. Wide turns and a short combo window.', weak: 'Hard to steer, risky landings', build: volt, color: '#2ff0ff',
    stats: { speed: 5, carve: 2, pop: 3, spin: 2, combo: 2, landing: 2, grind: 3 } },
  { id: 'hex', name: 'HEX', role: 'TRICK HACKER', blurb: 'Huge combos: fast spins, high pops and a long combo window.', weak: 'Weak on rails', build: hex, color: '#39ff88',
    stats: { speed: 3, carve: 4, pop: 4, spin: 5, combo: 5, landing: 3, grind: 2 } },
  { id: 'chrome', name: 'CHROME', role: 'HEAVY GRINDER', blurb: 'Rails pay big and landings forgive. Low jumps, slow spins.', weak: 'Low pop, slow spins', build: chrome, color: '#ffc23f',
    stats: { speed: 3, carve: 3, pop: 2, spin: 2, combo: 3, landing: 5, grind: 5 } }
];
/* multipliers read by the player physics: a stat of 3 is the baseline */
ND.riderK = (st) => {
  const d = (k) => st[k] - 3;
  const top = 1 + 0.06 * d('speed');
  return {
    drag: 1 / (top * top), gravity: 1 + 0.05 * d('speed'),
    turn: 1 + 0.12 * d('carve'), wall: Math.max(0.3, 1 - 0.15 * d('carve')),
    charge: 1 - 0.12 * d('pop'), jump: 1 + 0.07 * d('pop'),
    spin: 1 + 0.12 * d('spin'), trick: 1 + 0.1 * d('spin'),
    chain: 1 + 0.15 * d('combo'),
    land: 1 + 0.12 * d('landing'),
    grindPts: 1 + 0.12 * d('grind'), grindKick: 1 + 0.08 * d('grind')
  };
};
ND.buildRider = (id) => { const def = ND.RIDERS.find((x) => x.id === id) || ND.RIDERS[0]; const rg = def.build(); rg.def = def; return rg; };
