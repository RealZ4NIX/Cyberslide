/* CYBERSLIDE - 1v1 link messages. The connection layer (codes.ts, link.ts) is adapted from Drifta by Myrras;
   the messages here are Cyberslide's own: a rider pick, a shared hill seed and a full 3D rider pose. */

import { POSE_LEN } from './pose';

export const APP_VERSION: string = __APP_VERSION__;
export const POSE_HZ = 20;
export const SCORE_HZ = 4;

export interface PlayerInfo {
  /** scoreboard name, A-Z 0-9, up to 8 */
  name: string;
  /** rider id from riders.ts; the receiver falls back to NOVA for an unknown one */
  rider: string;
}

/** end-of-run numbers both screens show side by side */
export interface RunResult {
  score: number;
  dist: number;
  bestCombo: number;
  tricks: number;
}

export type Msg =
  | { t: 'hello'; v: string; info: PlayerInfo }
  // at: sender performance.now() ms
  | { t: 'ping'; id: number; at: number }
  | { t: 'pong'; id: number; at: number }
  // lobby: ready to drop; after a race: wants a rematch
  | { t: 'ready'; ready: boolean }
  // host -> guest: the hill seed and when the countdown ends (ms from now, host side; guest subtracts rtt/2)
  | { t: 'start'; seed: number; delay: number }
  // time: s since the synced drop (negative during the countdown); p: rider pose (pose.ts); unreliable channel
  | { t: 'pose'; time: number; p: number[] }
  // score: banked; live: the combo being built (the HUD shows both added up)
  | { t: 'score'; score: number; live: number }
  | { t: 'finish'; res: RunResult }
  // either player: back to the lobby to change riders
  | { t: 'lobby' }
  | { t: 'leave' };

export function encode(m: Msg): string {
  return JSON.stringify(m);
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown): v is string => typeof v === 'string' && v.length <= 64;
const nums = (o: Obj, keys: string[]) => keys.every((k) => num(o[k]));

function info(v: unknown): PlayerInfo | null {
  if (!isObj(v)) return null;
  const { name, rider } = v;
  if (typeof name !== 'string' || !/^[A-Z0-9]{1,8}$/.test(name)) return null;
  if (typeof rider !== 'string' || !/^[a-z]{1,12}$/.test(rider)) return null;
  return { name, rider };
}

function result(v: unknown): RunResult | null {
  if (!isObj(v) || !nums(v, ['score', 'dist', 'bestCombo', 'tricks'])) return null;
  return {
    score: v.score as number,
    dist: v.dist as number,
    bestCombo: v.bestCombo as number,
    tricks: v.tricks as number,
  };
}

function check(o: Obj): Msg | null {
  switch (o.t) {
    case 'hello': {
      const i = info(o.info);
      return str(o.v) && i ? { t: 'hello', v: o.v, info: i } : null;
    }
    case 'ping':
    case 'pong':
      return nums(o, ['id', 'at']) ? { t: o.t, id: o.id as number, at: o.at as number } : null;
    case 'ready':
      return typeof o.ready === 'boolean' ? { t: 'ready', ready: o.ready } : null;
    case 'start':
      return Number.isInteger(o.seed) && num(o.delay)
        ? { t: 'start', seed: o.seed as number, delay: o.delay as number }
        : null;
    case 'pose': {
      const p = o.p;
      return num(o.time) && Array.isArray(p) && p.length === POSE_LEN && p.every(num)
        ? { t: 'pose', time: o.time, p: p as number[] }
        : null;
    }
    case 'score':
      return nums(o, ['score', 'live'])
        ? { t: 'score', score: o.score as number, live: o.live as number }
        : null;
    case 'finish': {
      const r = result(o.res);
      return r ? { t: 'finish', res: r } : null;
    }
    case 'lobby':
    case 'leave':
      return { t: o.t };
    default:
      return null;
  }
}

export function decode(raw: unknown): Msg | null {
  if (typeof raw !== 'string') return null;
  try {
    const o: unknown = JSON.parse(raw);
    return isObj(o) ? check(o) : null;
  } catch {
    return null;
  }
}

export type LinkState = 'connecting' | 'open' | 'failed' | 'closed';

export interface Link {
  readonly state: LinkState;
  /** 'pose' goes unreliable/unordered, everything else reliable+ordered; no-op unless open */
  send(m: Msg): void;
  onMessage(cb: (m: Msg) => void): void;
  onState(cb: (s: LinkState) => void): void;
  close(): void;
}

export type LinkErrorReason = 'bad-code' | 'version' | 'wrong-kind' | 'timeout' | 'failed';

export class LinkError extends Error {
  constructor(readonly reason: LinkErrorReason) {
    super(reason);
  }
}

export interface HostHandle {
  link: Link;
  invite: string;
  /** rejects with LinkError */
  accept(reply: string): Promise<void>;
}

export interface GuestHandle {
  link: Link;
  reply: string;
}

export interface Connector {
  host(): Promise<HostHandle>;
  /** rejects with LinkError */
  join(invite: string): Promise<GuestHandle>;
}
