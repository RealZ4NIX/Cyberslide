// @ts-nocheck -- ported as-is from index.html; typed step by step

/* CYBERSLIDE - gamepad: reads the controller through the Gamepad API (standard mapping: DualSense, DualShock, Xbox and friends).
   This file only knows about the device: sticks with a dead-zone, buttons with edge detection, names for the button glyphs and rumble.
   main.js decides what the buttons do. */

import { ND } from './nd';

const NB = 20;
const NAMES = {
  ps: ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'CREATE', 'OPTIONS', 'L3', 'R3', '↑', '↓', '←', '→', 'PS', 'TOUCHPAD'],
  xbox: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'VIEW', 'MENU', 'LS', 'RS', '↑', '↓', '←', '→', 'HOME', 'SHARE']
};
const kindOf = (id) => /054c|dualsense|dualshock|wireless controller|playstation|sony/i.test(id || '') ? 'ps' : /xbox|xinput|045e|microsoft/i.test(id || '') ? 'xbox' : 'other';
const labelOf = (id, kind) => /dualsense/i.test(id || '') || /0ce6|0df2/i.test(id || '') ? 'DUALSENSE' : kind === 'ps' ? 'PLAYSTATION CONTROLLER' : kind === 'xbox' ? 'XBOX CONTROLLER' : 'CONTROLLER';

const st = {
  lx: 0, ly: 0, ax: 0,                                  // left stick after the dead-zone (-1..1), and the steering value: D-pad wins over the stick
  left: false, right: false, up: false, down: false,    // stick or D-pad as arrow keys
  btn: new Array(NB).fill(false), hit: new Array(NB).fill(false), rel: new Array(NB).fill(false),
  firstHit: -1, strong: false                           // first button pressed this frame (-1 none); "someone is really using the pad"
};
let cur = -1, last = null, sl = false, sr = false, su = false, sd = false;

function pick() {
  let list = [];
  try { list = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { list = []; }
  let best = null;
  for (let i = 0; i < list.length; i++) {
    const g = list[i]; if (!g || g.connected === false) continue;
    if (g.index === cur) return g;
    if (!best || (g.mapping === 'standard' && best.mapping !== 'standard')) best = g;
  }
  return best;
}

ND.pad = {
  st, connected: false, id: '', kind: 'ps', label: 'CONTROLLER', enabled: true,
  name(i) { return i == null ? '—' : (NAMES[this.kind === 'xbox' ? 'xbox' : 'ps'][i] || 'BTN ' + i); },
  /* read the pad once per frame; dz is the stick dead-zone (0..0.5). Returns whether a pad is connected. */
  poll(dz) {
    const g = pick();
    if (!g) {
      if (this.connected) { this.connected = false; cur = -1; last = null; }
      st.lx = st.ly = st.ax = 0; st.left = st.right = st.up = st.down = false; st.strong = false; st.firstHit = -1;
      for (let i = 0; i < NB; i++) st.btn[i] = st.hit[i] = st.rel[i] = false;
      return false;
    }
    const fresh = !this.connected || g.index !== cur;   // the press that wakes a pad up must not also act
    cur = g.index; last = g;
    if (fresh) { this.id = g.id; this.kind = kindOf(g.id); this.label = labelOf(g.id, this.kind); }
    this.connected = true;
    st.firstHit = -1; let any = false;
    for (let i = 0; i < NB; i++) {
      const b = g.buttons[i], v = b ? (b.value || 0) : 0;
      const on = !!b && (i === 6 || i === 7 ? (b.pressed || v > (st.btn[i] ? 0.2 : 0.35)) : (b.pressed || v > 0.5));
      st.hit[i] = on && !st.btn[i] && !fresh; st.rel[i] = !on && st.btn[i];
      if (st.hit[i]) { any = true; if (st.firstHit < 0) st.firstHit = i; }
      st.btn[i] = on;
    }
    // left stick: radial dead-zone, then rescaled so a 95% push is a full push
    let x = g.axes[0] || 0, y = g.axes[1] || 0;
    const m = Math.hypot(x, y);
    if (m <= dz) { x = 0; y = 0; }
    else { const t = Math.min(1, (m - dz) / Math.max(0.05, 0.95 - dz)), k = t / m; x *= k; y *= k; }
    st.lx = x; st.ly = y;
    sl = sl ? x < -0.4 : x < -0.55; sr = sr ? x > 0.4 : x > 0.55; su = su ? y < -0.4 : y < -0.55; sd = sd ? y > 0.4 : y > 0.55;
    const dl = st.btn[14], dr = st.btn[15], du = st.btn[12], dd = st.btn[13];
    st.left = dl || sl; st.right = dr || sr; st.up = du || su; st.down = dd || sd;
    st.ax = dl !== dr ? (dr ? 1 : -1) : x;
    st.strong = any || Math.abs(x) > 0.7 || Math.abs(y) > 0.7;
    return true;
  },
  /* haptics: strong = low rumble motor, weak = high one, ms = length */
  rumble(strong, weak, ms) {
    if (!this.enabled || !last) return;
    try {
      const a = last.vibrationActuator;
      if (a && a.playEffect) { const p = a.playEffect('dual-rumble', { startDelay: 0, duration: ms, weakMagnitude: Math.min(1, weak), strongMagnitude: Math.min(1, strong) }); if (p && p.catch) p.catch(() => {}); }
      else if (last.hapticActuators && last.hapticActuators[0] && last.hapticActuators[0].pulse) last.hapticActuators[0].pulse(Math.min(1, Math.max(strong, weak)), ms);
    } catch (e) { /* no haptics here */ }
  }
};
