import { describe, expect, it } from 'vitest';
import { secretCode } from './secretCode';

const feed = (c: ReturnType<typeof secretCode>, tokens: string[], start = 0, step = 100) =>
  tokens.map((t, i) => c.push(t, start + i * step));

describe('secretCode', () => {
  it('fires on the last input of the sequence, once', () => {
    const c = secretCode([...'SKELLY']);
    expect(feed(c, [...'SKELLY'])).toEqual([false, false, false, false, false, true]);
    expect(c.push('Y', 700)).toBe(false);
  });

  it('ignores junk before the code and keeps a still-valid prefix after a wrong input', () => {
    const c = secretCode([...'SKELLY']);
    expect(feed(c, [...'XXSSKELLY']).at(-1)).toBe(true);
    const pad = secretCode(['up', 'up', 'down', 'down', 'L1', 'L2']);
    expect(feed(pad, ['up', 'up', 'up', 'down', 'down', 'L1', 'L2']).at(-1)).toBe(true);
  });

  it('does not fire on a wrong order', () => {
    const c = secretCode(['up', 'up', 'down', 'down', 'L1', 'L2']);
    expect(feed(c, ['up', 'down', 'up', 'down', 'L1', 'L2']).some(Boolean)).toBe(false);
    expect(feed(c, ['up', 'up', 'down', 'down', 'L2', 'L1'], 5000).some(Boolean)).toBe(false);
  });

  it('starts over after a long pause between inputs', () => {
    const c = secretCode([...'SKELLY'], 1500);
    feed(c, [...'SKE']);
    expect(feed(c, [...'LLY'], 5000).some(Boolean)).toBe(false);
    expect(feed(c, [...'SKELLY'], 9000).at(-1)).toBe(true);
  });
});
