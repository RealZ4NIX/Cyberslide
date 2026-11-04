// @ts-nocheck -- ported as-is from the single-file build; not strictly typed yet (see docs/structure.md)

/* CYBERSLIDE - city: districts, neon signs, billboards, lanterns, pagodas, steam, cables, banners, air traffic */

import * as THREE from 'three';
import { ND } from './nd';
import { districtAt, mixSeed } from './course';

const T_INIT = performance.now();
const SEG = ND.SEG, HALF = ND.HALF, C = ND.C;
const rngf = (seed) => {
  let a = seed | 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};
const hash = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const PINK = 0xff3fd0, CYAN = 0x2ff0ff, YEL = 0xffd23f, ORG = 0xff8a2a, GRN = 0x7dff4a, VIO = 0xa35bff, RED = 0xff3a4a, WHT = 0xffffff;
const rgb = (c) => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
const mulc = (c, f) => [Math.min(1, c[0] * f), Math.min(1, c[1] * f), Math.min(1, c[2] * f)];
const pick = (r, a) => a[(r() * a.length) | 0];

/* ---------- canvas textures ---------- */
function tex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = repeat ? THREE.NearestMipmapLinearFilter : THREE.NearestFilter;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// tiling facade textures: one tile is 10 m wide and 14 m tall (16 x 16 cells)
function winTex(style, pal, seed) {
  const r = rngf(seed);
  return tex(128, 256, (g, w, h) => {
    g.fillStyle = { grid: '#0b0618', dense: '#13081b', strips: '#070b1c', industrial: '#0b0f1a', temple: '#1a0a11' }[style]; g.fillRect(0, 0, w, h);
    if (style === 'grid') {
      for (let y = 0; y < 16; y++) {
        if (r() < 0.06) { g.fillStyle = pal[0]; g.globalAlpha = 0.35; g.fillRect(0, y * 16 + 3, w, 9); g.globalAlpha = 1; }
        for (let x = 0; x < 16; x++) { const v = r(); if (v < 0.42) { g.fillStyle = v < 0.08 ? pal[1] : pal[0]; g.globalAlpha = 0.55 + r() * 0.45; g.fillRect(x * 8 + 1, y * 16 + 3, 5, 8); g.globalAlpha = 1; } }
        g.fillStyle = 'rgba(170,150,255,.22)'; g.fillRect(0, y * 16 + 14, w, 2);
      }
    } else if (style === 'dense') {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const v = r();
          if (v < 0.5) { g.fillStyle = v < 0.1 ? pal[1] : pal[0]; g.globalAlpha = 0.5 + r() * 0.5; g.fillRect(x * 8 + 1, y * 16 + 2, 6, 8); g.globalAlpha = 1; }
          else if (v < 0.62) { g.fillStyle = '#3a3550'; g.fillRect(x * 8 + 1, y * 16 + 6, 6, 5); g.fillStyle = '#16121f'; g.fillRect(x * 8 + 2, y * 16 + 7, 4, 3); g.fillStyle = '#6a6488'; g.fillRect(x * 8 + 3, y * 16 + 8, 2, 1); }   // air-con unit
        }
        g.fillStyle = '#2d2040'; g.fillRect(0, y * 16 + 12, w, 3);   // balcony slab
      }
      for (let i = 0; i < 3; i++) { g.fillStyle = '#34284a'; g.fillRect((r() * 16 | 0) * 8 + 3, 0, 1, h); }   // pipes
      g.fillStyle = pal[2]; g.globalAlpha = 0.85; g.fillRect((r() * 15 | 0) * 8 + 5, 0, 2, h); g.globalAlpha = 1;   // a neon strip down the face
    } else if (style === 'strips') {
      for (let y = 0; y < 8; y++) {
        let x = 0;
        while (x < w) { const sl = 32 + ((r() * 3) | 0) * 16, on = r() < 0.8; if (on) { g.fillStyle = pal[0]; g.globalAlpha = 0.65 + r() * 0.35; g.fillRect(x, y * 32 + 8, sl, 14); g.globalAlpha = 1; } x += sl; }
        g.fillStyle = 'rgba(5,6,16,.9)'; for (let m = 0; m < w; m += 16) g.fillRect(m, y * 32 + 6, 2, 17);
        g.fillStyle = pal[1]; g.globalAlpha = 0.9; g.fillRect(0, y * 32, w, 2); g.globalAlpha = 1;
      }
      g.fillStyle = pal[1]; g.globalAlpha = 0.55; for (let m = 0; m < w; m += 64) g.fillRect(m, 0, 2, h); g.globalAlpha = 1;
    } else if (style === 'industrial') {
      for (let y = 0; y < 8; y++) {
        g.fillStyle = '#1d2840'; g.fillRect(0, y * 32 + 28, w, 3); g.fillStyle = '#34486f'; g.fillRect(0, y * 32 + 28, w, 1);
        for (let x = 0; x < 4; x++) if (r() < 0.3) { g.fillStyle = '#05070d'; g.fillRect(x * 32 + 3, y * 32 + 6, 26, 14); g.fillStyle = pal[0]; g.globalAlpha = 0.6 + r() * 0.4; g.fillRect(x * 32 + 5, y * 32 + 8, 22, 10); g.globalAlpha = 1; }
        if (r() < 0.5) { g.fillStyle = pal[1]; g.fillRect((r() * 30 | 0) * 4 + 2, y * 32 + 24, 3, 3); }
      }
      g.fillStyle = '#e6b800'; for (let x = -16; x < w; x += 16) { g.beginPath(); g.moveTo(x, 224); g.lineTo(x + 8, 224); g.lineTo(x + 16, 238); g.lineTo(x + 8, 238); g.fill(); }   // hazard band
      g.fillStyle = '#10131c'; g.fillRect(0, 238, w, 2);
    } else {   // temple
      for (let y = 0; y < 8; y++) {
        g.fillStyle = '#7a2a30'; g.fillRect(0, y * 32, w, 4); g.fillStyle = '#c9a13a'; g.fillRect(0, y * 32 + 4, w, 1);
        for (let x = 0; x < 8; x++) {
          const lit = r() < 0.7; g.fillStyle = lit ? pal[0] : '#2a1018'; g.globalAlpha = lit ? 0.55 + r() * 0.45 : 1; g.fillRect(x * 16 + 3, y * 32 + 8, 10, 18); g.globalAlpha = 1;
          g.fillStyle = '#1a0a11'; g.fillRect(x * 16 + 7, y * 32 + 8, 2, 18); g.fillRect(x * 16 + 3, y * 32 + 16, 10, 2);
          g.fillStyle = '#6a1f2a'; g.fillRect(x * 16, y * 32 + 4, 2, 28);
          if (r() < 0.25) { g.fillStyle = '#ff3a4a'; g.fillRect(x * 16 + 5, y * 32 + 28, 4, 4); }
        }
      }
    }
  }, true);
}
const WIN = {
  t0: winTex('grid', ['#ff3fd0', '#ffd23f'], 11), t1: winTex('grid', ['#2ff0ff', '#ff3fd0'], 12), t2: winTex('grid', ['#a35bff', '#2ff0ff'], 13),
  k0: winTex('dense', ['#ffb43a', '#ff5a4a', '#ff3fd0'], 21), k1: winTex('dense', ['#3affd0', '#ffd23f', '#2ff0ff'], 22), k2: winTex('dense', ['#ff6ab8', '#ffe27a', '#7dff4a'], 23),
  o0: winTex('temple', ['#ffcf5a'], 31), o1: winTex('temple', ['#7affea'], 32),
  d0: winTex('industrial', ['#ff9a2a', '#ff3a4a'], 41), d1: winTex('industrial', ['#2ff0ff', '#7dff4a'], 42),
  c0: winTex('strips', ['#2ff0ff', '#ffffff'], 51), c1: winTex('strips', ['#a35bff', '#ff3fd0'], 52), c2: winTex('strips', ['#9ad0ff', '#ffd23f'], 53)
};

