// @ts-nocheck -- ported as-is from the single-file build; not strictly typed yet (see docs/structure.md)

/* CYBERSLIDE - tutorial: short practice courses that teach by doing.
   Each chapter is a little repeating course (see ND.world.setPlan) plus a list of steps. A step is finished by a player event
   or by something the rider does (hold a key, reach a side), so it never needs a perfect run: a wipeout just means try again.
   main.js hands over what the tutorial needs from the game through attach(); everything on screen for it lives here. */

import { ND } from './nd';
import { rampSum } from './course';

const SEG = ND.SEG || 70;
const $ = (id) => document.getElementById(id);
const PKEY = 'cyberslide-played';
let H = null, P = null;
let ci = 0, si = 0, n = 0, ctx = {}, active = false, grace = 0, finishing = 0, results = [], armed = false, lastText = '', lastStep = -1, cardTimer = 0;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// on a touch screen the four buttons get their own colours, like the buttons on screen (styles.css: .tt-text kbd.tb)
const TOUCH_BTN = { JUMP: 1, FLIP: 1, GRAB: 1, SPIN: 1 };
const kbd = (t) => (TOUCH_BTN[t] ? '<kbd class="tb ' + t.toLowerCase() + '">' : '<kbd>') + esc(t) + '</kbd>';
const K = (a) => kbd(H ? H.key(a) : a);
const GLYPH = { U: '↑', D: '↓', L: '←', R: '→', UL: '↖', UR: '↗', DL: '↙', DR: '↘' };
/* "← then A" for a named trick, using the key the player has bound to flip / grab */
const trickKeys = (name) => {
  const d = ND.TRICKS.find((t) => t.name === name);
  if (!d) return '';
  const b = kbd(H.btn(d.btn));
  return d.seq.length ? d.seq.map((k) => kbd(GLYPH[k])).join(' ') + ' then ' + b : b + ' alone';
};
const isGrab = (name) => { const d = ND.TRICKS.find((t) => t.name === name); return !!d && d.btn === 'D' && !d.sp; };
const landed = (min) => (e, d) => e === 'land' && d.air >= min;
const parts = (d) => d.parts || [d.name || ''];   // a mixed trick (spin + kickflip in one jump) lists every part
const named = (re) => (e, d) => e === 'trick' && parts(d).some((n) => re.test(n));
/* popping a jump while still on the ramp (or right at its lip) is hitting the ramp too, not just rolling off it */
const onRamp = () => rampSum(P.x, P.s) > 0.1 || rampSum(P.x, P.s - 2) > 0.1;
const wallSide = () => {
  const k0 = Math.floor(P.s / SEG);
  for (let k = k0; k <= k0 + 5; k++) for (const w of ND.seg(k).walls) if (w.s + w.len > P.s) return w.side;
  return 0;
};

