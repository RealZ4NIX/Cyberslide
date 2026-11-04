import { beforeEach, describe, expect, it } from 'vitest';
import { POSE_LEN, P } from './pose';
import { APP_VERSION, type Link, type LinkState, type Msg, type PlayerInfo } from './protocol';
import { createSession, INTERP_DELAY, START_DELAY_MS, type Session } from './session';

/* two in-memory link ends wired to each other */
interface End extends Link {
  state: LinkState;
  peer: End;
  inbox: Msg[];
  emit(m: Msg): void;
  setState(s: LinkState): void;
}

function end(): End {
  const msgs: ((m: Msg) => void)[] = [];
  const states: ((s: LinkState) => void)[] = [];
  const e = {
    state: 'connecting' as LinkState,
    inbox: [] as Msg[],
    emit: (m: Msg) => msgs.forEach((cb) => cb(m)),
    send(m: Msg) {
      if (e.state !== 'open') return;
      e.peer.inbox.push(m);
      e.peer.emit(m);
    },
    onMessage: (cb: (m: Msg) => void) => void msgs.push(cb),
    onState: (cb: (s: LinkState) => void) => void states.push(cb),
    setState(s: LinkState) {
      e.state = s;
      states.forEach((cb) => cb(s));
    },
    close() {
      e.setState('closed');
      e.peer.setState('closed');
    },
  } as End;
  return e;
}

const hostInfo: PlayerInfo = { name: 'HOST', rider: 'volt' };
const guestInfo: PlayerInfo = { name: 'GUEST', rider: 'skelly' };
const RES = (score: number) => ({ score, dist: 1200, bestCombo: 900, tricks: 14 });
const pose = (x: number, ry = 0) => {
  const p = new Array<number>(POSE_LEN).fill(0);
  p[P.gx] = x;
  p[P.gry] = ry;
  p[P.vis] = 1;
  return p;
};

let t = 0;
let seeds = 0;
const now = () => t;
let a: End, b: End, h: Session, g: Session;

beforeEach(() => {
  t = 0;
  seeds = 0;
  a = end();
  b = end();
  a.peer = b;
  b.peer = a;
  h = createSession(a, 'host', hostInfo, () => 1000 + ++seeds, now);
  g = createSession(b, 'guest', guestInfo, () => -1, now);
});

const connect = () => {
  a.state = b.state = 'open';
  a.setState('open');
  b.setState('open');
};
const toRace = () => {
  connect();
  h.setReady(true);
  g.setReady(true);
  h.tick();
};
const bothFinish = () => {
  h.finish(RES(5000));
  g.finish(RES(7000));
};

describe('handshake', () => {
  it('swaps names and riders, then both are in the lobby', () => {
    connect();
    expect(h.phase).toBe('lobby');
    expect(g.phase).toBe('lobby');
    expect(h.rival.info).toEqual(guestInfo);
    expect(g.rival.info).toEqual(hostInfo);
    expect(a.inbox[0]).toEqual({ t: 'hello', v: APP_VERSION, info: guestInfo });
  });

  it('a different build closes the link with a version error', () => {
    a.state = b.state = 'open';
    a.emit({ t: 'hello', v: 'some-other-build', info: guestInfo });
    expect(h.error).toBe('version');
    expect(h.phase).toBe('closed');
  });

  it('changing rider in the lobby reaches the rival', () => {
    connect();
    g.setInfo({ name: 'GUEST', rider: 'hex' });
    expect(h.rival.info?.rider).toBe('hex');
  });
});