/* ---------- sign atlases: white art on black, tinted per sign with vertex colours ---------- */
const FJ = "'Noto Sans JP','Noto Sans CJK JP','Hiragino Sans','Hiragino Kaku Gothic ProN','Yu Gothic','Meiryo','Microsoft YaHei','PingFang SC',sans-serif";
const FE = "'Russo One','Chakra Petch','Arial Black',Impact,sans-serif";
function panel(g, w, h) {
  g.fillStyle = '#05020b'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#fff'; g.lineWidth = 3; g.shadowColor = '#aaa'; g.shadowBlur = 5; g.strokeRect(4, 4, w - 8, h - 8);
  g.shadowBlur = 0; g.strokeStyle = '#777'; g.lineWidth = 1; g.strokeRect(9, 9, w - 18, h - 18);
}
function textH(g, str, w, h, font, col) {
  let size = h * 0.56; g.font = '900 ' + size + 'px ' + font;
  const mw = g.measureText(str).width, maxW = w - 24; if (mw > maxW) { size *= maxW / mw; g.font = '900 ' + size + 'px ' + font; }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#bbb'; g.shadowBlur = 7; g.fillStyle = col || '#fff';
  g.fillText(str, w / 2, h / 2 + size * 0.06); g.shadowBlur = 0;
}
function textV(g, str, w, h, font, col, top) {
  const ch = [...str], n = ch.length, y0 = top || 14, hh = h - y0 - 12, size = Math.min((w - 20) * 0.84, hh / n * 0.92);
  g.font = '900 ' + size + 'px ' + font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#bbb'; g.shadowBlur = 6; g.fillStyle = col || '#fff';
  ch.forEach((c, i) => g.fillText(c, w / 2, y0 + (i + 0.5) * hh / n + size * 0.05)); g.shadowBlur = 0;
}
const ATL = {
  v: { cw: 64, ch: 192, cols: 16, list: [], byTag: {} }, h: { cw: 192, ch: 64, cols: 5, list: [], byTag: {} },
  q: { cw: 128, ch: 128, cols: 8, list: [], byTag: {} }, b: { cw: 256, ch: 144, cols: 4, list: [], byTag: {} }
};
function cell(a, tag, draw) { const A = ATL[a]; (A.byTag[tag] = A.byTag[tag] || []).push(A.list.length); A.list.push(draw); }
const V_KANJI = ['酒場', '龍門', '夜市', '電脳', '麺屋', '薬局', '旅館', '福', '喜', '大酒店', '拉麺', '茶', '夢', '寿司', '刀', '愛', '雷', '鬼', '虎', '金', '城', '宿', '光', '夜', '武', '火', '幸運', '電器', '双喜', '占い', '歌舞伎', '寿'];
const V_ENG = ['BAR', 'HOTEL', 'CLUB', 'OPEN', 'SAKE', 'NOODLE', 'DISCO', '24H', 'TAXI', 'NEON', 'PUB', 'LIVE'];
const V_BAN = ['福', '喜', '龍', '酒', '幸運', '祭', '寿', '夢', '武', '虎', '春', '金', '光', '禅'];
const H_JP = ['ラーメン', 'カラオケ', 'ホテル', 'サイバー', 'ネオン', '居酒屋', '焼肉', '電脳街', '深夜営業', '新宿', '歌舞伎町', '夜光', 'カフェ', 'バー', 'サウナ', 'ゲーム', 'パチンコ', '歓迎光臨', '大酒店', '喫茶店', '食堂'];
const H_ENG = ['RAMEN', 'HOTEL', 'NOODLE', 'CYBER', '24H BAR', 'KARAOKE', 'SAKE', 'NEON', 'ARCADE', 'DRAGON', 'CLUB', 'TAXI', 'PHARMA', 'CAFE', 'SUSHI', 'TATTOO', 'NIGHT', 'DATA', 'LIQUOR', 'MOTEL', 'OPEN', 'WOK', 'MEGA MART', 'GYM 24', 'GAMES', 'LOVE', 'NO SLEEP', 'VR LOUNGE'];
const H_DOCK = ['DOCK 7', 'FREIGHT', 'CRANE 3', 'HAZARD', 'PORT 9', 'CARGO'];
V_KANJI.forEach((s) => cell('v', 'kanji', (g, w, h) => { panel(g, w, h); textV(g, s, w, h, FJ); }));
V_ENG.forEach((s) => cell('v', 'eng', (g, w, h) => { panel(g, w, h); textV(g, s, w, h, FE); }));
V_BAN.forEach((s) => cell('v', 'banner', (g, w, h) => {   // cloth banner: tint colour is the cloth, the characters are black
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#999'; g.fillRect(2, 3, w - 4, 7); g.fillStyle = '#fff'; g.fillRect(7, 12, w - 14, h - 26);
  g.fillStyle = '#bbb'; g.fillRect(7, 12, 3, h - 26); g.fillRect(w - 10, 12, 3, h - 26);
  g.fillStyle = '#fff'; for (let x = 7; x < w - 10; x += 8) { g.beginPath(); g.moveTo(x, h - 14); g.lineTo(x + 4, h - 4); g.lineTo(x + 8, h - 14); g.fill(); }
  textV(g, s, w, h - 14, FJ, '#000', 20);
}));
H_JP.forEach((s) => cell('h', 'jp', (g, w, h) => { panel(g, w, h); textH(g, s, w, h, FJ); }));
H_ENG.forEach((s) => cell('h', 'eng', (g, w, h) => { panel(g, w, h); textH(g, s, w, h, FE); }));
H_DOCK.forEach((s) => cell('h', 'dock', (g, w, h) => { panel(g, w, h); textH(g, s, w, h, FE); }));
// icon signs, 128 x 128
const ico = (name, fn) => cell('q', 'icon', (g, w, h) => {
  panel(g, w, h); g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round'; g.shadowColor = '#bbb'; g.shadowBlur = 7;
  fn(g, w, h); g.shadowBlur = 0;
});
ico('bowl', (g) => { g.beginPath(); g.arc(64, 62, 36, 0, Math.PI); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(40, 40); g.lineTo(92, 22); g.moveTo(50, 44); g.lineTo(100, 30); g.stroke(); g.lineWidth = 4; for (const x of [48, 64, 80]) { g.beginPath(); g.moveTo(x, 104); g.bezierCurveTo(x - 8, 96, x + 8, 90, x, 82); g.stroke(); } });
ico('martini', (g) => { g.beginPath(); g.moveTo(28, 30); g.lineTo(100, 30); g.lineTo(64, 70); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(64, 70); g.lineTo(64, 100); g.moveTo(42, 100); g.lineTo(86, 100); g.stroke(); g.beginPath(); g.arc(80, 24, 9, 0, 7); g.fill(); });
ico('eye', (g) => { g.beginPath(); g.moveTo(16, 64); g.quadraticCurveTo(64, 14, 112, 64); g.quadraticCurveTo(64, 114, 16, 64); g.stroke(); g.beginPath(); g.arc(64, 64, 16, 0, 7); g.fill(); });
ico('heart', (g) => { g.beginPath(); g.moveTo(64, 104); g.bezierCurveTo(8, 66, 24, 18, 64, 44); g.bezierCurveTo(104, 18, 120, 66, 64, 104); g.stroke(); });
ico('bolt', (g) => { g.beginPath(); g.moveTo(74, 14); g.lineTo(34, 70); g.lineTo(62, 70); g.lineTo(50, 116); g.lineTo(96, 52); g.lineTo(68, 52); g.closePath(); g.fill(); });
ico('arrow', (g) => { g.beginPath(); g.moveTo(24, 64); g.lineTo(96, 64); g.moveTo(66, 34); g.lineTo(100, 64); g.lineTo(66, 94); g.stroke(); });
ico('koi', (g) => { g.beginPath(); g.ellipse(58, 64, 36, 22, 0, 0, 7); g.stroke(); g.beginPath(); g.moveTo(94, 64); g.lineTo(118, 40); g.lineTo(118, 88); g.closePath(); g.stroke(); g.beginPath(); g.arc(42, 58, 4, 0, 7); g.fill(); });
ico('star', (g) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 22 : 48; g.lineTo(64 + Math.cos(a) * rr, 66 + Math.sin(a) * rr); } g.closePath(); g.stroke(); });
ico('moon', (g) => { g.beginPath(); g.arc(64, 64, 42, 0.5, Math.PI * 2 - 0.5); g.arc(80, 58, 34, Math.PI * 2 - 0.9, 0.9, true); g.closePath(); g.stroke(); });
ico('sakura', (g) => { g.lineWidth = 4; for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5 - Math.PI / 2; g.beginPath(); g.arc(64 + Math.cos(a) * 26, 64 + Math.sin(a) * 26, 18, 0, 7); g.stroke(); } g.beginPath(); g.arc(64, 64, 6, 0, 7); g.fill(); });
ico('yin', (g) => { g.beginPath(); g.arc(64, 64, 44, 0, 7); g.stroke(); g.beginPath(); g.arc(64, 64, 44, -Math.PI / 2, Math.PI / 2); g.arc(64, 86, 22, Math.PI / 2, -Math.PI / 2, true); g.arc(64, 42, 22, Math.PI / 2, -Math.PI / 2); g.fill(); });
ico('skull', (g) => { g.beginPath(); g.arc(64, 54, 36, Math.PI, 0); g.lineTo(92, 88); g.lineTo(36, 88); g.closePath(); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(50, 56, 9, 0, 7); g.arc(78, 56, 9, 0, 7); g.fill(); g.fillRect(54, 74, 20, 4); });
ico('dragon', (g) => { g.lineWidth = 9; g.beginPath(); g.moveTo(16, 96); g.bezierCurveTo(40, 30, 60, 120, 82, 60); g.bezierCurveTo(92, 36, 104, 40, 108, 30); g.stroke(); g.beginPath(); g.moveTo(108, 20); g.lineTo(122, 34); g.lineTo(104, 40); g.closePath(); g.fill(); });
// big billboard art, 256 x 144
const bb = (fn) => cell('b', 'bb', (g, w, h) => {
  g.fillStyle = '#05020b'; g.fillRect(0, 0, w, h); g.lineCap = 'round'; g.shadowColor = '#aaa'; g.shadowBlur = 6; fn(g, w, h); g.shadowBlur = 0;
  g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6);
});
bb((g, w, h) => { const gr = g.createLinearGradient(0, 20, 0, 100); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#888'); g.fillStyle = gr; g.beginPath(); g.arc(w / 2, 70, 52, Math.PI, 0); g.fill(); g.fillStyle = '#05020b'; for (let i = 0; i < 5; i++) g.fillRect(0, 56 + i * 7, w, 1.5 + i * 0.9); g.strokeStyle = '#ccc'; g.lineWidth = 2; for (let i = -8; i <= 8; i++) { g.beginPath(); g.moveTo(w / 2, 100); g.lineTo(w / 2 + i * 34, h); g.stroke(); } for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(0, 100 + k * k * 2.6); g.lineTo(w, 100 + k * k * 2.6); g.stroke(); } });
bb((g, w, h) => { g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.arc(w / 2, h / 2, 54, 0, 7); g.stroke(); g.lineWidth = 2; g.beginPath(); g.arc(w / 2, h / 2, 62, 0, 7); g.stroke(); g.font = '900 86px ' + FJ; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText('龍', w / 2, h / 2 + 6); });
bb((g, w, h) => { g.fillStyle = '#fff'; for (let i = 0; i < 20; i++) { const bh = 14 + hash(i * 3.1) * 90; for (let y = h - 14; y > h - 14 - bh; y -= 8) g.fillRect(14 + i * 11, y - 5, 8, 5); } });
bb((g, w, h) => { g.strokeStyle = '#fff'; g.lineWidth = 3; for (let k = 0; k < 6; k++) { g.globalAlpha = 1 - k * 0.14; g.beginPath(); for (let x = 8; x < w - 8; x += 4) { const y = h / 2 + Math.sin(x * 0.07 + k * 0.7) * (30 - k * 3) + (k - 3) * 8; x === 8 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); } g.globalAlpha = 1; });
bb((g, w, h) => { g.strokeStyle = '#fff'; g.lineWidth = 5; g.beginPath(); g.moveTo(w / 2, 14); g.lineTo(w / 2 + 70, h - 16); g.lineTo(w / 2 - 70, h - 16); g.closePath(); g.stroke(); g.beginPath(); g.ellipse(w / 2, h / 2 + 14, 34, 18, 0, 0, 7); g.stroke(); g.beginPath(); g.arc(w / 2, h / 2 + 14, 9, 0, 7); g.fill(); });
bb((g, w, h) => { textH(g, 'CYBERSLIDE', w, h * 0.8, FE); g.fillStyle = '#fff'; g.fillRect(24, h - 34, w - 48, 4); g.font = '700 16px ' + FE; g.textAlign = 'center'; g.fillText('RIDE THE NEON', w / 2, h - 16); });
bb((g, w, h) => { textH(g, 'SAKE 99', w, h * 0.8, FE); g.font = '900 30px ' + FJ; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText('酒', w / 2, h - 22); });
bb((g, w, h) => { g.strokeStyle = '#fff'; g.lineWidth = 5; g.strokeRect(78, 24, 100, 84); g.beginPath(); g.moveTo(128, 24); g.lineTo(128, 10); g.stroke(); g.beginPath(); g.arc(128, 8, 5, 0, 7); g.fill(); g.fillStyle = '#fff'; g.fillRect(100, 52, 18, 16); g.fillRect(138, 52, 18, 16); g.fillRect(104, 86, 48, 6); g.strokeRect(96, 108, 64, 14); });
bb((g, w, h) => { textH(g, '電脳 CITY', w, h * 0.9, FJ); });
bb((g, w, h) => { g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.moveTo(24, h - 30); g.lineTo(80, h - 60); g.lineTo(120, h - 46); g.lineTo(190, 34); g.lineTo(224, 28); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(236, 26); g.lineTo(212, 12); g.lineTo(212, 44); g.fill(); g.font = '900 24px ' + FE; g.textAlign = 'left'; g.fillText('MEGACORP', 22, 34); });
bb((g, w, h) => { g.fillStyle = '#fff'; for (let x = -h; x < w; x += 36) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 18, h); g.lineTo(x + 18 + h, 0); g.lineTo(x + h, 0); g.fill(); } g.fillStyle = '#05020b'; g.fillRect(40, 44, w - 80, 56); textH(g, 'KEEP CLEAR', w - 80, 56, FE); });
bb((g, w, h) => { g.strokeStyle = '#fff'; g.lineWidth = 3; for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) { const x = 24 + c * 28 + (r % 2) * 14, y = 22 + r * 26; g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.lineTo(x + Math.cos(a) * 13, y + Math.sin(a) * 13); } g.closePath(); g.stroke(); } });
bb((g, w, h) => { g.font = '900 80px ' + FE; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText('24', w / 2 - 28, h / 2); g.font = '900 36px ' + FE; g.fillText('HRS', w / 2 + 60, h / 2 + 14); g.fillRect(30, h - 24, w - 60, 4); });
const ALLCJK = [...new Set((V_KANJI.concat(V_BAN, H_JP, ['電脳龍酒']).join('')).split(''))].join('');
const atlasTex = {};
function drawAtlas(a) {
  const A = ATL[a]; let c = A.canvas;
  if (!c) { c = A.canvas = document.createElement('canvas'); c.width = c.height = 1024; }
  const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1024, 1024); g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 1024);
  A.list.forEach((fn, i) => {
    g.save(); g.translate((i % A.cols) * A.cw, Math.floor(i / A.cols) * A.ch); g.beginPath(); g.rect(0, 0, A.cw, A.ch); g.clip(); fn(g, A.cw, A.ch); g.restore();
  });
  if (!atlasTex[a]) { const t = atlasTex[a] = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; } else atlasTex[a].needsUpdate = true;
}
Object.keys(ATL).forEach(drawAtlas);
// scrolling ticker strip
const tickCv = document.createElement('canvas'); tickCv.width = 1024; tickCv.height = 32;
function drawTicker() {
  const g = tickCv.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 32); g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.font = '900 20px ' + FJ;
  g.fillText('歓迎光臨  ★  24 HOURS  ★  ネオン街  ★  CYBERSLIDE  ★  深夜営業  ★  NO SLEEP  ★  電脳  ★  ', 6, 17);
  g.fillRect(0, 0, 1024, 2); g.fillRect(0, 30, 1024, 2);
}
drawTicker();
const tickTex = new THREE.CanvasTexture(tickCv); tickTex.magFilter = tickTex.minFilter = THREE.NearestFilter; tickTex.generateMipmaps = false; tickTex.wrapS = THREE.RepeatWrapping;
// when the web fonts arrive, redraw the lettering with them
try {
  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load('900 40px "Noto Sans JP"', ALLCJK), document.fonts.load('40px "Russo One"', 'ABCDEFG 0123')]).then(() => { Object.keys(ATL).forEach(drawAtlas); drawTicker(); tickTex.needsUpdate = true; }).catch(() => {});
  }
} catch (e) { /* ignore */ }
const glowTex = tex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
const beamTex = tex(32, 128, (g, w, h) => { const gx = g.createLinearGradient(0, 0, w, 0); gx.addColorStop(0, 'rgba(255,255,255,0)'); gx.addColorStop(0.5, 'rgba(255,255,255,1)'); gx.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gx; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'destination-in'; const gy = g.createLinearGradient(0, 0, 0, h); gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(0.7, 'rgba(0,0,0,.55)'); gy.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = gy; g.fillRect(0, 0, w, h); });
const steamTex = tex(64, 128, (g, w, h) => {
  const r = rngf(77);
  for (let i = 0; i < 26; i++) { const x = 8 + r() * 48, y = r() * h, rad = 6 + r() * 11; for (const dy of [-h, 0, h]) { const gr = g.createRadialGradient(x, y + dy, 0, x, y + dy, rad); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - rad, y + dy - rad, rad * 2, rad * 2); } }
}, true);
steamTex.minFilter = THREE.LinearFilter; steamTex.magFilter = THREE.LinearFilter;

