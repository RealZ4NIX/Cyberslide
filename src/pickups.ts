/* CYBERSLIDE - pickups: draws the power-ups from powerups.ts as spinning holograms and finds when the rider touches
   one. Track ones are small and sit low over the snow with a ring on the ground. Sky ones are bigger, carry a second
   ring and a light beam down to the snow so they read from far away. Each power has its own colour and icon. */

import * as THREE from 'three';
import { ND } from './nd';
import { SEG, H } from './course';
import { POWER, POWER_KINDS, pickupKind, pickupsAt, touches } from './powerups';
import type { Pickup, PowerKind } from './powerups';

type Draw = (g: CanvasRenderingContext2D) => void;

/* ---------- icons (drawn on a 128 px canvas, centre 64/64, one unit = 1.6 px of the 64-unit sketch) ---------- */
const U = 1.6;
function path(g: CanvasRenderingContext2D, pts: number[][], close = true): void {
  g.beginPath();
  pts.forEach(([x, y], i) =>
    i ? g.lineTo(64 + x * U, 64 + y * U) : g.moveTo(64 + x * U, 64 + y * U),
  );
  if (close) g.closePath();
}
function circle(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.beginPath();
  g.arc(64 + x * U, 64 + y * U, r * U, 0, Math.PI * 2);
}
function rrect(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const X = 64 + x * U,
    Y = 64 + y * U,
    W = w * U,
    Hh = h * U,
    R = r * U;
  g.beginPath();
  g.moveTo(X + R, Y);
  g.arcTo(X + W, Y, X + W, Y + Hh, R);
  g.arcTo(X + W, Y + Hh, X, Y + Hh, R);
  g.arcTo(X, Y + Hh, X, Y, R);
  g.arcTo(X, Y, X + W, Y, R);
  g.closePath();
}
function label(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
): void {
  g.font = 'italic 900 ' + size * U + "px 'Russo One', 'Arial Black', Impact, sans-serif";
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 64 + x * U, 64 + y * U);
}

const ICON: Record<PowerKind, (sky: boolean) => Draw> = {
  // bolt in a ring
  over: () => (g) => {
    g.globalAlpha = 0.45;
    circle(g, 0, 0, 33);
    g.stroke();
    g.globalAlpha = 1;
    path(g, [
      [6, -28],
      [-14, 4],
      [0, 4],
      [-6, 28],
      [16, -6],
      [2, -6],
    ]);
    g.fill();
    g.stroke();
  },
  // microchip with pins and x2
  x2: () => (g) => {
    rrect(g, -22, -22, 44, 44, 4);
    g.fill();
    g.stroke();
    g.beginPath();
    for (const v of [-12, 0, 12]) {
      for (const [ax, ay, bx, by] of [
        [v, -22, v, -31],
        [v, 22, v, 31],
        [-22, v, -31, v],
        [22, v, 31, v],
      ]) {
        g.moveTo(64 + ax * U, 64 + ay * U);
        g.lineTo(64 + bx * U, 64 + by * U);
      }
    }
    g.stroke();
    g.fillStyle = '#ffffff';
    label(g, 'x2', 0, 1, 21);
  },
  // shield with a chain link
  shield: () => (g) => {
    g.beginPath();
    g.moveTo(64, 64 - 30 * U);
    g.lineTo(64 + 24 * U, 64 - 20 * U);
    g.lineTo(64 + 24 * U, 64 + 2 * U);
    g.bezierCurveTo(64 + 24 * U, 64 + 18 * U, 64 + 12 * U, 64 + 26 * U, 64, 64 + 32 * U);
    g.bezierCurveTo(64 - 12 * U, 64 + 26 * U, 64 - 24 * U, 64 + 18 * U, 64 - 24 * U, 64 + 2 * U);
    g.lineTo(64 - 24 * U, 64 - 20 * U);
    g.closePath();
    g.fill();
    g.stroke();
    g.strokeStyle = '#ffffff';
    rrect(g, -13, -7, 15, 14, 7);
    g.stroke();
    rrect(g, -2, -7, 15, 14, 7);
    g.stroke();
  },
  // planet with an orbit ring
  grav: () => (g) => {
    circle(g, 0, 0, 16);
    g.fill();
    g.stroke();
    g.save();
    g.translate(64, 64);
    g.rotate(-0.35);
    g.beginPath();
    g.ellipse(0, 0, 33 * U, 9 * U, 0, 0, Math.PI * 2);
    g.stroke();
    g.restore();
    g.fillStyle = '#ffffff';
    circle(g, -24, -24, 2.5);
    g.fill();
    circle(g, 26, 22, 2.5);
    g.fill();
  },
  // stopwatch with the seconds it adds
  time: (sky) => (g) => {
    circle(g, -4, 6, 24);
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(64 - 9 * U, 64 - 26 * U);
    g.lineTo(64 + 1 * U, 64 - 26 * U);
    g.moveTo(64 - 4 * U, 64 - 26 * U);
    g.lineTo(64 - 4 * U, 64 - 18 * U);
    g.moveTo(64 - 4 * U, 64 + 6 * U);
    g.lineTo(64 - 4 * U, 64 - 8 * U);
    g.moveTo(64 - 4 * U, 64 + 6 * U);
    g.lineTo(64 + 5 * U, 64 + 12 * U);
    g.stroke();
    g.fillStyle = '#07041a';
    circle(g, 21, -21, 13);
    g.fill();
    g.stroke();
    g.fillStyle = '#ffffff';
    label(g, sky ? '+10' : '+5', 21, -20.5, sky ? 10 : 13);
  },
};

