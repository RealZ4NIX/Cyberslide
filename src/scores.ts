// @ts-nocheck -- ported as-is from index.html; typed step by step

/* CYBERSLIDE - scoreboard storage.
   The game only talks to ND.scores (load / submit / qualifies). The data lives in a "backend" object, so the local
   browser storage used now can be swapped for an online one later without touching the menus. */

import { ND } from './nd';

const KEY = 'cyberslide-scores', MAX = 10, MODES = ['timed', 'endless'];

const readAll = () => {
  let o = {};
  try { o = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { o = {}; }
  const out = {};
  MODES.forEach((m) => {
    out[m] = (Array.isArray(o[m]) ? o[m] : []).filter((x) => x && typeof x.s === 'number' && x.s > 0).slice(0, MAX);
  });
  return out;
};
const writeAll = (all) => { try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { /* storage blocked: the board just won't persist */ } };

/* backend contract: load(mode) -> Promise<entries sorted high to low>, submit(mode, entry) -> Promise<{rank, list}> */
const local = {
  name: 'local',
  scope: 'Saved on this device only.',
  load(mode) { return Promise.resolve(readAll()[mode] || []); },
  submit(mode, entry) {
    const all = readAll(), list = all[mode] || [];
    let at = list.findIndex((x) => x.s < entry.s);     // ties go below the older entry
    if (at < 0) at = list.length;
    list.splice(at, 0, entry);
    all[mode] = list.slice(0, MAX); writeAll(all);
    return Promise.resolve({ rank: at < MAX ? at + 1 : 0, list: all[mode] });
  },
  clear() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }
};

const clean = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || '???';   // names are 1 to 8 letters or digits

ND.scores = {
  MAX, MODES,
  backend: local,
  load(mode) { return ND.scores.backend.load(mode); },
  /* rank (1-based) the score would take in an already loaded list, or 0 when it would not make the board */
  qualifies(list, score) {
    if (!(score > 0)) return 0;
    let at = list.findIndex((x) => x.s < score);
    if (at < 0) at = list.length;
    return at < MAX ? at + 1 : 0;
  },
  submit(mode, e) {
    return ND.scores.backend.submit(mode, { n: clean(e.name), s: Math.round(e.score), r: e.rider, d: Math.round(e.dist || 0), t: Date.now() });
  }
};