/* ---------- materials ---------- */
const M = {};
const add = (n, p) => { p.transparent = !!p.blending; if (p.blending) p.depthWrite = false; M[n] = new THREE.MeshBasicMaterial(p); return M[n]; };
add('solid', { vertexColors: true });
add('solid2', { vertexColors: true, side: THREE.DoubleSide });
add('glow', { map: glowTex, vertexColors: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
add('beam', { map: beamTex, vertexColors: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
add('tick', { map: tickTex, vertexColors: true, side: THREE.DoubleSide });
const STEAMS = [0, 1, 2].map((i) => { const t = steamTex.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; return add('steam' + i, { map: t, vertexColors: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: true }); });
Object.keys(WIN).forEach((k) => add('w_' + k, { map: WIN[k] }));
['v', 'h', 'q', 'b'].forEach((a) => ['0', 'A', 'B', 'C'].forEach((st) => add(a + st, { map: atlasTex[a], vertexColors: true, side: THREE.DoubleSide })));
add('bc0', { map: atlasTex.b, vertexColors: true, side: THREE.DoubleSide }); add('bc1', { map: atlasTex.b, vertexColors: true, side: THREE.DoubleSide });
const cableMat = new THREE.LineBasicMaterial({ color: 0x6f58b0 });

/* ---------- geometry batcher: everything in a chunk merges into one mesh per material ---------- */
function Batch() { this.g = {}; this.lines = []; }
Batch.prototype.part = function (key) { return this.g[key] || (this.g[key] = { p: [], u: [], c: [], i: [], n: 0 }); };
// quad: four [x,y,z] corners in order bottom-left, bottom-right, top-right, top-left
Batch.prototype.quad = function (key, a, b, c, d, uv, col) {
  const P = this.part(key), n = P.n, col3 = col || [1, 1, 1], u = uv || [0, 0, 1, 1];
  P.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2]);
  P.u.push(u[0], u[1], u[2], u[1], u[2], u[3], u[0], u[3]);
  for (let k = 0; k < 4; k++) P.c.push(col3[0], col3[1], col3[2]);
  P.i.push(n, n + 1, n + 2, n, n + 2, n + 3); P.n += 4;
};
Batch.prototype.tri = function (key, a, b, c, col) {
  const P = this.part(key), n = P.n;
  P.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); P.u.push(0, 0, 1, 0, 0.5, 1);
  for (let k = 0; k < 3; k++) P.c.push(col[0], col[1], col[2]);
  P.i.push(n, n + 1, n + 2); P.n += 3;
};
Batch.prototype.line = function (a, b) { this.lines.push(a[0], a[1], a[2], b[0], b[1], b[2]); };
Batch.prototype.cable = function (a, b, sag, n) {   // sagging wire
  n = n || 8; let prev = a;
  for (let i = 1; i <= n; i++) { const t = i / n, p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]; this.line(prev, p); prev = p; }
};
Batch.prototype.build = function (group) {
  for (const key in this.g) {
    const P = this.g[key]; if (!P.n) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P.p), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(P.u), 2));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(P.c), 3));
    geo.setIndex(new THREE.BufferAttribute(P.n > 65000 ? new Uint32Array(P.i) : new Uint16Array(P.i), 1));
    geo.computeBoundingSphere();
    group.add(new THREE.Mesh(geo, M[key]));
  }
  if (this.lines.length) {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.lines), 3)); geo.computeBoundingSphere();
    group.add(new THREE.LineSegments(geo, cableMat));
  }
};
// solid-colour helpers (vertex colours, lightly shaded so the shapes read)
const SH = { top: 1, zp: 0.86, xp: 0.74, xm: 0.8, zm: 0.62 };
function box(B, x, y0, z, w, h, d, col, flat, key) {
  const k = key || 'solid', x0 = x - w / 2, x1 = x + w / 2, y1 = y0 + h, z0 = z - d / 2, z1 = z + d / 2, f = flat ? 1 : 0, s = (v) => mulc(col, f ? 1 : v);
  B.quad(k, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], null, s(SH.zp));
  B.quad(k, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], null, s(SH.xp));
  B.quad(k, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], null, s(SH.xm));
  B.quad(k, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], null, s(SH.zm));
  B.quad(k, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], null, s(SH.top));
}
// round or square tapered solid (n sides), flat top cap
function frus(B, x, y0, z, rb, rt, h, n, col, rot, flat) {
  const y1 = y0 + h, pts = [];
  for (let i = 0; i < n; i++) { const a = (rot || 0) + i * Math.PI * 2 / n; pts.push([Math.cos(a), Math.sin(a)]); }
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n], am = (rot || 0) + (i + 0.5) * Math.PI * 2 / n;
    const sh = flat ? 1 : 0.62 + 0.38 * Math.max(0, Math.cos(am - 0.5)), c = mulc(col, sh);
    B.quad('solid', [x + p[0] * rb, y0, z + p[1] * rb], [x + q[0] * rb, y0, z + q[1] * rb], [x + q[0] * rt, y1, z + q[1] * rt], [x + p[0] * rt, y1, z + p[1] * rt], null, c);
  }
  if (rt > 0.01) for (let i = 1; i < n - 1; i++) B.tri('solid', [x + pts[0][0] * rt, y1, z + pts[0][1] * rt], [x + pts[i][0] * rt, y1, z + pts[i][1] * rt], [x + pts[i + 1][0] * rt, y1, z + pts[i + 1][1] * rt], mulc(col, flat ? 1 : 1.05));
}
// hip roof: rectangular, sloping on four sides
function hip(B, x, y0, z, hwb, hdb, hwt, hdt, h, col) {
  const y1 = y0 + h, c = (v) => mulc(col, v);
  B.quad('solid', [x - hwb, y0, z + hdb], [x + hwb, y0, z + hdb], [x + hwt, y1, z + hdt], [x - hwt, y1, z + hdt], null, c(0.9));
  B.quad('solid', [x + hwb, y0, z + hdb], [x + hwb, y0, z - hdb], [x + hwt, y1, z - hdt], [x + hwt, y1, z + hdt], null, c(0.72));
  B.quad('solid', [x - hwb, y0, z - hdb], [x - hwb, y0, z + hdb], [x - hwt, y1, z + hdt], [x - hwt, y1, z - hdt], null, c(0.8));
  B.quad('solid', [x + hwb, y0, z - hdb], [x - hwb, y0, z - hdb], [x - hwt, y1, z - hdt], [x + hwt, y1, z - hdt], null, c(0.6));
  if (hwt > 0.01) B.quad('solid', [x - hwt, y1, z + hdt], [x + hwt, y1, z + hdt], [x + hwt, y1, z - hdt], [x - hwt, y1, z - hdt], null, c(1));
}
// textured facade prism (sides only, windows tile 10 m x 14 m) + roof cap
function prism(B, key, x, y0, z, w, h, d, r, roofCol) {
  const x0 = x - w / 2, x1 = x + w / 2, y1 = y0 + h, z0 = z - d / 2, z1 = z + d / 2, uo = r(), vo = ((r() * 16) | 0) / 16, v0 = vo, v1 = vo + h / 14;
  const ux = w / 10, uz = d / 10;
  B.quad(key, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [uo, v0, uo + ux, v1]);
  B.quad(key, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [uo, v0, uo + uz, v1]);
  B.quad(key, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [uo, v0, uo + uz, v1]);
  B.quad(key, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [uo, v0, uo + ux, v1]);
  B.quad('solid', [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], null, roofCol || [0.1, 0.07, 0.17]);
}
function cylTex(B, key, x, y0, z, rad, h, n, r) {
  const uo = r(), vo = ((r() * 16) | 0) / 16, circ = Math.PI * 2 * rad / 10;
  for (let i = 0; i < n; i++) {
    const a0 = i * Math.PI * 2 / n, a1 = (i + 1) * Math.PI * 2 / n;
    B.quad(key, [x + Math.cos(a0) * rad, y0, z + Math.sin(a0) * rad], [x + Math.cos(a1) * rad, y0, z + Math.sin(a1) * rad], [x + Math.cos(a1) * rad, y0 + h, z + Math.sin(a1) * rad], [x + Math.cos(a0) * rad, y0 + h, z + Math.sin(a0) * rad], [uo + circ * i / n, vo, uo + circ * (i + 1) / n, vo + h / 14]);
  }
  for (let i = 1; i < n - 1; i++) B.tri('solid', [x + rad, y0 + h, z], [x + Math.cos(i * Math.PI * 2 / n) * rad, y0 + h, z + Math.sin(i * Math.PI * 2 / n) * rad], [x + Math.cos((i + 1) * Math.PI * 2 / n) * rad, y0 + h, z + Math.sin((i + 1) * Math.PI * 2 / n) * rad], [0.1, 0.07, 0.17]);
}
// an atlas cell as a flat sign; right/up are the sign's axes in the world
function cellUV(a, i) {
  const A = ATL[a], cx = i % A.cols, cy = Math.floor(i / A.cols), e = 0.6 / 1024;
  return [cx * A.cw / 1024 + e, 1 - (cy + 1) * A.ch / 1024 + e, (cx + 1) * A.cw / 1024 - e, 1 - cy * A.ch / 1024 - e];
}
function sign(B, key, a, i, c, right, up, w, h, col) {
  const rx = right[0] * w / 2, ry = right[1] * w / 2, rz = right[2] * w / 2, ux = up[0] * h / 2, uy = up[1] * h / 2, uz = up[2] * h / 2;
  B.quad(key, [c[0] - rx - ux, c[1] - ry - uy, c[2] - rz - uz], [c[0] + rx - ux, c[1] + ry - uy, c[2] + rz - uz], [c[0] + rx + ux, c[1] + ry + uy, c[2] + rz + uz], [c[0] - rx + ux, c[1] - ry + uy, c[2] - rz + uz], cellUV(a, i), col);
}
function glowQ(B, x, y, z, size, col) { B.quad('glow', [x - size, y - size, z], [x + size, y - size, z], [x + size, y + size, z], [x - size, y + size, z], null, col); }
const NEON = [PINK, CYAN, YEL, ORG, GRN, VIO, RED].map(rgb);
const warm = [RED, ORG, YEL, PINK].map(rgb), cool = [CYAN, VIO, GRN, WHT].map(rgb);

