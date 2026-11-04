/* A pose copied off the real player and put on a rival model must look the same: every part of the rider
   ends up in the same place in the world. */
import '../test-utils/fakeDom';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ND } from '../nd';
import '../tricks';
import '../world';
import '../riders';
import '../player';
import { RivalRider } from '../rival';
import { capture, lerpPose, P, POSE_LEN } from './pose';

const DT = 1 / 60;
const idle = () => ({
  left: false,
  right: false,
  up: false,
  down: false,
  space: false,
  trick: false,
  grab: false,
  flip: false,
  ax: 0,
});

function worldMats(root: THREE.Object3D): number[][] {
  root.updateMatrixWorld(true);
  const out: number[][] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh)
      out.push(o.matrixWorld.elements.map((v) => Math.round(v * 100) / 100));
  });
  return out;
}

describe('pose', () => {
  it('has a fixed length', () => {
    const p = new ND.Player(new THREE.Scene());
    expect(capture(p)).toHaveLength(POSE_LEN);
  });

  it('a mid-air trick on the real player looks identical on the rival model', () => {
    const scene = new THREE.Scene();
    const p = new ND.Player(scene);
    p.setRider('nova'); // hex's orbiting cubes run on their own clock, so compare a rider without moving extras
    p.resetAll();
    // ride, charge a jump, release, then start a grab in the air
    for (let i = 0; i < 60; i++) p.update(DT, idle());
    for (let i = 0; i < 30; i++) p.update(DT, { ...idle(), space: true });
    for (let i = 0; i < 12; i++) p.update(DT, idle());
    expect(p.state).toBe('air');
    p.update(DT, { ...idle(), right: true });
    p.update(DT, idle());
    for (let i = 0; i < 8; i++) p.update(DT, { ...idle(), grab: true });

    const rv = new RivalRider(new THREE.Scene());
    rv.setRider('nova');
    const pose = capture(p);
    rv.update(pose, DT, p.s, 'HEX', '0');
    expect(rv.shown).toBe(true);
    // the tail wiggles on each game's own clock: only the pose is compared
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const segs of [p.tailSegs, (rv as any).rig.tailSegs])
      for (const sg of segs) sg.rotation.y = 0;
    const a = worldMats(p.group),
      b = worldMats(rv.group);
    expect(b.length).toBe(a.length);
    for (let i = 0; i < a.length; i++)
      for (let k = 0; k < 16; k++) expect(b[i][k]).toBeCloseTo(a[i][k], 1);
  });

  it('blends angles the short way round', () => {
    const a = new Array<number>(POSE_LEN).fill(0),
      b = a.slice();
    a[P.gry] = Math.PI * 2 - 0.1;
    b[P.gry] = 0.1;
    a[P.gx] = 0;
    b[P.gx] = 10;
    const m = lerpPose(a, b, 0.5);
    expect(Math.cos(m[P.gry])).toBeCloseTo(1, 3);
    expect(m[P.gx]).toBe(5);
  });

  it('flags snap instead of blending', () => {
    const a = new Array<number>(POSE_LEN).fill(0),
      b = a.slice();
    b[P.vis] = 1;
    expect(lerpPose(a, b, 0.4)[P.vis]).toBe(0);
    expect(lerpPose(a, b, 0.6)[P.vis]).toBe(1);
  });

  it('a rider out of range is hidden', () => {
    const p = new ND.Player(new THREE.Scene());
    const rv = new RivalRider(new THREE.Scene());
    rv.setRider('nova');
    rv.update(capture(p), DT, p.s + 1000, 'X', '0');
    expect(rv.shown).toBe(false);
  });
});
