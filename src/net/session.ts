/* CYBERSLIDE - one 1v1 link from lobby to rematch, on top of a Link (link.ts). Shape adapted from Drifta's
   session by Myrras; the race rules are Cyberslide's: the host deals the hill seed, both riders drop on the
   same synced countdown, and after a race both must ask for a rematch to get a new hill. */

import { lerpPose } from './pose';
import {
  APP_VERSION,
  POSE_HZ,
  SCORE_HZ,
  type Link,
  type LinkState,
  type Msg,
  type PlayerInfo,
  type RunResult,
} from './protocol';

/** countdown length: the same 3 s as a solo run */
export const START_DELAY_MS = 3000;
/** the rival is drawn this far behind real time so there is always a frame on each side to blend */
export const INTERP_DELAY = 0.1; // s
const PING_MS = 1000;
const BUFFER_S = 10;
const BUFFER_MAX = 400;

export type SessionPhase = 'handshake' | 'lobby' | 'race' | 'closed';

export interface Rival {
  info: PlayerInfo | null;
  ready: boolean;
  score: number;
  live: number;
  result: RunResult | null;
  connected: boolean;
}

interface Frame {
  t: number;
  p: number[];
}

export interface Session {
  readonly role: 'host' | 'guest';
  readonly phase: SessionPhase;
  readonly rival: Rival;
  readonly me: PlayerInfo;
  /** lobby: ready to drop; after both finished: wants a rematch */
  readonly ready: boolean;
  /** my run is over (time ran out) */
  readonly finished: boolean;
  /** seed of the current race's hill */
  readonly seed: number | null;
  readonly rtt: number;
  readonly error: 'version' | null;
  /** Replaces my info (rider or name); re-sent as hello. Only in the lobby. */
  setInfo(info: PlayerInfo): void;
  setReady(r: boolean): void;
  /** ready works in the lobby, and after a race once both runs are over */
  canReady(): boolean;
  onStart(cb: (seed: number, inMs: number) => void): void;
  sendPose(time: number, p: number[]): void;
  sendScore(score: number, live: number): void;
  finish(res: RunResult): void;
  /** Rival pose INTERP_DELAY behind runTime; holds the last frame while connected and riding. */
  rivalPose(runTime: number): number[] | null;
  backToLobby(): void;
  leave(): void;
  /** pings, and the host starts the race once both are ready; call every frame */
  tick(): void;
  onChange(cb: () => void): void;
}

