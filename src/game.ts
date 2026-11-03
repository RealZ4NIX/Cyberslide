// @ts-nocheck -- ported as-is from the single-file build; not strictly typed yet (see docs/structure.md)

/* CYBERSLIDE - main: renderer, camera, input, HUD, modes */

import * as THREE from 'three';
import { ND } from './nd';
import { secretCode } from './secretCode';

export function boot(): void {
  const $ = (id) => document.getElementById(id);
  const canvas = $('c');

  /* ---------- settings (saved in localStorage) ---------- */
  const SKEY = 'cyberslide-settings';
  const GAME_ACTS = ['left', 'right', 'up', 'down', 'space', 'trick', 'grab', 'flip'];   // these feed the player's input
  const DEF_KEYS = {
    left: ['ArrowLeft', null], right: ['ArrowRight', null], up: ['ArrowUp', null], down: ['ArrowDown', null], space: ['Space', null],
    trick: ['KeyS', 'KeyJ'], grab: ['KeyD', 'KeyK'], flip: ['KeyA', 'KeyL'], restart: ['KeyR', null], mute: ['KeyM', null], pause: ['KeyP', null]
  };
  const DEF = { music: 100, sfx: 100, mute: false, chips: true, res: 300, fx: 1, fov: 62, crt: false, fps: false, padDead: 15, rumble: true };
  // controller buttons (standard mapping indexes: 0 cross, 1 circle, 2 square, 3 triangle, 4 L1, 5 R1, 6 L2, 7 R2, 8 create, 9 options, 10 L3, 11 R3, 17 touchpad)
  const DEF_PAD = { space: [0, null], trick: [6, 7], grab: [1, null], flip: [2, null], restart: [8, null], pause: [9, null], mute: [17, null] };
  const PAD_RESERVED = [12, 13, 14, 15, 16];   // D-pad (steering and menus) and the PS button
  const RESERVED = /^(Escape|Tab|Enter|NumpadEnter|Digit1|Digit2|Meta.*|Alt.*|Control.*|F\d+|ContextMenu|NumLock|PrintScreen|ScrollLock|Pause)$/;
  const KEY_NAMES = { ArrowLeft: '\u2190', ArrowRight: '\u2192', ArrowUp: '\u2191', ArrowDown: '\u2193', Space: 'SPACE', ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT',
    Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/',
    Backspace: 'BKSP', CapsLock: 'CAPS', Delete: 'DEL', Insert: 'INS', Home: 'HOME', End: 'END', PageUp: 'PG UP', PageDown: 'PG DN' };
  const S = (function () {
    let o = {};
    try { o = JSON.parse(localStorage.getItem(SKEY) || '{}') || {}; } catch (e) { o = {}; }
    const s = Object.assign({}, DEF);
    for (const k in DEF) if (typeof o[k] === typeof DEF[k]) s[k] = o[k];
    s.music = Math.max(0, Math.min(100, s.music)); s.sfx = Math.max(0, Math.min(100, s.sfx));
    if (![240, 300, 450, 720].includes(s.res)) s.res = 300;
    if (![0, 0.5, 1].includes(s.fx)) s.fx = 1;
    s.fov = Math.max(50, Math.min(90, s.fov));
    s.padDead = Math.max(5, Math.min(40, Math.round(s.padDead)));
    s.keys = {};
    for (const a in DEF_KEYS) {
      const n = DEF_KEYS[a].length, src = o.keys && Array.isArray(o.keys[a]) ? o.keys[a] : DEF_KEYS[a];
      s.keys[a] = []; for (let i = 0; i < n; i++) s.keys[a].push(typeof src[i] === 'string' && !RESERVED.test(src[i]) ? src[i] : null);
    }
    s.pad = {};
    for (const a in DEF_PAD) {
      const src = o.pad && Array.isArray(o.pad[a]) ? o.pad[a] : DEF_PAD[a];
      s.pad[a] = [0, 1].map((i) => (Number.isInteger(src[i]) && src[i] >= 0 && src[i] < 20 && !PAD_RESERVED.includes(src[i]) ? src[i] : null));
    }
    s.labels = {};   // what the key says on this keyboard layout, learned from key presses
    return s;
  })();
  function saveS() { try { const o = Object.assign({}, S); delete o.labels; localStorage.setItem(SKEY, JSON.stringify(o)); } catch (e) { /* ignore */ } }
  let KEYMAP = {}, ACTKEY = {};
  function buildKeymap() {
    KEYMAP = {}; ACTKEY = {};
    for (const a in S.keys) for (const c of S.keys[a]) if (c) { if (GAME_ACTS.includes(a)) KEYMAP[c] = a; else ACTKEY[c] = a; }
  }
  buildKeymap();
  function keyName(c) {
    if (!c) return '\u2014';
    if (S.labels[c]) return S.labels[c];
    if (KEY_NAMES[c]) return KEY_NAMES[c];
    if (/^Key[A-Z]$/.test(c)) return c.slice(3);
    if (/^Digit\d$/.test(c)) return c.slice(5);
    if (/^Numpad/.test(c)) return 'NUM ' + c.slice(6);
    return c;
  }
  const primary = (a) => S.keys[a].find((c) => c) || null;
  ND.btnLabel = (b) => { const a = b === 'A' ? 'flip' : 'grab', n = actName(a); return n === '\u2014' ? b : n; };   // tricks.js uses it for the combo chips
  function refreshKeyLabels() {
    document.querySelectorAll('[data-k]').forEach((e) => { e.textContent = actName(e.dataset.k); });
    document.querySelectorAll('[data-padk]').forEach((e) => { e.textContent = dev === 'pad' ? actName(e.dataset.padk) : e.dataset.kbt; });   // keys that read differently on a pad
    document.querySelectorAll('[data-kbonly]').forEach((e) => { e.hidden = dev === 'pad'; });
  }
  ND.audio.setMuted(S.mute); ND.audio.setVolumes(S.music / 100, S.sfx / 100);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  } catch (e) {
    $('nogl').hidden = false; return;
  }
  renderer.setPixelRatio(1);
  const FOG = 0x4a1c70;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(FOG, 40, 250);
  scene.background = new THREE.Color(FOG);
  const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.5, 700);
  ND.camera = camera;   // exposed for tests
  scene.add(new THREE.AmbientLight(0x9a86d8, 0.75));
  const key = new THREE.DirectionalLight(0xff8fd8, 0.95); key.position.set(-50, 100, 60); scene.add(key);
  const rim = new THREE.DirectionalLight(0x2ff0ff, 0.4); rim.position.set(60, 30, -80); scene.add(rim);

  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    const ph = S.res, pw = Math.max(160, Math.round(ph * w / h));
    renderer.setSize(pw, ph, false);
    camera.aspect = pw / ph; camera.updateProjectionMatrix();
    if (ND.select) ND.select.resize(pw / ph);
  }
  addEventListener('resize', resize); resize();

  /* ---------- sky + sun ---------- */
  const sky = (function () {
    const geo = new THREE.SphereGeometry(560, 18, 12), col = [], p = geo.attributes.position;
    const stops = [[-1, 0x4a1c70], [0, 0x4a1c70], [0.02, 0xff4fa0], [0.12, 0xc43a9e], [0.3, 0x5a2a9a], [1, 0x0f0636]];
    for (let i = 0; i < p.count; i++) {
      const t = p.getY(i) / 560; let a = stops[0], b = stops[stops.length - 1];
      for (let k = 0; k < stops.length - 1; k++) if (t >= stops[k][0] && t <= stops[k + 1][0]) { a = stops[k]; b = stops[k + 1]; break; }
      const f = b[0] === a[0] ? 0 : (t - a[0]) / (b[0] - a[0]);
      const c = new THREE.Color(a[1]).lerp(new THREE.Color(b[1]), Math.max(0, Math.min(1, f)));
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    m.renderOrder = -2; scene.add(m); return m;
  })();
  const sun = (function () {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 20, 0, 236); gr.addColorStop(0, '#fff06a'); gr.addColorStop(0.55, '#ff8a5a'); gr.addColorStop(1, '#ff2fa8');
    g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 108, 0, 7); g.fill();
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 7; i++) g.fillRect(0, 128 + i * 17, 256, 2 + i * 1.6);
    const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), new THREE.MeshBasicMaterial({ map: t, transparent: true, fog: false, depthWrite: false }));
    m.renderOrder = -1; scene.add(m); return m;
  })();

  /* ---------- snow ---------- */
  const SN = 380, snowRel = [], snowArr = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) snowRel.push({ x: (Math.random() - 0.5) * 60, y: Math.random() * 35 - 10, z: 20 - Math.random() * 100 });
  const snowGeo = new THREE.BufferGeometry(); snowGeo.setAttribute('position', new THREE.BufferAttribute(snowArr, 3));
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.28, sizeAttenuation: true }));
  snow.frustumCulled = false; scene.add(snow);

  /* ---------- world + player ---------- */
  ND.world.init(scene);
  ND.city.init(scene);
  const RIDER_KEY = 'cyberslide-rider';
  try { ND.riderId = localStorage.getItem(RIDER_KEY) || 'nova'; } catch (e) { ND.riderId = 'nova'; }
  if (!ND.RIDERS.some((r) => r.id === ND.riderId)) ND.riderId = 'nova';
  ND.select.init(); ND.select.resize(camera.aspect);
  ND.select.set(ND.RIDERS.findIndex((r) => r.id === ND.riderId), true);
  const player = new ND.Player(scene);
  ND.player = player;
  let lastP = { x: 0, y: 0, s: 0 };

  /* ---------- input ---------- */
  const inp = { left: false, right: false, up: false, down: false, space: false, trick: false, grab: false, flip: false };
  let confirmFrom = null, swallowSpace = false;   // restart confirmation: remembers where to go back to on Esc
  addEventListener('keydown', (e) => {
    if (e.isTrusted !== false) setDevice('kb');
    if (e.key && e.key.length === 1 && e.code !== 'Space' && !e.code.startsWith('Numpad')) S.labels[e.code] = e.key.toUpperCase();
    if (listen) { e.preventDefault(); if (!e.repeat) handleListen(e); return; }
    if (swallowSpace && e.code === 'Space') { e.preventDefault(); return; }   // the Space that confirmed a restart must not also start a jump
    if (!e.repeat && e.key && e.key.length === 1 && secretReady() && skellyKeys.push(e.key.toUpperCase(), performance.now())) unlockSecret();
    if (navKey(e)) return;
    if (state === 'confirm') {
      if (e.code === 'Escape') { e.preventDefault(); if (!e.repeat) cancelConfirm(); }
      return;
    }
    const k = optOpen ? null : KEYMAP[e.code];   // the options screen leaves arrows and Space to its own controls
    if (k) { inp[k] = true; if (state !== 'menu' || e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault(); }
    if (e.repeat) return;
    const act = ACTKEY[e.code];
    if (e.code === 'Escape' || act === 'pause') {
      if (optOpen) { if (e.code === 'Escape') closeOptions(); }
      else if (trOpen) { if (e.code === 'Escape') closeTricks(); }
      else if (boardOpen) { if (e.code === 'Escape') closeBoard(); }
      else if (state === 'play') pause(); else if (state === 'pause') resume(); else if (state === 'tutdone') toMenu();
    }
    else if ((e.code === 'Enter' || e.code === 'NumpadEnter') && state === 'play' && mode === 'tutorial') { e.preventDefault(); ND.tutorial.skipStep(); }
    else if (act === 'mute') toggleMute();
    else if (trOpen || optOpen || boardOpen) return;
    else if (act === 'restart' && (state === 'play' || state === 'pause' || state === 'over')) openConfirm();
    else if (state === 'menu') { if (e.code === 'Digit1') startRun('timed'); else if (e.code === 'Digit2') startRun('endless'); }
  });
  addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) inp[k] = false; if (e.code === 'Space') { swallowSpace = false; if (navName) e.preventDefault(); } });
  addEventListener('blur', () => { for (const k in inp) inp[k] = false; if (state === 'play') pause(); });

  /* ---------- controller: gamepad.js reads the device, this decides what the buttons do ---------- */
  const PADK = ND.pad;
  let dev = 'kb', padSwallow = false, padConn = false, padNavWas = false;   // dev: which device the prompts speak about
  const padIn = { left: false, right: false, up: false, down: false, space: false, trick: false, grab: false, flip: false, ax: 0 };
  const einp = { left: false, right: false, up: false, down: false, space: false, trick: false, grab: false, flip: false, ax: 0 };   // what the game sees: keyboard and controller together
  const padHeld = (a) => S.pad[a].some((i) => i != null && PADK.st.btn[i]);
  const padHit = (a) => S.pad[a].some((i) => i != null && PADK.st.hit[i]);
  const ARROWS = { left: '←', right: '→', up: '↑', down: '↓' };
  function actName(a) {
    if (dev === 'pad') {
      if (ARROWS[a]) return ARROWS[a];
      const b = S.pad[a] && S.pad[a].find((i) => i != null);
      return b != null ? PADK.name(b) : '—';
    }
    return keyName(primary(a));
  }
  function setDevice(d) { if (dev === d) return; dev = d; refreshKeyLabels(); paintNavbar(); }
  let padNoteT = 0;
  function padNote(text) {
    const n = $('padNote'); n.textContent = text; n.classList.add('show');
    clearTimeout(padNoteT); padNoteT = setTimeout(() => n.classList.remove('show'), 2600);
  }
  function toggleMute() { const m = ND.audio.toggleMute(); S.mute = m; saveS(); toast(m ? 'SOUND OFF' : 'SOUND ON', 'info'); if (optOpen) buildOptions(); }
  function padStatus(on) {
    padNote(on ? PADK.label + ' CONNECTED' : 'CONTROLLER DISCONNECTED');
    if (on) { setDevice('pad'); if (optOpen) buildOptions(); }
    else { setDevice('kb'); if (state === 'play') pause(); if (optOpen) buildOptions(); }
  }
  /* haptics */
  function padRumble(n, d) {
    if (!S.rumble || !PADK.connected) return;
    const r = (a, b, ms) => PADK.rumble(a, b, ms);
    if (n === 'land') { if (d.air > 0.3) { const k = Math.min(1, d.air / 2.2); r(0.25 + 0.5 * k, 0.15 + 0.3 * k, 70 + 110 * k); } }
    else if (n === 'perfect') { r(0, 0.8, 110); setTimeout(() => r(0.6, 0.3, 140), 130); }
    else if (n === 'crash') r(1, 0.7, 420);
    else if (n === 'wall') r(0.35, 0.5, 90);
    else if (n === 'mega') r(0.9, 0.5, 260);
    else if (n === 'sky') r(1, 0.7, 340);
    else if (n === 'launch') r(0.5, 0.3, 140);
    else if (n === 'boost') r(0, 0.45, 150);
    else if (n === 'grindStart') r(0.3, 0.2, 90);
    else if (n === 'bank') r(0, 0.5, 120);
    else if (n === 'special') r(0.4, 0.7, 160);
  }
  /* menus: stick or D-pad moves (held = repeats), cross confirms, circle goes back, square deletes a letter on the name entry */
  const NAVH = { up: false, down: false, left: false, right: false }, NAVT = { up: 0, down: 0, left: 0, right: 0 }, nofn = () => {};
  function padNavDir(d, rep) {
    if (navName === 'entry') {
      if (performance.now() < enLockUntil) return;
      entryKey({ code: d === 'up' ? 'ArrowUp' : d === 'down' ? 'ArrowDown' : d === 'left' ? 'ArrowLeft' : 'ArrowRight', key: '', repeat: rep, preventDefault: nofn });
      return;
    }
    if (d === 'up' || d === 'down') navMove(d === 'up' ? -1 : 1);
    else if (navName === 'menu') { if (!rep) riderStep(d === 'left' ? -1 : 1); }
    else if (navName === 'board') { if (!rep) boardTab(d === 'left' ? -1 : 1); }
    else navAdjust(d === 'left' ? -1 : 1, rep);
  }
  function padConfirm() {
    if (navName === 'entry') {
      if (performance.now() < enLockUntil) return;
      if (enName.length) { navSfx('sel'); padSwallow = true; saveEntry(); } else navSfx('early');
      return;
    }
    padSwallow = true; navConfirm();
  }
  function padBack() {
    if (navName === 'entry') { if (performance.now() >= enLockUntil) skipEntry(); return; }
    if (state === 'confirm') cancelConfirm();
    else if (optOpen) closeOptions(); else if (trOpen) closeTricks(); else if (boardOpen) closeBoard();
    else if (state === 'pause') resume(); else if (state === 'tutdone') toMenu();
  }
  function padPauseBtn() {
    if (optOpen || trOpen || boardOpen) return;
    if (state === 'play') pause(); else if (state === 'pause') resume(); else if (state === 'tutdone') toMenu();
  }
  function padSecret(tok) { if (secretReady() && skellyPad.push(tok, performance.now())) unlockSecret(); }
  function padMenu(dt) {
    const P = PADK.st;
    if (P.hit[4]) padSecret('L1');
    if (P.hit[6]) padSecret('L2');
    if (!padNavWas) for (const d in NAVH) { NAVH[d] = P[d]; NAVT[d] = 0.4; }   // a stick already held when the menu opens waits for the next push
    for (const d in NAVH) {
      if (P[d] && !NAVH[d]) { NAVH[d] = true; NAVT[d] = 0.4; padSecret(d); padNavDir(d, false); }
      else if (P[d]) { NAVT[d] -= dt; if (NAVT[d] <= 0) { NAVT[d] = 0.1; padNavDir(d, true); } }
      else NAVH[d] = false;
    }
    if (P.hit[0]) padConfirm();
    else if (P.hit[1]) padBack();
    else if (P.hit[2] && navName === 'entry' && performance.now() >= enLockUntil) { enBack(); paintEntry(); navSfx('nav'); }
    if (padHit('pause')) padPauseBtn();
    else if (padHit('restart') && navName !== 'entry' && (state === 'pause' || state === 'over') && !(trOpen || optOpen || boardOpen)) openConfirm();
  }
  function padFrame(dt) {
    const on = PADK.poll(S.padDead / 100);
    PADK.enabled = S.rumble;
    if (on !== padConn) { padConn = on; padStatus(on); }
    for (const k in padIn) padIn[k] = k === 'ax' ? 0 : false;
    if (on) {
      const P = PADK.st;
      if (P.strong) setDevice('pad');
      if (listen && listen.pad) { if (P.firstHit >= 0) padBind(P.firstHit); }
      else {
        if (padHit('mute')) toggleMute();
        if (navName) padMenu(dt);
        else {
          if (padHit('pause')) padPauseBtn();
          else if (padHit('restart') && state === 'play') openConfirm();
        }
        if (!navName && state === 'play') {
          padIn.left = P.left; padIn.right = P.right; padIn.up = P.up; padIn.down = P.down; padIn.ax = P.ax;
          for (const a of ['space', 'trick', 'grab', 'flip']) padIn[a] = padHeld(a);
          if (padSwallow) { if (padHeld('space')) padIn.space = false; else padSwallow = false; }   // the press that confirmed a menu must not also jump
        }
      }
    }
    padNavWas = !!navName;
    for (const k in einp) einp[k] = k === 'ax' ? padIn.ax : (inp[k] || padIn[k]);
  }
  function padBind(b) {
    const { a, i } = listen;
    if (PAD_RESERVED.includes(b)) { say('That one is used for steering and menus. Pick another button.'); return; }
    let holder = null;
    for (const x in S.pad) S.pad[x].forEach((c, j) => { if (c === b && !(x === a && j === i)) holder = { a: x, i: j }; });
    const prev = S.pad[a][i];
    if (holder) S.pad[holder.a][holder.i] = prev;
    S.pad[a][i] = b;
    stopListen(); padChanged();
    const nm = PADK.name(b);
    say(!holder ? actLabel(a) + ' is now ' + nm + '.' : prev != null ? nm + ' swapped with "' + actLabel(holder.a) + '".' : nm + ' was taken from "' + actLabel(holder.a) + '", which now has no button there.');
  }
  function padChanged() { saveS(); buildOptions(); buildTricks(); refreshKeyLabels(); paintNavbar(); }
  function padSlotBtn(a, i) {
    const v = S.pad[a][i], b = mk('button', 'kb' + (v == null ? ' empty' : ''), PADK.name(v)); b.type = 'button';
    b.dataset.slot = 'p' + a + i; b.setAttribute('aria-label', actLabel(a) + ' button ' + (i + 1) + ': ' + (v == null ? 'not set' : PADK.name(v)) + '. Click to change');
    b.onclick = () => startListen(a, i, b, true);
    return b;
  }

  /* ---------- HUD ---------- */
  const el = {
    score: $('hudScore'), pts: $('hudPts'), mult: $('hudMult'), bar: $('hudBar'), time: $('hudTime'), timeLbl: $('hudTimeLbl'),
    speed: $('hudSpeed'), speedBox: $('speedBox'), boost: $('hudBoost'), dist: $('hudDist'), banner: $('banner'), big: $('big'), feed: $('feed'), combo: $('combo'),
    flash: $('flash'), spec: $('hudSpec'), specBox: $('specBox'), fail: $('fail')
  };
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  function toast(text, cls, input) {
    const d = document.createElement('div'); d.className = 'toast ' + (cls || ''); d.textContent = text;
    if (input && S.chips) { const k = document.createElement('span'); k.className = 'tin'; k.textContent = input; d.appendChild(k); }
    el.feed.appendChild(d);
    while (el.feed.children.length > 6) el.feed.removeChild(el.feed.firstChild);
    setTimeout(() => d.remove(), 2200);
  }
  let bigT = 0;
  function big(text, cls) { el.big.textContent = text; el.big.className = 'show ' + (cls || ''); bigT = 1.1; }
  let lastBanner = '', lastScore = -1, dispScore = 0, failT = 0, slowT = 0;
  function showFail(reason, lost) {
    $('failWhy').textContent = reason || 'Wipeout';
    $('failPts').textContent = '-' + fmt(lost);
    el.fail.className = ''; void el.fail.offsetWidth; el.fail.className = 'show'; failT = 5.2;
    const rf = $('rflash'); rf.className = ''; void rf.offsetWidth; if (S.fx > 0) rf.className = 'on';   // red edge flash
    shake = Math.max(shake, 1.0); fovKick = Math.max(fovKick, 6);                                       // camera slam (scaled by the shake option)
    if (S.fx > 0) slowT = 0.6;                                                                          // brief slow-motion beat
  }
  function hud(dt) {
    if (bigT > 0) { bigT -= dt; if (bigT <= 0 && state !== 'countdown') el.big.className = ''; }
    const live = state === 'play' ? player.liveTrick() : '';
    const risk = state === 'play' && player.landRisk();
    const bkey = live + (risk ? '!' : '');
    if (bkey !== lastBanner) { el.banner.textContent = live; el.banner.className = live ? (risk ? 'on risk' : 'on') : ''; lastBanner = bkey; }
    // the score runs up live with the combo you are building, so it drops back if you fail it
    const target = player.score + (player.combo.active ? Math.round(player.combo.pts * player.mult()) : 0);
    if (target < dispScore) dispScore = target; else dispScore += Math.max(target - dispScore > 0 ? 1 : 0, (target - dispScore) * Math.min(1, dt * 9));
    if (Math.abs(target - dispScore) < 1) dispScore = target;
    const shown = Math.round(dispScore);
    if (shown !== lastScore) { el.score.textContent = fmt(shown); lastScore = shown; }
    el.score.classList.toggle('live', player.combo.active);
    if (failT > 0) { failT -= dt; if (failT <= 0) el.fail.className = ''; }
    const c = player.combo;
    el.combo.className = c.active ? 'on' : '';
    if (c.active) {
      el.pts.textContent = fmt(c.pts); el.mult.textContent = 'x' + player.mult().toFixed(1);
      el.bar.style.width = (state === 'play' && player.state === 'ride' ? Math.max(0, c.timer / 2.2) * 100 : 100) + '%';
    }
    el.speed.textContent = Math.round(player.speed * 3.6);
    el.boost.style.width = (player.boostT > 0 ? Math.min(100, player.boostT / player.boostMax * 100) : 0) + '%';
    el.speedBox.classList.toggle('boost', player.boostT > 0);
    el.dist.textContent = fmt(player.dist) + ' m';
    el.spec.style.width = Math.round(player.special * 100) + '%';
    const full = player.special >= 1;
    el.specBox.classList.toggle('full', full);
    $('specLbl').textContent = full ? 'SPECIAL READY' : 'SPECIAL';
    specFlames(full);
    if (mode === 'timed') { const t = Math.max(0, timeLeft); el.time.textContent = Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0'); el.time.className = t < 10 ? 'low' : ''; }
    else { el.time.textContent = '∞'; el.time.className = ''; }
  }

  /* ---------- last 10 seconds of a 2 min run: big 10, 9, 8 ... countdown with a tick each second ---------- */
  const endEl = $('endCount'); let endN = 0;
  function endCount() {
    if (state === 'pause' || state === 'confirm') return;                      // keep what is showing while paused
    const n = state === 'play' && mode === 'timed' && timeLeft > 0 && timeLeft <= 10 ? Math.ceil(timeLeft) : 0;
    if (n === endN) return;
    endN = n; endEl.className = '';
    if (!n) { endEl.textContent = ''; return; }
    endEl.textContent = String(n); void endEl.offsetWidth;                      // restart the pop animation every second
    endEl.className = 'show' + (n <= 3 ? ' hot' : '');
    ND.audio.sfx(n <= 3 ? 'warn2' : 'warn');
  }

  /* ---------- perfect landing effects ---------- */
  const FXN = 110, fxPos = new Float32Array(FXN * 3), fxCol = new Float32Array(FXN * 3), fxVel = new Float32Array(FXN * 3), fxLife = new Float32Array(FXN);
  for (let i = 0; i < FXN; i++) fxPos[i * 3 + 1] = -999;
  const fxGeo = new THREE.BufferGeometry();
  fxGeo.setAttribute('position', new THREE.BufferAttribute(fxPos, 3));
  fxGeo.setAttribute('color', new THREE.BufferAttribute(fxCol, 3));
  const fxPts = new THREE.Points(fxGeo, new THREE.PointsMaterial({ size: 0.2, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  fxPts.frustumCulled = false; scene.add(fxPts);
  const addMat = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const fxRing = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 40), addMat(0xffd23f)); fxRing.rotation.order = 'YXZ'; fxRing.visible = false; scene.add(fxRing);
  const fxRing2 = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40), addMat(0xff3fd0)); fxRing2.rotation.order = 'YXZ'; fxRing2.visible = false; scene.add(fxRing2);
  const fxPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.1, 14, 16, 1, true), addMat(0xffe27a)); fxPillar.visible = false; scene.add(fxPillar);
  let fxT = 0, fovKick = 0, shake = 0;
  function burst(x, y, s) {
    const pal = [[1, 0.82, 0.25], [1, 1, 0.9], [0.18, 0.94, 1], [1, 0.25, 0.8]];
    for (let i = 0; i < FXN; i++) {
      const a = Math.random() * 6.283, sp = 3 + Math.random() * 9, up = 2 + Math.random() * 8, c = pal[i % pal.length];
      fxPos[i * 3] = x; fxPos[i * 3 + 1] = y + 0.3; fxPos[i * 3 + 2] = -s;
      fxVel[i * 3] = Math.cos(a) * sp; fxVel[i * 3 + 1] = up; fxVel[i * 3 + 2] = Math.sin(a) * sp - player.speed * 0.8;
      fxCol[i * 3] = c[0]; fxCol[i * 3 + 1] = c[1]; fxCol[i * 3 + 2] = c[2];
      fxLife[i] = 0.55 + Math.random() * 0.6;
    }
    fxGeo.attributes.color.needsUpdate = true;
    const dh = ND.H(x + Math.sin(player.heading), s + Math.cos(player.heading)) - y;
    for (const m of [fxRing, fxRing2, fxPillar]) { m.position.set(x, y + 0.2, -s); m.visible = true; }
    for (const m of [fxRing, fxRing2]) m.rotation.set(-Math.PI / 2 + Math.atan(dh), -player.heading, 0);
    fxPillar.position.y = y + 7;
    fxT = 0.001; fovKick = 11; shake = 0.5;
    el.flash.className = ''; void el.flash.offsetWidth; el.flash.className = 'on';
  }
  /* powerslide snow spray: thrown up and out from the sliding board */
  const SPN = 150, spPos = new Float32Array(SPN * 3), spVel = new Float32Array(SPN * 3), spLife = new Float32Array(SPN);
  for (let i = 0; i < SPN; i++) spPos[i * 3 + 1] = -999;
  const spGeo = new THREE.BufferGeometry(); spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
  const spPts = new THREE.Points(spGeo, new THREE.PointsMaterial({ size: 0.26, color: 0xe6f8ff, transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
  spPts.frustumCulled = false; scene.add(spPts);
  let spAcc = 0, spI = 0;
  function updateSpray(dt) {
    if (state === 'play' && player.state === 'ride' && player.slide > 0.3) {
      spAcc += dt * 150 * player.slide * Math.min(1, player.speed / 14);
      const h = player.heading, fx = Math.sin(h), fz = -Math.cos(h), lx = Math.cos(h), lz = Math.sin(h);   // travel direction and the board's sideways axis
      while (spAcc >= 1) {
        spAcc--; const i = spI; spI = (spI + 1) % SPN;
        const along = (Math.random() - 0.5) * 1.5, out = -player.slideDir * (1 + Math.random() * 5.5), up = 1.2 + Math.random() * 4;
        spPos[i * 3] = player.x + lx * along; spPos[i * 3 + 1] = ND.H(player.x, player.s) + 0.15; spPos[i * 3 + 2] = -player.s + lz * along;
        spVel[i * 3] = fx * player.speed * 0.55 + lx * out; spVel[i * 3 + 1] = up; spVel[i * 3 + 2] = fz * player.speed * 0.55 + lz * out;
        spLife[i] = 0.35 + Math.random() * 0.45;
      }
    }
    let any = false;
    for (let i = 0; i < SPN; i++) {
      if (spLife[i] <= 0) continue;
      spLife[i] -= dt; any = true;
      if (spLife[i] <= 0) { spPos[i * 3 + 1] = -999; continue; }
      spVel[i * 3 + 1] -= 16 * dt;
      spPos[i * 3] += spVel[i * 3] * dt; spPos[i * 3 + 1] += spVel[i * 3 + 1] * dt; spPos[i * 3 + 2] += spVel[i * 3 + 2] * dt;
    }
    if (any) spGeo.attributes.position.needsUpdate = true;
  }
  function updateFx(dt) {
    updateSpray(dt);
    if (fxT > 0) {
      fxT += dt;
      const u = Math.min(1, fxT / 0.6);
      fxRing.scale.setScalar(1 + 11 * (1 - (1 - u) * (1 - u))); fxRing.material.opacity = 1 - u;
      const u2 = Math.min(1, Math.max(0, fxT - 0.1) / 0.6);
      fxRing2.scale.setScalar(1 + 8 * (1 - (1 - u2) * (1 - u2))); fxRing2.material.opacity = (1 - u2) * 0.9;
      fxPillar.scale.set(1 + 0.6 * u, 1, 1 + 0.6 * u); fxPillar.material.opacity = 0.4 * (1 - u) * (1 - u);
      if (fxT > 0.75) { fxRing.visible = fxRing2.visible = fxPillar.visible = false; fxT = 0; }
    }
    let any = false;
    for (let i = 0; i < FXN; i++) {
      if (fxLife[i] <= 0) continue;
      fxLife[i] -= dt; any = true;
      if (fxLife[i] <= 0) { fxPos[i * 3 + 1] = -999; continue; }
      fxVel[i * 3 + 1] -= 24 * dt;
      fxPos[i * 3] += fxVel[i * 3] * dt; fxPos[i * 3 + 1] += fxVel[i * 3 + 1] * dt; fxPos[i * 3 + 2] += fxVel[i * 3 + 2] * dt;
    }
    if (any) fxGeo.attributes.position.needsUpdate = true;
    fovKick *= Math.max(0, 1 - 5 * dt); shake *= Math.max(0, 1 - 7 * dt);
  }

  /* ---------- player events ---------- */
  player.onEvent = (n, d) => {
    padRumble(n, d);
    if (mode === 'tutorial') {
      ND.tutorial.event(n, d);
      if (n === 'crash') { toast('WIPEOUT  no worries, try again', 'info'); ND.audio.sfx('crash'); ND.audio.grind(false, 0); return; }   // practice: no FAIL drop
    }
    if (n === 'trick') { toast(d.name + (d.pts ? '  +' + fmt(d.pts) : '') + (d.mix ? '  MIX x' + d.mix : d.chain > 1 ? '  CHAIN x' + d.chain : ''), 'trick', d.input); ND.audio.sfx('trick'); }
    else if (n === 'bank') { toast('COMBO BANKED +' + fmt(d.total), 'bank'); big('+' + fmt(d.total), 'bank'); ND.audio.sfx('bank'); }
    else if (n === 'crash') { toast((d.reason || 'Wipeout').toUpperCase() + (d.lost ? '  combo lost -' + fmt(d.lost) : ''), 'bad'); if (d.lost > 0) showFail(d.reason, d.lost); else big(d.reason === 'Bad landing' ? 'BAD LANDING' : 'WIPEOUT', 'bad'); ND.audio.sfx('crash'); ND.audio.grind(false, 0); }
    else if (n === 'perfect') { big('PERFECT!', 'perfect'); burst(d.x, d.y, d.s); ND.audio.sfx('perfect'); }
    else if (n === 'arm') ND.audio.sfx('arm');
    else if (n === 'trickStart') ND.audio.sfx('flip');
    else if (n === 'special') { toast('SPECIAL  ' + d.name.toUpperCase(), 'special', d.input); ND.audio.sfx('special'); }
    else if (n === 'specialReady') { toast('SPECIAL READY', 'special'); ND.audio.sfx('ready'); }
    else if (n === 'early') { toast('TOO EARLY', 'info'); ND.audio.sfx('early'); }
    else if (n === 'wall') { shake = Math.max(shake, 0.25); ND.audio.sfx('scrape'); }
    else if (n === 'sky') { toast('SKY LAUNCH  specials pay x2', 'special'); fovKick = Math.max(fovKick, 13); shake = Math.max(shake, 0.4); ND.audio.sfx('ready'); }
    else if (n === 'mega') { toast('MEGA AIR  specials pay x2', 'special'); fovKick = Math.max(fovKick, 9); shake = Math.max(shake, 0.3); ND.audio.sfx('ready'); }
    else if (n === 'boost' && d.rail) { fovKick = Math.max(fovKick, d.rail === 'off' ? 6 : 3); if (d.rail === 'off') toast(d.pow > 1.0 ? 'MEGA RAIL BOOST' : 'RAIL BOOST', 'boost'); ND.audio.sfx('boost'); }
    else if (n === 'boost') { toast((d.clean && !d.perfect ? 'CLEAN LANDING  ' : '') + (d.pow > 1.0 ? 'MEGA BOOST' : d.pow > 0.6 ? 'SUPER BOOST' : 'BOOST'), 'boost'); ND.audio.sfx('boost'); }
    else if (n === 'jump' || n === 'launch') ND.audio.sfx('jump');
    else if (n === 'land') { if (d.air > 0.25) ND.audio.sfx('land'); }
    else if (n === 'grindStart') ND.audio.grind(true, player.speed);
    else if (n === 'grindEnd') ND.audio.grind(false, 0);
  };

  /* ---------- game flow ---------- */
  let mode = 'timed', state = 'menu', timeLeft = 120, cd = 0, last = performance.now(), camHead = 0, camY = 0, camLook = 0, camDown = 0;
  const overlays = { menu: $('menu'), pause: $('pause'), result: $('result'), tricks: $('tricks'), confirm: $('confirm'), options: $('options'), entry: $('entry'), board: $('board'), tutdone: $('tutdone') };
  /* ---------- rider select card ---------- */
  const rcStats = $('rcStats');
  ND.STAT_KEYS.forEach(([k, label]) => {
    const row = document.createElement('div'); row.className = 'rc-row'; row.dataset.stat = k;
    row.innerHTML = '<span>' + label + '</span><div class="rc-bar"><i></i></div><em></em>';
    rcStats.appendChild(row);
  });
  const rcPips = $('rcPips');
  function buildPips() { rcPips.textContent = ''; ND.RIDERS.forEach(() => rcPips.appendChild(document.createElement('span'))); }
  buildPips();
  function paintCard() {
    const d = ND.RIDERS[ND.select.index], card = $('riderCard');
    card.style.setProperty('--rc', d.color); card.style.setProperty('--bc', d.color);
    $('rcName').textContent = d.name; $('rcRole').textContent = d.role; $('rcBlurb').textContent = d.blurb; $('rcWeak').textContent = d.weak;
    rcStats.querySelectorAll('.rc-row').forEach((row) => {
      const v = d.stats[row.dataset.stat]; row.querySelector('i').style.setProperty('--v', (v * 20) + '%'); row.querySelector('em').textContent = v;
      row.classList.toggle('hi', v >= 5);
    });
    [...rcPips.children].forEach((p, i) => p.classList.toggle('on', i === ND.select.index));
  }
  function riderStep(d) {
    ND.select.step(d); pickRider();
    ND.audio.init(); ND.audio.sfx('nav');
  }
  function pickRider() {
    const def = ND.RIDERS[ND.select.index]; ND.riderId = def.id;
    if (!def.secret) try { localStorage.setItem(RIDER_KEY, ND.riderId); } catch (e) { /* ignore */ }   // a secret pick isn't saved: it's gone next session
    paintCard();
  }
  /* secret rider: type SKELLY on the main menu, or press up up down down L1 L2 on a controller.
     The unlock is in memory only, so after closing the game he's gone again. */
  const SECRET_ID = 'skelly';
  const skellyKeys = secretCode(['S', 'K', 'E', 'L', 'L', 'Y']);
  const skellyPad = secretCode(['up', 'up', 'down', 'down', 'L1', 'L2']);
  const secretReady = () => state === 'menu' && navName === 'menu';
  let unlockT = 0;
  function unlockSecret() {
    const fresh = ND.unlockRider(SECRET_ID), def = ND.riderDef(SECRET_ID);
    if (fresh) { ND.select.addRider(def); buildPips(); }
    else { const i = ND.RIDERS.indexOf(def); if (i !== ND.select.index) ND.select.step((i - ND.select.index + ND.RIDERS.length) % ND.RIDERS.length); }
    pickRider();
    ND.audio.init(); ND.audio.sfx(fresh ? 'fanfare' : 'sel');
    padNote(fresh ? 'SECRET RIDER UNLOCKED \u00b7 ' + def.name : def.name + ' IS BACK');
    const card = $('riderCard'); card.classList.remove('unlock'); void card.offsetWidth; card.classList.add('unlock');
    clearTimeout(unlockT); unlockT = setTimeout(() => card.classList.remove('unlock'), 1400);
    if (S.rumble && PADK.connected) { PADK.rumble(0.9, 0.6, 220); setTimeout(() => PADK.rumble(0.4, 0.9, 260), 260); }
  }
  $('rcPrev').onclick = () => riderStep(-1);
  $('rcNext').onclick = () => riderStep(1);
  paintCard();
  const navMem = {};
  let navIdx = 0, navCol = 0, navName = null;
  const NAVBAR = {
    menu: [['\u2191\u2193', 'Select'], ['\u2190\u2192', 'Rider'], ['Space', 'Confirm'], ['1 / 2', 'Quick start']],
    pause: [['\u2191\u2193', 'Select'], ['Space', 'Confirm'], ['Esc', 'Resume']],
    confirm: [['\u2191\u2193', 'Select'], ['Space', 'Confirm'], ['Esc', 'Cancel']],
    tricks: [['\u2191\u2193', 'Select'], ['Space', 'Confirm'], ['Esc', 'Back']],
    options: [['\u2191\u2193', 'Select'], ['\u2190\u2192', 'Adjust'], ['Space', 'Confirm'], ['Esc', 'Back']],
    result: [['\u2191\u2193', 'Select'], ['Space', 'Confirm'], ['@restart', 'Restart']],
    entry: [['A-Z 0-9', 'Type'], ['Backspace', 'Delete'], ['\u2190\u2192', 'Move'], ['\u2191\u2193', 'Letter'], ['Space', 'Save'], ['Esc', 'Skip']],
    board: [['\u2190\u2192', 'Mode'], ['Space', 'Confirm'], ['Esc', 'Back']],
    tutdone: [['\u2191\u2193', 'Select'], ['Space', 'Confirm'], ['Esc', 'Menu']]
  };
  const NAVBAR_PAD = {
    menu: [['\u2191\u2193', 'Select'], ['\u2190\u2192', 'Rider'], ['@b0', 'Confirm']],
    pause: [['\u2191\u2193', 'Select'], ['@b0', 'Confirm'], ['@pause', 'Resume']],
    confirm: [['\u2191\u2193', 'Select'], ['@b0', 'Confirm'], ['@b1', 'Cancel']],
    tricks: [['\u2191\u2193', 'Select'], ['@b0', 'Confirm'], ['@b1', 'Back']],
    options: [['\u2191\u2193', 'Select'], ['\u2190\u2192', 'Adjust'], ['@b0', 'Confirm'], ['@b1', 'Back']],
    result: [['\u2191\u2193', 'Select'], ['@b0', 'Confirm'], ['@restart', 'Restart']],
    entry: [['\u2191\u2193', 'Letter'], ['\u2190\u2192', 'Move'], ['@b2', 'Delete'], ['@b0', 'Save'], ['@b1', 'Skip']],
    board: [['\u2190\u2192', 'Mode'], ['@b0', 'Confirm'], ['@b1', 'Back']],
    tutdone: [['\u2191\u2193', 'Select'], ['@b0', 'Confirm'], ['@b1', 'Menu']]
  };
  function show(name, keep) {
    if (navName) navMem[navName] = navIdx;
    for (const k in overlays) overlays[k].hidden = k !== name;
    navName = name || null;
    $('riderCard').hidden = name !== 'menu';
    navIdx = keep && navMem[name] != null ? navMem[name] : 0; navCol = 0;
    $('hud').style.visibility = name ? 'hidden' : '';
    paintNavbar();
    navPaint(false);
  }
  function paintNavbar() {
    const nb = $('navbar');
    nb.hidden = !navName; nb.textContent = '';
    if (!navName) return;
    const tok = (k) => k === '@restart' ? actName('restart') : k === '@pause' ? actName('pause') : /^@b\d+$/.test(k) ? PADK.name(+k.slice(2)) : k;
    ((dev === 'pad' ? NAVBAR_PAD : NAVBAR)[navName] || []).forEach(([k, t]) => { const sp = document.createElement('span'), kb = document.createElement('kbd'); kb.textContent = tok(k); sp.appendChild(kb); sp.appendChild(document.createTextNode(t)); nb.appendChild(sp); });
  }
  /* ---------- menu navigation: arrows move, left/right adjust, Space confirms ---------- */
  function navUnits() {
    const out = [];
    if (!navName) return out;
    overlays[navName].querySelectorAll('.btn, .opt-row').forEach((e) => {
      if (e.classList.contains('opt-row')) {
        const rg = e.querySelector('input[type=range]'), sg = e.querySelector('.seg');
        if (rg) out.push({ el: e, t: 'range', inp: rg });
        else if (sg) out.push({ el: e, t: 'seg', box: sg });
        else { const bs = [...e.querySelectorAll('button:not(.fixed)')]; if (bs.length) out.push({ el: e, t: 'btns', bs }); }
      } else if (!e.hidden) out.push({ el: e, t: 'btn' });
    });
    return out;
  }
  function navPaint(scroll) {
    document.querySelectorAll('.sel, .cur').forEach((x) => x.classList.remove('sel', 'cur'));
    const u = navUnits(); if (!u.length) return;
    navIdx = Math.max(0, Math.min(navIdx, u.length - 1));
    const c = u[navIdx]; c.el.classList.add('sel');
    if (c.t === 'btns') { navCol = Math.max(0, Math.min(navCol, c.bs.length - 1)); c.bs[navCol].classList.add('cur'); }
    if (scroll) {
      const ov = overlays[navName];
      if (navIdx === 0) ov.scrollTop = 0; else if (navIdx === u.length - 1) ov.scrollTop = ov.scrollHeight; else c.el.scrollIntoView({ block: 'nearest' });
    }
  }
  const navSfx = (n) => { ND.audio.init(); ND.audio.sfx(n); };
  function navMove(d) { const u = navUnits(); if (!u.length) return; navIdx = (navIdx + d + u.length) % u.length; navPaint(true); navSfx('nav'); }
  function navAdjust(d, rep) {
    const c = navUnits()[navIdx]; if (!c) return;
    if (c.t === 'range') {
      const i = c.inp, st = +i.step || 1, v = Math.max(+i.min, Math.min(+i.max, +i.value + d * st));
      if (v !== +i.value) { i.value = v; i.dispatchEvent(new Event('input')); if (!rep) i.dispatchEvent(new Event('change')); navSfx('nav'); }
    } else if (c.t === 'seg') {
      const bs = [...c.box.querySelectorAll('button')], k = bs.findIndex((b) => b.classList.contains('on')), nk = Math.max(0, Math.min(bs.length - 1, k + d));
      if (nk !== k) { bs[nk].click(); navSfx('nav'); }
    } else if (c.t === 'btns') {
      const nk = Math.max(0, Math.min(c.bs.length - 1, navCol + d));
      if (nk !== navCol) { navCol = nk; navPaint(false); navSfx('nav'); }
    }
  }
  function navConfirm() {
    const c = navUnits()[navIdx]; if (!c) return;
    if (c.el.disabled) return;
    if (c.t === 'btn') { navSfx('sel'); c.el.click(); }
    else if (c.t === 'btns') { navSfx('sel'); c.bs[Math.min(navCol, c.bs.length - 1)].click(); }
    else if (c.t === 'seg') {
      const bs = [...c.box.querySelectorAll('button')], k = bs.findIndex((b) => b.classList.contains('on'));
      bs[(k + 1) % bs.length].click(); navSfx('nav');
    }
  }
  function navKey(e) {
    if (!navName) return false;
    if (navName === 'entry') return entryKey(e);
    const c = e.code;
    if (c !== 'ArrowUp' && c !== 'ArrowDown' && c !== 'ArrowLeft' && c !== 'ArrowRight' && c !== 'Space') return false;
    e.preventDefault();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();   // the highlight is ours; a focused button would also fire on Space itself
    if (c === 'ArrowUp' || c === 'ArrowDown') navMove(c === 'ArrowUp' ? -1 : 1);
    else if (c === 'Space') { if (!e.repeat) { swallowSpace = true; navConfirm(); } }
    else if (navName === 'menu') { if (!e.repeat) riderStep(c === 'ArrowLeft' ? -1 : 1); }
    else if (navName === 'board') { if (!e.repeat) boardTab(c === 'ArrowLeft' ? -1 : 1); }
    else navAdjust(c === 'ArrowLeft' ? -1 : 1, e.repeat);
    return true;
  }
  let navLast = null;
  addEventListener('mousemove', (e) => {
    if (!navName || e.target === navLast) return;
    navLast = e.target;
    const u = navUnits(), i = u.findIndex((x) => x.el.contains(e.target));
    if (i < 0) return;
    let col = navCol;
    if (u[i].t === 'btns') { const j = u[i].bs.findIndex((b) => b.contains(e.target)); if (j >= 0) col = j; }
    if (i !== navIdx || col !== navCol) { navIdx = i; navCol = col; navPaint(false); }
  });
  const bestKey = (m) => 'cyberslide-best-' + m;
  function getBest(m) { try { return parseInt(localStorage.getItem(bestKey(m)) || localStorage.getItem('neondrop-best-' + m) || '0', 10) || 0; } catch (e) { return 0; } }
  function setBest(m, v) { try { localStorage.setItem(bestKey(m), String(v)); } catch (e) { /* ignore */ } }

  /* tutorial: chapters are short practice courses (tutorial.js). The glow on the menu button stays until a round has been played. */
  const tutGlow = () => !ND.tutorial.played() && !getBest('timed') && !getBest('endless');
  function paintTutBtn() {
    const g = tutGlow();
    $('btnTutorial').classList.toggle('glow', g);
    $('tutSub').textContent = g ? 'START HERE \u00b7 LEARN BY DOING' : 'LEARN BY DOING';
  }
  function leaveTutorial() { if (ND.tutorial.active) ND.tutorial.end(); }
  ND.tutorial.attach({
    player,
    key: (a) => actName(a),
    btn: (b) => ND.btnLabel(b),
    sfx: (n) => ND.audio.sfx(n),
    pulse: () => { el.flash.className = ''; void el.flash.offsetWidth; el.flash.className = 'on'; fovKick = Math.max(fovKick, 5); },
    burst: () => burst(player.x, player.y, player.s),
    done: (res) => tutorialDone(res)
  });
  function startRun(m, ci) {
    const tut = m === 'tutorial';
    if (!tut) { leaveTutorial(); ND.tutorial.markPlayed(); }
    mode = m; player.setRider(tut ? 'nova' : ND.riderId); ND.audio.init(); ND.audio.startMusic(); ND.audio.sfx('start');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (tut) ND.tutorial.begin(ci || 0);
    player.resetAll(); ND.world.clear(); ND.world.update(player.s);
    if (tut) player.speedCap = ND.tutorial.cap();
    lastP = { x: player.x, y: player.y, s: player.s };
    timeLeft = 120; cd = tut ? 2.6 : 3; state = 'countdown'; show(null);
    el.timeLbl.textContent = m === 'timed' ? 'TIME' : 'ENDLESS';
    el.feed.innerHTML = ''; lastScore = -1; dispScore = 0; failT = 0; slowT = 0; el.fail.className = ''; $('rflash').className = ''; camHead = 0; camLook = 0; camDown = 1; camY = player.y + 3.3 + CD_UP;
    snapCamera();
  }
  function openConfirm() {
    confirmFrom = state; state = 'confirm';
    for (const k in inp) inp[k] = false;
    ND.audio.grind(false, 0); ND.audio.carve(0, false, 0);
    $('confText').textContent = mode === 'tutorial' ? 'Start this chapter again?' : confirmFrom === 'over' ? 'Start a new run?' : 'Your current run will be lost.';
    show('confirm');
  }
  function cancelConfirm() {
    const from = confirmFrom; confirmFrom = null;
    if (from === 'play') resume(); else if (from === 'pause') { state = 'pause'; show('pause', true); } else { state = 'over'; show('result', true); }
  }
  function confirmRestart() { confirmFrom = null; swallowSpace = true; inp.space = false; padSwallow = true; if (mode === 'tutorial') startRun('tutorial', ND.tutorial.chapter); else startRun(mode); }
  $('btnConfYes').onclick = confirmRestart;
  $('btnConfNo').onclick = cancelConfirm;
  function setBtn(id, text, sub) { const b = $(id); b.textContent = text; if (sub) { const sm = document.createElement('small'); sm.textContent = sub; b.appendChild(sm); } }
  function pause() {
    state = 'pause'; ND.audio.grind(false, 0); ND.audio.carve(0, false, 0);
    if (mode === 'tutorial') { setBtn('btnEnd', 'SKIP CHAPTER', 'MOVE ON'); setBtn('btnRestart', 'RESTART CHAPTER'); setBtn('btnMenu', 'EXIT TUTORIAL'); }
    else { setBtn('btnEnd', 'END RUN', 'SEE YOUR RESULTS'); setBtn('btnRestart', 'RESTART'); setBtn('btnMenu', 'MAIN MENU'); }
    show('pause');
  }
  function resume() { state = 'play'; show(null); last = performance.now(); }
  function refreshBests() { $('bestTimed').textContent = fmt(getBest('timed')); $('bestEndless').textContent = fmt(getBest('endless')); }
  function toMenu() { leaveTutorial(); state = 'menu'; ND.audio.grind(false, 0); ND.audio.carve(0, false, 0); player.resetAll(); ND.world.clear(); ND.world.update(player.s); el.big.className = ''; show('menu'); refreshBests(); paintTutBtn();
    if (tutGlow()) { const i = navUnits().findIndex((u) => u.el.id === 'btnTutorial'); if (i >= 0) { navIdx = i; navPaint(false); } }   // first time: the tutorial is the highlighted button
  }

  /* a chapter was finished (or skipped): badges for what was learned, then on to the next one */
  function tutorialDone(res) {
    state = 'tutdone'; ND.audio.grind(false, 0); ND.audio.carve(0, false, 0); el.big.className = '';
    for (const k in inp) inp[k] = false;
    const last = res.last, nOk = res.badges.filter((b) => b.ok).length;
    if (last) ND.tutorial.finishedAll();
    $('tdCrumb').textContent = last ? '// all clear' : '// chapter clear';
    $('tdSub').textContent = last ? 'TUTORIAL COMPLETE' : 'CHAPTER ' + (res.ci + 1) + ' OF ' + res.total + ' COMPLETE';
    $('tdTitle').textContent = last ? 'READY TO RIDE' : nOk === res.badges.length ? 'NICE RIDING' : 'ON TO THE NEXT';
    const box = $('tdStars'); box.textContent = '';
    res.badges.forEach((b, i) => { const sp = document.createElement('span'); sp.textContent = b.badge; if (!b.ok) sp.className = 'dim'; sp.style.animationDelay = (i * 0.09) + 's'; box.appendChild(sp); });
    $('tdText').textContent = last
      ? 'That is everything. Chain tricks, bank big combos and go for the biggest air. Go set a score.'
      : res.tricks + ' tricks landed \u00b7 best combo ' + fmt(res.bestCombo) + (nOk < res.badges.length ? ' \u00b7 skipped steps are greyed out, you can replay the chapter any time' : '');
    $('btnTdNext').hidden = last;
    $('tdNextSub').textContent = last ? '' : 'CHAPTER ' + (res.ci + 2) + ' \u00b7 ' + ND.tutorial.CHAPTERS[res.ci + 1].name;
    $('btnTdRun').className = last ? 'btn' : 'btn alt';
    $('btnTdAgain').textContent = last ? 'REPLAY LAST CHAPTER' : 'REPLAY CHAPTER';
    show('tutdone');
    ND.audio.sfx(last ? 'fanfare' : 'bank');
  }
  function finish() {
    state = 'over'; player.bank(); ND.audio.grind(false, 0); ND.audio.carve(0, false, 0); ND.audio.sfx('end');
    const best = getBest(mode), isBest = player.score > best;
    if (isBest) setBest(mode, player.score);
    const st = player.stats;
    $('resTitle').textContent = mode === 'timed' ? 'TIME UP' : 'RUN OVER';
    $('resScore').textContent = fmt(player.score);
    $('resBadge').hidden = !isBest;
    $('resBest').textContent = fmt(Math.max(best, player.score));
    $('resCombo').textContent = fmt(st.bestCombo); $('resTricks').textContent = st.tricks; $('resGrinds').textContent = st.grinds;
    $('resCrash').textContent = st.crashes; $('resSpeed').textContent = Math.round(st.topSpeed * 3.6) + ' km/h';
    $('resDist').textContent = fmt(player.dist) + ' m'; $('resAir').textContent = st.bestAir.toFixed(1) + ' s';
    $('resRank').hidden = true;
    show('result');
    lockAgain(mode === 'timed' && timeLeft <= 0 ? 3000 : 0);   // time ran out: RUN AGAIN stays locked for 3 s so a mashed key can't skip the result
    // a run that makes the top 10 asks for initials before the result screen is used
    const run = { mode, score: player.score, dist: player.dist, rider: ND.riderId };
    ND.scores.load(run.mode).then((list) => {
      const rank = ND.scores.qualifies(list, run.score);
      if (rank && state === 'over' && navName === 'result') openEntry(run, rank);
    });
  }

  /* RUN AGAIN is locked for a moment after time runs out, so a key still being mashed can't start a new run by accident */
  let againTimer = 0;
  function lockAgain(ms) {
    clearInterval(againTimer); againTimer = 0;
    const b = $('btnAgain'), end = performance.now() + ms;
    const paint = () => {
      const left = end - performance.now();
      if (left <= 0) { clearInterval(againTimer); againTimer = 0; b.disabled = false; b.textContent = 'RUN AGAIN'; return; }
      b.disabled = true; b.textContent = '';
      b.appendChild(document.createTextNode('RUN AGAIN'));
      const sm = document.createElement('small'); sm.textContent = 'READY IN ' + Math.ceil(left / 1000); b.appendChild(sm);
    };
    paint();
    if (ms > 0) againTimer = setInterval(paint, 100);
  }

  /* ---------- scoreboard: top 10 per mode, initials entry ---------- */
  const NAME_KEY = 'cyberslide-name', NAME_MAX = 8, NAME_SET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let boardOpen = false, boardFrom = 'menu', boardMode = 'timed', boardHL = null, enPend = null, enLockUntil = 0;
  let enName = [], enCaret = 0, enFresh = false;                    // the name being typed, caret position, "remembered name still selected"
  const loadName = () => {
    try { return (localStorage.getItem(NAME_KEY) || localStorage.getItem('cyberslide-initials') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, NAME_MAX); } catch (e) { return ''; }
  };
  const enSlots = $('enSlots');
  function paintEntry() {
    [...enSlots.children].forEach((s, i) => {
      const ch = enName[i] || '';
      s.classList.toggle('on', !enFresh && i === Math.min(enCaret, NAME_MAX - 1));
      s.classList.toggle('fill', !!ch);
      s.classList.toggle('all', enFresh && !!ch);
      s.querySelector('b').textContent = ch;
    });
    $('btnEnSave').disabled = enName.length === 0;
  }
  function enCycle(d) {                                              // up/down: pick the letter at the caret (an empty slot starts a new one)
    if (enFresh) { enFresh = false; return; }
    if (enCaret < enName.length) { const k = NAME_SET.indexOf(enName[enCaret]); enName[enCaret] = NAME_SET[(k + d + NAME_SET.length) % NAME_SET.length]; }
    else if (enName.length < NAME_MAX) { enName.push(d > 0 ? NAME_SET[0] : NAME_SET[NAME_SET.length - 1]); enCaret = enName.length - 1; }
  }
  function enType(ch) {
    if (enFresh) { enName = []; enCaret = 0; enFresh = false; }       // typing over the remembered name replaces it
    if (enName.length < NAME_MAX) { enName.splice(enCaret, 0, ch); enCaret++; }
    else if (enCaret < NAME_MAX) { enName[enCaret] = ch; enCaret++; }   // a full name: typing inside it replaces letters
    else navSfx('early');                                                 // caret at the end of a full name: extra keys are ignored
  }
  function enBack() {
    if (enFresh) { enName = []; enCaret = 0; enFresh = false; return; }
    if (enCaret > 0) { enName.splice(enCaret - 1, 1); enCaret--; }
  }
  for (let i = 0; i < NAME_MAX; i++) {
    const s = document.createElement('div'); s.className = 'slot';
    s.innerHTML = '<button class="ar" type="button" tabindex="-1" aria-label="Next letter">▲</button><b></b><button class="ar" type="button" tabindex="-1" aria-label="Previous letter">▼</button>';
    const [up, , dn] = s.children;
    up.onclick = () => { enFresh = false; enCaret = Math.min(i, enName.length); enCycle(1); paintEntry(); navSfx('nav'); };
    dn.onclick = () => { enFresh = false; enCaret = Math.min(i, enName.length); enCycle(-1); paintEntry(); navSfx('nav'); };
    s.querySelector('b').onclick = () => { enFresh = false; enCaret = Math.min(i, enName.length); paintEntry(); navSfx('nav'); };
    enSlots.appendChild(s);
  }
  function openEntry(run, rank) {
    enPend = run;
    enName = loadName().split('').filter(Boolean); enCaret = enName.length; enFresh = enName.length > 0;   // empty the first time, afterwards the remembered name
    $('enSub').textContent = (run.mode === 'timed' ? '2 MIN RUN' : 'ENDLESS') + ' // RANK #' + rank;
    $('enScore').textContent = fmt(run.score);
    enLockUntil = performance.now() + 2000;   // keys still being mashed from the run must not type or save a name
    $('entry').classList.add('lock'); setTimeout(() => $('entry').classList.remove('lock'), 2000);
    paintEntry(); show('entry'); ND.audio.sfx('sel');
  }
  function saveEntry() {
    if (!enPend || !enName.length) { navSfx('early'); return; }
    const p = enPend, name = enName.join(''); enPend = null;
    try { localStorage.setItem(NAME_KEY, name); } catch (e) { /* ignore */ }
    ND.scores.submit(p.mode, { name, score: p.score, rider: p.rider, dist: p.dist }).then((res) => {
      const r = $('resRank'); r.hidden = !res.rank; r.textContent = res.rank ? 'Scoreboard rank #' + res.rank : '';
      openBoard('result', p.mode, res.rank ? { mode: p.mode, idx: res.rank - 1 } : null);
    });
  }
  function skipEntry() { enPend = null; show('result', true); }
  function entryKey(e) {
    const c = e.code;
    if (performance.now() < enLockUntil) { e.preventDefault(); if (c === 'Space') swallowSpace = true; return true; }   // brief lock after the entry screen opens
    if (c === 'Space') {
      e.preventDefault(); if (e.repeat) return true;
      swallowSpace = true;
      if (enName.length) { navSfx('sel'); saveEntry(); } else navSfx('early');   // a name needs at least one character
      return true;
    }
    if (c === 'ArrowUp' || c === 'ArrowDown') { e.preventDefault(); enCycle(c === 'ArrowUp' ? 1 : -1); paintEntry(); navSfx('nav'); return true; }
    if (c === 'ArrowLeft' || c === 'ArrowRight') {
      e.preventDefault();
      if (enFresh) { enFresh = false; enCaret = c === 'ArrowLeft' ? enName.length - 1 : enName.length; }
      else enCaret = Math.max(0, Math.min(enName.length, enCaret + (c === 'ArrowLeft' ? -1 : 1)));
      enCaret = Math.max(0, enCaret); paintEntry(); navSfx('nav');
      return true;
    }
    if (c === 'Escape') { e.preventDefault(); if (!e.repeat) skipEntry(); return true; }
    if (c === 'Backspace') { e.preventDefault(); enBack(); paintEntry(); navSfx('nav'); return true; }
    if (e.key && /^[a-zA-Z0-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      if (!e.repeat) { enType(e.key.toUpperCase()); paintEntry(); navSfx('nav'); }
      return true;
    }
    return false;
  }
  function renderBoard() {
    const m = boardMode;
    $('bdTabs').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.m === m));
    $('bdNote').textContent = ND.scores.backend.scope;
    ND.scores.load(m).then((list) => {
      if (boardMode !== m) return;
      const box = $('bdList'); box.textContent = '';
      for (let i = 0; i < ND.scores.MAX; i++) {
        const en = list[i], row = document.createElement('div');
        row.className = 'bd-row' + (i < 3 ? ' top' : '') + (en ? '' : ' empty') + (boardHL && boardHL.mode === m && boardHL.idx === i ? ' me' : '');
        const cell = (cls, txt) => { const s = document.createElement('span'); s.className = cls; s.textContent = txt; row.appendChild(s); return s; };
        cell('rk', i + 1); cell('in', en ? en.n : '---'); cell('sc', en ? fmt(en.s) : '');
        const def = en && ND.riderDef(en.r), rd = cell('rd', def ? def.name : '');
        if (def) rd.style.setProperty('--rc', def.color);
        cell('ds', en ? fmt(en.d || 0) + ' m' : '');
        box.appendChild(row);
      }
    });
  }
  function openBoard(from, m, hl) { boardOpen = true; boardFrom = from; boardMode = m || boardMode; boardHL = hl || null; show('board'); renderBoard(); }
  function closeBoard() { boardOpen = false; boardHL = null; show(boardFrom, true); }
  function boardTab(d) { const M = ND.scores.MODES; boardMode = M[(M.indexOf(boardMode) + d + M.length) % M.length]; boardHL = null; renderBoard(); navSfx('nav'); }
  $('bdTabs').querySelectorAll('button').forEach((b) => { b.onclick = () => { boardMode = b.dataset.m; boardHL = null; renderBoard(); navSfx('nav'); }; });
  $('btnBoard').onclick = () => openBoard('menu', mode);
  $('btnBoard2').onclick = () => openBoard('result', mode);
  $('btnBdBack').onclick = closeBoard;
  $('btnEnSave').onclick = saveEntry;
  $('btnEnSkip').onclick = skipEntry;
  /* ---------- trick list ---------- */
  let trOpen = false, trFrom = 'menu', optOpen = false, optFrom = 'menu', listen = null;
  /* frost + sparkles over the special bar when it is full (low-res canvas, pixelated) */
  const spcv = $('specFx'), spx = spcv.getContext('2d'), sparks = [];
  let frostLast = 0, frostOn = 0;
  const crystals = (() => { const a = []; for (let x = 2; x < 186; x += 4 + Math.floor(Math.random() * 4)) a.push({ x, h: 5 + Math.random() * 10 }); return a; })();
  function star(x, y, r, col) {
    spx.fillStyle = col;
    spx.fillRect(Math.round(x) - 0, Math.round(y) - r, 1, r * 2 + 1);
    spx.fillRect(Math.round(x) - r, Math.round(y), r * 2 + 1, 1);
    if (r > 1) { spx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3); }
  }
  function specFlames(on) {
    const now = performance.now();
    if (!on && !sparks.length && frostOn <= 0) { if (frostLast) { spx.clearRect(0, 0, spcv.width, spcv.height); frostLast = 0; } return; }
    const dt = Math.min(0.05, (now - (frostLast || now)) / 1000); frostLast = now;
    const W = spcv.width, H = spcv.height;
    frostOn = Math.max(0, Math.min(1, frostOn + (on ? 4 : -4) * dt));
    if (on) for (let i = 0; i < 2; i++) {
      const bar = Math.random() < 0.55;
      sparks.push({ x: 2 + Math.random() * (W - 4), y: bar ? H - 2 - Math.random() * 3 : H - 4 - Math.random() * (H - 10), vx: (Math.random() - 0.5) * 6, vy: -(6 + Math.random() * 16), life: 0, max: 0.5 + Math.random() * 0.8, r: Math.random() < 0.3 ? 2 : 1, ph: Math.random() * 6 });
    }
    spx.clearRect(0, 0, W, H);
    // frost crystals growing along the top edge of the bar
    for (const c of crystals) {
      const h = Math.round(c.h * frostOn * (0.85 + 0.15 * Math.sin(now / 260 + c.x)));
      for (let j = 0; j < h; j++) {
        const w = Math.max(1, Math.round((h - j) / 3));
        spx.fillStyle = 'rgba(40,120,225,' + frostOn.toFixed(2) + ')'; spx.fillRect(c.x - (w >> 1) - 1, H - 1 - j, w + 2, 1);
        spx.fillStyle = j > h * 0.6 ? 'rgba(255,255,255,' + frostOn.toFixed(2) + ')' : 'rgba(150,235,255,' + frostOn.toFixed(2) + ')'; spx.fillRect(c.x - (w >> 1), H - 1 - j, w, 1);
      }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const f = sparks[i]; f.life += dt;
      if (f.life >= f.max) { sparks.splice(i, 1); continue; }
      f.x += (f.vx + Math.sin(f.life * 6 + f.ph) * 4) * dt; f.y += f.vy * dt;
      const k = f.life / f.max, tw = Math.sin(k * Math.PI);   // fade in and out
      const col = f.r > 1 ? 'rgba(255,255,255,' + tw.toFixed(2) + ')' : (k < 0.5 ? 'rgba(190,245,255,' : 'rgba(120,215,255,') + tw.toFixed(2) + ')';
      star(f.x + 1, f.y + 1, f.r, 'rgba(30,90,220,' + (0.75 * tw).toFixed(2) + ')');   // dark-blue edge so sparkles read on snow
      star(f.x, f.y, f.r, col);
    }
  }

  ND.TRICK_INPUT = 'after';   // one fixed style: tap the arrows, then the trick button
  try { localStorage.removeItem('cyberslide-input'); } catch (e) { /* ignore */ }
  function buildTricks() {
    $('trHow').innerHTML = 'In the air, tap the arrows in order, then press <kbd data-k="flip">A</kbd> (flip) or <kbd data-k="grab">D</kbd> (grab) within half a second. Holding an arrow works too. A diagonal is two arrows pressed together. Each trick counts once per jump. <kbd data-k="trick">S</kbd> + arrows still spins and flips your body.';
    $('menuHow').innerHTML = 'Tap arrows, then <kbd data-k="flip">A</kbd> for <b>flip tricks</b> or <kbd data-k="grab">D</kbd> for <b>grabs</b>. See ALL TRICKS.';
    const fill = (id, list) => {
      const box = $(id); box.textContent = '';
      list.forEach((t) => {
        const r = document.createElement('div'); r.className = 'tr-row' + (t.sp ? ' sp' : '');
        const n = document.createElement('span'); n.className = 'tr-name'; n.textContent = t.name;
        const k = document.createElement('span'); k.className = 'tr-keys'; k.textContent = ND.trickInput(t);
        r.appendChild(n); r.appendChild(k); box.appendChild(r);
      });
    };
    const T = ND.TRICKS;
    fill('trFlip', T.filter((t) => t.btn === 'A' && !t.sp));
    fill('trGrab', T.filter((t) => t.btn === 'D' && !t.sp));
    fill('trSpecA', T.filter((t) => t.btn === 'A' && t.sp));
    fill('trSpecD', T.filter((t) => t.btn === 'D' && t.sp));
    refreshKeyLabels();
  }
  buildTricks();
  function openTricks(from) { trOpen = true; trFrom = from; show('tricks'); $('tricks').scrollTop = 0; }
  function closeTricks() { trOpen = false; show(trFrom, true); }
  $('btnTricks').onclick = () => openTricks('menu');
  $('btnTricks2').onclick = () => openTricks('pause');
  $('btnTricksBack').onclick = closeTricks;

  /* ---------- options ---------- */
  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const ACTS = [['left', 'Carve left'], ['right', 'Carve right'], ['up', 'Up: tuck, trick arrow'], ['down', 'Down: brake, trick arrow'], ['space', 'Jump, perfect landing'],
    ['trick', 'Body spin, flip, grind switch'], ['flip', 'Flip tricks'], ['grab', 'Grab tricks'], ['restart', 'Restart'], ['mute', 'Mute'], ['pause', 'Pause']];
  const PAD_ACTS = [['space', 'Jump, perfect landing'], ['trick', 'Body spin, flip, grind switch'], ['flip', 'Flip tricks'], ['grab', 'Grab tricks'], ['restart', 'Restart'], ['mute', 'Mute'], ['pause', 'Pause']];
  const actLabel = (a) => (ACTS.find((x) => x[0] === a) || [0, a])[1];
  let lastRes = S.res, previewT = 0;
  function applyS() {
    ND.audio.setMuted(S.mute); ND.audio.setVolumes(S.music / 100, S.sfx / 100);
    $('crt').hidden = !S.crt; $('fps').hidden = !S.fps;
    if (lastRes !== S.res) { lastRes = S.res; resize(); }
  }
  function say(t) { $('optMsg').textContent = t || ''; }
  function section(title) { const h = mk('div', 'opt-sec', title), g = mk('div', 'opt-grid brk'); $('optBody').appendChild(h); $('optBody').appendChild(g); return g; }
  function orow(g, label, sub) { const r = mk('div', 'opt-row'), l = mk('span', '', label); if (sub) l.appendChild(mk('small', '', sub)); r.appendChild(l); g.appendChild(r); return r; }
  function slider(g, label, key, min, max, step, f, onRelease) {
    const r = orow(g, label), w = mk('div', 'kbs'), i = mk('input'), v = mk('span', 'opt-val', f(S[key]));
    i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = S[key]; i.setAttribute('aria-label', label);
    i.oninput = () => { S[key] = +i.value; v.textContent = f(S[key]); applyS(); saveS(); };
    if (onRelease) i.onchange = onRelease;
    w.appendChild(i); w.appendChild(v); r.appendChild(w);
  }
  function seg(g, label, get, set, choices, sub) {
    const r = orow(g, label, sub), box = mk('div', 'seg'); box.setAttribute('role', 'group'); box.setAttribute('aria-label', label);
    choices.forEach(([val, txt]) => {
      const b = mk('button', get() === val ? 'on' : '', txt); b.type = 'button'; b.setAttribute('aria-pressed', String(get() === val));
      b.onclick = () => { set(val); box.querySelectorAll('button').forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); }); applyS(); saveS(); };
      box.appendChild(b);
    });
    r.appendChild(box);
  }
  const bool = (g, label, key, on, off, sub) => seg(g, label, () => S[key], (v) => { S[key] = v; }, [[true, on || 'ON'], [false, off || 'OFF']], sub);
  function slotBtn(a, i) {
    const b = mk('button', 'kb' + (S.keys[a][i] ? '' : ' empty'), keyName(S.keys[a][i])); b.type = 'button';
    b.dataset.slot = a + i; b.setAttribute('aria-label', actLabel(a) + ' key ' + (i + 1) + ': ' + (S.keys[a][i] ? keyName(S.keys[a][i]) : 'not set') + '. Click to change');
    b.onclick = () => startListen(a, i, b);
    return b;
  }
  function buildOptions() {
    const body = $('optBody'); body.textContent = '';
    let g = section('AUDIO');
    slider(g, 'Music volume', 'music', 0, 100, 5, (v) => v + '%');
    slider(g, 'Effects volume', 'sfx', 0, 100, 5, (v) => v + '%', () => { ND.audio.init(); ND.audio.sfx('trick'); });
    seg(g, 'Sound', () => S.mute, (v) => { S.mute = v; }, [[false, 'ON'], [true, 'MUTED']], 'Mute with ' + actName('mute') + ' any time');
    g = section('CONTROLS');
    bool(g, 'Show trick inputs in the combo feed', 'chips');
    const hdr = orow(g, 'Key bindings', 'Click a key, then press the new one. Backspace clears it, Esc cancels.');
    const rb = mk('button', 'mini', 'RESET KEYS'); rb.type = 'button';
    rb.onclick = () => { for (const a in DEF_KEYS) S.keys[a] = DEF_KEYS[a].slice(); keysChanged(); say('Keys reset to default.'); };
    hdr.appendChild(rb);
    for (const [a, label] of ACTS) {
      const r = orow(g, label), w = mk('div', 'kbs');
      if (a === 'pause') { const f = mk('button', 'kb fixed', 'ESC'); f.type = 'button'; f.tabIndex = -1; f.setAttribute('aria-label', 'Escape always pauses'); w.appendChild(f); }
      for (let i = 0; i < S.keys[a].length; i++) w.appendChild(slotBtn(a, i));
      r.appendChild(w);
    }
    g = section('CONTROLLER');
    orow(g, 'Controller', PADK.connected ? PADK.label + ' connected' : 'None found. Connect one and press any button.');
    slider(g, 'Stick dead-zone', 'padDead', 5, 40, 1, (v) => v + '%');
    bool(g, 'Vibration', 'rumble', 'ON', 'OFF', 'Rumble on landings, wall scrapes and wipeouts');
    const phd = orow(g, 'Button bindings', 'Pick a slot, then press the new button. Backspace clears, Esc cancels. Steer and brake: left stick or D-pad.');
    const prb = mk('button', 'mini', 'RESET BUTTONS'); prb.type = 'button';
    prb.onclick = () => { for (const a in DEF_PAD) S.pad[a] = DEF_PAD[a].slice(); padChanged(); say('Buttons reset to default.'); };
    phd.appendChild(prb);
    for (const [a, label] of PAD_ACTS) {
      const r = orow(g, label), w = mk('div', 'kbs');
      for (let i = 0; i < S.pad[a].length; i++) w.appendChild(padSlotBtn(a, i));
      r.appendChild(w);
    }
    g = section('GRAPHICS');
    seg(g, 'Resolution', () => S.res, (v) => { S.res = v; }, [[240, 'CRUNCHY'], [300, 'CLASSIC'], [450, 'SHARP'], [720, 'CRISP']], 'Lower is more PS2 and lighter on slow machines');
    seg(g, 'Screen shake and speed zoom', () => S.fx, (v) => { S.fx = v; }, [[1, 'FULL'], [0.5, 'REDUCED'], [0, 'OFF']], 'Reduced or off is easier on motion sickness');
    slider(g, 'Field of view', 'fov', 50, 90, 1, (v) => v + '\u00b0');
    bool(g, 'CRT scanlines and vignette', 'crt');
    bool(g, 'FPS counter', 'fps');
    g = section('DATA');
    const r = orow(g, 'Best scores', 'Clears your 2 min and endless bests'), db = mk('button', 'mini', 'RESET BEST SCORES'); db.type = 'button';
    let arm = 0;
    db.onclick = () => {
      if (!arm) { db.textContent = 'CLICK AGAIN TO CONFIRM'; db.classList.add('warn'); arm = setTimeout(() => { arm = 0; db.textContent = 'RESET BEST SCORES'; db.classList.remove('warn'); }, 3000); return; }
      clearTimeout(arm); arm = 0; db.textContent = 'RESET BEST SCORES'; db.classList.remove('warn');
      try { for (const k of ['timed', 'endless']) { localStorage.removeItem(bestKey(k)); localStorage.removeItem('neondrop-best-' + k); } } catch (e) { /* ignore */ }
      refreshBests(); say('Best scores cleared.');
    };
    r.appendChild(db);
    if (navName === 'options') navPaint(false);
  }
  function keysChanged() { buildKeymap(); saveS(); buildOptions(); buildTricks(); }
  function startListen(a, i, btn, pad) {
    if (listen && listen.btn) listen.btn.classList.remove('listen');
    listen = { a, i, btn, pad: !!pad }; btn.classList.add('listen'); btn.textContent = pad ? 'PRESS BUTTON' : 'PRESS KEY';
    say(pad ? 'Press the new button on the controller for "' + actLabel(a) + '". Backspace clears, Esc cancels.' : 'Press the new key for "' + actLabel(a) + '". Backspace clears, Esc cancels.');
  }
  function stopListen() { if (listen && listen.btn) listen.btn.classList.remove('listen'); listen = null; }
  function handleListen(e) {
    const { a, i } = listen;
    if (e.code === 'Escape') { stopListen(); buildOptions(); say('Cancelled.'); return; }
    if (listen.pad) {
      if (e.code === 'Backspace' || e.code === 'Delete') { S.pad[a][i] = null; stopListen(); padChanged(); say(actLabel(a) + ' slot cleared.'); }
      else say('Press a button on the controller. Backspace clears, Esc cancels.');
      return;
    }
    if (e.code === 'Backspace' || e.code === 'Delete') { S.keys[a][i] = null; stopListen(); keysChanged(); say(actLabel(a) + ' slot cleared.'); return; }
    if (RESERVED.test(e.code)) { say('That key is reserved. Pick another one.'); return; }
    let holder = null;
    for (const b in S.keys) S.keys[b].forEach((c, j) => { if (c === e.code && !(b === a && j === i)) holder = { a: b, i: j }; });
    const prev = S.keys[a][i];
    if (holder) S.keys[holder.a][holder.i] = prev;
    S.keys[a][i] = e.code;
    stopListen(); keysChanged();
    const nm = keyName(e.code);
    say(!holder ? actLabel(a) + ' is now ' + nm + '.' : prev ? nm + ' swapped with "' + actLabel(holder.a) + '".' : nm + ' was taken from "' + actLabel(holder.a) + '", which now has no key there.');
  }
  function openOptions(from) { optOpen = true; optFrom = from; say(''); buildOptions(); show('options'); $('options').scrollTop = 0; }
  function closeOptions() { stopListen(); optOpen = false; show(optFrom, true); }
  $('btnOptions').onclick = () => openOptions('menu');
  $('btnOptions2').onclick = () => openOptions('pause');
  $('btnOptBack').onclick = closeOptions;
  applyS();
  $('btnTimed').onclick = () => startRun('timed');
  $('btnEndless').onclick = () => startRun('endless');
  $('btnResume').onclick = resume;
  $('btnEnd').onclick = () => { if (mode === 'tutorial') ND.tutorial.skipChapter(); else finish(); };
  $('btnRestart').onclick = () => { if (mode === 'tutorial') startRun('tutorial', ND.tutorial.chapter); else startRun(mode); };
  $('btnTutorial').onclick = () => startRun('tutorial', 0);
  $('btnTdNext').onclick = () => startRun('tutorial', ND.tutorial.chapter + 1);
  $('btnTdAgain').onclick = () => startRun('tutorial', ND.tutorial.chapter);
  $('btnTdRun').onclick = () => startRun('timed');
  $('btnTdMenu').onclick = toMenu;
  $('btnMenu').onclick = toMenu;
  $('btnAgain').onclick = () => startRun(mode);
  $('btnMenu2').onclick = toMenu;

  /* ---------- camera ---------- */
  const sunOff = new THREE.Vector3(0, 62, -470);
  /* during the countdown the camera sits higher and tilts down into the slope, then eases back to the normal view after the drop */
  const CD_UP = 1.0, CD_DOWN = 5.5, CAM_CLEAR = 0.7;
  let camLift = 0;
  function snapCamera() {
    camera.position.set(player.x, player.y + 3.3 + CD_UP * camDown, -player.s + 8);
    camera.lookAt(player.x, player.y - 3 - CD_DOWN * camDown, -player.s - 14);
  }
  function updateCamera(dt) {
    const cdT = state === 'countdown' ? 1 : 0;
    camDown += (cdT - camDown) * Math.min(1, dt * (cdT ? 10 : 2.2));
    camHead += (player.heading * 0.6 - camHead) * Math.min(1, dt * 3);
    // lean the view toward where the path is heading so bends can be read early
    const pathX = Math.max(-9, Math.min(9, (ND.C(player.s + 40) - player.x) * 0.3));
    camLook += (pathX - camLook) * Math.min(1, dt * 2.2);
    const dist = 8 + player.speed * 0.02;
    const tx = player.x - Math.sin(camHead) * dist;
    camera.position.x += (tx - camera.position.x) * Math.min(1, dt * 7);
    camY += (player.y + 3.3 + CD_UP * camDown - camY) * Math.min(1, dt * (player.state === 'air' ? 3 : 8));
    camera.position.z = -player.s + Math.cos(camHead) * dist;
    // terrain-aware: the camera sits up the hill from the rider, so the snow behind it is higher than the rider's own ground.
    // Probe the line from the camera to the rider and lift the camera whenever the ground would cut into it (landing slopes,
    // ramps, walls, tumbles). It rises at once and settles back slowly, so the usual view stays the same.
    {
      const hx = player.x, hy = player.y + 1.2, hz = -player.s, cx = camera.position.x, cz = camera.position.z;
      let need = camY;
      for (let i = 0; i < 5; i++) {
        const f = i * 0.2, g = ND.H(cx + (hx - cx) * f, -(cz + (hz - cz) * f)) + CAM_CLEAR;
        need = Math.max(need, (g - hy * f) / (1 - f));
      }
      const want = need - camY;
      camLift += (want - camLift) * Math.min(1, dt * (want > camLift ? 30 : 2.5));
      camera.position.y = Math.max(camY + camLift, need);
    }
    camera.up.set(-player.roll * 0.3, 1, 0).normalize();
    camera.lookAt(player.x + Math.sin(camHead) * 10 + camLook, player.y - 2.4 - CD_DOWN * camDown, -player.s - 14);
    const bf = S.fov, fov = Math.min(bf + 30, bf + (Math.max(0, Math.min(20, (player.speed - 15) * 0.55)) + 6 * player.boostNow) * S.fx) + fovKick * S.fx;
    if (Math.abs(fov - camera.fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * (fovKick > 0.5 ? 12 : 3)); camera.updateProjectionMatrix(); }
    sky.position.copy(camera.position);
    sun.position.copy(camera.position).add(sunOff);
  }
  function updateSnow(dt) {
    const dx = player.x - lastP.x, dy = player.y - lastP.y, ds = player.s - lastP.s;
    lastP = { x: player.x, y: player.y, s: player.s };
    for (let i = 0; i < SN; i++) {
      const r = snowRel[i];
      r.x -= dx; r.y -= dy + 2.2 * dt; r.z += ds;
      if (r.z > 22) r.z -= 100; else if (r.z < -78) r.z += 100;
      if (r.x > 30) r.x -= 60; else if (r.x < -30) r.x += 60;
      if (r.y < -12) r.y += 40; else if (r.y > 28) r.y -= 40;
      snowArr[i * 3] = player.x + r.x; snowArr[i * 3 + 1] = player.y + r.y; snowArr[i * 3 + 2] = -player.s + r.z;
    }
    snowGeo.attributes.position.needsUpdate = true;
  }

  /* ---------- main loop ---------- */
  const fpsEl = $('fps'); let fpsN = 0, fpsT = 0, fpsLast = performance.now();
  const NOINP = { left: false, right: false, up: false, down: false, space: false, trick: false, grab: false, flip: false };
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.033, Math.max(0.001, (now - last) / 1000)); last = now;
    if (S.fps) { fpsN++; fpsT += (now - fpsLast) / 1000; if (fpsT >= 0.5) { fpsEl.textContent = Math.round(fpsN / fpsT) + ' FPS'; fpsN = 0; fpsT = 0; } }
    fpsLast = now;
    padFrame(dt);
    if (state === 'countdown') {
      const before = Math.ceil(cd); cd -= dt;
      player.pose(dt, NOINP);
      if (cd <= 0) { state = 'play'; big('DROP!', 'go'); }
      else { const n = Math.ceil(cd); el.big.textContent = String(n); el.big.className = 'show'; if (n !== before) ND.audio.sfx('ui'); }
    } else if (state === 'play') {
      let ts = 1;
      if (slowT > 0) { slowT -= dt; ts = slowT > 0.25 ? 0.2 : 0.2 + 0.8 * (1 - Math.max(0, slowT) / 0.25); }   // slow-mo beat after a failed combo
      player.update(dt * ts, einp);
      if (mode === 'tutorial') ND.tutorial.update(dt * ts, einp);
      if (mode === 'timed') { timeLeft -= dt; if (timeLeft <= 0) { timeLeft = 0; finish(); } }
      ND.audio.carve(player.speed, player.state === 'ride', Math.max(Math.abs(player.hv) / 2, player.slide * 1.4));
    } else if (state === 'menu') {
      player.pose(dt, NOINP);
    }
    const inMenu = state === 'menu';
    if (inMenu) { player.group.visible = false; player.trail.visible = false; }
    player.glow.visible = !inMenu;
    ND.select.setVisible(inMenu && navName === 'menu'); ND.select.update(dt);
    ND.world.update(player.s);
    ND.city.update(dt, player);
    updateCamera(dt); updateSnow(dt); updateFx(dt); hud(dt); endCount();
    const cp = camera.position.clone();
    if (shake * S.fx > 0.01) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * shake * S.fx, (Math.random() - 0.5) * shake * S.fx, 0));
    renderer.render(scene, camera);
    ND.select.render(renderer);
    camera.position.copy(cp);
  }
  toMenu();
  snapCamera();
  requestAnimationFrame(frame);
}