/* ---------- districts ---------- */
// each district: facade textures, building sizes per row (front / middle / far), sign mix and extras (all chances)
const DIST = [
  { name: 'NEO TOKYO', rail: 3, win: ['t0', 't1', 't2'], front: { w: [9, 18], d: [11, 20], h: [30, 76], gap: [0, 3] }, mid: { h: [60, 130] }, far: { h: [90, 190] },
    types: { box: 0.4, tier: 0.3, tower: 0.15, cyl: 0.15 }, edge: 0.6, blade: 1.5, facade: 0.7, jp: 0.5, bb: 0.35, tick: 0.2, ban: 0.05, lantern: 0.07, llines: 0, pag: 0.03, steam: 0.1, cab: 2, beam: 0.25, clutter: 0.5, flick: 0.3, neon: NEON },
  { name: 'KOWLOON', rail: 1, win: ['k0', 'k1', 'k2'], front: { w: [7, 12], d: [8, 13], h: [44, 92], gap: [0, 1.5] }, mid: { h: [70, 140] }, far: { h: [90, 170] },
    types: { box: 0.7, tier: 0.15, tower: 0.15, cyl: 0 }, edge: 0.3, blade: 3.4, facade: 0.9, jp: 0.7, bb: 0.12, tick: 0.12, ban: 0.35, lantern: 0.2, llines: 0.35, pag: 0.02, steam: 0.4, cab: 4, beam: 0, clutter: 0.9, flick: 0.4, neon: warm.concat(cool.slice(0, 2), NEON) },
  { name: 'OLD TOWN', rail: 5, win: ['o0', 'o1'], front: { w: [9, 15], d: [10, 16], h: [16, 40], gap: [1, 4] }, mid: { h: [24, 56] }, far: { h: [40, 100] },
    types: { box: 0.25, tier: 0.08, roof: 0.5, pagoda: 0.3 }, edge: 0.3, blade: 1.1, facade: 0.5, jp: 0.9, bb: 0.04, tick: 0, ban: 0.8, lantern: 0.34, llines: 0.7, pag: 0.5, steam: 0.1, cab: 1, beam: 0, clutter: 0.8, flick: 0.12, neon: [RED, ORG, YEL, PINK, GRN].map(rgb) },
  { name: 'DOCKS', rail: 2, win: ['d0', 'd1'], front: { w: [12, 24], d: [14, 26], h: [14, 40], gap: [2, 9] }, mid: { h: [20, 60] }, far: { h: [40, 110] },
    types: { box: 0.35, tier: 0.1, tower: 0, cyl: 0, tank: 0.2, stack: 0.15, crane: 0.1, ware: 0.1 }, edge: 0.25, blade: 0.7, facade: 0.6, jp: 0.15, bb: 0.12, tick: 0.05, ban: 0.1, lantern: 0.03, llines: 0, pag: 0, steam: 0.9, cab: 4, beam: 0.1, clutter: 0.7, flick: 0.25, neon: [ORG, CYAN, GRN, YEL, RED].map(rgb) },
  { name: 'CORPORATE', rail: 4, win: ['c0', 'c1', 'c2'], front: { w: [14, 24], d: [16, 26], h: [50, 110], gap: [3, 9] }, mid: { h: [100, 180] }, far: { h: [130, 230] },
    types: { box: 0.35, tier: 0.35, tower: 0.2, cyl: 0.1 }, edge: 1, blade: 0.4, facade: 0.4, jp: 0.2, bb: 0.5, tick: 0.2, ban: 0, lantern: 0.02, llines: 0, pag: 0, steam: 0.05, cab: 1, beam: 0.55, clutter: 0.3, flick: 0.08, neon: [CYAN, WHT, VIO, PINK, 0x9ad0ff].map(rgb) }
];
// which district a segment is in comes from the course's shuffle bag (all five before any repeats, 420 m each)
const distOf = (k) => DIST[districtAt(k)];
const wpick = (r, t) => { let tot = 0; for (const k in t) tot += t[k]; let v = r() * tot; for (const k in t) { v -= t[k]; if (v <= 0) return k; } return 'box'; };
const between = (r, a) => a[0] + r() * (a[1] - a[0]);

