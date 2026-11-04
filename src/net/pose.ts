/* CYBERSLIDE - the rider's whole look in one flat array, so a rival's rider can be drawn doing exactly what
   the real one does: position, body rotation, board flips, grabs, arms, crouch. player.ts builds these
   transforms every frame; this copies them out and back in. */

/** the parts of a rider model a pose drives (player.ts and rival.ts both have them) */
export interface PoseRig {
  group: Obj3;
  flipG: Obj3;
  board: Obj3;
  body: Obj3;
  armNear: Obj3;
  armFar: Obj3;
  tail: Obj3;
}
interface V3 {
  x: number;
  y: number;
  z: number;
}
interface Obj3 {
  position: V3;
  rotation: V3;
  scale: V3;
  visible: boolean;
}
/** what capture() reads off the player besides its model */
export interface PoseSource extends PoseRig {
  speed: number;
  heading: number;
  state: string;
  glowMat: { opacity: number };
}

/* index of every slot */
export const P = {
  gx: 0,
  gy: 1,
  gz: 2,
  grx: 3,
  gry: 4,
  grz: 5,
  fx: 6,
  fy: 7,
  fz: 8,
  lift: 9,
  by: 10,
  brx: 11,
  brz: 12,
  bodyRy: 13,
  bodyY: 14,
  bodySy: 15,
  armN: 16,
  armF: 17,
  tail: 18,
  vis: 19,
  speed: 20,
  glow: 21,
  heading: 22,
  crash: 23,
} as const;
export const POSE_LEN = 24;
/** slots that are angles: blended the short way round so a reset from 2π to 0 doesn't spin the model */
const ANGLES = [
  P.grx,
  P.gry,
  P.grz,
  P.fx,
  P.fy,
  P.fz,
  P.brx,
  P.brz,
  P.bodyRy,
  P.armN,
  P.armF,
  P.tail,
  P.heading,
];
const IS_ANGLE: boolean[] = Array.from({ length: POSE_LEN }, (_, i) => ANGLES.includes(i as never));
const TAU = Math.PI * 2;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

export function capture(p: PoseSource): number[] {
  const g = p.group,
    f = p.flipG;
  return [
    g.position.x,
    g.position.y,
    g.position.z,
    g.rotation.x,
    g.rotation.y,
    g.rotation.z,
    f.rotation.x,
    f.rotation.y,
    f.rotation.z,
    f.position.y,
    p.board.position.y,
    p.board.rotation.x,
    p.board.rotation.z,
    p.body.rotation.y,
    p.body.position.y,
    p.body.scale.y,
    p.armNear.rotation.x,
    p.armFar.rotation.x,
    p.tail.rotation.z,
    g.visible ? 1 : 0,
    p.speed,
    p.glowMat.opacity,
    p.heading,
    p.state === 'crash' ? 1 : 0,
  ].map(r3);
}

/** angle from a to b the short way round */
const dAng = (a: number, b: number) => {
  const d = (b - a) % TAU;
  return d > Math.PI ? d - TAU : d < -Math.PI ? d + TAU : d;
};

/** blend two poses; u = 0 gives a, 1 gives b. Flags (visible, crashed) snap at the halfway point. */
export function lerpPose(a: number[], b: number[], u: number): number[] {
  const out = new Array<number>(POSE_LEN);
  for (let i = 0; i < POSE_LEN; i++) {
    if (i === P.vis || i === P.crash) out[i] = u < 0.5 ? a[i] : b[i];
    else if (IS_ANGLE[i]) out[i] = a[i] + dAng(a[i], b[i]) * u;
    else out[i] = a[i] + (b[i] - a[i]) * u;
  }
  return out;
}

export function apply(r: PoseRig, p: number[]): void {
  r.group.position.x = p[P.gx];
  r.group.position.y = p[P.gy];
  r.group.position.z = p[P.gz];
  r.group.rotation.x = p[P.grx];
  r.group.rotation.y = p[P.gry];
  r.group.rotation.z = p[P.grz];
  r.group.visible = p[P.vis] > 0.5;
  r.flipG.rotation.x = p[P.fx];
  r.flipG.rotation.y = p[P.fy];
  r.flipG.rotation.z = p[P.fz];
  r.flipG.position.y = p[P.lift];
  r.board.position.y = p[P.by];
  r.board.rotation.x = p[P.brx];
  r.board.rotation.z = p[P.brz];
  r.body.rotation.y = p[P.bodyRy];
  r.body.position.y = p[P.bodyY];
  r.body.scale.y = p[P.bodySy];
  r.armNear.rotation.x = p[P.armN];
  r.armFar.rotation.x = p[P.armF];
  r.tail.rotation.z = p[P.tail];
}

/** where on the hill a pose is: x across, s down the slope (the world z axis is -s) */
export const poseAt = (p: number[]) => ({ x: p[P.gx], s: -p[P.gz], y: p[P.gy] });
