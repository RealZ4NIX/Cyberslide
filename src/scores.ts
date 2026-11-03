/* CYBERSLIDE - scoreboard storage.
   The game only talks to `scores` (load / submit / qualifies). The data lives in a "backend" object, so the local
   browser storage used now can be swapped for an online one later without touching the menus. */

import { ND } from './nd';

export type Mode = 'timed' | 'endless';

/** one saved run: name, score, rider id, distance (m), timestamp (ms) */
export interface ScoreEntry {
  n: string;
  s: number;
  r: string;
  d: number;
  t: number;
}

export interface SubmitResult {
  /** 1-based place on the board, or 0 when the run did not make it */
  rank: number;
  list: ScoreEntry[];
}

/** load(mode) gives entries sorted high to low; submit inserts one and returns where it landed */
export interface ScoreBackend {
  name: string;
  scope: string;
  load(mode: Mode): Promise<ScoreEntry[]>;
  submit(mode: Mode, entry: ScoreEntry): Promise<SubmitResult>;
  clear?(): void;
}

export const KEY = 'cyberslide-scores';
export const MAX = 10;
export const MODES: readonly Mode[] = ['timed', 'endless'];

type Board = Record<Mode, ScoreEntry[]>;

const readAll = (): Board => {
  let o: Record<string, unknown> = {};
  try {
    o = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch {
    o = {};
  }
  const out = {} as Board;
  MODES.forEach((m) => {
    const raw = o[m];
    out[m] = (Array.isArray(raw) ? raw : [])
      .filter((x): x is ScoreEntry => !!x && typeof x.s === 'number' && x.s > 0)
      .slice(0, MAX);
  });
  return out;
};

const writeAll = (all: Board): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage blocked: the board just won't persist */
  }
};

/** where a score would go in a high-to-low list; ties go below the older entry */
const placeOf = (list: readonly ScoreEntry[], score: number): number => {
  const at = list.findIndex((x) => x.s < score);
  return at < 0 ? list.length : at;
};

export const localBackend: ScoreBackend = {
  name: 'local',
  scope: 'Saved on this device only.',
  load(mode) {
    return Promise.resolve(readAll()[mode] || []);
  },
  submit(mode, entry) {
    const all = readAll(),
      list = all[mode] || [];
    const at = placeOf(list, entry.s);
    list.splice(at, 0, entry);
    all[mode] = list.slice(0, MAX);
    writeAll(all);
    return Promise.resolve({ rank: at < MAX ? at + 1 : 0, list: all[mode] });
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
};

/** names are 1 to 8 letters or digits, upper case; anything else becomes ??? */
export const cleanName = (s: unknown): string =>
  String(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8) || '???';

export interface RunResult {
  name: string;
  score: number;
  rider: string;
  dist?: number;
}

export const scores = {
  MAX,
  MODES,
  backend: localBackend as ScoreBackend,
  load(mode: Mode): Promise<ScoreEntry[]> {
    return scores.backend.load(mode);
  },
  /** rank (1-based) the score would take in an already loaded list, or 0 when it would not make the board */
  qualifies(list: readonly ScoreEntry[], score: number): number {
    if (!(score > 0)) return 0;
    const at = placeOf(list, score);
    return at < MAX ? at + 1 : 0;
  },
  submit(mode: Mode, e: RunResult, now: number = Date.now()): Promise<SubmitResult> {
    return scores.backend.submit(mode, {
      n: cleanName(e.name),
      s: Math.round(e.score),
      r: e.rider,
      d: Math.round(e.dist || 0),
      t: now,
    });
  },
};

ND.scores = scores;
