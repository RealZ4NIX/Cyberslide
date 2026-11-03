// @ts-nocheck -- ported as-is from index.html; typed step by step

/* CYBERSLIDE - rider select: four riders stand on a neon ring in the menu; the ring spins so the chosen one is in front */

import * as THREE from 'three';
import { ND } from './nd';

const R = 3.0, PI = Math.PI, TAU = PI * 2;
let scene2, cam2, root, ring, riders = [], pads = [], ang = 0, tgt = 0, vel = 0, idx = 0, t = 0, visible = false;

/* the ring has its own little scene and camera, drawn over the game world, so it never clips into the hill */
function init() {
  scene2 = new THREE.Scene();
  scene2.add(new THREE.AmbientLight(0x9a86d8, 0.85));
  const key = new THREE.DirectionalLight(0xffa0e0, 1.0); key.position.set(-6, 10, 12); scene2.add(key);
  const back = new THREE.DirectionalLight(0x2ff0ff, 0.65); back.position.set(8, 4, -10); scene2.add(back);
  cam2 = new THREE.PerspectiveCamera(30, 16 / 9, 1, 100);
  cam2.position.set(0, 5.8, 18); cam2.lookAt(0.2, -1.75, 0);
  root = new THREE.Group();
  root.position.set(3.7, 0, 0);               // right of centre: the menu panel takes the left side
  scene2.add(root);
  // platform: dark disc, neon rims
  const plat = new THREE.Group(); root.add(plat);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.75, R + 0.9, 0.22, 56), new THREE.MeshPhongMaterial({ color: 0x120a30, flatShading: true, shininess: 30, specular: 0x6a4cff }));
  disc.position.y = -0.14; plat.add(disc);
  const rim = (r0, r1, c, o, y) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 64), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -PI / 2; m.position.y = y; plat.add(m); return m;
  };
  rim(R + 0.63, R + 0.77, 0xff2fb8, 0.95, 0.0);
  rim(R + 0.36, R + 0.42, 0x2ff0ff, 0.8, 0.0);
  rim(R - 0.9, R - 0.85, 0x8a2bff, 0.6, 0.0);
  const under = rim(0.0, R + 1.5, 0xff2fb8, 0.12, -0.3);
  under.geometry.dispose(); under.geometry = new THREE.RingGeometry(R + 0.85, R + 1.5, 56);
  // the ring that carries the riders and spins
  ring = new THREE.Group(); root.add(ring);
  ND.RIDERS.forEach((def, i) => {
    const rg = ND.buildRider(def.id);
    rg.baseY = 0.2; rg.headY = 0.02;                              // turn the torso and head toward the viewer
    const g = new THREE.Group();
    const fg = new THREE.Group(); fg.add(rg.board); g.add(fg, rg.body);
    g.scale.setScalar(0.9);
    const pad = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.18, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(def.color), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    pad.rotation.x = -PI / 2; pad.position.y = 0.02;
    const padFill = new THREE.Mesh(new THREE.CircleGeometry(1.0, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(def.color), transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    padFill.rotation.x = -PI / 2; padFill.position.y = 0.015;
    const slot = new THREE.Group(); slot.add(g, pad, padFill); ring.add(slot);
    riders.push({ rg, g, slot, pad, padFill, def });
    pads.push(pad);
  });
  place();
}
function place() {
  riders.forEach((r, i) => {
    const a = i * PI / 2 - ang;
    r.slot.position.set(Math.sin(a) * R, 0, Math.cos(a) * R);
    r.g.rotation.y = PI / 2 - 0.55 - 0.18 * Math.sin(a);       // faces the camera at three quarters, a little toward the middle
    const f = 0.5 + 0.5 * Math.cos(a);                           // 1 at the front, 0 at the back
    r.pad.material.opacity = 0.18 + 0.7 * f * f;
    r.padFill.material.opacity = 0.04 + 0.22 * f * f;
  });
}
function update(dt) {
  if (!root) return;
  if (!visible) return;
  t += dt;
  // critically damped spring toward the target angle: the ring spins a quarter turn and settles
  const k = 160, c = 2 * Math.sqrt(k);
  vel += (k * (tgt - ang) - c * vel) * dt; ang += vel * dt;
  place();
  riders.forEach((r) => r.rg.idle && r.rg.idle(t + r.def.name.length, dt));
}
function render(renderer) {
  if (!root || !visible) return;
  renderer.autoClear = false; renderer.clearDepth(); renderer.render(scene2, cam2); renderer.autoClear = true;
}
ND.select = {
  init,
  update,
  render,
  resize(aspect) { if (cam2) { cam2.aspect = aspect; cam2.updateProjectionMatrix(); } },
  get index() { return idx; },
  setVisible(v) { visible = v; },
  set(i, snap) { idx = ((i % 4) + 4) % 4; if (snap) { ang = tgt = Math.round(tgt / TAU) * TAU + idx * PI / 2; vel = 0; } },
  step(d) {                                                       // d = +1: the next rider comes in from the right
    const prev = idx; idx = (((idx + d) % 4) + 4) % 4;
    tgt += d * PI / 2;
    return prev !== idx;
  },
  snapTo() { ang = tgt; vel = 0; }
};