/* ---------- chunk scenery ---------- */
function neonPick(r, D) { return pick(r, D.neon); }
function flickState(r, D) { return r() < D.flick ? pick(r, ['A', 'B', 'C']) : '0'; }
function build(group, k, g) {
  const D = distOf(k), r = rngf(mixSeed(k * 7717 + 31)), B = new Batch(), s0 = k * SEG;
  const zones = g.rails.filter((q) => q.win).map((q) => ({ side: q.win, a: q.s - 8, b: q.s + 20 }));
  const anch = { '-1': [], '1': [] };
  const bbKey = () => (r() < 0.5 ? 'bc' + (r() < 0.5 ? 0 : 1) : 'b0');
  for (const side of [-1, 1]) {
    for (let row = 0; row < 3; row++) {
      const R = row === 0 ? D.front : row === 1 ? Object.assign({}, D.front, D.mid, { w: [12, 24], d: [14, 26], gap: [0, 6] }) : Object.assign({}, D.front, D.far, { w: [16, 30], d: [18, 34], gap: [0, 10] });
      const off0 = row === 0 ? 28 : row === 1 ? 50 : 92, off1 = row === 0 ? 38 : row === 1 ? 66 : 128;
      let cur = s0 + r() * 3;
      while (cur < s0 + SEG - 6) {
        const d = Math.min(between(r, R.d), s0 + SEG - cur); if (d < 7) break;
        const sc = cur + d / 2, w = between(r, R.w), face = between(r, [off0, off1]), bx = C(sc) + side * (face + w / 2);
        const wing = row === 0 && zones.some((z) => z.side === side && sc + d / 2 > z.a && sc - d / 2 < z.b);
        if (!wing) {
          const h = between(r, R.h), y0 = (row === 0 ? ND.H(C(sc) + side * face, sc) : ND.base(bx, sc)) - 10;
          building(B, D, r, { side, row, bx, sc: -sc, w, d, h, y0, top: y0 + 10 + h, xf: bx - side * w / 2, face, anch: anch[side], bbKey });
        }
        cur += d + between(r, R.gap);
      }
    }
  }
  sideCables(B, D, r, anch);
  crossLines(B, D, r, k, anch, g, zones);
  clutter(B, D, r, k, s0);
  B.build(group);
}

function building(B, D, r, b) {
  const { side, row, bx, sc, w, d, h, y0, top, xf } = b, front = row === 0, tall = h + 10;
  const key = 'w_' + pick(r, D.win), col = neonPick(r, D), type = front || row === 1 ? wpick(r, D.types) : (r() < 0.55 ? 'box' : r() < 0.7 ? 'tier' : 'tower');
  let roofY = top, rw = w, rd = d;
  if (type === 'tower') {
    const tw = Math.min(w, 8 + r() * 3), td = Math.min(d, 8 + r() * 3);
    prism(B, key, bx, y0, sc, tw, tall, td, r); rw = tw; rd = td;
    box(B, bx, top, sc, tw * 0.5, 4, td * 0.5, [0.12, 0.09, 0.2]); box(B, bx, top + 4, sc, 0.6, 12 + r() * 14, 0.6, [0.2, 0.18, 0.3]);
    box(B, bx, top + 15, sc, 1.1, 0.5, 1.1, rgb(RED), true); glowQ(B, bx, top + 15.2, sc + 0.8, 2.2, rgb(RED)); roofY = top + 4;
  } else if (type === 'tier') {
    const h1 = tall * 0.55, h2 = tall * 0.3, h3 = tall - h1 - h2, sh = side;   // setbacks step away from the track
    prism(B, key, bx, y0, sc, w, h1, d, r);
    const w2 = w * 0.78, d2 = d * 0.85, x2 = bx + sh * (w - w2) / 2;
    prism(B, key, x2, y0 + h1, sc, w2, h2, d2, r);
    const w3 = w2 * 0.6, d3 = d2 * 0.62, x3 = x2 + sh * (w2 - w3) / 2;
    prism(B, key, x3, y0 + h1 + h2, sc, w3, h3, d3, r);
    for (const [yy, ww, dd, xx] of [[y0 + h1, w2, d2, x2], [y0 + h1 + h2, w3, d3, x3]]) box(B, xx, yy - 0.12, sc, ww + 0.3, 0.3, dd + 0.3, col, true);
    roofY = top; rw = w3; rd = d3; b.rx = x3;
  } else if (type === 'cyl') {
    const rad = Math.min(w, d) * 0.5; cylTex(B, key, bx, y0, sc, rad, tall, 12, r);
    frus(B, bx, top, sc, rad + 0.25, rad + 0.25, 0.4, 12, col, 0, true); rw = rad * 1.6; rd = rad * 1.6;
  } else if (type === 'pagoda') {
    const hw = Math.min(6.4, Math.min(w, d) * 0.5), gy = y0 + 10, base = hw * 1.5;
    box(B, bx, y0, sc, base * 2, 10 + 1.4, base * 2, [0.2, 0.12, 0.24]); box(B, bx - side * 0, gy + 1.3, sc + base, base * 2 + 0.3, 0.25, 0.25, col, true);
    pagoda(B, D, r, bx, gy + 1.4, sc, hw, 3 + ((r() * 3) | 0)); return;
  } else if (type === 'roof') {
    prism(B, key, bx, y0, sc, w, tall, d, r);
    hip(B, bx, top - 0.2, sc, w / 2 + 2.2, d / 2 + 2.2, w * 0.14, d * 0.14, 3.6 + r() * 2, pick(r, [[0.1, 0.38, 0.45], [0.38, 0.1, 0.2], [0.14, 0.14, 0.4]]));
    box(B, bx, top - 0.5, sc, w + 4.7, 0.3, d + 4.7, col, true); roofY = top + 4;
  } else if (type === 'tank') {
    const rad = Math.min(w, d) * 0.45; frus(B, bx, y0, sc, rad, rad, tall * 0.7 + 4, 14, [0.22, 0.24, 0.36], 0, false);
    frus(B, bx, y0 + tall * 0.7 + 4, sc, rad, rad * 0.5, 2.4, 14, [0.3, 0.3, 0.44]);
    for (let i = 0; i < 3; i++) frus(B, bx, y0 + 10 + i * (tall * 0.7 - 8) / 3, sc, rad + 0.12, rad + 0.12, 1.4, 14, i % 2 ? [0.9, 0.7, 0.1] : [0.1, 0.1, 0.12], 0, true);
    roofY = y0 + tall * 0.7 + 6.4; rw = rd = 0;
  } else if (type === 'stack') {
    const rad = 2 + r() * 1.5, hh = tall + 14;
    for (let i = 0; i < 6; i++) frus(B, bx, y0 + i * hh / 6, sc, rad - i * 0.08, rad - (i + 1) * 0.08, hh / 6, 10, i % 2 ? [0.9, 0.9, 0.95] : [0.85, 0.12, 0.15]);
    frus(B, bx, y0 + hh, sc, rad - 0.2, rad - 0.2, 0.7, 10, rgb(ORG), 0, true); glowQ(B, bx, y0 + hh + 0.8, sc + 1.2, 4.5, rgb(ORG));
    steam(B, r, bx, y0 + hh + 0.8, sc, 9 + r() * 6, 30); roofY = y0 + hh; rw = rd = 0;
  } else if (type === 'crane') {
    const hh = tall + 18, cc = [0.2, 0.22, 0.34];
    for (const dz of [-d * 0.35, d * 0.35]) for (const dx of [-w * 0.3, w * 0.3]) box(B, bx + dx, y0, sc + dz, 0.9, hh, 0.9, cc);
    box(B, bx, y0 + hh, sc, w * 0.9, 1.4, d * 0.9, cc); box(B, bx - side * w * 0.9, y0 + hh + 0.3, sc, w * 1.8, 1, 1, cc);
    box(B, bx - side * w * 1.7, y0 + hh - 3, sc, 0.5, 6, 0.5, rgb(ORG), true); glowQ(B, bx - side * w * 1.7, y0 + hh - 3, sc + 1, 2.4, rgb(ORG)); roofY = y0 + hh + 1.4; rw = rd = 0;
  } else if (type === 'ware') {
    prism(B, key, bx, y0, sc, w * 1.1, Math.min(tall, 20), d, r); roofY = y0 + Math.min(tall, 20); rw = w; rd = d;
    box(B, bx, roofY, sc, w * 1.1, 1.4, 1.2, rgb(ORG), true);
  } else {
    prism(B, key, bx, y0, sc, w, tall, d, r); rw = w; rd = d;
    if (front) { box(B, xf - side * 0.1, top - 0.1, sc, 0.3, 0.3, d + 0.3, col, true); box(B, bx, top - 0.1, sc + d / 2 + 0.1, w + 0.3, 0.3, 0.3, col, true); }
  }
  const visible = front || row === 1;
  if (visible) { b.roofY = roofY; b.rw = rw; b.rd = rd; facade(B, D, r, b, type, col); roof(B, D, r, b, type, col); }
  else if (r() < 0.35) { box(B, bx, roofY, sc, 0.8, 8 + r() * 10, 0.8, [0.2, 0.18, 0.3]); box(B, bx, roofY + 8, sc, 1, 0.5, 1, rgb(RED), true); glowQ(B, bx, roofY + 8.4, sc + 0.8, 2.6, rgb(RED)); }
  if (front && h > 24 && type !== 'tank' && type !== 'stack' && type !== 'crane') b.anch.push({ x: xf, s: -sc, top, h, gy: y0 + 10, side });
}

