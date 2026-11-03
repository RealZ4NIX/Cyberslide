import './test-utils/fakeDom';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ND } from './nd';
import './riders';

interface RiderDef {
  id: string;
  name: string;
  stats: Record<string, number>;
}
const RIDERS = ND.RIDERS as RiderDef[];

describe('riders', () => {
  it('has the four riders, each with all seven stats from 1 to 5', () => {
    expect(RIDERS.map((r) => r.id)).toEqual(['nova', 'volt', 'hex', 'chrome']);
    const keys = (ND.STAT_KEYS as [string, string][]).map(([k]) => k);
    for (const r of RIDERS) {
      expect(Object.keys(r.stats).sort()).toEqual([...keys].sort());
      for (const v of Object.values(r.stats)) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(5);
      }
    }
  });

  it('turns stats into physics multipliers, with the all-rounder at exactly 1', () => {
    const k = ND.riderK(RIDERS[0].stats);
    for (const [name, v] of Object.entries(k))
      if (typeof v === 'number') expect(v, name).toBeCloseTo(1, 9);
    const volt = ND.riderK(RIDERS[1].stats);
    expect(volt.drag).toBeLessThan(1); // faster top speed
    expect(volt.turn).toBeLessThan(1); // wider turns
  });

  it('builds every rider model without a GPU, and falls back to NOVA for unknown ids', () => {
    for (const r of RIDERS) {
      const rg = ND.buildRider(r.id);
      expect(rg.def.id).toBe(r.id);
      expect(rg.body).toBeInstanceOf(THREE.Object3D);
      expect(rg.board).toBeInstanceOf(THREE.Object3D);
      expect(() => rg.idle?.(1.5, 1 / 60)).not.toThrow();
    }
    expect(ND.buildRider('nobody').def.id).toBe('nova');
  });
});
