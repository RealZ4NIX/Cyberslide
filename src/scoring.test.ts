import { describe, expect, it } from 'vitest';
import { distPoints, distRate, speedMult } from './scoring';

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

describe('distance points', () => {
  it('pay more per metre the deeper you are, up to a cap', () => {
    expect(distRate(0)).toBe(1);
    expect(distRate(1000)).toBe(2);
    expect(distRate(5000)).toBe(6);
    expect(distRate(9000)).toBe(10);
    expect(distRate(50000)).toBe(10);
  });
  it('add up to the area under the rate', () => {
    expect(distPoints(0)).toBe(0);
    expect(distPoints(1000)).toBe(1500);
    expect(distPoints(5000)).toBe(17500);
    expect(distPoints(9000)).toBe(49500);
    expect(distPoints(10000)).toBe(59500);
    // the closed form matches stepping metre by metre
    let sum = 0;
    for (let d = 0; d < 6000; d += 0.5) sum += distRate(d + 0.25) * 0.5;
    expect(sum).toBeCloseTo(distPoints(6000), 0);
  });
});