function facade(B, D, r, b, type, col) {
  const { side, row, sc, w, d, y0, top, xf } = b, lo = y0 + 16, hi = Math.max(lo + 2, top - 4), front = row === 0, avail = top - lo - 1;
  if (type === 'tank' || type === 'stack' || type === 'crane') return;
  const n = avail < 5 ? 0 : Math.round(D.blade * (front ? 1 : 0.4) * (0.5 + r()));
  for (let i = 0; i < n; i++) {   // blade signs: stick out from the face so they read from the track
    const vert = r() < 0.7, c = neonPick(r, D), z = sc + d / 2 - 0.8 - r() * Math.max(0, d - 3), st = r() < 0.2 ? '0' : flickState(r, D);
    if (vert) {
      const cells = ATL.v.byTag[r() < D.jp ? 'kanji' : 'eng'], ci = pick(r, cells), hh = Math.min(7 + r() * 3, avail), ww = hh / 3, yy = lo + hh / 2 + r() * Math.max(0, avail - hh);
      sign(B, 'v' + st, 'v', ci, [xf - side * (ww / 2 + 0.3), yy, z], [1, 0, 0], [0, 1, 0], ww, hh, c);
      box(B, xf - side * 0.15, yy + hh / 2 + 0.1, z, 0.5, 0.2, 0.2, [0.15, 0.13, 0.22]);
    } else {
      const ci = pick(r, ATL.q.byTag.icon), s = Math.min(3 + r() * 1.5, avail), yy = lo + s / 2 + r() * Math.max(0, avail - s);
      sign(B, 'q' + st, 'q', ci, [xf - side * (s / 2 + 0.3), yy, z], [1, 0, 0], [0, 1, 0], s, s, c);
    }
  }
  if (front && avail > 16 && r() < D.bb) {   // giant screen jutting out of the face, seen head-on as you approach
    const k = b.bbKey(), ci = pick(r, ATL.b.byTag.bb), ww = Math.min(9 + r() * 5, d + 4), hh = ww * 0.5625, yy = lo + hh / 2 + 2 + r() * Math.max(0, avail - hh - 4), z = sc + d / 2 - 0.5 - r() * 2, cx = xf - side * (ww / 2 + 0.4), cc = k === 'b0' ? neonPick(r, D) : [1, 1, 1];
    sign(B, k, 'b', ci, [cx, yy, z], [1, 0, 0], [0, 1, 0], ww, hh, cc);
    box(B, cx, yy + hh / 2, z - 0.1, ww + 0.5, 0.3, 0.3, col, true); box(B, cx, yy - hh / 2, z - 0.1, ww + 0.5, 0.3, 0.3, col, true);
    box(B, cx - ww / 2, yy, z - 0.1, 0.3, hh, 0.3, col, true); box(B, cx + ww / 2, yy, z - 0.1, 0.3, hh, 0.3, col, true);
    box(B, xf - side * 0.5, yy, z - 0.2, 1, 0.3, 0.3, [0.15, 0.13, 0.22]); glowQ(B, cx, yy, z + 0.8, ww * 0.7, mulc(cc, 0.35));
  }
  if (avail > 4 && r() < D.facade * (front ? 1 : 0.4)) {   // horizontal sign flat on the face toward the track
    const pool = D.name === 'DOCKS' && r() < 0.6 ? 'dock' : r() < D.jp ? 'jp' : 'eng', ci = pick(r, ATL.h.byTag[pool]), ww = Math.min(d - 1.5, 9), c = neonPick(r, D);
    sign(B, 'h' + flickState(r, D), 'h', ci, [xf - side * 0.12, lo + r() * (hi - lo), sc + (r() - 0.5) * Math.max(0, d - ww - 1)], [0, 0, side], [0, 1, 0], ww, ww / 3, c);
  }
  if (avail > 4 && r() < D.facade * 0.5 * (front ? 1 : 0.3)) {   // second one on the face toward the approaching rider
    const ci = pick(r, ATL.h.byTag[r() < D.jp ? 'jp' : 'eng']), ww = Math.min(w - 1.5, 9);
    sign(B, 'h' + flickState(r, D), 'h', ci, [b.bx, lo + 4 + r() * (hi - lo), sc + d / 2 + 0.12], [1, 0, 0], [0, 1, 0], ww, ww / 3, neonPick(r, D));
  }
  if (avail > 4 && r() < D.ban * (front ? 1 : 0.3)) {   // cloth banners hanging from the corner of the face
    const ci = pick(r, ATL.v.byTag.banner), hh = Math.min(6 + r() * 2.5, Math.max(3, avail - 1)), yy = Math.min(top - 3.5, lo + 4 + r() * 12) - hh / 2, c = pick(r, [rgb(RED), rgb(RED), [0.9, 0.1, 0.25], rgb(YEL), [0.15, 0.2, 0.8]]);
    for (let i = 0; i < 1 + (r() < 0.5 ? 1 : 0); i++) {
      const z = sc + d / 2 - 1 - i * 3.2;
      box(B, xf - side * 1.1, yy + hh / 2 + 0.2, z, 2.4, 0.18, 0.18, [0.2, 0.15, 0.1]);
      sign(B, 'v0', 'v', ci, [xf - side * 1.1, yy, z], [1, 0, 0], [0, 1, 0], 1.9, hh, c);
    }
  }
  if (r() < D.llines && front) {   // a string of lanterns along the face
    const yy = Math.min(y0 + 18 + r() * 8, top - 3), z0 = sc - d / 2 + 1.5, z1 = sc + d / 2 - 1.5, x = xf - side * 0.9;
    B.cable([x, yy + 1, z0], [x, yy + 1, z1], 0.5, 6);
    const m = Math.max(3, Math.floor(d / 2.4));
    for (let i = 0; i < m; i++) { const t = (i + 0.5) / m, zz = z0 + (z1 - z0) * t; lantern(B, x, yy + 1 - 2 * 0.5 * 4 * t * (1 - t) * 0.5 - 0.4, zz, r); }
  }
  if (avail > 4 && r() < D.tick * (front ? 1 : 0.3) && d > 9) {   // scrolling ticker band
    const yy = lo + r() * (hi - lo), ww = Math.min(d - 1, 22);
    B.quad('tick', [xf - side * 0.14, yy - 0.8, sc + (side > 0 ? -ww / 2 : ww / 2)], [xf - side * 0.14, yy - 0.8, sc + (side > 0 ? ww / 2 : -ww / 2)], [xf - side * 0.14, yy + 0.8, sc + (side > 0 ? ww / 2 : -ww / 2)], [xf - side * 0.14, yy + 0.8, sc + (side > 0 ? -ww / 2 : ww / 2)], [0, 0, ww / 22, 1], neonPick(r, D));
  }
  if (front && r() < D.edge) {   // neon strips down the corners and a glowing crown
    const hh = Math.min(top - y0 - 12, 60);
    box(B, xf - side * 0.1, top - hh, sc + d / 2 + 0.1, 0.3, hh, 0.3, col, true); box(B, xf + side * (w - 0.1), top - hh, sc + d / 2 + 0.1, 0.3, hh, 0.3, col, true);
    box(B, b.bx, top, sc + d / 2 + 0.1, w + 0.4, 0.4, 0.4, col, true); box(B, xf - side * 0.1, top, sc, 0.4, 0.4, d + 0.4, col, true);
  }
}
function roof(B, D, r, b, type, col) {
  const { side, bx, sc, d, w, roofY: ry } = b, rx = b.rx || bx;
  if (type === 'tank' || type === 'stack' || type === 'crane' || type === 'ware') { if (type === 'ware' && r() < D.steam) steam(B, r, bx, ry, sc, 8 + r() * 5, 24); return; }
  if (b.row === 0 && r() < D.bb * 0.4 && w > 10) {   // billboard on posts, facing the approaching rider
    const k = b.bbKey(), ci = pick(r, ATL.b.byTag.bb), ww = Math.min(w + 4, 18), hh = ww * 0.5625, cc = k === 'b0' ? pick(r, D.neon) : [1, 1, 1];
    box(B, rx - ww * 0.3, ry, sc + d * 0.2, 0.6, 3.4, 0.6, [0.15, 0.13, 0.22]); box(B, rx + ww * 0.3, ry, sc + d * 0.2, 0.6, 3.4, 0.6, [0.15, 0.13, 0.22]);
    sign(B, k, 'b', ci, [rx, ry + 3.4 + hh / 2, sc + d * 0.2 + 0.4], [1, 0, 0], [0, 1, 0], ww, hh, cc);
    box(B, rx, ry + 3.4 + hh, sc + d * 0.2, ww + 0.6, 0.35, 0.5, col, true); box(B, rx, ry + 3.2, sc + d * 0.2, ww + 0.6, 0.35, 0.5, col, true);
    return;
  }
  const n = 1 + ((r() * 2) | 0);
  for (let i = 0; i < n; i++) {
    const v = r(), x = rx + (r() - 0.5) * Math.max(0, (b.rw || w) - 3), z = sc + (r() - 0.5) * Math.max(0, (b.rd || d) - 3);
    if (v < 0.3) box(B, x, ry, z, 2 + r() * 2.5, 1.4 + r(), 2 + r() * 2, [0.2, 0.19, 0.3]);                            // ac / machinery
    else if (v < 0.5) { frus(B, x, ry + 1.6, z, 1.6, 1.6, 2.6, 8, [0.3, 0.26, 0.4]); frus(B, x, ry + 4.2, z, 1.8, 0.1, 1.4, 8, [0.2, 0.17, 0.28]); for (const q of [-0.9, 0.9]) box(B, x + q, ry, z + q, 0.2, 1.7, 0.2, [0.15, 0.13, 0.22]); }   // water tank
    else if (v < 0.75) { box(B, x, ry, z, 0.25, 9 + r() * 8, 0.25, [0.22, 0.2, 0.32]); const hh = ry + 9 + r() * 8; box(B, x, hh, z, 0.7, 0.4, 0.7, rgb(RED), true); glowQ(B, x, hh + 0.2, z + 0.7, 1.8, rgb(RED)); }   // mast + light
    else if (v < 0.88) { frus(B, x, ry + 0.8, z, 0.2, 2.2, 1.6, 8, [0.4, 0.4, 0.5]); box(B, x, ry, z, 0.2, 1, 0.2, [0.2, 0.2, 0.3]); }   // dish
    else if (r() < D.steam + 0.2) steam(B, r, x, ry + 0.5, z, 8 + r() * 6, 22);
    else { box(B, x, ry, z, 0.2, 4 + r() * 3, 0.2, [0.2, 0.2, 0.3]); box(B, x + 1, ry + 3.8, z, 2, 0.18, 0.18, [0.2, 0.2, 0.3]); const f = pick(r, [rgb(RED), rgb(YEL), rgb(CYAN), rgb(PINK)]); B.quad('solid2', [x + 0.1, ry + 3.5, z], [x + 2.4, ry + 3.5, z], [x + 2.4, ry + 4.6, z], [x + 0.1, ry + 4.6, z], null, f); }   // flag
  }
  if (D.beam && r() < D.beam && b.row === 0 && b.h > 50) {   // searchlight beam
    const c = pick(r, [rgb(CYAN), rgb(PINK), rgb(WHT), rgb(VIO)]), x = rx, y = ry + 1, hh = 120, lean = (r() - 0.5) * 10;
    B.quad('beam', [x - 2.4, y, sc], [x + 2.4, y, sc], [x + 2.4 + lean, y + hh, sc], [x - 2.4 + lean, y + hh, sc], [0, 0, 1, 1], mulc(c, 0.7));
    B.quad('beam', [x, y, sc - 2.4], [x, y, sc + 2.4], [x + lean, y + hh, sc + 2.4], [x + lean, y + hh, sc - 2.4], [0, 0, 1, 1], mulc(c, 0.5));
  }
  if (type === 'box' && D.pag && r() < D.pag * 0.4 && b.row === 0) pagoda(B, D, r, rx, ry, sc, Math.min(w, d) * 0.5, 2);
  if (type === 'roof' || type === 'box') {   // eave lanterns on temple-style roofs
    if (D.name === 'OLD TOWN' && r() < 0.6) for (const dx of [-1, 1]) lantern(B, bx + dx * (w / 2 + 1), ry - 1.8, sc + d / 2 + 0.5, r);
  }
}
function lantern(B, x, y, z, r) {
  const c = pick(r, [rgb(RED), rgb(RED), rgb(RED), rgb(ORG), rgb(YEL), rgb(PINK)]);
  frus(B, x, y, z, 0.5, 0.5, 0.9, 8, c, 0, true); box(B, x, y + 0.9, z, 0.5, 0.12, 0.5, [0.15, 0.1, 0.05], true); box(B, x, y - 0.12, z, 0.45, 0.12, 0.45, [0.15, 0.1, 0.05], true);
  box(B, x, y - 0.6, z, 0.08, 0.5, 0.08, rgb(YEL), true); glowQ(B, x, y + 0.45, z + 0.7, 1.7, mulc(c, 0.75));
}
function steam(B, r, x, y, z, hh, wd) {
  const k = 'steam' + ((r() * 3) | 0), wb = 1.2, wt = 3.4 + r() * 1.5, v1 = hh / 8;
  B.quad(k, [x - wb, y, z], [x + wb, y, z], [x + wt, y + hh, z], [x - wt, y + hh, z], [0, 0, 1, v1], [0.5, 0.45, 0.7]);
  B.quad(k, [x, y, z - wb], [x, y, z + wb], [x, y + hh, z + wt], [x, y + hh, z - wt], [0, 0, 1, v1], [0.5, 0.45, 0.7]);
}
// fine/steep pagoda: stacked square tiers with flared hip roofs and neon eaves
function pagoda(B, D, r, x, y0, z, hw, tiers) {
  let y = y0;
  const wall = pick(r, [[0.42, 0.08, 0.16], [0.3, 0.07, 0.2]]), roofc = pick(r, [[0.08, 0.36, 0.42], [0.4, 0.09, 0.2], [0.14, 0.14, 0.42]]), trim = pick(r, [rgb(PINK), rgb(YEL), rgb(CYAN)]);
  for (let i = 0; i < tiers; i++) {
    const s = hw * (1 - i * 0.16), wh = 3.6;
    box(B, x, y, z, s * 2, wh, s * 2, wall);
    for (const dx of [-0.5, 0.5]) { B.quad('solid', [x + dx * s * 1.1 - 0.5, y + 0.8, z + s + 0.06], [x + dx * s * 1.1 + 0.5, y + 0.8, z + s + 0.06], [x + dx * s * 1.1 + 0.5, y + 2.8, z + s + 0.06], [x + dx * s * 1.1 - 0.5, y + 2.8, z + s + 0.06], null, [1, 0.8, 0.35]); }
    y += wh;
    const ov = s * 1.45;
    hip(B, x, y, z, ov, ov, s * 0.7, s * 0.7, 1.1, roofc); hip(B, x, y + 1.1, z, s * 0.7, s * 0.7, s * 0.2, s * 0.2, 1.7, roofc);
    box(B, x, y - 0.1, z + ov, ov * 2, 0.25, 0.25, trim, true); box(B, x, y - 0.1, z - ov, ov * 2, 0.25, 0.25, trim, true); box(B, x + ov, y - 0.1, z, 0.25, 0.25, ov * 2, trim, true); box(B, x - ov, y - 0.1, z, 0.25, 0.25, ov * 2, trim, true);
    for (const dx of [-1, 1]) lantern(B, x + dx * ov, y - 1.9, z + ov, r);
    y += 2.8;
  }
  box(B, x, y - 0.2, z, 0.35, 5, 0.35, [0.9, 0.7, 0.2], true); box(B, x, y + 4.4, z, 0.9, 0.9, 0.9, rgb(CYAN), true); glowQ(B, x, y + 4.8, z + 0.9, 3, rgb(CYAN));
}
// power cables hang along one side of the street only, from building to building
function sideCables(B, D, r, anch) {
  for (const key of ['-1', '1']) {
    const a = anch[key].filter((q) => q.h > 18).sort((p, q) => p.s - q.s);
    for (let i = 0; i + 1 < a.length; i++) {
      if (r() > D.cab / 4) continue;
      const p = a[i], q = a[i + 1], side = p.side;
      if (q.s - p.s > 45) continue;
      const x = (side > 0 ? Math.min(p.x, q.x) : Math.max(p.x, q.x)) - side * 0.3, y = Math.min(p.top, q.top) - 2.5 - r() * 4;
      if (y - Math.min(p.gy, q.gy) < 12) continue;
      B.cable([x, y, -p.s], [x, y - 0.5, -q.s], 1.4 + r() * 1.2, 8);
      if (r() < 0.5) B.cable([x, y - 0.9, -p.s], [x, y - 1.3, -q.s], 1.8 + r(), 8);
    }
  }
}
// the rare lantern / bunting strings strung across the track between facing buildings
function crossLines(B, D, r, k, anch, g, zones) {
  const L = anch['-1'].filter((a) => a.h > 18), R = anch['1'].filter((a) => a.h > 18);
  if (!L.length || !R.length) return;
  const wall = (x, s) => ND.wallSum(x, s) > 0.05;
  if (r() < D.lantern) {   // the rare lantern string
    if (ND.city && ND.city.log) ND.city.log.push(k);
    const a = pick(r, L), b = pick(r, R), gy = ND.H(C(a.s), a.s), y = Math.min(gy + 17 + r() * 4, Math.min(a.top, b.top) - 3);
    if (y - gy < 12) return;
    const bunting = r() < 0.3, n = 9, pa = [a.x, y, -a.s], pb = [b.x, y, -b.s - 3];
    box(B, a.x, y, -a.s, 0.8, 0.3, 0.3, [0.15, 0.1, 0.05]); box(B, b.x, y, -b.s - 3, 0.8, 0.3, 0.3, [0.15, 0.1, 0.05]);
    B.cable(pa, pb, 3.5, 16);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, px = pa[0] + (pb[0] - pa[0]) * t, py = pa[1] + (pb[1] - pa[1]) * t - 3.5 * 4 * t * (1 - t), pz = pa[2] + (pb[2] - pa[2]) * t;
      if (bunting) B.tri('solid2', [px - 0.7, py, pz], [px + 0.7, py, pz], [px, py - 1.6, pz], pick(r, [rgb(PINK), rgb(CYAN), rgb(YEL), rgb(ORG), rgb(GRN)]));
      else lantern(B, px, py - 1.5, pz, r);
    }
    if (!bunting && r() < 0.5) { const o = 5; B.cable([pa[0], pa[1] - 0.4, pa[2] - o], [pb[0], pb[1] - 0.4, pb[2] - o], 3.5, 16); for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; lantern(B, pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t - 3.5 * 4 * t * (1 - t) - 1.9, pa[2] + (pb[2] - pa[2]) * t - o, r); } }
  }
}
// street furniture between the course and the buildings (never inside the quarterpipe walls)
function clutter(B, D, r, k, s0) {
  for (const side of [-1, 1]) {
    for (let s = s0 + 4; s < s0 + SEG - 4; s += 11 + r() * 8) {
      if (r() > D.clutter) continue;
      const x = C(s) + side * (HALF + 5 + r() * 3);
      if (ND.wallSum(x, s) > 0.05 || ND.wallSum(C(s) + side * (HALF + 1), s) > 0.05) continue;
      const gy = ND.H(x, s), v = r(), c = neonPick(r, D);
      if (v < 0.45) {   // neon lamp post
        box(B, x, gy, -s, 0.28, 6.2, 0.28, [0.2, 0.19, 0.3]); box(B, x - side * 0.6, gy + 6.2, -s, 1.4, 0.3, 0.5, [0.2, 0.19, 0.3]);
        box(B, x - side * 1.1, gy + 5.95, -s, 0.5, 0.5, 0.9, c, true); glowQ(B, x - side * 1.1, gy + 5.9, -s + 0.8, 2.6, mulc(c, 0.8));
      } else if (v < 0.75) {   // vending machine
        box(B, x, gy, -s, 1.1, 1.9, 0.9, [0.18, 0.17, 0.3]); B.quad('solid', [x - 0.45, gy + 0.4, -s + 0.46], [x + 0.45, gy + 0.4, -s + 0.46], [x + 0.45, gy + 1.7, -s + 0.46], [x - 0.45, gy + 1.7, -s + 0.46], null, c); glowQ(B, x, gy + 1.1, -s + 0.9, 1.7, mulc(c, 0.6));
      } else {   // glowing bollards
        for (let i = 0; i < 3; i++) { box(B, x, gy, -s - i * 2, 0.35, 1.0, 0.35, [0.2, 0.19, 0.3]); box(B, x, gy + 1.0, -s - i * 2, 0.4, 0.2, 0.4, c, true); }
      }
    }
  }
}