export function createSession(
  link: Link,
  role: 'host' | 'guest',
  me: PlayerInfo,
  newSeed: () => number,
  now: () => number = () => performance.now(),
): Session {
  let phase: SessionPhase = 'handshake';
  let ready = false;
  let finished = false;
  let seed: number | null = null;
  let rtt = 0;
  let error: 'version' | null = null;
  const rival: Rival = {
    info: null,
    ready: false,
    score: 0,
    live: 0,
    result: null,
    connected: false,
  };
  let frames: Frame[] = [];
  let lastPose = -Infinity;
  let lastScore = -Infinity;
  let pingId = 0;
  let lastPing = -Infinity;
  const startCbs: ((seed: number, inMs: number) => void)[] = [];
  const changeCbs: (() => void)[] = [];
  const changed = () => changeCbs.forEach((cb) => cb());

  const resetRace = () => {
    frames = [];
    lastPose = -Infinity;
    lastScore = -Infinity;
    finished = false;
    ready = false;
    Object.assign(rival, { ready: false, score: 0, live: 0, result: null });
  };
  const enterRace = (s: number, inMs: number) => {
    seed = s;
    phase = 'race';
    resetRace();
    startCbs.forEach((cb) => cb(s, inMs));
    changed();
  };
  const enterLobby = () => {
    phase = 'lobby';
    seed = null;
    resetRace();
    changed();
  };
  const close = () => {
    if (phase === 'closed') return;
    phase = 'closed';
    rival.connected = false;
    changed();
  };
  const canReady = () =>
    phase === 'lobby' || (phase === 'race' && finished && rival.result !== null);
  const canStart = () => role === 'host' && canReady() && ready && rival.ready && rival.connected;
  const pushFrame = (f: Frame) => {
    if (frames.length && f.t <= frames[frames.length - 1].t) return;
    frames.push(f);
    const cut = f.t - BUFFER_S;
    let i = 0;
    while (i < frames.length - 1 && frames[i].t < cut) i++;
    i = Math.max(i, frames.length - BUFFER_MAX);
    if (i) frames.splice(0, i);
  };

  const handle = (m: Msg) => {
    if (phase === 'closed') return;
    switch (m.t) {
      case 'hello':
        if (m.v !== APP_VERSION) {
          error = 'version';
          close();
          link.close();
          return;
        }
        rival.info = m.info;
        rival.connected = true;
        if (phase === 'handshake') phase = 'lobby';
        return changed();
      case 'ping':
        return link.send({ t: 'pong', id: m.id, at: m.at });
      case 'pong': {
        const s = now() - m.at;
        rtt = rtt === 0 ? s : rtt * 0.8 + s * 0.2;
        return;
      }
      case 'ready':
        if (phase !== 'lobby' && phase !== 'race') return;
        rival.ready = m.ready;
        return changed();
      case 'start':
        if (role !== 'guest' || (phase !== 'lobby' && phase !== 'race')) return;
        return enterRace(m.seed, Math.max(0, m.delay - rtt / 2));
      case 'pose':
        if (phase !== 'race') return;
        return pushFrame({ t: m.time, p: m.p });
      case 'score':
        if (phase !== 'race' || rival.result) return;
        rival.score = m.score;
        rival.live = m.live;
        return changed();
      case 'finish':
        if (phase !== 'race') return;
        rival.result = m.res;
        rival.score = m.res.score;
        rival.live = 0;
        return changed();
      case 'lobby':
        if (phase !== 'race') return;
        return enterLobby();
      case 'leave':
        return close();
    }
  };

  const onState = (s: LinkState) => {
    if (s === 'open') link.send({ t: 'hello', v: APP_VERSION, info: me });
    else if (s === 'closed' || s === 'failed') close();
  };
  link.onMessage(handle);
  link.onState(onState);
  if (link.state === 'open') onState('open');

  return {
    role,
    get phase() {
      return phase;
    },
    rival,
    get me() {
      return me;
    },
    get ready() {
      return ready;
    },
    get finished() {
      return finished;
    },
    get seed() {
      return seed;
    },
    get rtt() {
      return rtt;
    },
    get error() {
      return error;
    },
    setInfo(info) {
      if (phase !== 'handshake' && phase !== 'lobby') return;
      me = info;
      if (link.state === 'open') link.send({ t: 'hello', v: APP_VERSION, info });
      changed();
    },
    setReady(r) {
      if (!canReady() || r === ready) return;
      ready = r;
      link.send({ t: 'ready', ready: r });
      changed();
    },
    canReady,
    onStart(cb) {
      startCbs.push(cb);
    },
    sendPose(time, p) {
      if (phase !== 'race' || finished) return;
      if (time < lastPose) lastPose = -Infinity;
      if (time - lastPose < 1 / POSE_HZ - 1e-9) return;
      lastPose = time;
      link.send({ t: 'pose', time, p });
    },
    sendScore(score, live) {
      if (phase !== 'race' || finished) return;
      const t = now();
      if (t - lastScore < 1000 / SCORE_HZ) return;
      lastScore = t;
      link.send({ t: 'score', score, live });
    },
    finish(res) {
      if (phase !== 'race' || finished) return;
      finished = true;
      link.send({ t: 'finish', res });
      changed();
    },
    rivalPose(runTime) {
      if (!rival.connected || rival.result || !frames.length) return null;
      const t = runTime - INTERP_DELAY;
      if (t < frames[0].t) return null;
      const last = frames[frames.length - 1];
      if (t >= last.t) return last.p.slice();
      let i = frames.length - 2;
      while (i > 0 && frames[i].t > t) i--;
      const a = frames[i],
        b = frames[i + 1];
      return lerpPose(a.p, b.p, (t - a.t) / (b.t - a.t));
    },
    backToLobby() {
      if (phase !== 'race') return;
      link.send({ t: 'lobby' });
      enterLobby();
    },
    leave() {
      if (phase === 'closed') return;
      link.send({ t: 'leave' });
      close();
      link.close();
    },
    tick() {
      if (phase === 'closed' || link.state !== 'open') return;
      if (canStart()) {
        const s = newSeed();
        link.send({ t: 'start', seed: s, delay: START_DELAY_MS });
        enterRace(s, START_DELAY_MS);
      }
      const t = now();
      if (t - lastPing < PING_MS) return;
      lastPing = t;
      link.send({ t: 'ping', id: ++pingId, at: t });
    },
    onChange(cb) {
      changeCbs.push(cb);
    },
  };
}
