// @ts-nocheck -- ported as-is from index.html; typed step by step

/* CYBERSLIDE - trick list: flip tricks (A), grab tricks (D) and specials.
   seq: arrow inputs tapped before the button, U D L R and diagonals UL UR DL DR (empty = button alone)
   b: board turns [nose-over-tail, spin, roll]; yaw/flip: whole-rider turns (landing must match); by: upper-body spin
   p: pose [board lift, nose tilt, roll, near arm, far arm, body drop]; sp: special (needs a full meter) */

import { ND } from './nd';

const L = [];
const add = (btn, name, seq, pts, o) => L.push(Object.assign({ btn, name, seq: seq ? seq.split(' ') : [], pts, dur: 0.55, sp: false }, o));
const A = (n, s, p, o) => add('A', n, s, p, o);
const D = (n, s, p, o) => add('D', n, s, p, o);
const S = (b, n, s, p, o) => add(b, n, s, p, Object.assign({ sp: true, dur: 0.7 }, o));

/* ---- flip tricks (A) ---- */
A('Shove-It', '', 80, { b: [0, 0.5, 0], dur: 0.4 });
A('Pop Shove-It', 'U', 100, { b: [0, 0.5, 0], dur: 0.42 });
A('FS Shove-It', 'D', 100, { b: [0, -0.5, 0], dur: 0.42 });
A('Kickflip', 'L', 150, { b: [0, 0, 1], dur: 0.5 });
A('Heelflip', 'R', 150, { b: [0, 0, -1], dur: 0.5 });
A('Impossible', 'DR DR', 250, { b: [1, 0, 0], dur: 0.55 });
A('Body Varial', 'R R', 160, { by: 0.5, dur: 0.5 });
A('Varial Kickflip', 'UL', 220, { b: [0, 0.5, 1], dur: 0.55 });
A('Varial Heelflip', 'UR', 220, { b: [0, 0.5, -1], dur: 0.55 });
A('360 Shove-It', 'D D', 200, { b: [0, 1, 0], dur: 0.55 });
A('Hardflip', 'UL UL', 260, { b: [0, -0.5, 1], lift: 0.25, dur: 0.55 });
A('Ollie North', 'U U', 120, { p: [0.2, -0.9, 0, -0.3, 1.0, -0.1], dur: 0.45 });
A('360 Flip', 'DL DL', 300, { b: [0, 1, 1], dur: 0.6 });
A('Inward Heelflip', 'DL', 260, { b: [0, -0.5, -1], dur: 0.55 });
A('Front Foot Impossible', 'DR', 280, { b: [1, 0, 1], dur: 0.6 });
A('Kickflip to Indy', 'UR UR', 300, { b: [0, 0, 1], p: [0.5, 0, 0, -0.15, 1.1, -0.12], dur: 0.6 });
A('Heelflip Varial Lien', 'L L', 320, { b: [0, 0.5, -1], p: [0.4, -0.5, 0, -0.4, 1.0, -0.1], dur: 0.6 });

/* ---- grab tricks (D) ---- */
const G = (n, s, p, pose) => D(n, s, p, { p: pose, dur: 0.6 });
G('Mute', '', 80, [0.45, 0, 0, -0.15, 1.1, -0.12]);
G('Melon', 'L', 100, [0.5, 0, -0.3, -0.15, 1.1, -0.1]);
G('Stalefish', 'DR', 130, [0.55, 0, 0.35, -0.1, 1.15, -0.12]);
G('Benihana', 'DL', 150, [0.5, 0.2, -0.45, -0.15, 1.1, -0.12]);
G('Roastbeef', 'L L', 120, [0.5, 0, 0.5, -0.1, 1.2, -0.1]);
G('Nosegrab', 'U', 90, [0.5, -0.55, 0, -0.15, 1.1, -0.12]);
G('Indy Nosebone', 'UR', 130, [0.5, -0.5, 0.3, -0.15, 1.1, -0.12]);
G('Tailgrab', 'D', 90, [0.5, 0.55, 0, -0.15, 1.1, -0.12]);
G('Indy', 'R', 100, [0.5, 0, 0, -0.15, 1.1, -0.12]);
G('Japan Air', 'UL', 130, [0.62, 0, -0.5, -0.15, 1.1, -0.12]);
G('Method', 'R R', 130, [0.62, 0, 0.55, -0.6, 1.3, -0.14]);
G('Rocket Air', 'U U', 150, [0.55, -0.9, 0, -0.2, 1.0, -0.12]);
G('Crossbone', 'UL UL', 160, [0.55, 0.1, -0.7, -0.1, 1.2, -0.12]);
G('Airwalk', 'D D', 160, [0.4, 0, 0, -0.9, 0.9, -0.1]);
G('Judo', 'DR DR', 170, [0.55, 0, 0.9, -0.3, 1.3, -0.14]);
G('Indy Stiffy', 'D DL', 140, [0.5, 0.3, 0, -0.15, 1.1, -0.12]);
G('Madonna', 'UR UR', 150, [0.55, -0.3, 0.4, -0.2, 1.2, -0.12]);
G('Varial', 'DL DL', 140, [0.5, 0, -0.8, -0.15, 1.1, -0.12]);
G('Sal Flip', 'U UL', 220, [0.5, -0.4, -0.6, -0.2, 1.1, -0.12]);