/* ---------- the curriculum ---------- */
const CH = [
  {
    id: 'basics', name: 'THE BASICS', cap: 20, plan: () => 'clear',
    sub: 'A flat slope with nothing in the way. Take your time.',
    steps: [
      { badge: 'CARVE', title: 'CARVE', need: 2,
        text: () => 'Hold ' + K('left') + ' to carve left, ' + K('right') + ' to carve right.<br><span class="dim">Reach both sides of the slope.</span>',
        tick: (dt, c) => { if (P.x <= -3) c.l = 1; if (P.x >= 3) c.r = 1; return (c.l | 0) + (c.r | 0); } },
      { badge: 'BRAKE', title: 'BRAKE', need: 1,
        text: () => 'Hold ' + K('down') + ' to brake: your rider powerslides to slow down.',
        tick: (dt, c, inp) => { if (inp.down && P.state === 'ride') c.t = (c.t || 0) + dt; c.p = (c.t || 0) / 0.7; return c.p >= 1 ? 1 : 0; }, prog: (c) => c.p || 0 },
      { badge: 'JUMP', title: 'JUMP', need: 3, ev: landed(0.35),
        text: () => 'Hold ' + K('space') + ' to crouch, then <b>release</b> to jump.<br><span class="dim">Land on your feet. Three jumps.</span>' },
      { badge: 'BIG JUMP', title: 'JUMP HIGHER', need: 1, ev: landed(1.0),
        text: () => 'The longer you hold ' + K('space') + ', the higher you go.<br><span class="dim">Crouch all the way down, then let go.</span>' },
      { badge: 'KICKFLIP', title: 'KICKFLIP', need: 1, ev: named(/^Kickflip$/),
        text: () => 'In the air: ' + trickKeys('Kickflip') + '.<br><span class="dim">Arrow first, button right after. Then land it.</span>' },
      { badge: 'GRAB', title: 'GRAB', need: 3, ev: (e, d) => e === 'trick' && parts(d).some(isGrab),
        text: () => 'In the air: press ' + K('grab') + ' to grab the board.<br><span class="dim">Tricks count when you land. Three grabs.</span>' },
      { badge: '180', title: '180 SPIN', need: 3, ev: named(/^\d+( SWITCH)?$/),
        text: () => 'In the air: hold ' + K('trick') + ' and press ' + K('left') + ' or ' + K('right') + '.<br><span class="dim">Half a turn, then land. Landing backwards is fine. Three spins.</span>' },
      { badge: 'FLIP', title: 'FRONTFLIP OR BACKFLIP', need: 1, ev: named(/(BACK|FRONT)FLIP/),
        text: () => 'In the air: hold ' + K('trick') + ' and press ' + K('up') + ' (frontflip) or ' + K('down') + ' (backflip).<br><span class="dim">Needs a high jump. Land it clean.</span>' },
      { badge: 'DIAGONAL', title: 'DIAGONAL FLIP', need: 1,
        ev: (e, d) => e === 'trick' && parts(d).some((n) => /(BACK|FRONT)FLIP/.test(n)) && parts(d).some((n) => /^\d+$/.test(n)),   // a spin and a flip in one jump
        text: () => 'Spin <b>and</b> flip at once: hold ' + K('trick') + ' and press two arrows together, like ' + K('left') + ' + ' + K('down') + '.<br><span class="dim">Needs a high jump. Hold for about half a second, then let go and land.</span>' },
      { badge: 'COMBO', title: 'COMBO & BANK', need: 1, ev: (e) => e === 'bank' && P.combo.entries >= 2,
        text: () => 'Land <b>two tricks</b>, then ride on for 2 s without tricking: the combo <b>banks</b>.<br><span class="dim">A wipeout loses the combo, so bank it!</span>' }
    ]
  },
  {
    id: 'ramps', name: 'RAMPS & LANDINGS', cap: 22, plan: (i) => ['tutramp', 'clear', 'tutramp', 'clear', 'tutbar', 'clear'][(i + 5) % 6],
    sub: 'Ramps give you air. Good landings give you speed.',
    steps: [
      { badge: 'RAMP', title: 'HIT THE RAMP', need: 1, ev: (e) => e === 'launch' || (e === 'jump' && onRamp()),
        text: () => 'Ride straight into the ramp and fly.<br><span class="dim">Do a trick on the way up!</span>' },
      { badge: 'PERFECT', title: 'PERFECT LANDING', need: 3, ev: (e) => e === 'perfect',
        text: () => 'A ring shows where you will land. When it turns <b>gold</b>, tap ' + K('space') + ' just before touchdown.<br><span class="dim">A perfect landing fixes any rotation. Three of them.</span>' },
      { badge: 'SPECIAL', title: 'SPECIAL TRICK', need: 1,
        enter: () => P.fill(1),
        ev: (e, d, c) => { if (e === 'respawn' && P.special < 1) P.fill(1); return e === 'special'; },
        text: () => 'Your special meter is full. In the air: ' + trickKeys('Triple Kickflip') + '.<br><span class="dim">Specials pay big. Tricks fill the meter again.</span>' },
      { badge: 'HAZARDS', title: 'BARRIERS', need: 1,
        ev: (e, d, c) => { if (e === 'crash') c.hit = Math.floor(P.s / SEG); return false; },
        tick: (dt, c) => { const k = Math.floor(P.s / SEG); if (ND.kindAt(k) === 'tutbar' && P.s - k * SEG > 58 && c.done !== k) { c.done = k; if (c.hit !== k) return 1; } return 0; },
        text: () => 'Barriers ahead! Steer around them with ' + K('left') + ' and ' + K('right') + ', or jump over.<br><span class="dim">Hitting one is a wipeout. Get past a full row.</span>' }
    ]
  },
  {
    id: 'rails', name: 'RAILS', cap: 22, plan: (i) => (i % 2 === 1 ? 'tutrail' : 'clear'),
    sub: 'Land on a rail to grind it. Higher rails pay more.',
    steps: [
      { badge: 'GRIND', title: 'LAND ON THE RAIL', need: 1, ev: (e) => e === 'grindStart',
        text: () => 'Ride up the ramp and land on the rail. Aim for the middle.<br><span class="dim">Your board locks on and slides along it.</span>' },
      { badge: 'SWITCH', title: 'SWITCH YOUR GRIND', need: 1, ev: named(/(BOARDSLIDE|LIPSLIDE|NOSEGRIND|TAILSLIDE) GRIND/),
        text: () => 'While grinding, hold ' + K('trick') + ' and press an arrow to change the grind.<br><span class="dim">Every new grind adds to your combo. ' + K('space') + ' hops off.</span>' }
    ]
  },
  {
    id: 'pipe', name: 'SIDE PIPE', cap: 24, plan: (i) => (i % 4 === 1 ? 'pipe' : 'clear'),
    sub: 'Ride up a big wall for mega air.',
    steps: [
      { badge: 'MEGA AIR', title: 'LAUNCH OFF THE WALL', need: 1, ev: (e) => e === 'mega',
        text: () => {
          const s = wallSide(), side = s < 0 ? 'left' : s > 0 ? 'right' : '';
          return side
            ? 'A big wall runs along your <b>' + side + '</b> side. Steer into it with ' + K(side) + ' and keep going: it throws you into the sky.<br><span class="dim">Do tricks up there, then land back on the wall.</span>'
            : 'A big wall is coming up. Steer into it and keep going: it throws you into the sky.';
        } }
    ]
  }
];

