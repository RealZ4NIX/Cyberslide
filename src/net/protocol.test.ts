import { describe, expect, it } from 'vitest';
import { POSE_LEN } from './pose';
import { APP_VERSION, decode, encode, type Msg } from './protocol';

const pose = Array.from({ length: POSE_LEN }, (_, i) => i * 0.5);
const VALID: Msg[] = [
  { t: 'hello', v: APP_VERSION, info: { name: 'Z4NIX', rider: 'skelly' } },
  { t: 'ping', id: 3, at: 12.5 },
  { t: 'pong', id: 3, at: 12.5 },
  { t: 'ready', ready: true },
  { t: 'start', seed: -123456, delay: 3000 },
  { t: 'pose', time: -1.25, p: pose },
  { t: 'score', score: 12000, live: 850 },
  { t: 'finish', res: { score: 12000, dist: 2400, bestCombo: 4000, tricks: 22 } },
  { t: 'lobby' },
  { t: 'leave' },
];

describe('protocol', () => {
  it('every message survives encode/decode', () => {
    for (const m of VALID) expect(decode(encode(m))).toEqual(m);
  });

  it('drops anything malformed', () => {
    const bad: unknown[] = [
      42,
      'not json',
      '[]',
      '{"t":"nope"}',
      JSON.stringify({ t: 'hello', v: 'x', info: { name: 'lower', rider: 'nova' } }),
      JSON.stringify({ t: 'hello', v: 'x', info: { name: 'TOOLONGNAME', rider: 'nova' } }),
      JSON.stringify({ t: 'hello', v: 'x', info: { name: 'OK', rider: '<script>' } }),
      JSON.stringify({ t: 'start', seed: 1.5, delay: 3000 }),
      JSON.stringify({ t: 'pose', time: 0, p: [1, 2, 3] }),
      JSON.stringify({ t: 'pose', time: 0, p: pose.map((v, i) => (i === 3 ? 'x' : v)) }),
      JSON.stringify({ t: 'score', score: Infinity, live: 0 }),
      JSON.stringify({ t: 'finish', res: { score: 1 } }),
      JSON.stringify({ t: 'ready', ready: 'yes' }),
    ];
    for (const b of bad) expect(decode(b)).toBeNull();
  });

  it('keeps only known fields', () => {
    const m = decode(JSON.stringify({ t: 'score', score: 1, live: 2, evil: 'x' }));
    expect(m).toEqual({ t: 'score', score: 1, live: 2 });
  });
});
