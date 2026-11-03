import { beforeEach, describe, expect, it } from 'vitest';
import { installStorage, MemoryStorage } from './test-utils/memoryStorage';
import { cleanName, KEY, localBackend, MAX, scores, type ScoreEntry } from './scores';

let store: MemoryStorage;
beforeEach(() => {
  store = installStorage();
  scores.backend = localBackend;
});

const run = (score: number, name = 'ACE') => ({ name, score, rider: 'nova', dist: 1234.4 });
const entry = (s: number, n = 'X'): ScoreEntry => ({ n, s, r: 'nova', d: 0, t: 0 });

describe('cleanName', () => {
  it('upper-cases and keeps only letters and digits, max 8', () => {
    expect(cleanName('ne0n rider!!')).toBe('NE0NRIDE');
    expect(cleanName('zx')).toBe('ZX');
  });
  it('falls back to ??? for empty or junk names', () => {
    expect(cleanName('')).toBe('???');
    expect(cleanName('  ---  ')).toBe('???');
    expect(cleanName(null)).toBe('???');
  });
});

describe('qualifies', () => {
  it('gives the 1-based rank a score would take', () => {
    const list = [entry(900), entry(500), entry(100)];
    expect(scores.qualifies(list, 1000)).toBe(1);
    expect(scores.qualifies(list, 600)).toBe(2);
    expect(scores.qualifies(list, 50)).toBe(4);
  });
  it('puts ties below the existing entry', () => {
    expect(scores.qualifies([entry(500)], 500)).toBe(2);
  });
  it('is 0 for zero, negative or NaN scores', () => {
    expect(scores.qualifies([], 0)).toBe(0);
    expect(scores.qualifies([], -5)).toBe(0);
    expect(scores.qualifies([], NaN)).toBe(0);
  });
  it('is 0 when the board is full and the score is too low', () => {
    const full = Array.from({ length: MAX }, (_, i) => entry(1000 - i * 10));
    expect(scores.qualifies(full, 1)).toBe(0);
    expect(scores.qualifies(full, 5000)).toBe(1);
  });
});

describe('submit and load (local backend)', () => {
  it('stores a cleaned, rounded entry and reports its rank', async () => {
    const res = await scores.submit('timed', run(1520.6, 'ace'), 42);
    expect(res.rank).toBe(1);
    expect(res.list[0]).toEqual({ n: 'ACE', s: 1521, r: 'nova', d: 1234, t: 42 });
    expect(await scores.load('timed')).toEqual(res.list);
  });

  it('keeps each mode on its own board', async () => {
    await scores.submit('timed', run(100));
    await scores.submit('endless', run(200));
    expect((await scores.load('timed')).map((e) => e.s)).toEqual([100]);
    expect((await scores.load('endless')).map((e) => e.s)).toEqual([200]);
  });

  it('sorts high to low and keeps only the top 10', async () => {
    for (let i = 1; i <= 12; i++) await scores.submit('endless', run(i * 100));
    const list = await scores.load('endless');
    expect(list).toHaveLength(MAX);
    expect(list[0].s).toBe(1200);
    expect(list[MAX - 1].s).toBe(300);
    const late = await scores.submit('endless', run(50));
    expect(late.rank).toBe(0);
  });

  it('ignores corrupt or hand-edited storage', async () => {
    store.setItem(KEY, '{not json');
    expect(await scores.load('timed')).toEqual([]);
    store.setItem(
      KEY,
      JSON.stringify({ timed: [{ s: 'big' }, null, { s: -3 }, entry(70)], endless: 'nope' }),
    );
    expect((await scores.load('timed')).map((e) => e.s)).toEqual([70]);
    expect(await scores.load('endless')).toEqual([]);
  });

  it('still works (without persisting) when storage is blocked', async () => {
    store.broken = true;
    const res = await scores.submit('timed', run(300));
    expect(res.rank).toBe(1);
    expect(await scores.load('timed')).toEqual([]);
    expect(() => localBackend.clear?.()).not.toThrow();
  });

  it('routes through whichever backend is plugged in', async () => {
    const seen: string[] = [];
    scores.backend = {
      name: 'fake',
      scope: 'test',
      load: async () => [entry(1)],
      submit: async (mode, e) => {
        seen.push(mode + ':' + e.n);
        return { rank: 7, list: [] };
      },
    };
    expect(await scores.load('timed')).toEqual([entry(1)]);
    expect((await scores.submit('endless', run(5, 'bo'))).rank).toBe(7);
    expect(seen).toEqual(['endless:BO']);
  });
});
