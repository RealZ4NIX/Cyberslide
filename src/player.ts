// @ts-nocheck -- ported as-is from the single-file build; not strictly typed yet (see docs/structure.md)

/* CYBERSLIDE - player: model, physics, tricks, grinds, combo scoring */

import * as THREE from 'three';
import { ND } from './nd';
import { Powers, OVER_KICK } from './powerups';

const G = 28, TAU = Math.PI * 2, CHAIN_TIME = 2.2, LAND_YAW = 0.62, LAND_FLIP = 0.7;
const PERFECT_WIN = 0.3;   // seconds before touchdown in which Space gives a perfect landing
const SKY_EXTRA = 11;      // a perfect landing on a side quarterpipe throws you this much faster than a normal pipe launch
const LOCK_EARLY = 0.45;   // pressing Space too early locks it out for this long
const BUF_T = 0.55;        // arrows tapped this recently count toward a trick
const CHORD_T = 0.075;     // two arrows pressed this close together make a diagonal
const OPP = { U: 'D', D: 'U', L: 'R', R: 'L' };
const sm = (t) => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
/** score multiplier for mixing this many parts (spin, flip, tricks) into one jump */
export const mixMult = (n) => (n < 2 ? 1 : 1 + 0.5 * n);
const GRAB = {
  left: { name: 'Indy', rate: 120, y: 0.5, rx: 0, rz: 0 },
  right: { name: 'Method', rate: 220, y: 0.62, rx: 0, rz: 0.55 },
  up: { name: 'Nose', rate: 160, y: 0.5, rx: -0.55, rz: 0 },
  down: { name: 'Tail', rate: 160, y: 0.5, rx: 0.55, rz: 0 },
  none: { name: 'Mute', rate: 100, y: 0.45, rx: 0, rz: 0 }
};
const GRIND_MAXV = 64;   // rails only push you up to this speed; they never take speed away if you are already faster
const GRIND = {
  '50-50': { rate: 150, yaw: 0, rx: 0 },
  'Boardslide': { rate: 250, yaw: Math.PI / 2, rx: 0 },
  'Lipslide': { rate: 250, yaw: -Math.PI / 2, rx: 0 },
  'Nosegrind': { rate: 300, yaw: 0, rx: -0.45 },
  'Tailslide': { rate: 300, yaw: 0, rx: 0.45 }
};
const lam = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0 });
const bas = (c) => new THREE.MeshBasicMaterial({ color: c });
const wrapPi = (a, m) => a - Math.round(a / m) * m;