/* ---- specials: flip based (A) ---- */
S('A', 'Triple Kickflip', 'U L', 800, { b: [0, 0, 3] });
S('A', 'Hardflip Late Flip', 'U D', 850, { b: [1, -0.5, 1] });
S('A', 'Double Hardflip', 'R D', 900, { b: [0, -1, 2] });
S('A', '540 Flip', 'R U', 1000, { b: [0, 0, 1], yaw: 1.5, dur: 0.8 });
S('A', 'Shove it Rewind', 'UR UL', 950, { b: [0, 2, 0] });
S('A', 'Laser Flip', 'D R', 1100, { b: [1, 1, 1], dur: 0.75 });
S('A', 'Kickflip Mc Twist', 'D L', 1100, { b: [0, 0, 1], yaw: 1.5, flip: 1, dur: 0.9 });
S('A', 'Triple Heelflip', 'U R', 900, { b: [0, 0, -3] });
S('A', 'Half Flip Casper', 'R L', 1000, { b: [0, 0.5, 1], p: [0.7, 0.3, 0, -0.3, 1.0, -0.2] });
S('A', 'Hospital Flip', 'L R', 1000, { b: [1, 0, 1], p: [0.4, 0, 0, -1.2, 1.2, -0.2] });
S('A', 'Kickflip 1 Foot Tail', 'L U', 1100, { b: [0, 0, 1], p: [0.6, 0.6, 0, -0.2, 1.4, -0.1], dur: 0.8 });
S('A', 'Ghetto Bird', 'D U', 1200, { b: [0, 1, 2], dur: 0.8 });
S('A', 'Does W. a Spider Can', 'L D', 1800, { b: [0, 0, 2], p: [0.5, 0, 0, -2.2, 2.2, -0.35], dur: 0.8 });

/* ---- specials: grab based (D) ---- */
S('D', 'Fingerflip Airwalk', 'L R', 1000, { b: [0, 0, 1], p: [0.4, 0, 0, -0.9, 0.9, -0.1] });
S('D', 'Christ Air', 'U L', 1000, { p: [0.5, 0, 0, -1.5, 1.5, -0.05], dur: 0.8 });
S('D', 'FS-540', 'R L', 1200, { yaw: 1.5, p: [0.5, 0, 0.5, -0.2, 1.2, -0.12], dur: 0.9 });
S('D', 'Sacktap', 'U D', 1100, { p: [0.55, 0.2, 0.3, -0.4, 1.5, -0.25] });
S('D', 'Racket Air', 'D L', 1100, { p: [0.5, 0, 0, -1.6, 0.4, -0.15] });
S('D', '1 Foot Japan', 'U R', 1100, { p: [0.6, 0, -0.6, -0.3, 1.4, -0.1] });
S('D', 'Indy Frontflip', 'D U', 1300, { flip: -1, p: [0.5, 0, 0, -0.15, 1.1, -0.12], dur: 0.75 });
S('D', 'Pizza Guy', 'D R', 1300, { yaw: 1, p: [0.5, 0, 0, -1.0, 1.9, -0.2], dur: 0.75 });
S('D', 'Mute Backflip', 'L U', 1400, { flip: 1, p: [0.45, 0, 0, -0.15, 1.1, -0.12], dur: 0.75 });
S('D', 'Indy Backflip', 'R U', 1400, { flip: 1, p: [0.5, 0, 0, -0.15, 1.1, -0.12], dur: 0.75 });
S('D', 'The 900', 'R D', 2000, { yaw: 2.5, p: [0.45, 0, 0, -0.4, 1.0, -0.12], dur: 0.95 });
S('D', 'Assume the Position', 'DL DR', 1500, { p: [0.3, 0, 0, -0.1, 0.1, -0.4], dur: 0.8 });
S('D', 'Salute!!!', 'L D', 1600, { p: [0.4, 0, 0, -0.2, -2.8, -0.1], dur: 0.8 });
S('D', 'Spidey Flip', 'UL UR', 1800, { flip: 1, p: [0.5, 0, 0, -2.2, 2.2, -0.3], dur: 0.9 });
S('D', 'Double Splits', 'DR DL', 1800, { p: [0.6, 0, 0, -1.6, 1.6, -0.45], dur: 0.8 });

// harder tricks pay disproportionately more; specials pay the most
L.forEach((t) => { t.pts = Math.round(t.pts * (t.sp ? 4.5 : t.pts >= 250 ? 3 : 2) / 10) * 10; });
ND.TRICKS = L;
ND.TRICK_BY_KEY = {};
L.forEach((t) => { ND.TRICK_BY_KEY[t.btn + '|' + t.seq.join(' ')] = t; });
const GLYPH = { U: '\u2191', D: '\u2193', L: '\u2190', R: '\u2192', UL: '\u2196', UR: '\u2197', DL: '\u2199', DR: '\u2198' };
ND.trickInput = (t) => {
  const g = t.seq.map((k) => GLYPH[k]).join(' ');
  const b = ND.btnLabel ? ND.btnLabel(t.btn) : t.btn;   // shows the key the player has bound to flip / grab
  if (!t.seq.length) return b + ' alone';
  return ND.TRICK_INPUT === 'hold' ? b + ' + ' + g : g + ' + ' + b;
};