const canvases = new Map<string, HTMLCanvasElement>();
function iconCanvas(kind: PowerKind, sky: boolean): HTMLCanvasElement {
  const key = kind + (sky ? ':sky' : '');
  let c = canvases.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const col = POWER[kind].css;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  // dark glass disc behind the icon: the colours have to read against bright snow as well as the night sky
  const bg = g.createRadialGradient(64, 64, 20, 64, 64, 62);
  bg.addColorStop(0, 'rgba(7,4,26,0.78)');
  bg.addColorStop(0.72, 'rgba(7,4,26,0.62)');
  bg.addColorStop(1, 'rgba(7,4,26,0)');
  g.fillStyle = bg;
  g.fillRect(0, 0, 128, 128);
  // glow pass, the coloured tube, then a thin white-hot core like a neon sign
  for (const pass of [0, 1, 2]) {
    g.save();
    g.strokeStyle = pass === 2 ? '#ffffff' : col;
    g.fillStyle = pass === 1 ? col + '66' : 'rgba(0,0,0,0)';
    g.lineWidth = [13, 7, 2.2][pass];
    g.globalAlpha = [0.4, 1, 0.85][pass];
    g.shadowColor = col;
    g.shadowBlur = [18, 8, 0][pass];
    ICON[kind](sky)(g);
    g.restore();
  }
  // hologram scanlines
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = 'rgba(0,0,0,0.3)';
  for (let y = 0; y < 128; y += 4) g.fillRect(0, y, 128, 1.2);
  canvases.set(key, c);
  return c;
}
/** the icon as an image URL, for the HUD */
export function iconURL(kind: PowerKind, sky = false): string {
  const c = iconCanvas(kind, sky) as HTMLCanvasElement & { toDataURL?: () => string };
  return typeof c.toDataURL === 'function' ? c.toDataURL() || '' : '';
}

/* ---------- shared pieces ---------- */
const add = (o: THREE.MeshBasicMaterialParameters): THREE.MeshBasicMaterial =>
  new THREE.MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    ...o,
  });
const glowTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,0.8)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const geo = {
  plane: new THREE.PlaneGeometry(1, 1),
  hex: new THREE.RingGeometry(0.9, 1, 6),
  ring: new THREE.RingGeometry(0.92, 1, 32),
  beam: new THREE.CylinderGeometry(0.12, 0.6, 1, 10, 1, true),
};
interface KindMats {
  icon: THREE.MeshBasicMaterial;
  iconSky: THREE.MeshBasicMaterial;
  line: THREE.MeshBasicMaterial;
  glow: THREE.MeshBasicMaterial;
  beam: THREE.MeshBasicMaterial;
}
const mats = new Map<PowerKind, KindMats>();
function kindMats(kind: PowerKind): KindMats {
  let m = mats.get(kind);
  if (m) return m;
  const color = POWER[kind].color;
  const tex = (sky: boolean) => {
    const t = new THREE.CanvasTexture(iconCanvas(kind, sky));
    t.anisotropy = 2;
    return t;
  };
  m = {
    icon: add({ map: tex(false), fog: false }),
    iconSky: add({ map: tex(true), fog: false }),
    line: add({ color, opacity: 0.95, fog: false }),
    glow: add({ map: glowTex, color, opacity: 0.4, blending: THREE.AdditiveBlending }),
    beam: add({ color, opacity: 0.3, fog: false }),
  };
  mats.set(kind, m);
  return m;
}