class Player {
  constructor(scene) {
    this.group = new THREE.Group();
    this.flipG = new THREE.Group(); this.flipG.rotation.order = 'YXZ';
    this.group.add(this.flipG);
    this.rigs = {}; this.rigId = null; this.rig = null;
    this.setRider(ND.riderId || 'nova');
    this.group.rotation.order = 'YXZ';
    this.group.scale.set(1.25, 1.25, 1.25);
    scene.add(this.group);
    // soft pink glow that sits on the snow under the rider and fades with height
    const gc = document.createElement('canvas'); gc.width = gc.height = 64;
    const gx = gc.getContext('2d'), grd = gx.createRadialGradient(32, 32, 2, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,0.95)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    gx.fillStyle = grd; gx.fillRect(0, 0, 64, 64);
    this.glowMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5, color: 0xff2fb8 });
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 3.8), this.glowMat);
    this.glow.rotation.order = 'YXZ'; scene.add(this.glow); this.glowMat.color.setHex(this.rig.glow);
    // landing cue: a fixed target ring on the snow and an outer ring that closes in on it
    const mkRing = (a, b) => {
      const m = new THREE.Mesh(new THREE.RingGeometry(a, b, 28), new THREE.MeshBasicMaterial({ color: 0x2ff0ff, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0.8 }));
      m.rotation.order = 'YXZ'; m.visible = false; m.renderOrder = 5; scene.add(m); return m;
    };
    this.ringT = mkRing(0.8, 1.0); this.ringO = mkRing(0.86, 1.0);
    // light trail ribbon
    this.TN = 26; this.trailPts = [];
    this.trailPos = new Float32Array(this.TN * 6); this.trailCol = new Float32Array(this.TN * 6);
    this.trailPosAttr = new THREE.BufferAttribute(this.trailPos, 3);
    this.trailColAttr = new THREE.BufferAttribute(this.trailCol, 3);
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', this.trailPosAttr); tg.setAttribute('color', this.trailColAttr);
    const ti = [];
    for (let i = 0; i < this.TN - 1; i++) { const q = i * 2; ti.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    tg.setIndex(ti);
    this.trail = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    this.trail.frustumCulled = false; scene.add(this.trail);
    this.onEvent = null;
    this.best = { bestCombo: 0 };
    this.pw = new Powers();   // power-ups running on the rider (powerups.ts)
    this.resetAll();
  }

  emit(n, d) { if (this.onEvent) this.onEvent(n, d || {}); }

  /* swap the rider model and stats (see riders.js) */
  setRider(id) {
    const def = ND.RIDERS.find((r) => r.id === id) || ND.RIDERS[0];
    if (this.rigId === def.id) return;
    if (this.rig) { this.flipG.remove(this.rig.board); this.group.remove(this.rig.body); }
    const rg = this.rigs[def.id] || (this.rigs[def.id] = ND.buildRider(def.id));
    this.rig = rg; this.rigId = def.id; this.def = def; this.k = ND.riderK(def.stats);
    this.board = rg.board; this.body = rg.body; this.head = rg.head; this.armNear = rg.armNear; this.armFar = rg.armFar; this.tail = rg.tail; this.tailSegs = rg.tailSegs;
    this.board.position.set(0, 0, 0); this.board.rotation.set(0, 0, 0); this.body.position.set(0, 0, 0); this.body.rotation.set(0, -0.7, 0, 'XYZ'); this.body.scale.set(1, 1, 1);
    this.flipG.add(rg.board); this.group.add(rg.body);
    if (this.glowMat) this.glowMat.color.setHex(rg.glow);
  }

  resetAll() {
    this.speedCap = 0; this.slide = 0; this.slideDir = 1;
    this.score = 0; this.dist = 0;
    this.stats = { tricks: 0, crashes: 0, topSpeed: 0, bestCombo: 0, grinds: 0, bestAir: 0 };
    this.combo = { pts: 0, entries: 0, timer: 0, active: false };
    this.x = 0; this.s = 8; this.y = ND.H(0, 8);
    this.heading = 0; this.hv = 0; this.speed = 14; this.vy = 0; this.prevGv = -14;
    this.state = 'ride'; this.charge = 0; this.wasSpace = false; this.invuln = 0; this.t = 0;
    this.gScale = 1; this.pitch = 0; this.roll = 0; this.grindYaw = 0; this.grindRx = 0;
    this.boostT = 0; this.boostPow = 0; this.boostMax = 1;
    this.tumble = { x: 0, z: 0, vx: 0, vz: 0 }; this.crashT = 0;
    this.special = 0; this.dirPrev = {}; this.heldDirs = []; this.chord = null; this.tokens = []; this.wasFlip = false; this.wasGrab = false;
    this.resetAir(); this.spaceLock = 0; this.holdLock = false; this.wallCool = 0; this.pipeCool = 0; this.readyT = 0; this.readyC = 0; this.perfStreak = 0;
    this.group.visible = true; this.trailPts.length = 0;
    this.pw.reset();
  }
  resetAir() {
    this.yawRot = 0; this.flipRot = 0; this.yawVel = 0; this.flipVel = 0;
    this.grab = null; this.grabs = new Set(); this.grabPts = 0; this.airT = 0; this.peakAir = 0;
    this.perfectArm = false; this.cue = false; this.tti = 99; this.pred = null; this.pipeAir = 0;
    this.clearTricks();
  }
  clearTricks() {
    this.aTrick = null; this.dTrick = null; this.queued = []; this.doneNames = new Set();
    this.tYawBase = 0; this.tFlipBase = 0;
  }

  /* ---- trick inputs: tap arrows, then A (flip) or D (grab) ---- */
  chordEnd() {
    const c = this.chord; if (!c) return;
    const v = c.keys.find((k) => k === 'U' || k === 'D') || '', h = c.keys.find((k) => k === 'L' || k === 'R') || '';
    this.tokens.push({ tok: v + h, t: c.t });
    if (this.tokens.length > 6) this.tokens.shift();
    this.chord = null;
  }
  dirPress(k) {
    const c = this.chord;
    if (c && this.t - c.t <= CHORD_T && c.keys.length === 1 && c.keys[0] !== k && c.keys[0] !== OPP[k]) c.keys.push(k);
    else { this.chordEnd(); this.chord = { keys: [k], t: this.t }; }
  }
  heldTok() {
    const h = this.heldDirs;
    const v = h.includes('U') && !h.includes('D') ? 'U' : h.includes('D') && !h.includes('U') ? 'D' : '';
    const x = h.includes('L') && !h.includes('R') ? 'L' : h.includes('R') && !h.includes('L') ? 'R' : '';
    return v + x;
  }
  trickInput(inp) {
    const held = [];
    for (const [k, v] of [['U', inp.up], ['D', inp.down], ['L', inp.left], ['R', inp.right]]) {
      if (v) held.push(k);
      if (v && !this.dirPrev[k]) this.dirPress(k);
      this.dirPrev[k] = v;
    }
    this.heldDirs = held;
    if (this.chord && this.t - this.chord.t > CHORD_T) this.chordEnd();
    if (ND.TRICK_INPUT === 'hold') this.holdStep(inp);
    else {
      if (inp.flip && !this.wasFlip) this.trickPress('A');
      if (inp.grab && !this.wasGrab) this.trickPress('D');
    }
    this.wasFlip = !!inp.flip; this.wasGrab = !!inp.grab;
  }
  canTrick() { return this.state === 'air' && !this.perfectArm && this.airT >= 0.04; }
  // longest arrow sequence (ending now) that names an available trick
  matchTrick(btn, toks) {
    for (let n = Math.min(2, toks.length); n >= 0; n--) {
      if (n === 0 && toks.length) break;                            // button alone only when no arrows were used
      const def = ND.TRICK_BY_KEY[btn + '|' + toks.slice(toks.length - n).join(' ')];
      if (!def || (def.sp && this.special < 1) || this.doneNames.has(def.name)) continue;
      return def;
    }
    return null;
  }
  startTrick(def, slot) {
    this[slot] = { def, t: 0 }; this.tokens.length = 0;
    // the meter fills while you are still in the air: every trick you start adds to it, so specials can be chained
    if (def.sp) { this.special = 0; this.emit('special', { name: def.name, input: ND.trickInput(def) }); this.fill(0.12); }
    else this.fill(0.3);
    this.emit('trickStart', { name: def.name });
  }
  trickPress(btn) {
    if (!this.canTrick()) return;
    this.chordEnd();
    const toks = this.tokens.filter((x) => this.t - x.t <= BUF_T).map((x) => x.tok);
    const ht = this.heldTok();
    if (ht && toks[toks.length - 1] !== ht) toks.push(ht);
    const slot = btn === 'A' ? 'aTrick' : 'dTrick';
    if (this[slot]) return;                                        // one trick per button at a time
    const def = this.matchTrick(btn, toks);
    if (def) this.startTrick(def, slot);
  }
  // "hold" style: keep A or D held, then tap the arrows in order
  holdStep(inp) {
    this.hold = this.hold || {};
    for (const [btn, down] of [['A', inp.flip], ['D', inp.grab]]) {
      let h = this.hold[btn];
      if (!down) { this.hold[btn] = null; continue; }
      if (!h) { h = this.hold[btn] = { t0: this.t, done: false, first: this.heldTok() }; }   // arrows already held count first
      if (h.done || !this.canTrick()) continue;
      const slot = btn === 'A' ? 'aTrick' : 'dTrick';
      if (this[slot]) { h.done = true; continue; }
      const toks = [];
      if (h.first) toks.push({ tok: h.first, t: h.t0 });
      for (const x of this.tokens) if (x.t >= h.t0 && !(h.first && toks.length === 1 && x.tok === h.first && x.t - h.t0 < 0.12)) toks.push(x);
      let use = toks.slice(-2);
      if (use.length === 2 && use[1].t - use[0].t > 0.5) use = use.slice(1);
      const lastT = use.length ? use[use.length - 1].t : h.t0;
      const names = use.map((x) => x.tok);
      // a longer sequence starting with these arrows might still be coming: give it a moment
      const more = names.length < 2 && ND.TRICKS.some((d) => d.btn === btn && d.seq.length > names.length && names.every((k, i) => d.seq[i] === k) && (!d.sp || this.special >= 1) && !this.doneNames.has(d.name));
      const waiting = this.t - lastT < (names.length ? 0.22 : 0.18);
      if (waiting && (more || !names.length)) continue;
      h.done = true;
      const def = this.matchTrick(btn, names);
      if (def) this.startTrick(def, slot);
    }
  }
  trickStep(dt) {
    for (const slot of ['aTrick', 'dTrick']) {
      const tr = this[slot]; if (!tr) continue;
      tr.t += dt * this.k.trick;
      if (tr.t >= tr.def.dur) {
        const d = tr.def;
        this.queued.push(d); this.doneNames.add(d.name);
        this.tYawBase += (d.yaw || 0) * TAU; this.tFlipBase += (d.flip || 0) * TAU;
        this[slot] = null; this.emit('trickDone', { name: d.name });
      }
    }
  }
  tYawTot() { let v = this.tYawBase; for (const tr of [this.aTrick, this.dTrick]) if (tr && tr.def.yaw) v += tr.def.yaw * TAU * sm(tr.t / tr.def.dur); return v; }
  tFlipTot() { let v = this.tFlipBase; for (const tr of [this.aTrick, this.dTrick]) if (tr && tr.def.flip) v += tr.def.flip * TAU * sm(tr.t / tr.def.dur); return v; }
  fill(v) {
    if (this.special >= 1) return;
    this.special = Math.min(1, this.special + v);
    if (this.special >= 1) this.emit('specialReady');
  }

  get boostNow() { return this.boostT > 0 ? this.boostPow * Math.min(1, this.boostT / 0.7) : 0; }

  mult() { return 1 + 0.2 * this.combo.entries; }   // no cap

  addCombo(name, pts, sp, chain, nofill, def, mix) {
    const c = this.combo;
    if (!sp && !nofill) this.fill(0.16);
    if (chain > 1) pts = Math.round(pts * (1 + 0.35 * (chain - 1)));   // chain bonus: each extra trick in one jump pays more
    const pm = this.pw.scoreMult; pts = Math.round(pts * pm);           // score multiplier chip
    const n = mix ? mix.parts.length : 1;   // a mixed trick counts every part toward the combo multiplier
    c.pts += pts; c.entries += n; c.timer = CHAIN_TIME * this.k.chain; c.active = true;
    this.stats.tricks += n;
    this.emit('trick', { name, pts, chain: chain || 0, input: def ? ND.trickInput(def) : '', parts: mix ? mix.parts : [name], mix: mix ? mix.x : 0, x2: pm > 1 });
  }
  bank() {
    const c = this.combo;
    if (!c.active) return;
    const total = Math.round(c.pts * this.mult());
    this.score += total;
    if (total > this.stats.bestCombo) this.stats.bestCombo = total;
    this.emit('bank', { total, mult: this.mult() });
    c.pts = 0; c.entries = 0; c.active = false; c.timer = 0;
  }

  /* tricks scored when a jump ends cleanly */
  creditAir(landing) {
    const spins = Math.round(Math.abs(this.yawRot) / Math.PI);
    const flips = Math.round(Math.abs(this.flipRot) / TAU);
    // every part of the jump: body spin, body flip, then the flip/grab/special tricks in the order they were done
    const parts = [];
    if (spins > 0) parts.push({ name: String(spins * 180), pts: Math.round(200 * spins * (1 + 0.2 * (spins - 1))), body: true });
    if (flips > 0) parts.push({ name: (flips > 1 ? flips + 'x ' : '') + (this.flipRot < 0 ? 'FRONTFLIP' : 'BACKFLIP'), pts: 600 * flips, body: true });
    for (const q of this.queued) parts.push({ name: q.name, pts: q.sp && this.megaAir ? q.pts * 2 : q.pts, def: q, sp: q.sp });   // air tricks already filled the meter when they started
    this.queued = [];
    const sw = spins % 2 === 1 && landing ? ' SWITCH' : '';
    if (parts.length === 1) {
      const a = parts[0];
      this.addCombo(a.name + (a.body ? sw : ''), a.pts, a.sp, 1, !a.body, a.def);
    } else if (parts.length > 1) {
      // mixing them in one jump makes one trick worth far more than its parts: 2 parts x2, 3 parts x2.5, 4 parts x3...
      const x = mixMult(parts.length);
      for (const a of parts) if (a.body) this.fill(0.16);
      const def = parts.find((a) => a.def)?.def;
      this.addCombo(parts.map((a) => a.name.toUpperCase()).join(' ') + sw, Math.round(x * parts.reduce((v, a) => v + a.pts, 0)),
        parts.some((a) => a.sp), 1, true, def, { parts: parts.map((a) => a.name), x });
    }
    if (!parts.length && this.airT > 0.9) this.addCombo('BIG AIR', Math.round(this.airT * 160));
    if (this.airT > this.stats.bestAir) this.stats.bestAir = this.airT;
    return parts.length > 0;
  }

  /* a power-up was picked up (pickups.ts finds the touch, game.ts calls this) */
  power(kind, sky) {
    const g = this.pw.grant(kind, sky);
    if (kind === 'over') {
      this.speed += OVER_KICK[sky ? 1 : 0];
      this.boostPow = Math.max(this.boostNow, 1); this.boostT = this.boostMax = Math.max(this.boostT, g.amount);
    }
    this.emit('power', g);
    return g;
  }

  jump(v) {
    // v is the pop speed relative to the hill, so add the hill's own vertical motion
    this.state = 'air'; this.vy = this.prevGv + v; this.resetAir(); this.megaAir = false; this.emit('jump');
  }

  crash(reason) {
    if (this.state === 'crash') return;
    // combo shield: the bail still happens, but the combo survives it and you get the full window to carry it on
    const shielded = this.combo.active && this.pw.absorb();
    const lost = shielded ? 0 : Math.round(this.combo.pts * this.mult());
    if (shielded) this.combo.timer = CHAIN_TIME * this.k.chain;
    else { this.combo.pts = 0; this.combo.entries = 0; this.combo.active = false; this.combo.timer = 0; }
    this.stats.crashes++; this.boostT = 0; this.special = 0;
    this.state = 'crash'; this.crashT = 0; this.perfStreak = 0;
    this.tumble.vx = 6 + Math.random() * 4; this.tumble.vz = (Math.random() - 0.5) * 8;
    this.resetAir();
    this.emit('crash', { reason, lost, shielded, saved: shielded ? Math.round(this.combo.pts * this.mult()) : 0 });
  }

  update(dt, inp) {
    this.t += dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.spaceLock > 0) this.spaceLock -= dt;
    if (this.wallCool > 0) this.wallCool -= dt;
    if (this.pipeCool > 0) this.pipeCool -= dt;
    if (this.readyT > 0) this.readyT -= dt;
    if (this.boostT > 0) this.boostT = Math.max(0, this.boostT - dt);
    this.pw.tick(dt);
    this.trickInput(inp);
    const prevSpace = this.wasSpace;
    this.spacePressed = inp.space && !prevSpace;
    this.gScale = 1 + Math.min(0.45, this.dist / 6000);
    // fast riders cover several metres a frame, enough to skip straight through a steep ramp lip: ride and air are stepped in
    // sub-steps of at most ~0.45 m so the ground is checked all along the path (the other states take the rest of the frame)
    const subs = Math.min(10, Math.max(1, Math.ceil(this.speed * dt / 0.45)));
    let left = dt;
    for (let i = 0; i < subs + 2 && left > 1e-6; i++) {
      const h = (this.state === 'ride' || this.state === 'air') && subs > 1 ? Math.min(left, dt / subs) : left;
      switch (this.state) {
        case 'ride': this.ride(h, inp); break;
        case 'air': this.air(h, inp); break;
        case 'grind': this.grind(h, inp); break;
        case 'crash': this.crashStep(h); break;
      }
      left -= h;
    }
    this.wasSpace = inp.space;
    if (this.speedCap && this.speed > this.speedCap) this.speed = this.speedCap;   // tutorial: keep the pace calm
    this.dist = Math.max(0, this.s - 8);
    if (this.speed > this.stats.topSpeed) this.stats.topSpeed = this.speed;
    if (this.combo.active && this.state === 'ride') {
      this.combo.timer -= dt;
      if (this.combo.timer <= 0) this.bank();
    }
    this.pose(dt, inp);
  }

  blockHit() {
    if (this.invuln > 0) return null;
    const bl = ND.blocksNear(this.s);
    for (let i = 0; i < bl.length; i++) {
      const b = bl[i];
      if (Math.abs(this.x - b.x) < b.w / 2 + 0.5 && Math.abs(this.s - b.s) < b.d / 2 + 0.55 &&
        this.y < ND.H(b.x, b.s) + b.h - 0.15) return b;
    }
    return null;
  }
  wall() {
    const cs = ND.C(this.s), xr = this.x - cs, pw = ND.megaAt(this.x, this.s);
    const lim = ND.HALF + 1.6 + (pw && pw.side && pw.side * xr > 0 ? 10 : 0);
    if (Math.abs(xr) > lim) {
      const sg = Math.sign(xr); this.x = cs + sg * lim;
      this.heading = -sg * 0.25; this.hv = 0;
      if (this.wallCool <= 0) {   // scraping the wall costs speed, so the bends have to be steered
        this.wallCool = 0.3; this.speed *= 1 - 0.14 * this.k.wall; this.emit('wall');
      }
    }
  }

  ride(dt, inp) {
    const steer = inp.ax ? inp.ax : (inp.right ? 1 : 0) - (inp.left ? 1 : 0);   // a stick gives a value between -1 and 1, keys give -1, 0 or 1
    if (!inp.space) this.holdLock = false;
    if (inp.space && !this.holdLock) {
      if (this.charge === 0 && this.readyT > 0) this.charge = this.readyC;   // a perfect landing leaves you already crouched
      this.charge = Math.min(1, this.charge + dt / (0.39 * this.k.charge));   // 40% faster knee bend (was 0.55 s to full crouch)
    }
    else if (!inp.space && this.charge > 0) { const c = this.charge; this.charge = 0; this.jump((8 + 8 * c) * this.k.jump); return; }
    const turn = 2.1 * this.k.turn * (0.55 + 0.45 * Math.min(1, 14 / Math.max(8, this.speed)));
    this.hv += (steer * turn - this.hv) * Math.min(1, dt * 9);
    this.heading += this.hv * dt;
    if (!steer) this.heading -= this.heading * Math.min(1, 0.9 * dt);
    const wx = (ND.wallSum(this.x + 1, this.s) - ND.wallSum(this.x - 1, this.s)) / 2;   // sideways slope of a quarterpipe wall
    // gravity pulls you back down the wall, but not while you are deliberately driving up a side quarterpipe at speed:
    // that climb must not be pushed back before the launch point (it used to turn shallow approaches around)
    const climbing = this.pipeCool <= 0 && this.speed > 12 && this.heading * Math.sign(wx) > 0.02;
    if (Math.abs(wx) > 0.3 && !climbing) this.heading -= Math.sign(wx) * Math.min(3.2, 3.2 * (Math.abs(wx) - 0.2)) * dt;
    this.heading = Math.max(-1.25, Math.min(1.25, this.heading));
    const c = Math.cos(this.heading), sn = Math.abs(Math.sin(this.heading));
    const bo = this.boostNow, ov = this.pw.overNow;   // overclock: a hard push and much less drag while it runs
    let a = (14 * this.gScale * this.k.gravity + 7 * bo + 18 * ov) * c - 11 * sn - 0.012 * this.k.drag * (inp.up ? 0.62 : 1) * (1 - 0.2 * Math.min(1, bo)) * (1 - 0.35 * ov) * this.speed * this.speed;
    a += 24 * ND.bowlDown(this.x, this.s) * c;   // landing slopes pull you down, then give it back
    if (inp.down) a -= 16;
    if (this.charge > 0.2) a -= 4;
    this.speed = Math.max(3, this.speed + a * dt);
    const nx = this.x + Math.sin(this.heading) * this.speed * dt;
    const ns = this.s + c * this.speed * dt;
    const ny = ND.H(nx, ns);
    const gv = (ny - this.y) / dt;
    this.x = nx; this.s = ns;
    // driving onto a side quarterpipe catapults you straight up: as soon as you are on the curve and heading into it
    const pw = this.pipeCool <= 0 && this.speed > 12 && this.heading !== 0 ? ND.megaAt(nx, ns) : null;
    if (pw && pw.side && Math.sin(this.heading) * pw.side > 0.03 && ND.wallSum(nx, ns) > 0.06) {
      const hillV = (ND.base(this.x, this.s + 1) - ND.base(this.x, this.s)) * this.speed * Math.cos(this.heading);
      this.vy = hillV + pw.cap + 14; this.y = ny + this.vy * dt;
      this.state = 'air'; this.resetAir(); this.megaAir = true; this.emit('launch');
      this.heading = pw.side * 0.03; this.hv = 0; this.pipeAir = pw.side; this.emit('mega');
      return;
    }
    if (this.prevGv - gv > 7 && this.speed > 12) {
      // launch speed relative to the hill is capped, so more speed means a longer jump rather than a much higher one
      // (mega quarterpipes have a much higher cap)
      const hillV = (ND.base(this.x, this.s + 1) - ND.base(this.x, this.s)) * this.speed * Math.cos(this.heading);
      const mega = ND.megaAt(this.x, this.s);
      this.vy = hillV + Math.min(mega ? mega.cap : 16, this.prevGv - hillV) + 2; this.y += this.vy * dt;
      this.state = 'air'; this.resetAir(); this.megaAir = !!mega; this.emit('launch');
      if (mega) {
        if (mega.side) { this.heading = -mega.side * 0.07; this.hv = 0; this.pipeAir = mega.side; }   // off the lip you drop straight back onto the wall
        this.emit('mega');
      }
    } else { this.y = ny; this.prevGv = gv; }
    this.wall();
    const b = this.blockHit();
    if (b) this.crash(b.kind === 'pylon' ? 'Hit a pylon' : 'Hit a barrier');
  }

  air(dt, inp) {
    this.airT += dt;
    this.vy -= G * this.pw.gravScale * dt; this.y += this.vy * dt;   // low-grav field: floatier, higher jumps
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.s += Math.cos(this.heading) * this.speed * dt;
    this.wall();
    const hh = this.y - ND.H(this.x, this.s);
    if (hh > this.peakAir) this.peakAir = hh;
    this.perfectCheck();
    const armed = this.perfectArm;
    const J = inp.trick && !armed;
    let yawT = 0, flipT = 0;
    if (J) {
      if (inp.left) yawT = 1; else if (inp.right) yawT = -1;
      if (inp.up) flipT = -1; else if (inp.down) flipT = 1;
    } else {
      const st = inp.ax ? inp.ax : (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      this.heading = Math.max(-1.25, Math.min(1.25, this.heading + st * 0.5 * dt));
      // out of a side quarterpipe the wall keeps you from drifting far: you always come back down onto the curve
      if (this.pipeAir) this.heading = this.pipeAir * Math.max(-0.07, Math.min(0.07, this.heading * this.pipeAir));
    }
    const rs = armed ? 2.6 : 1;   // a committed landing straightens the rider out quickly
    if (yawT) { this.yawVel += (yawT * 9.5 * this.k.spin - this.yawVel) * Math.min(1, dt * 10); this.yawRot += this.yawVel * dt; }
    else { this.yawVel = 0; this.yawRot += (Math.round(this.yawRot / Math.PI) * Math.PI - this.yawRot) * Math.min(1, dt * 3 * rs); }
    if (flipT) { this.flipVel += (flipT * 7.5 * this.k.spin - this.flipVel) * Math.min(1, dt * 10); this.flipRot += this.flipVel * dt; }
    else { this.flipVel = 0; this.flipRot += (Math.round(this.flipRot / TAU) * TAU - this.flipRot) * Math.min(1, dt * 4.5 * rs); }
    this.trickStep(dt);

    const rails = ND.railsNear(this.s);
    for (let i = 0; i < rails.length; i++) {
      const r = rails[i];
      if (Math.abs(this.x - ND.railX(r, this.s)) < r.tol && this.s >= r.s && this.s <= r.s + r.len) {
        const ry = ND.railY(r, this.s);
        const rv = this.vy - (ND.railY(r, this.s + 1) - ry) * this.speed * Math.cos(this.heading);
        if (this.y <= ry + 0.9 + 0.15 * r.tier && this.y >= ry - 1.5 - 0.25 * r.tier && rv <= 3) {
          this.startGrind(r); return;      // a rail always catches you: flips and spins are cleaned up, the combo carries on
        }
      }
    }
    const b = this.blockHit();
    if (b) { this.crash(b.kind === 'pylon' ? 'Hit a pylon' : 'Hit a barrier'); return; }
    const gy = ND.H(this.x, this.s);
    if (this.y <= gy) this.land(gy);
  }

  /* where and when the current jump will touch down (null if it ends on a rail) */
  predict() {
    const h = 0.03, sx = Math.sin(this.heading) * this.speed, ss = Math.cos(this.heading) * this.speed, cs = Math.cos(this.heading);
    let x = this.x, s = this.s, y = this.y, vy = this.vy, pgd = y - ND.H(x, s);
    const g = G * this.pw.gravScale;
    for (let t = h; t < 2.4; t += h) {
      vy -= g * h; y += vy * h; x += sx * h; s += ss * h;
      const rails = ND.railsNear(s);
      for (let i = 0; i < rails.length; i++) {
        const r = rails[i];
        if (Math.abs(x - ND.railX(r, s)) < r.tol && s >= r.s && s <= r.s + r.len) {
          const ry = ND.railY(r, s), rv = vy - (ND.railY(r, s + 1) - ry) * this.speed * cs;
          if (y <= ry + 0.9 + 0.15 * r.tier && y >= ry - 1.5 - 0.25 * r.tier && rv <= 3) return null;
        }
      }
      const gy = ND.H(x, s), gd = y - gy;
      if (gd <= 0) { const f = pgd / Math.max(1e-6, pgd - gd); return { t: t - h + f * h, x, s, y: gy }; }
      pgd = gd;
    }
    return null;
  }

  /* perfect landing: tap Space in the last moments before touchdown */
  perfectCheck() {
    this.cue = false; this.pred = null; this.tti = 99;
    if (this.peakAir > 1.8) {
      const pr = this.predict();
      if (pr && this.airT + pr.t > 0.55) {
        this.pred = pr; this.tti = pr.t;
        this.cue = !this.perfectArm && this.spaceLock <= 0 && pr.t <= PERFECT_WIN * this.k.land;
        if (this.spacePressed && !this.perfectArm && this.spaceLock <= 0) {
          if (pr.t <= PERFECT_WIN * this.k.land) { this.perfectArm = true; this.cue = false; this.holdLock = true; this.emit('arm'); }
          else { this.spaceLock = LOCK_EARLY; this.holdLock = true; this.cue = false; this.emit('early'); }
        }
      }
    }
  }

  land(gy) {
    const armed = this.perfectArm;
    for (const slot of ['aTrick', 'dTrick']) {          // a trick that is nearly done still counts
      const tr = this[slot];
      if (tr && tr.t / tr.def.dur >= 0.8) {
        const d = tr.def; this.queued.push(d); this.doneNames.add(d.name);
        this.tYawBase += (d.yaw || 0) * TAU; this.tFlipBase += (d.flip || 0) * TAU; this[slot] = null;
      }
    }
    const yawTot = this.yawRot + this.tYawTot(), flipTot = this.flipRot + this.tFlipTot();
    const yawDev = armed ? 0 : Math.abs(wrapPi(yawTot, Math.PI));
    const flipDev = armed ? 0 : Math.abs(wrapPi(flipTot, TAU));
    if (yawDev > LAND_YAW * this.k.land || flipDev > LAND_FLIP * this.k.land) { this.y = gy; this.crash('Bad landing'); return; }
    this.y = gy;
    const trickDone = this.creditAir(true);
    this.yawRot = armed ? Math.round(yawTot / Math.PI) * Math.PI : yawTot;      // finished body spins carry into the stance
    this.yawRot -= Math.round(this.yawRot / TAU) * TAU;
    this.flipRot = 0; this.grab = null; this.clearTricks();
    this.state = 'ride'; this.vy = 0; this.pipeCool = this.pipeAir ? 0.8 : 0;   // only a landing out of a pipe launch has to roll back down first; a normal jump onto the wall launches right away
    const dh = ND.H(this.x + Math.sin(this.heading), this.s + Math.cos(this.heading)) - gy;
    this.prevGv = dh * this.speed;
    this.emit('land', { air: this.airT });
    let perfPts = 0;
    if (armed) {
      // perfect landings in a row stack: the 2nd pays double, the 3rd triple... any other real landing or a crash resets it
      this.perfStreak++;
      perfPts = Math.round((300 + 300 * Math.min(1, this.peakAir / 6)) * this.perfStreak);
      this.addCombo('PERFECT LANDING' + (this.perfStreak > 1 ? ' x' + this.perfStreak : ''), perfPts);
      this.emit('perfect', { pts: perfPts, x: this.x, y: gy, s: this.s, streak: this.perfStreak });
    } else if (this.airT > 0.55 && this.peakAir > 1.8) this.perfStreak = 0;   // small hops that could never be perfect don't break it
    if (armed) {
      // perfect landing: land already crouched, ready to pop again. Still holding Space = keep charging, release to jump.
      this.holdLock = false; this.readyC = 0.45; this.readyT = 0.9;
      this.charge = this.wasSpace ? this.readyC : 0;
    }
    this.perfectArm = false; this.cue = false;
    // clean landing from a real jump: speed boost grows with height, combo size and landing quality
    if (this.airT > 0.55 && this.peakAir > 1.8) {
      const q = 1 - Math.max(yawDev / (LAND_YAW * this.k.land), flipDev / (LAND_FLIP * this.k.land));
      const perfect = trickDone && yawDev < 0.2 && flipDev < 0.2;
      const hN = Math.min(1, this.peakAir / 7), cN = Math.min(1, this.combo.entries / 8);
      const pw = Math.min(1.4, 0.12 + 0.12 * q + 0.55 * hN + 0.7 * cN + (perfect ? 0.2 : 0) + (armed ? 0.3 : 0) + 0.35 * this.boostNow);
      this.boostPow = pw; this.boostT = this.boostMax = 1.4 + 1.1 * pw;
      this.speed += 2 + 4 * pw;
      this.emit('boost', { pow: pw, perfect: armed, clean: perfect });
    }
    // perfect landing on a side quarterpipe: the wall throws you straight back up, higher than the launch off the lip
    if (armed) {
      const pw = ND.megaAt(this.x, this.s);
      if (pw && pw.side && ND.wallSum(this.x, this.s) > 0.5) this.skyLaunch(pw);
    }
  }

  skyLaunch(pw) {
    const hillV = (ND.base(this.x, this.s + 1) - ND.base(this.x, this.s)) * this.speed * Math.cos(this.heading);
    this.charge = 0; this.readyT = 0; this.holdLock = true;
    this.vy = hillV + pw.cap + 14 + SKY_EXTRA; this.y += this.vy / 60;
    this.state = 'air'; this.resetAir(); this.megaAir = true;   // still mega air: specials keep paying double
    this.heading = pw.side * 0.03; this.hv = 0; this.pipeAir = pw.side; this.pipeCool = 0;   // you come back down onto the same wall
    this.emit('launch'); this.emit('sky', { x: this.x, y: this.y, s: this.s });
  }

  startGrind(rail) {
    for (const slot of ['aTrick', 'dTrick']) {          // tricks still turning when you hit the rail count if they were half done
      const tr = this[slot];
      if (tr && tr.t / tr.def.dur >= 0.5) { this.queued.push(tr.def); this.doneNames.add(tr.def.name); this[slot] = null; }
    }
    this.creditAir(false); this.perfectArm = false; this.cue = false; this.clearTricks(); this.fill(0.16);
    this.state = 'grind'; this.rail = rail; this.grindT = 0; this.megaAir = false;
    this.x = ND.railX(rail, this.s); this.heading = 0; this.hv = 0;
    this.grindName = '50-50'; this.grindUsed = new Set(['50-50']);
    this.yawRot = 0; this.flipRot = 0; this.grab = null; this.grabs = new Set(); this.grabPts = 0;
    this.combo.entries++; this.combo.timer = CHAIN_TIME * this.k.chain; this.combo.active = true;
    this.stats.grinds++; this.stats.tricks++;
    this.emit('trick', { name: '50-50 GRIND', pts: 0 });
    if (rail.tier) this.addCombo(rail.tier === 3 ? 'WINDOW RAIL' : rail.tier === 2 ? 'SKY RAIL' : 'HIGH RAIL', [0, 300, 800, 1200][rail.tier]);
    // getting on a rail kicks you forward
    this.speed = Math.max(this.speed, Math.min(GRIND_MAXV, Math.max(this.speed, 20) + 4 + 1.2 * rail.tier));
    this.boostPow = Math.max(this.boostNow, 0.55 + 0.1 * rail.tier); this.boostT = this.boostMax = 1.3;
    this.emit('boost', { pow: this.boostPow, rail: 'on' });
    this.emit('grindStart');
  }

  // leaving a rail (end of the rail or a jump off): the longer and busier the grind, the bigger the kick
  endGrind() {
    const r = this.rail, bonus = Math.min(11, (3.5 + 2.2 * this.grindT + 1.4 * (this.grindUsed.size - 1) + 1.1 * r.tier) * this.k.grindKick);
    this.speed = Math.max(this.speed, Math.min(GRIND_MAXV, this.speed + bonus));
    const pw = Math.min(1.4, 0.5 + bonus / 14 + 0.1 * r.tier);
    this.boostPow = Math.max(this.boostNow, pw); this.boostT = this.boostMax = 1.5 + 0.9 * pw;
    this.emit('boost', { pow: pw, rail: 'off' });
    this.emit('grindEnd');
  }

  grind(dt, inp) {
    let n = '50-50';
    if (inp.trick) { n = inp.left ? 'Boardslide' : inp.right ? 'Lipslide' : inp.up ? 'Nosegrind' : inp.down ? 'Tailslide' : '50-50'; }
    if (n !== this.grindName) {
      this.grindName = n;
      if (!this.grindUsed.has(n)) {
        this.grindUsed.add(n); this.combo.entries++; this.stats.tricks++; this.fill(0.1);
        this.emit('trick', { name: n.toUpperCase() + ' GRIND', pts: 0 });
      }
    }
    this.grindT += dt;
    this.combo.pts += GRIND[n].rate * 2 * [1, 1.5, 2.2, 3][this.rail.tier] * this.k.grindPts * this.pw.scoreMult * dt; this.combo.timer = CHAIN_TIME * this.k.chain; this.combo.active = true;
    this.speed = Math.max(this.speed, Math.min(GRIND_MAXV, this.speed + (3.5 + 0.8 * this.rail.tier) * this.k.grindKick * dt));   // rails speed you up, never down
    const px = this.x;
    this.s += this.speed * dt;
    this.x = ND.railX(this.rail, this.s); this.y = ND.railY(this.rail, this.s);
    this.prevGv = (this.y - ND.railY(this.rail, this.s - 0.5)) / 0.5 * this.speed;
    const lat = (this.x - px) / Math.max(dt, 1e-4);          // sideways speed along a slanted rail
    this.hv = 0;
    const leave = () => { this.heading = Math.max(-0.5, Math.min(0.5, Math.atan2(lat, Math.max(8, this.speed)))); };
    if (this.spacePressed) { leave(); this.jump(10); this.endGrind(); return; }
    if (this.s > this.rail.s + this.rail.len) {
      leave();
      this.state = 'air'; this.vy = this.prevGv + 3; this.resetAir(); this.endGrind();
    }
  }

  crashStep(dt) {
    this.crashT += dt;
    this.speed = Math.max(0, this.speed * (1 - 1.9 * dt));
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.s += Math.cos(this.heading) * this.speed * dt;
    this.wall();
    const gy = ND.H(this.x, this.s);
    this.vy -= G * dt; this.y += this.vy * dt;
    if (this.y < gy) { this.y = gy; this.vy = 0; }
    this.tumble.x += this.tumble.vx * dt; this.tumble.z += this.tumble.vz * dt;
    this.tumble.vx *= 1 - 0.9 * dt; this.tumble.vz *= 1 - 0.9 * dt;
    if (this.crashT > 1.3) {
      this.state = 'ride'; this.invuln = 2; this.heading = 0; this.hv = 0; this.readyT = 0; this.charge = 0;
      this.speed = 12; this.tumble.x = this.tumble.z = 0; this.prevGv = -14;
      this.y = ND.H(this.x, this.s); this.resetAir();
      this.emit('respawn');
    }
  }

  updateTrail() {
    const N = this.TN, pts = this.trailPts, P = this.trailPos, C = this.trailCol, bo = this.boostNow, c0 = this.rig.trail[0], c1 = this.rig.trail[1];
    if (this.state === 'air' || this.state === 'crash') pts.pop();
    else { pts.unshift({ x: this.x, y: this.y + 0.14, z: -this.s + 0.9 }); if (pts.length > N) pts.pop(); }
    if (!pts.length) { this.trail.visible = false; return; }
    this.trail.visible = true;
    for (let i = 0; i < N; i++) {
      const p = pts[Math.min(i, pts.length - 1)];
      const f = i < pts.length ? i / (N - 1) : 1;
      const w = 0.42 * Math.pow(1 - f, 0.8) * (1 + 0.7 * bo);
      const j = i * 6, br = (1 - 0.35 * f) * (1 + 0.3 * bo);
      P[j] = p.x - w; P[j + 1] = p.y; P[j + 2] = p.z; P[j + 3] = p.x + w; P[j + 4] = p.y; P[j + 5] = p.z;
      C[j] = C[j + 3] = (c0[0] + (c1[0] - c0[0]) * f) * br; C[j + 1] = C[j + 4] = (c0[1] + (c1[1] - c0[1]) * f) * br; C[j + 2] = C[j + 5] = (c0[2] + (c1[2] - c0[2]) * f) * br;
    }
    this.trailPosAttr.needsUpdate = true; this.trailColAttr.needsUpdate = true;
  }

  landRisk() {
    if (this.state !== 'air' || this.perfectArm || this.y - ND.H(this.x, this.s) > 3.5) return false;
    return Math.abs(wrapPi(this.yawRot + this.tYawTot(), Math.PI)) > LAND_YAW * this.k.land || Math.abs(wrapPi(this.flipRot + this.tFlipTot(), TAU)) > LAND_FLIP * this.k.land;
  }

  liveTrick() {
    if (this.state === 'grind') return this.grindName.toUpperCase() + ' GRIND';
    if (this.state !== 'air') return '';
    const p = [];
    const spins = Math.round(Math.abs(this.yawRot) / Math.PI);
    if (spins > 0) p.push(spins * 180);
    if (Math.abs(this.flipRot) > Math.PI) p.push(this.flipRot < 0 ? 'FRONTFLIP' : 'BACKFLIP');
    for (const q of this.queued) p.push(q.name.toUpperCase());
    for (const tr of [this.aTrick, this.dTrick]) if (tr) p.push(tr.def.name.toUpperCase());
    return p.join(' + ');
  }

  pose(dt, inp) {
    const air = this.state === 'air';
    // powerslide: braking on the ground swings the rider sideways into a skid (looks only, speed and steering are untouched)
    const braking = !!inp && this.state === 'ride' && inp.down && this.speed > 6;
    if (this.slide < 0.15 && inp && (inp.left || inp.right)) this.slideDir = inp.right ? 1 : -1;   // swings out to the side you are steering to
    this.slide += ((braking ? 1 : 0) - this.slide) * Math.min(1, dt * 9);
    if (this.slide < 0.005) this.slide = 0;
    const dh = ND.H(this.x + Math.sin(this.heading), this.s + Math.cos(this.heading)) - ND.H(this.x, this.s);
    const target = air ? Math.atan2(this.vy, Math.max(8, this.speed)) : Math.atan(dh);
    this.pitch += (target - this.pitch) * Math.min(1, dt * (air ? 4 : 12));
    this.roll += ((this.state === 'ride' ? -this.hv * 0.22 : 0) - this.roll) * Math.min(1, dt * 10);
    const gTarget = this.state === 'grind' ? GRIND[this.grindName] : null;
    this.grindYaw += ((gTarget ? gTarget.yaw : 0) - this.grindYaw) * Math.min(1, dt * 14);
    this.grindRx += ((gTarget ? gTarget.rx : 0) - this.grindRx) * Math.min(1, dt * 14);
    // pose from the running trick (grab poses, arms), board flips and body spins
    let gr = null, fx = 0, fy = 0, fz = 0, lift = 0, bodyYaw = 0;
    for (const tr of [this.dTrick, this.aTrick]) {
      if (!tr) continue;
      const d = tr.def, u = tr.t / d.dur, e = sm(u);
      if (d.b) { fx += d.b[0] * TAU * e; fy += d.b[1] * TAU * e; fz += d.b[2] * TAU * e; }
      if (d.by) bodyYaw += d.by * TAU * e;
      if (d.lift) lift += d.lift * Math.sin(Math.PI * u);
      if (d.p && !gr) {
        const a = Math.max(0, Math.min(1, u / 0.2, (1 - u) / 0.18));
        gr = { name: d.name, y: d.p[0] * a, rx: d.p[1] * a, rz: d.p[2] * a, n: lerp(-0.95, d.p[3], a), f: lerp(0.95, d.p[4], a), dy: d.p[5] * a };
      }
    }
    this.grab = gr;
    this.flipG.rotation.set(fx, fy, fz); this.flipG.position.y = lift;
    const by = gr ? gr.y : 0, brx = gr ? gr.rx : this.grindRx, brz = gr ? gr.rz : 0;
    this.board.position.y += (by - this.board.position.y) * Math.min(1, dt * 16);
    this.board.rotation.x += (brx - this.board.rotation.x) * Math.min(1, dt * 16);
    this.board.rotation.z += (brz - this.board.rotation.z) * Math.min(1, dt * 16);
    const cr = Math.max(this.charge, this.readyT > 0 && this.state === 'ride' ? this.readyC : 0);
    const bodyT = (-0.3 * cr) + (gr ? gr.dy : 0) - 0.16 * this.slide;
    this.body.rotation.y = -0.7 + bodyYaw;
    this.body.position.y += (bodyT - this.body.position.y) * Math.min(1, dt * 14);
    this.body.scale.y += ((1 - 0.2 * cr) - this.body.scale.y) * Math.min(1, dt * 14);
    const ak = Math.min(1, dt * 12);
    let nT = -0.25 + this.hv * 0.12, fT = 0.25 + this.hv * 0.12;
    if (this.state === 'air') { nT = -0.95; fT = 0.95; }
    if (gr) { nT = gr.n; fT = gr.f; }
    if (this.state === 'grind') { nT = -0.7; fT = 0.7; }
    if (this.slide > 0) { nT += (-1.15 - nT) * this.slide; fT += (1.15 - fT) * this.slide; }   // arms out for balance
    this.armNear.rotation.x += (nT - this.armNear.rotation.x) * ak;
    this.armFar.rotation.x += (fT - this.armFar.rotation.x) * ak;
    this.tail.rotation.z = -1.2 + Math.min(1.1, this.speed * 0.03);
    if (this.rig.fx) this.rig.fx(this.t, dt, this.speed);
    for (let i = 0; i < this.tailSegs.length; i++) this.tailSegs[i].rotation.y = Math.sin(this.t * 10 + i * 1.2) * 0.3;
    this.group.position.set(this.x, this.y + 0.1, -this.s);
    this.group.rotation.set(
      this.pitch + this.flipRot + this.tFlipTot() + this.tumble.x,
      -this.heading + this.yawRot + this.tYawTot() + this.grindYaw + this.slideDir * this.slide * 1.05,
      this.roll + this.tumble.z - this.slideDir * this.slide * 0.22, 'YXZ');
    this.group.visible = this.invuln <= 0 || Math.floor(this.t * 16) % 2 === 0;
    const gy = ND.H(this.x, this.s), hgt = Math.max(0, this.y - gy);
    this.glow.position.set(this.x, gy + 0.07, -this.s);
    this.glow.rotation.set(-Math.PI / 2 + Math.atan(dh), -this.heading, 0);
    this.glowMat.opacity = this.state === 'crash' ? 0 : 0.55 * Math.max(0, 1 - hgt / 7);
    this.updateTrail();
    this.updateRing();
  }

  updateRing() {
    const pr = this.state === 'air' ? this.pred : null;
    if (!pr) { this.ringT.visible = this.ringO.visible = false; return; }
    const inWin = this.perfectArm || pr.t <= PERFECT_WIN * this.k.land;
    const dh = ND.H(pr.x + Math.sin(this.heading), pr.s + Math.cos(this.heading)) - pr.y;
    const col = this.perfectArm ? 0xffffff : inWin ? 0xffd23f : 0x2ff0ff;
    for (const m of [this.ringT, this.ringO]) {
      m.visible = true; m.material.color.setHex(col);
      m.position.set(pr.x, pr.y + 0.15, -pr.s);
      m.rotation.set(-Math.PI / 2 + Math.atan(dh), -this.heading, 0);
    }
    const u = this.perfectArm ? 0 : Math.min(1, pr.t / 0.9);
    this.ringT.scale.setScalar(1.15);
    this.ringO.scale.setScalar(1.15 * (1 + 1.7 * u * u));
    const pulse = 0.65 + 0.35 * Math.sin(this.t * 34);
    this.ringT.material.opacity = inWin ? 0.9 : 0.5;
    this.ringO.material.opacity = inWin ? 0.55 + 0.45 * pulse : 0.7 * (1 - 0.6 * u);
  }
}
ND.Player = Player;
