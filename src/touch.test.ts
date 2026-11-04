import { describe, expect, it } from 'vitest';
import { dpadDirs, pickButton, type ButtonSpot } from './touch';

const on = (d: ReturnType<typeof dpadDirs>) =>
  (['up', 'down', 'left', 'right'] as const).filter((k) => d[k]).join('+');

describe('touch D-pad', () => {
  it('pushes nothing inside the dead zone', () => {
    expect(on(dpadDirs(0, 0, 60))).toBe('');
    expect(on(dpadDirs(8, -8, 60))).toBe('');
  });
  it('reads the four straight directions (screen y points down)', () => {
    expect(on(dpadDirs(50, 0, 60))).toBe('right');
    expect(on(dpadDirs(-50, 0, 60))).toBe('left');
    expect(on(dpadDirs(0, -50, 60))).toBe('up');
    expect(on(dpadDirs(0, 50, 60))).toBe('down');
  });
  it('reads diagonals as two arms', () => {
    expect(on(dpadDirs(40, -40, 60))).toBe('up+right');
    expect(on(dpadDirs(-40, -40, 60))).toBe('up+left');
    expect(on(dpadDirs(-40, 40, 60))).toBe('down+left');
    expect(on(dpadDirs(40, 40, 60))).toBe('down+right');
  });
  it('keeps a slightly-off straight push straight (equal 45° slices)', () => {
    expect(on(dpadDirs(50, -15, 60))).toBe('right'); // ~17° up
    expect(on(dpadDirs(-15, 50, 60))).toBe('down');
    expect(on(dpadDirs(50, -25, 60))).toBe('up+right'); // ~27° up: past the 22.5° line
  });
  it('still works past the rim, so the thumb can slide off the pad', () => {
    expect(on(dpadDirs(-200, 5, 60))).toBe('left');
  });
});

describe('touch diamond', () => {
  const spots: ButtonSpot[] = [
    { act: 'space', x: 100, y: 160, r: 36 },
    { act: 'flip', x: 50, y: 110, r: 28 },
    { act: 'grab', x: 150, y: 110, r: 28 },
    { act: 'trick', x: 100, y: 60, r: 28 },
  ];
  it('finds the button under the finger', () => {
    expect(pickButton(spots, 100, 160)).toBe('space');
    expect(pickButton(spots, 52, 108)).toBe('flip');
    expect(pickButton(spots, 150, 112)).toBe('grab');
    expect(pickButton(spots, 100, 62)).toBe('trick');
  });
  it('forgives a finger a little outside a button', () => {
    expect(pickButton(spots, 100 + 40, 160)).toBe('space');
  });
  it('picks nothing in the gap in the middle', () => {
    expect(pickButton(spots, 100, 110)).toBe(null);
  });
  it('picks the nearest when two overlap', () => {
    const near: ButtonSpot[] = [
      { act: 'space', x: 0, y: 0, r: 30 },
      { act: 'flip', x: 40, y: 0, r: 30 },
    ];
    expect(pickButton(near, 15, 0)).toBe('space');
    expect(pickButton(near, 25, 0)).toBe('flip');
  });
});
