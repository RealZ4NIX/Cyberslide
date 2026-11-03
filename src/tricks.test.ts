import { afterEach, describe, expect, it } from 'vitest';
import { ND } from './nd';
import { GLYPH, scalePoints, TRICK_BY_KEY, TRICKS, trickInput, trickKey, type Dir } from './tricks';

afterEach(() => {
  delete ND.btnLabel;
  delete ND.TRICK_INPUT;
});

describe('trick list', () => {
  it('has a unique input for every trick', () => {
    const keys = TRICKS.map((t) => trickKey(t.btn, t.seq));
    expect(new Set(keys).size).toBe(keys.length);
    expect(Object.keys(TRICK_BY_KEY)).toHaveLength(TRICKS.length);
  });

  it('only uses known directions, and at most two taps', () => {
    for (const t of TRICKS) {
      expect(t.seq.length).toBeLessThanOrEqual(2);
      for (const d of t.seq) expect(Object.keys(GLYPH)).toContain(d);
    }
  });

  it('has a button-alone trick on both buttons, so a plain press always does something', () => {
    expect(TRICK_BY_KEY['A|'].name).toBe('Shove-It');
    expect(TRICK_BY_KEY['D|'].name).toBe('Mute');
  });

  it('every special needs two taps and is never a plain press', () => {
    const specials = TRICKS.filter((t) => t.sp);
    expect(specials.length).toBeGreaterThan(0);
    for (const t of specials) expect(t.seq).toHaveLength(2);
  });

  it('has sane timing and points', () => {
    for (const t of TRICKS) {
      expect(t.dur).toBeGreaterThan(0.3);
      expect(t.dur).toBeLessThan(1);
      expect(t.pts % 10).toBe(0);
      expect(t.pts).toBeGreaterThan(0);
    }
  });

  it('pays specials more than any normal trick', () => {
    const best = Math.max(...TRICKS.filter((t) => !t.sp).map((t) => t.pts));
    const worst = Math.min(...TRICKS.filter((t) => t.sp).map((t) => t.pts));
    expect(worst).toBeGreaterThan(best);
  });
});

describe('scalePoints', () => {
  it('doubles easy tricks, triples hard ones (250+), x4.5 for specials, rounded to 10', () => {
    expect(scalePoints(150, false)).toBe(300);
    expect(scalePoints(250, false)).toBe(750);
    expect(scalePoints(1000, true)).toBe(4500);
    expect(scalePoints(85, false)).toBe(170);
  });
  it('matches the shipped values', () => {
    expect(TRICK_BY_KEY['A|L'].pts).toBe(300); // Kickflip
    expect(TRICK_BY_KEY['A|DL DL'].pts).toBe(900); // 360 Flip
    expect(TRICKS.find((t) => t.name === 'The 900')?.pts).toBe(9000);
  });
});

describe('trickInput', () => {
  const t = (btn: 'A' | 'D', seq: Dir[]) => ({ btn, seq });
  it('shows arrows then the button (arrows-first input)', () => {
    expect(trickInput(t('A', ['U', 'L']))).toBe('↑ ← + A');
  });
  it('says "alone" for a plain press', () => {
    expect(trickInput(t('D', []))).toBe('D alone');
  });
  it('uses the key the player has bound, once the game provides labels', () => {
    ND.btnLabel = (b: string) => (b === 'A' ? 'FLIP' : 'GRAB');
    expect(trickInput(t('A', ['DR']))).toBe('↘ + FLIP');
  });
  it('shows button first for the old hold style', () => {
    ND.TRICK_INPUT = 'hold';
    expect(trickInput(t('A', ['L']))).toBe('A + ←');
  });
});
