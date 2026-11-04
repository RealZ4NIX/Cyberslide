/* CYBERSLIDE - the other rider in a 1v1 link: their own rider model, posed from the frames their game sends
   (net/pose.ts), with a soft glow on the snow and a floating name and score tag. Nothing here collides. */

import * as THREE from 'three';
import { ND } from './nd';
import { apply, P, poseAt, type PoseRig } from './net/pose';

/** past this far up or down the hill the rival is out of the streamed world and the fog anyway */
export const RIVAL_RANGE = 240;
const TAG_W = 256,
  TAG_H = 72;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rig = any;

export class RivalRider {
  readonly group = new THREE.Group();
  readonly flipG = new THREE.Group();
  private rig: Rig = null;
  private rigId = '';
  private parts: PoseRig | null = null;
  private readonly glow: THREE.Mesh;
  private readonly glowMat: THREE.MeshBasicMaterial;
  private readonly tag: THREE.Sprite;
  private readonly tagCv: HTMLCanvasElement;
  private readonly tagTex: THREE.CanvasTexture;
  private tagKey = '';
  private t = 0;
  /** true while something is drawn (a pose arrived and the rider is in range) */
  shown = false;

  constructor(scene: THREE.Scene) {
    this.group.rotation.order = 'YXZ';
    this.flipG.rotation.order = 'YXZ';
    this.group.add(this.flipG);
    this.group.scale.set(1.25, 1.25, 1.25);
    this.group.visible = false;
    scene.add(this.group);

    const gc = document.createElement('canvas');
    gc.width = gc.height = 64;
    const gx = gc.getContext('2d')!,
      grd = gx.createRadialGradient(32, 32, 2, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,0.95)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    gx.fillStyle = grd;
    gx.fillRect(0, 0, 64, 64);
    this.glowMat = new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(gc),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.5,
    });
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 3.8), this.glowMat);
    this.glow.rotation.order = 'YXZ';
    this.glow.visible = false;
    scene.add(this.glow);

    this.tagCv = document.createElement('canvas');
    this.tagCv.width = TAG_W;
    this.tagCv.height = TAG_H;
    this.tagTex = new THREE.CanvasTexture(this.tagCv);
    this.tagTex.minFilter = THREE.LinearFilter;
    this.tag = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.tagTex,
        depthTest: false,
        depthWrite: false,
        fog: false,
        transparent: true,
      }),
    );
    this.tag.scale.set(2.6, 2.6 * (TAG_H / TAG_W), 1);
    this.tag.renderOrder = 6;
    this.tag.visible = false;
    scene.add(this.tag);
  }

  /** swap to this rider's model (an unknown id falls back to NOVA, like the rest of the game) */
  setRider(id: string): void {
    const def = ND.riderDef(id) || ND.RIDERS[0];
    if (this.rigId === def.id) return;
    if (this.rig) {
      this.flipG.remove(this.rig.board);
      this.group.remove(this.rig.body);
    }
    const rg = ND.buildRider(def.id);
    this.rig = rg;
    this.rigId = def.id;
    rg.board.position.set(0, 0, 0);
    rg.board.rotation.set(0, 0, 0);
    rg.body.position.set(0, 0, 0);
    rg.body.rotation.set(0, -0.7, 0, 'XYZ');
    this.flipG.add(rg.board);
    this.group.add(rg.body);
    this.glowMat.color.setHex(rg.glow);
    this.parts = {
      group: this.group,
      flipG: this.flipG,
      board: rg.board,
      body: rg.body,
      armNear: rg.armNear,
      armFar: rg.armFar,
      tail: rg.tail,
    };
    this.tagKey = '';
  }

  get color(): string {
    return (ND.riderDef(this.rigId) || ND.RIDERS[0]).color;
  }

  private paintTag(name: string, score: string): void {
    const key = name + '|' + score;
    if (key === this.tagKey) return;
    this.tagKey = key;
    const g = this.tagCv.getContext('2d')!;
    g.clearRect(0, 0, TAG_W, TAG_H);
    g.fillStyle = 'rgba(10,4,30,0.72)';
    g.fillRect(8, 4, TAG_W - 16, TAG_H - 8);
    g.fillStyle = this.color;
    g.fillRect(8, 4, 5, TAG_H - 8);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '700 26px "Russo One", "Chakra Petch", sans-serif';
    g.fillText(name, TAG_W / 2, 24);
    g.fillStyle = '#ffffff';
    g.font = '700 22px "Chakra Petch", sans-serif';
    g.fillText(score, TAG_W / 2, 52);
    this.tagTex.needsUpdate = true;
  }

  /** draw the rival at this pose (null hides them); localS = where you are on the hill */
  update(
    pose: number[] | null,
    dt: number,
    localS: number,
    name: string,
    score: string,
    localX = 0,
  ): void {
    this.t += dt;
    const at = pose && poseAt(pose);
    this.shown = !!(pose && at && this.parts && Math.abs(at.s - localS) < RIVAL_RANGE);
    if (!this.shown || !pose || !at || !this.parts) {
      this.group.visible = this.glow.visible = this.tag.visible = false;
      return;
    }
    apply(this.parts, pose);
    const rg = this.rig;
    if (rg.fx) rg.fx(this.t, dt, pose[P.speed]);
    if (rg.tailSegs)
      for (let i = 0; i < rg.tailSegs.length; i++)
        rg.tailSegs[i].rotation.y = Math.sin(this.t * 10 + i * 1.2) * 0.3;
    const h = pose[P.heading],
      gy = ND.H(at.x, at.s),
      dh = ND.H(at.x + Math.sin(h), at.s + Math.cos(h)) - gy;
    this.glow.visible = true;
    this.glow.position.set(at.x, gy + 0.07, -at.s);
    this.glow.rotation.set(-Math.PI / 2 + Math.atan(dh), -h, 0);
    this.glowMat.opacity = pose[P.glow];
    // the tag fades out when you ride right next to each other, so it never sits in your face
    const near = Math.hypot(at.x - localX, at.s - localS);
    (this.tag.material as THREE.SpriteMaterial).opacity = Math.max(0, Math.min(1, (near - 5) / 9));
    this.tag.visible = near > 5;
    this.tag.position.set(at.x, at.y + 3.4, -at.s);
    this.paintTag(name, score);
  }

  hide(): void {
    this.shown = false;
    this.group.visible = this.glow.visible = this.tag.visible = false;
  }
}
