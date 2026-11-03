/* CYBERSLIDE - gamepad: reads the controller through the Gamepad API (standard mapping: DualSense, DualShock, Xbox and friends).
   This file only knows about the device: sticks with a dead-zone, buttons with edge detection, names for the button glyphs and rumble.
   game.ts decides what the buttons do. */

import { ND } from './nd';

export const NB = 20;
export type PadKind = 'ps' | 'xbox' | 'other';

const NAMES = {
  ps: [
    '✕',
    '○',
    '□',
    '△',
    'L1',
    'R1',
    'L2',
    'R2',
    'CREATE',
    'OPTIONS',
    'L3',
    'R3',
    '↑',
    '↓',
    '←',
    '→',
    'PS',
    'TOUCHPAD',
  ],
  xbox: [
    'A',
    'B',
    'X',
    'Y',
    'LB',
    'RB',
    'LT',
    'RT',
    'VIEW',
    'MENU',
    'LS',
    'RS',
    '↑',
    '↓',
    '←',
    '→',
    'HOME',
    'SHARE',
  ],
};

/** how a button is drawn as an on-screen glyph: its label, its shape and its colour */
export interface PadGlyph {
  text: string;
  /** face: round face button, pill: shoulders, triggers and system buttons, dpad: a D-pad direction */
  shape: 'face' | 'pill' | 'dpad';
  /** colour of a face button, as printed on the real pad ('' for everything else) */
  tone: '' | 'blue' | 'red' | 'pink' | 'green' | 'yellow';
}

const FACE_TONES = {
  ps: ['blue', 'red', 'pink', 'green'], // ✕ ○ □ △
  xbox: ['green', 'red', 'blue', 'yellow'], // A B X Y
} as const;

/** the glyph for button i on this kind of pad (pads we don't recognise use the PlayStation look) */
export function glyphOf(kind: PadKind, i: number): PadGlyph {
  const k = kind === 'xbox' ? 'xbox' : 'ps';
  const text = NAMES[k][i] || 'BTN ' + i;
  if (i >= 0 && i <= 3) return { text, shape: 'face', tone: FACE_TONES[k][i] };
  if (i >= 12 && i <= 15) return { text, shape: 'dpad', tone: '' };
  return { text, shape: 'pill', tone: '' };
}

/* Xbox is checked first: an Xbox Series pad over Bluetooth calls itself "Xbox Wireless Controller", which would
   otherwise match the PlayStation "wireless controller" pattern */
export const kindOf = (id: string | null | undefined): PadKind =>
  /xbox|xinput|045e|microsoft/i.test(id || '')
    ? 'xbox'
    : /054c|dualsense|dualshock|wireless controller|playstation|sony/i.test(id || '')
      ? 'ps'
      : 'other';

export const labelOf = (id: string | null | undefined, kind: PadKind): string =>
  /dualsense/i.test(id || '') || /0ce6|0df2/i.test(id || '')
    ? 'DUALSENSE'
    : kind === 'ps'
      ? 'PLAYSTATION CONTROLLER'
      : kind === 'xbox'
        ? 'XBOX CONTROLLER'
        : 'CONTROLLER';

/** radial dead-zone, then rescaled so a 95% push is a full push */
export function deadZone(x: number, y: number, dz: number): [number, number] {
  const m = Math.hypot(x, y);
  if (m <= dz) return [0, 0];
  const t = Math.min(1, (m - dz) / Math.max(0.05, 0.95 - dz)),
    k = t / m;
  return [x * k, y * k];
}

export interface PadState {
  /** left stick after the dead-zone (-1..1) */
  lx: number;
  ly: number;
  /** steering value: the D-pad wins over the stick */
  ax: number;
  /** stick or D-pad as arrow keys */
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  /** held / pressed this frame / released this frame */
  btn: boolean[];
  hit: boolean[];
  rel: boolean[];
  /** first button pressed this frame (-1 none) */
  firstHit: number;
  /** "someone is really using the pad" */
  strong: boolean;
}

const st: PadState = {
  lx: 0,
  ly: 0,
  ax: 0,
  left: false,
  right: false,
  up: false,
  down: false,
  btn: new Array(NB).fill(false),
  hit: new Array(NB).fill(false),
  rel: new Array(NB).fill(false),
  firstHit: -1,
  strong: false,
};
let cur = -1,
  last: Gamepad | null = null,
  sl = false,
  sr = false,
  su = false,
  sd = false;