const PRAISE = ['NICE!', 'CLEAN!', 'SMOOTH!', 'YES!', 'LOCKED IN!', 'SICK!', 'THERE IT IS!'];

/* ---------- on screen ---------- */
const el = {};
const grab = () => {
  ['tut', 'tutChap', 'tutNum', 'tutTitle', 'tutText', 'tutPips', 'tutBar', 'tutCard', 'tcSmall', 'tcName', 'tcSub', 'tutOk'].forEach((k) => { el[k] = $(k); });
};
const cur = () => CH[ci].steps[si];
function render(force) {
  if (!active || !el.tut) return;
  const ch = CH[ci], st = ch.steps[si];
  if (!st) return;
  if (si !== lastStep || force) {
    lastStep = si; lastText = '';
    el.tutChap.textContent = 'TRAINING // CH.' + String(ci + 1).padStart(2, '0') + ' ' + ch.name;
    el.tutNum.textContent = String(si + 1).padStart(2, '0') + ' / ' + String(ch.steps.length).padStart(2, '0');
    el.tut.classList.remove('step'); void el.tut.offsetWidth; el.tut.classList.add('step');
    el.tutTitle.textContent = st.title;
    el.tutPips.textContent = '';
    for (let i = 0; i < st.need; i++) el.tutPips.appendChild(document.createElement('i'));
    el.tutBar.parentElement.classList.toggle('show', !!st.prog);
  }
  const t = st.text();
  if (t !== lastText) { el.tutText.innerHTML = t; lastText = t; }
  [...el.tutPips.children].forEach((p, i) => p.classList.toggle('on', i < n));
  if (st.prog) el.tutBar.style.width = Math.round(Math.min(1, st.prog(ctx)) * 100) + '%';
}
function pop(text, sub) {
  el.tutOk.innerHTML = esc(text) + (sub ? '<small>' + esc(sub) + '</small>' : '');
  el.tutOk.className = ''; void el.tutOk.offsetWidth; el.tutOk.className = 'show';
}
let flashT = 0;
function flashPanel() { clearTimeout(flashT); el.tut.classList.remove('done'); void el.tut.offsetWidth; el.tut.classList.add('done'); flashT = setTimeout(() => el.tut.classList.remove('done'), 1100); }
function showCard(ch) {
  clearTimeout(cardTimer);
  el.tcSmall.textContent = 'CHAPTER ' + String(ci + 1).padStart(2, '0') + ' / ' + String(CH.length).padStart(2, '0'); el.tcName.textContent = ch.name; el.tcSub.textContent = ch.sub;
  el.tutCard.className = ''; void el.tutCard.offsetWidth; el.tutCard.className = 'show';
  cardTimer = setTimeout(() => { el.tutCard.className = 'out'; cardTimer = setTimeout(() => { el.tutCard.className = ''; }, 700); }, 2600);
}
function hideAll() {
  clearTimeout(cardTimer);
  if (el.tut) { el.tut.hidden = true; el.tutCard.className = ''; el.tutOk.className = ''; }
}