describe('starting a race', () => {
  it('needs both ready; the host deals one seed to both', () => {
    connect();
    const starts: [string, number, number][] = [];
    h.onStart((s, ms) => starts.push(['h', s, ms]));
    g.onStart((s, ms) => starts.push(['g', s, ms]));
    h.setReady(true);
    h.tick();
    expect(h.phase).toBe('lobby');
    g.setReady(true);
    h.tick();
    expect(h.phase).toBe('race');
    expect(g.phase).toBe('race');
    expect(h.seed).toBe(1001);
    expect(g.seed).toBe(1001);
    expect(starts).toEqual([
      ['g', 1001, START_DELAY_MS],
      ['h', 1001, START_DELAY_MS],
    ]);
  });

  it("the guest's countdown is shortened by half the round trip", () => {
    connect();
    let gotMs = -1;
    g.onStart((_, ms) => (gotMs = ms));
    t = 80; // the guest's ping from t = 0 comes back 80 ms later
    b.emit({ t: 'pong', id: 1, at: 0 });
    b.emit({ t: 'start', seed: 7, delay: START_DELAY_MS });
    expect(gotMs).toBe(START_DELAY_MS - 40);
    expect(g.seed).toBe(7);
  });

  it('the guest cannot start a race', () => {
    connect();
    g.setReady(true);
    h.setReady(true);
    g.tick();
    expect(g.phase).toBe('lobby');
  });
});

describe('racing', () => {
  it('blends the rival pose between frames, delayed a little', () => {
    toRace();
    g.sendPose(0, pose(0));
    g.sendPose(0.05, pose(10, 0.2));
    const p = h.rivalPose(0.025 + INTERP_DELAY)!;
    expect(p[P.gx]).toBeCloseTo(5);
    expect(p[P.gry]).toBeCloseTo(0.1);
    expect(h.rivalPose(-1)).toBeNull();
    expect(h.rivalPose(5)![P.gx]).toBe(10); // holds the last frame
  });

  it('sends poses at most 20 times a second', () => {
    toRace();
    g.sendPose(0, pose(0));
    g.sendPose(0.01, pose(1));
    g.sendPose(0.05, pose(2));
    expect(a.inbox.filter((m) => m.t === 'pose')).toHaveLength(2);
  });

  it('live score shows up on the other side, rate limited', () => {
    toRace();
    g.sendScore(1200, 300);
    g.sendScore(1300, 0);
    expect(h.rival.score).toBe(1200);
    expect(h.rival.live).toBe(300);
    t = 300;
    g.sendScore(1300, 0);
    expect(h.rival.score).toBe(1300);
  });

  it('a finished rival stops being drawn', () => {
    toRace();
    g.sendPose(0, pose(0));
    g.finish(RES(7000));
    expect(h.rival.result?.score).toBe(7000);
    expect(h.rivalPose(1)).toBeNull();
  });
});

describe('after the race', () => {
  it('rematch needs both runs over, then gives a new hill', () => {
    toRace();
    h.finish(RES(5000));
    h.setReady(true);
    expect(h.ready).toBe(false); // rival still riding
    g.finish(RES(7000));
    h.setReady(true);
    g.setReady(true);
    h.tick();
    expect(h.phase).toBe('race');
    expect(h.seed).toBe(1002);
    expect(g.seed).toBe(1002);
    expect(h.finished).toBe(false);
    expect(h.rival.result).toBeNull();
  });

  it('either player can take both back to the lobby', () => {
    toRace();
    bothFinish();
    g.backToLobby();
    expect(h.phase).toBe('lobby');
    expect(g.phase).toBe('lobby');
    expect(h.ready).toBe(false);
  });

  it('riders can only change in the lobby', () => {
    toRace();
    g.setInfo({ name: 'GUEST', rider: 'nova' });
    expect(h.rival.info?.rider).toBe('skelly');
  });
});

describe('leaving', () => {
  it('leave closes both sides', () => {
    toRace();
    g.leave();
    expect(h.phase).toBe('closed');
    expect(h.rival.connected).toBe(false);
    expect(g.phase).toBe('closed');
  });

  it('a dropped link closes the session', () => {
    toRace();
    a.setState('closed');
    expect(h.phase).toBe('closed');
  });
});