function pick(): Gamepad | null {
  let list: ArrayLike<Gamepad | null> = [];
  try {
    list = navigator.getGamepads ? navigator.getGamepads() : [];
  } catch {
    list = [];
  }
  let best: Gamepad | null = null;
  for (let i = 0; i < list.length; i++) {
    const g = list[i];
    if (!g || g.connected === false) continue;
    if (g.index === cur) return g;
    if (!best || (g.mapping === 'standard' && best.mapping !== 'standard')) best = g;
  }
  return best;
}

interface LegacyHaptics {
  hapticActuators?: { pulse?: (value: number, ms: number) => unknown }[];
}

export const pad = {
  st,
  connected: false,
  id: '',
  kind: 'ps' as PadKind,
  label: 'CONTROLLER',
  enabled: true,
  name(i: number | null | undefined): string {
    return i == null ? '—' : NAMES[this.kind === 'xbox' ? 'xbox' : 'ps'][i] || 'BTN ' + i;
  },
  glyph(i: number): PadGlyph {
    return glyphOf(this.kind, i);
  },
  /** read the pad once per frame; dz is the stick dead-zone (0..0.5). Returns whether a pad is connected. */
  poll(dz: number): boolean {
    const g = pick();
    if (!g) {
      if (this.connected) {
        this.connected = false;
        cur = -1;
        last = null;
      }
      st.lx = st.ly = st.ax = 0;
      st.left = st.right = st.up = st.down = false;
      st.strong = false;
      st.firstHit = -1;
      for (let i = 0; i < NB; i++) st.btn[i] = st.hit[i] = st.rel[i] = false;
      return false;
    }
    const fresh = !this.connected || g.index !== cur; // the press that wakes a pad up must not also act
    cur = g.index;
    last = g;
    if (fresh) {
      this.id = g.id;
      this.kind = kindOf(g.id);
      this.label = labelOf(g.id, this.kind);
    }
    this.connected = true;
    st.firstHit = -1;
    let any = false;
    for (let i = 0; i < NB; i++) {
      const b = g.buttons[i],
        v = b ? b.value || 0 : 0;
      // triggers have hysteresis so a half-squeezed trigger doesn't chatter
      const on =
        !!b &&
        (i === 6 || i === 7 ? b.pressed || v > (st.btn[i] ? 0.2 : 0.35) : b.pressed || v > 0.5);
      st.hit[i] = on && !st.btn[i] && !fresh;
      st.rel[i] = !on && st.btn[i];
      if (st.hit[i]) {
        any = true;
        if (st.firstHit < 0) st.firstHit = i;
      }
      st.btn[i] = on;
    }
    const [x, y] = deadZone(g.axes[0] || 0, g.axes[1] || 0, dz);
    st.lx = x;
    st.ly = y;
    // stick-as-arrows with hysteresis: press past 0.55, release under 0.4
    sl = sl ? x < -0.4 : x < -0.55;
    sr = sr ? x > 0.4 : x > 0.55;
    su = su ? y < -0.4 : y < -0.55;
    sd = sd ? y > 0.4 : y > 0.55;
    const dl = st.btn[14],
      dr = st.btn[15],
      du = st.btn[12],
      dd = st.btn[13];
    st.left = dl || sl;
    st.right = dr || sr;
    st.up = du || su;
    st.down = dd || sd;
    st.ax = dl !== dr ? (dr ? 1 : -1) : x;
    st.strong = any || Math.abs(x) > 0.7 || Math.abs(y) > 0.7;
    return true;
  },
  /** haptics: strong = low rumble motor, weak = high one, ms = length */
  rumble(strong: number, weak: number, ms: number): void {
    if (!this.enabled || !last) return;
    try {
      const a = last.vibrationActuator as GamepadHapticActuator | null | undefined;
      const legacy = (last as unknown as LegacyHaptics).hapticActuators;
      if (a && a.playEffect) {
        const p = a.playEffect('dual-rumble', {
          startDelay: 0,
          duration: ms,
          weakMagnitude: Math.min(1, weak),
          strongMagnitude: Math.min(1, strong),
        });
        if (p && p.catch) p.catch(() => {});
      } else if (legacy && legacy[0] && legacy[0].pulse) {
        legacy[0].pulse(Math.min(1, Math.max(strong, weak)), ms);
      }
    } catch {
      /* no haptics here */
    }
  },
};

export type Pad = typeof pad;
ND.pad = pad;