/* ---------- animation + air traffic ---------- */
let T = 0, scene = null, carsB, carsL, carsU, drones, tr = [], dr = [];
const dummy = new THREE.Object3D(), tmpC = new THREE.Color();
const NC = 7, ND2 = 16, WIN_B = -60, WIN_L = 600;
// a small flying car: body (tinted per car), dark glass cabin, spoiler, head / tail lights and an underglow strip
function geoOf(B) {
  const P = B.g.solid, geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P.p), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(P.c), 3));
  geo.setIndex(new THREE.BufferAttribute(new Uint16Array(P.i), 1));
  return geo;
}
function carGeos() {
  const bd = new Batch(), lt = new Batch(), ug = new Batch(), W = [1, 1, 1], GL = [0.14, 0.2, 0.32];
  box(bd, 0, 0, 0, 3.6, 0.95, 9.2, W);                                  // lower body
  hip(bd, 0, 0.95, -2.7, 1.8, 1.9, 1.5, 0.9, 0.38, W);                   // sloping bonnet
  hip(bd, 0, 0.95, 0.7, 1.7, 2.5, 1.25, 1.35, 1.05, GL);                 // glass cabin
  box(bd, 0, 1.0, 4.3, 3.5, 0.16, 1.1, [0.3, 0.3, 0.36]);                // spoiler
  for (const x of [-1.3, 1.3]) box(bd, x, 0.8, 4.3, 0.2, 0.3, 0.3, [0.3, 0.3, 0.36]);
  for (const x of [-1.9, 1.9]) for (const z of [-2.7, 2.7]) box(bd, x, -0.35, z, 0.5, 0.5, 1.5, [0.22, 0.22, 0.28]);   // thruster pods
  for (const x of [-1.2, 1.2]) box(lt, x, 0.45, -4.62, 0.9, 0.3, 0.12, [1, 0.95, 0.65], true);   // headlights
  box(lt, 0, 0.5, 4.62, 3.2, 0.22, 0.12, [1, 0.12, 0.18], true);                                   // tail light bar
  box(ug, 0, -0.5, 0, 3.0, 0.14, 7.6, W, true);                                                     // underglow
  return [geoOf(bd), geoOf(lt), geoOf(ug)];
}
function init(sc) {
  scene = sc;
  const [gb, gl, gu] = carGeos(), mk = (g) => new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }), NC);
  carsB = mk(gb); carsL = mk(gl); carsU = mk(gu);
  drones = new THREE.InstancedMesh(new THREE.BoxGeometry(2.6, 1, 2.6), new THREE.MeshBasicMaterial({ fog: false }), ND2);
  for (const m of [carsB, carsL, carsU, drones]) { m.frustumCulled = false; scene.add(m); }
  const r = rngf(9001), bodies = [0xff3fa8, 0x2fd0ff, 0xffd23f, 0xff6a2a, 0xdcdcf4, 0x8a5cff], glows = [CYAN, PINK, ORG, YEL, GRN];
  tr = []; dr = [];
  for (let i = 0; i < NC; i++) {
    const side = r() < 0.5 ? -1 : 1;
    // most traffic cruises in sky lanes 50+ m over the course (the highest jump reaches ~35 m), a couple far out to the sides
    if (i < NC - 2) tr.push({ s0: r() * WIN_L, v: (r() < 0.5 ? -1 : 1) * (14 + r() * 22), dx: (r() - 0.5) * 36, alt: 52 + ((r() * 4) | 0) * 9 + r() * 4 });
    else tr.push({ s0: r() * WIN_L, v: (r() < 0.5 ? -1 : 1) * (14 + r() * 22), dx: side * (165 + r() * 140), alt: 38 + r() * 90 });
    carsB.setColorAt(i, tmpC.setHex(pick(r, bodies))); carsL.setColorAt(i, tmpC.setHex(WHT)); carsU.setColorAt(i, tmpC.setHex(pick(r, glows)));
  }
  for (let i = 0; i < ND2; i++) {
    const side = r() < 0.5 ? -1 : 1;
    dr.push({ s0: r() * WIN_L, v: (r() - 0.5) * 6, dx: side * (150 + r() * 160), alt: 30 + r() * 80, ph: r() * 6 });
    drones.setColorAt(i, tmpC.setHex(pick(r, [RED, CYAN, PINK, YEL])));
  }
  carsB.instanceColor.needsUpdate = carsL.instanceColor.needsUpdate = carsU.instanceColor.needsUpdate = drones.instanceColor.needsUpdate = true;
}
const wrapD = (s0, v, ps) => { let d = (s0 + v * T) - ps - WIN_B; d = d - Math.floor(d / WIN_L) * WIN_L; return d + WIN_B; };
function update(dt, p) {
  T += dt;
  for (const a of ['v', 'h', 'q', 'b']) {
    M[a + 'A'].color.setScalar(Math.sin(T * 37) + Math.sin(T * 23.1 + 1) > 1.25 ? 0.18 : 1);
    M[a + 'B'].color.setScalar(0.6 + 0.4 * Math.sin(T * 2.4 + a.charCodeAt(0)));
    M[a + 'C'].color.setScalar(((T * 1.3 + a.charCodeAt(0) * 0.37) % 2) < 1.5 ? 1 : 0.12);
  }
  M.bc0.color.setHSL((T * 0.07) % 1, 0.9, 0.62); M.bc1.color.setHSL((0.5 + T * 0.05) % 1, 0.9, 0.62);
  tickTex.offset.x = (T * 0.06) % 1;
  STEAMS.forEach((m, i) => { m.map.offset.y -= dt * (0.22 + i * 0.07); });
  if (!carsB || !p) return;
  for (let i = 0; i < NC; i++) {
    const c = tr[i], d = wrapD(c.s0, c.v, p.s), sc = p.s + d;
    dummy.position.set(C(sc) + c.dx, ND.base(C(sc), sc) + c.alt, -sc); dummy.rotation.set(0, c.v > 0 ? 0 : Math.PI, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
    carsB.setMatrixAt(i, dummy.matrix); carsL.setMatrixAt(i, dummy.matrix); carsU.setMatrixAt(i, dummy.matrix);
  }
  for (let i = 0; i < ND2; i++) {
    const c = dr[i], d = wrapD(c.s0, c.v, p.s), s = p.s + d, y = ND.base(C(s), s) + c.alt + Math.sin(T * 1.3 + c.ph) * 1.5, blink = Math.sin(T * 6 + c.ph) > -0.4 ? 1 : 0.01;
    dummy.position.set(C(s) + c.dx, y, -s); dummy.rotation.set(0, T * 0.6 + c.ph, 0); dummy.scale.set(blink, blink, blink); dummy.updateMatrix(); drones.setMatrixAt(i, dummy.matrix);
  }
  carsB.instanceMatrix.needsUpdate = carsL.instanceMatrix.needsUpdate = carsU.instanceMatrix.needsUpdate = drones.instanceMatrix.needsUpdate = true;
}
ND.city = { railStyle: (s) => distOf(Math.floor(s / SEG)).rail, cars: () => tr, T: () => T, initMs: performance.now() - T_INIT, build, init, update, districtName: (s) => distOf(Math.floor(s / SEG)).name, DIST };