/* ---------- flow ---------- */
function enterStep() {
  n = 0; ctx = {}; grace = 0.45; lastStep = -1;
  const st = cur();
  if (st.enter) st.enter(ctx);
  render(true);
}
function stepDone(skipped) {
  results[si] = skipped ? 'skip' : 'done';
  const st = cur();
  if (!skipped) {
    n = st.need; render();
    pop(PRAISE[Math.floor(Math.random() * PRAISE.length)], st.badge + ' LEARNED');
    flashPanel(); H.sfx('step'); H.pulse();
  } else H.sfx('ui');
  si++;
  if (si >= CH[ci].steps.length) { chapterDone(skipped); return; }
  enterStep();
}
function chapterDone(skipped) {
  if (skipped) { finishing = 0.05; return; }   // skipping the last step moves on without the fanfare
  finishing = 1.7;
  el.tutText.innerHTML = '<b>CHAPTER COMPLETE!</b>';
  el.tutTitle.textContent = CH[ci].name;
  el.tutPips.textContent = ''; el.tutBar.parentElement.classList.remove('show');
  setTimeout(() => { if (active) { pop('CHAPTER CLEAR!', CH[ci].name); H.burst(); H.sfx('fanfare'); } }, 650);
}
function summary() {
  const ch = CH[ci];
  return {
    ci, last: ci === CH.length - 1, name: ch.name, total: CH.length,
    badges: ch.steps.map((s, i) => ({ badge: s.badge, ok: results[i] === 'done' })),
    tricks: P.stats.tricks, bestCombo: P.stats.bestCombo, grinds: P.stats.grinds
  };
}

ND.tutorial = {
  CHAPTERS: CH,
  get active() { return active; },
  get chapter() { return ci; },
  attach(h) { H = h; P = h.player; grab(); },
  played() { try { return !!localStorage.getItem(PKEY); } catch (e) { return false; } },
  markPlayed() { try { localStorage.setItem(PKEY, '1'); } catch (e) { /* ignore */ } },
  cap() { return CH[ci].cap; },
  /* start (or restart) chapter i: the world switches to its course, main.js resets the rider */
  begin(i) {
    ci = Math.max(0, Math.min(CH.length - 1, i | 0)); si = 0; results = []; finishing = 0; armed = false;
    active = true;
    document.body.classList.add('tutmode');
    ND.world.setPlan(CH[ci].plan);
    el.tut.hidden = false;
    enterStep(); showCard(CH[ci]);
    return CH[ci];
  },
  end() {
    if (!active) return;
    active = false; finishing = 0;
    document.body.classList.remove('tutmode');
    hideAll();
    ND.world.setPlan(null);
  },
  event(e, d) {
    if (!active || finishing || grace > 0) return;
    const st = cur(); if (!st) return;
    if (st.ev && st.ev(e, d || {}, ctx)) {
      n++;
      if (n >= st.need) stepDone(false); else { H.sfx('tick'); render(); }
    }
  },
  update(dt, inp) {
    if (!active) return;
    if (finishing > 0) {
      finishing -= dt;
      if (finishing <= 0) { finishing = 0; active = true; P.bank(); H.done(summary()); }
      return;
    }
    if (grace > 0) grace -= dt;
    else {
      const st = cur();
      if (st && st.tick) {
        const v = st.tick(dt, ctx, inp);
        if (typeof v === 'number' && v > n) { n = v; if (n >= st.need) { stepDone(false); return; } H.sfx('tick'); }
      }
    }
    render();
  },
  skipStep() { if (active && !finishing) stepDone(true); },
  skipChapter() {
    if (!active) return;
    for (let i = si; i < CH[ci].steps.length; i++) results[i] = results[i] || 'skip';
    si = CH[ci].steps.length; finishing = 0; P.bank(); H.done(summary());
  },
  finishedAll() { this.markPlayed(); }
};
