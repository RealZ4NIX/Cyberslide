import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deadZone, glyphOf, kindOf, labelOf, NB, pad } from './gamepad';

interface FakePad {
  index: number;
  id: string;
  connected: boolean;
  mapping: string;
  axes: number[];
  buttons: { pressed: boolean; value: number }[];
  vibrationActuator?: { playEffect: (...a: unknown[]) => Promise<void> };
}
const mkPad = (over: Partial<FakePad> = {}): FakePad => ({
  index: 0,
  id: 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)',
  connected: true,
  mapping: 'standard',
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: NB }, () => ({ pressed: false, value: 0 })),
  ...over,
});

let pads: (FakePad | null)[] = [];
beforeEach(() => {
  pads = [];
  vi.stubGlobal('navigator', { getGamepads: () => pads });
  pad.poll(0.15); // reset to "nothing connected"
});
afterEach(() => vi.unstubAllGlobals());

const press = (p: FakePad, i: number, on = true) => {
  p.buttons[i] = { pressed: on, value: on ? 1 : 0 };
};

describe('device detection', () => {
  it('recognises PlayStation and Xbox pads by id', () => {
    expect(kindOf('Wireless Controller (Vendor: 054c)')).toBe('ps');
    expect(kindOf('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)')).toBe('xbox');
    expect(kindOf('8BitDo Pro 2')).toBe('other');
    expect(kindOf(undefined)).toBe('other');
  });
  it('labels a DualSense specifically', () => {
    expect(labelOf('Vendor: 054c Product: 0ce6', 'ps')).toBe('DUALSENSE');
    expect(labelOf('Wireless Controller', 'ps')).toBe('PLAYSTATION CONTROLLER');
    expect(labelOf('Xbox', 'xbox')).toBe('XBOX CONTROLLER');
  });
  it('names buttons with the right glyphs for the pad', () => {
    pads = [mkPad()];
    pad.poll(0.15);
    expect(pad.name(0)).toBe('✕');
    pads = [mkPad({ index: 1, id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)' })];
    pad.poll(0.15);
    expect(pad.name(0)).toBe('A');
    expect(pad.name(null)).toBe('—');
    expect(pad.name(19)).toBe('BTN 19');
  });
});

describe('deadZone', () => {
  it('zeroes small pushes', () => {
    expect(deadZone(0.1, 0.05, 0.15)).toEqual([0, 0]);
  });
  it('reaches full deflection at 95%', () => {
    const [x] = deadZone(0.95, 0, 0.15);
    expect(x).toBeCloseTo(1, 6);
  });
  it('keeps the direction and scales smoothly from the edge of the zone', () => {
    const [x, y] = deadZone(0.4, 0.4, 0.15);
    expect(x).toBeCloseTo(y, 9);
    const [justOut] = deadZone(0.16, 0, 0.15);
    expect(justOut).toBeGreaterThan(0);
    expect(justOut).toBeLessThan(0.02);
  });
});

describe('poll', () => {
  it('reports no pad and a neutral state when nothing is connected', () => {
    expect(pad.poll(0.15)).toBe(false);
    expect(pad.connected).toBe(false);
    expect(pad.st.ax).toBe(0);
  });

  it('does not count the press that wakes a pad up', () => {
    const p = mkPad();
    press(p, 0);
    pads = [p];
    expect(pad.poll(0.15)).toBe(true);
    expect(pad.st.hit[0]).toBe(false);
    expect(pad.st.btn[0]).toBe(true);
  });

  it('detects presses and releases on the frame they happen', () => {
    const p = mkPad();
    pads = [p];
    pad.poll(0.15);
    press(p, 1);
    pad.poll(0.15);
    expect(pad.st.hit[1]).toBe(true);
    expect(pad.st.firstHit).toBe(1);
    pad.poll(0.15);
    expect(pad.st.hit[1]).toBe(false); // held, not pressed again
    press(p, 1, false);
    pad.poll(0.15);
    expect(pad.st.rel[1]).toBe(true);
  });

  it('lets the D-pad win over the stick for steering', () => {
    const p = mkPad({ axes: [0.8, 0, 0, 0] });
    pads = [p];
    pad.poll(0.15);
    expect(pad.st.ax).toBeGreaterThan(0.6);
    expect(pad.st.right).toBe(true);
    press(p, 14); // D-pad left
    pad.poll(0.15);
    expect(pad.st.ax).toBe(-1);
    expect(pad.st.left).toBe(true);
  });

  it('uses hysteresis on the stick-as-arrow so it does not flicker', () => {
    const p = mkPad({ axes: [-0.5, 0, 0, 0] });
    pads = [p];
    pad.poll(0);
    expect(pad.st.left).toBe(false); // not past 0.55 yet
    p.axes[0] = -0.6;
    pad.poll(0);
    expect(pad.st.left).toBe(true);
    p.axes[0] = -0.45;
    pad.poll(0);
    expect(pad.st.left).toBe(true); // still held until under 0.4
    p.axes[0] = -0.3;
    pad.poll(0);
    expect(pad.st.left).toBe(false);
  });

  it('prefers a standard-mapped pad, and sticks to the one in use', () => {
    const odd = mkPad({ index: 0, mapping: '', id: 'generic' });
    const std = mkPad({ index: 1 });
    pads = [odd, std];
    pad.poll(0.15);
    expect(pad.id).toBe(std.id);
    pads = [odd, std];
    pad.poll(0.15);
    expect(pad.id).toBe(std.id);
  });
});

describe('rumble', () => {
  it('plays a dual-rumble effect, clamped to 1', () => {
    const playEffect = vi.fn(() => Promise.resolve());
    pads = [mkPad({ vibrationActuator: { playEffect } })];
    pad.poll(0.15);
    pad.rumble(2, 0.5, 120);
    expect(playEffect).toHaveBeenCalledWith('dual-rumble', {
      startDelay: 0,
      duration: 120,
      weakMagnitude: 0.5,
      strongMagnitude: 1,
    });
  });
  it('does nothing when vibration is turned off', () => {
    const playEffect = vi.fn(() => Promise.resolve());
    pads = [mkPad({ vibrationActuator: { playEffect } })];
    pad.poll(0.15);
    pad.enabled = false;
    pad.rumble(1, 1, 100);
    pad.enabled = true;
    expect(playEffect).not.toHaveBeenCalled();
  });
});

describe('button glyphs', () => {
  it('colours the PlayStation face buttons like the real pad', () => {
    expect(glyphOf('ps', 0)).toEqual({ text: '✕', shape: 'face', tone: 'blue' });
    expect(glyphOf('ps', 1)).toEqual({ text: '○', shape: 'face', tone: 'red' });
    expect(glyphOf('ps', 2)).toEqual({ text: '□', shape: 'face', tone: 'pink' });
    expect(glyphOf('ps', 3)).toEqual({ text: '△', shape: 'face', tone: 'green' });
  });
  it('colours the Xbox face buttons like the real pad', () => {
    expect(glyphOf('xbox', 0)).toEqual({ text: 'A', shape: 'face', tone: 'green' });
    expect(glyphOf('xbox', 1)).toEqual({ text: 'B', shape: 'face', tone: 'red' });
    expect(glyphOf('xbox', 2)).toEqual({ text: 'X', shape: 'face', tone: 'blue' });
    expect(glyphOf('xbox', 3)).toEqual({ text: 'Y', shape: 'face', tone: 'yellow' });
  });
  it('draws shoulders, triggers and the D-pad as their own shapes', () => {
    expect(glyphOf('ps', 6)).toEqual({ text: 'L2', shape: 'pill', tone: '' });
    expect(glyphOf('xbox', 7)).toEqual({ text: 'RT', shape: 'pill', tone: '' });
    expect(glyphOf('ps', 12)).toEqual({ text: '↑', shape: 'dpad', tone: '' });
  });
  it('uses the PlayStation look for pads it does not recognise', () => {
    expect(glyphOf('other', 2)).toEqual(glyphOf('ps', 2));
    expect(glyphOf('ps', 19).text).toBe('BTN 19');
  });
});