/* ---------- one pickup ---------- */
interface Item {
  p: Pickup;
  kind: PowerKind;
  grp: THREE.Group;
  icon: THREE.Mesh;
  hex: THREE.Mesh;
  hex2: THREE.Mesh | null;
  /** seconds since it was taken (0 = still there) */
  pop: number;
  phase: number;
}
function build(p: Pickup, kind: PowerKind): Item {
  const m = kindMats(kind),
    sz = p.sky ? 3.2 : 2.1;
  const grp = new THREE.Group();
  grp.position.set(p.x, p.y, -p.s);
  const glow = new THREE.Mesh(geo.plane, m.glow);
  glow.scale.setScalar(sz * 2.3);
  glow.renderOrder = 3;
  const icon = new THREE.Mesh(geo.plane, p.sky ? m.iconSky : m.icon);
  icon.scale.setScalar(sz * 1.15);
  icon.renderOrder = 4;
  const hex = new THREE.Mesh(geo.hex, m.line);
  hex.scale.setScalar(sz * 0.72);
  grp.add(glow, icon, hex);
  let hex2: THREE.Mesh | null = null;
  const gy = H(p.x, p.s);
  if (p.sky) {
    hex2 = new THREE.Mesh(geo.ring, m.line);
    hex2.scale.setScalar(sz * 0.95);
    hex2.rotation.x = Math.PI / 2;
    grp.add(hex2);
    // light beam down to the snow, so you can see where to launch from
    const len = Math.max(1, p.y - gy - sz * 0.6);
    const beam = new THREE.Mesh(geo.beam, m.beam);
    beam.scale.set(1, len, 1);
    beam.position.y = -sz * 0.6 - len / 2;
    grp.add(beam);
  } else {
    // ground ring under it: helps read how far away it is
    const ring = new THREE.Mesh(geo.ring, m.line);
    ring.scale.setScalar(1.1);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = gy + 0.06 - p.y;
    grp.add(ring);
  }
  return { p, kind, grp, icon, hex, hex2, pop: 0, phase: (p.s * 0.37) % 6.283 };
}
/** a taken pickup fades on its own copy of the materials, so the others of its kind stay bright */
function ownMats(it: Item): void {
  it.grp.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.material) mesh.material = (mesh.material as THREE.Material).clone();
  });
}

/* ---------- streaming and touching ---------- */
const active = new Map<number, Item[]>();
const taken = new Set<string>();
let scene: THREE.Scene | null = null,
  t = 0,
  timed = true;

export interface Collected {
  p: Pickup;
  kind: PowerKind;
}
interface RiderLike {
  x: number;
  y: number;
  s: number;
  state: string;
}

export const pickups = {
  init(sc: THREE.Scene): void {
    scene = sc;
    POWER_KINDS.forEach(kindMats); // build textures up front: no hitch on the first pickup
  },
  /** forget everything (new run, back to menu); `on` = this run has power-ups, `isTimed` = time chips stay time chips */
  clear(on = false, isTimed = true): void {
    active.forEach((list) => list.forEach((it) => scene?.remove(it.grp)));
    active.clear();
    taken.clear();
    this.on = on;
    timed = isTimed;
  },
  on: false,
  /** stream pickups around the rider, animate them, and return what was touched moving from `prev` to the rider */
  update(
    dt: number,
    r: RiderLike,
    prev: { x: number; y: number; s: number },
    take = true,
  ): Collected[] {
    t += dt;
    const got: Collected[] = [];
    if (!this.on) return got;
    const k = Math.floor(r.s / SEG),
      lo = k - 1,
      hi = k + 3;
    for (let i = lo; i <= hi; i++) {
      if (active.has(i)) continue;
      const list = pickupsAt(i)
        .filter((p) => !taken.has(p.id))
        .map((p) => build(p, pickupKind(p, timed)));
      list.forEach((it) => scene?.add(it.grp));
      active.set(i, list);
    }
    active.forEach((list, i) => {
      if (i >= lo && i <= hi) return;
      list.forEach((it) => scene?.remove(it.grp));
      active.delete(i);
    });
    const canTake = take && r.state !== 'crash';
    active.forEach((list) => {
      for (let j = list.length - 1; j >= 0; j--) {
        const it = list[j];
        if (it.pop > 0) {
          // taken: swell and fade out
          it.pop += dt;
          const u = Math.min(1, it.pop / 0.3);
          it.grp.scale.setScalar(1 + 1.6 * u);
          it.grp.traverse((o) => {
            const mm = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
            if (mm) mm.opacity = (mm.userData.o0 ?? (mm.userData.o0 = mm.opacity)) * (1 - u);
          });
          if (u >= 1) {
            scene?.remove(it.grp);
            list.splice(j, 1);
          }
          continue;
        }
        // spin: the icon swings toward the camera, the frame turns all the way round
        const ph = it.phase;
        it.grp.position.y = it.p.y + Math.sin(t * 2.2 + ph) * (it.p.sky ? 0.3 : 0.14);
        it.icon.rotation.y = Math.sin(t * 2.6 + ph) * 0.75;
        it.hex.rotation.set(0, t * 3 + ph, t * 0.7);
        if (it.hex2) it.hex2.rotation.set(Math.PI / 2 + Math.sin(t * 1.3 + ph) * 0.5, 0, -t * 2);
        if (canTake && touches(it.p, prev.x, prev.y, prev.s, r.x, r.y, r.s)) {
          taken.add(it.p.id);
          it.pop = 1e-4;
          ownMats(it);
          got.push({ p: it.p, kind: it.kind });
        }
      }
    });
    return got;
  },
};

ND.pickups = Object.assign(pickups, { iconURL });
ND.POWER = POWER;
