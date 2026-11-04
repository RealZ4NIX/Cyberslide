import { describe, expect, it } from 'vitest';
import { distMult, speedMult } from './scoring';

const kmh = (v: number) => v / 3.6;

describe('speed multiplier', () => {
  it('is x1.0 up to 100 km/h', () => {
    expect(speedMult(0)).toBe(1);
    expect(speedMult(kmh(60))).toBe(1);
    expect(speedMult(kmh(139))).toBe(1);
  });
  it('climbs 0.1 for every 40 km/h above 100', () => {
    expect(speedMult(kmh(140))).toBe(1.1);
    expect(speedMult(kmh(180))).toBe(1.2);
    expect(speedMult(kmh(219))).toBe(1.2);
    expect(speedMult(kmh(220))).toBe(1.3);
    expect(speedMult(kmh(260))).toBe(1.4);
  });
  it('tops out at x1.5 from 300 km/h', () => {
    expect(speedMult(kmh(300))).toBe(1.5);
    expect(speedMult(kmh(420))).toBe(1.5);
  });
  it('only ever goes up with speed', () => {
    let last = 0;
    for (let v = 0; v < 400; v += 1) {
      const m = speedMult(kmh(v));
      expect(m).toBeGreaterThanOrEqual(last);
      last = m;
    }
  });
});

describe('distance multiplier', () => {
  it('is x1.0 for the first km, then +0.1 for every full km', () => {
    expect(distMult(0)).toBe(1);
    expect(distMult(999)).toBe(1);
    expect(distMult(1000)).toBe(1.1);
    expect(distMult(5400)).toBe(1.5);
    expect(distMult(9000)).toBe(1.9);
    expect(distMult(11000)).toBe(2.1);
  });
  it('has no cap (the 2-minute clock is the cap)', () => {
    expect(distMult(20000)).toBe(3);
  });
});
