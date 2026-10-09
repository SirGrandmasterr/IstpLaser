/**
 * Ni: the variable-focal collimator. Unprimed it is a flat elliptical pancake
 * lens; primed, its elements telescope outward into a barrel that points.
 */
import {
  AdditiveBlending,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
} from 'three';
import { seGate } from '../model/beam';
import { AXIS_QUAT, labelAnchor, NI_POS } from './layout';
import { glass, titanium } from './materials';
import { glowTexture } from './textures';
import type { FrameContext, Instrument } from './types';

const N = 5;
const PANCAKE = { rx: 0.92, ry: 0.56 };
const SPACING = 0.27;
const START_Z = -0.32;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class Ni implements Instrument {
  readonly id = 'ni' as const;
  readonly group = new Group();
  readonly pickables: Object3D[] = [];
  readonly labelAnchor = labelAnchor(NI_POS, 1.25);
  readonly view = {
    position: NI_POS.clone().add(new Vector3(2.6, 1.6, 5.6)),
    target: NI_POS.clone().add(new Vector3(0.3, -0.15, 0)),
  };

  /** Spring-driven extension (can overshoot slightly). */
  extension = 0;
  private extVel = 0;
  private elements: Group[] = [];
  private sleeves: Mesh[] = [];
  private glassMat = glass(0x8d7bff, 0.32);
  private rimGlow = new MeshBasicMaterial({ color: new Color(0.35, 0.25, 1.2), toneMapped: false });
  private haze: Sprite;
  private hazeAmount = 0;

  constructor() {
    this.group.position.copy(NI_POS);
    this.group.quaternion.copy(AXIS_QUAT);

    const discGeo = new CylinderGeometry(1, 1, 0.045, 56);
    discGeo.rotateX(Math.PI / 2);
    const rimGeo = new TorusGeometry(1, 0.04, 10, 72);
    const lineGeo = new TorusGeometry(1.0, 0.012, 6, 72);
    const rimMat = titanium(0x2b2840, 0.3);
    for (let i = 0; i < N; i++) {
      const el = new Group();
      const disc = new Mesh(discGeo, this.glassMat);
      const rim = new Mesh(rimGeo, rimMat);
      const line = new Mesh(lineGeo, this.rimGlow);
      line.position.z = 0.03;
      el.add(disc, rim, line);
      this.elements.push(el);
      this.group.add(el);
      this.pickables.push(disc, rim);
    }

    const sleeveGeo = new CylinderGeometry(1, 1, 1, 56, 1, true);
    sleeveGeo.rotateX(Math.PI / 2);
    const sleeveMat = titanium(0x24222f, 0.34);
    sleeveMat.side = DoubleSide;
    for (let i = 0; i < N - 1; i++) {
      const s = new Mesh(sleeveGeo, sleeveMat);
      this.sleeves.push(s);
      this.group.add(s);
      this.pickables.push(s);
    }

    this.haze = new Sprite(
      new SpriteMaterial({
        map: glowTexture(),
        color: new Color(0.35, 0.25, 1.0),
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      }),
    );
    this.haze.scale.setScalar(2.6);
    this.group.add(this.haze);
  }

  /** Where the beam leaves Ni, world space. */
  exitWorld(out: Vector3): Vector3 {
    const e = Math.max(0, this.extension);
    out.set(0, 0, lerp(0.05, START_Z + (N - 1) * SPACING + 0.05, e));
    return this.group.localToWorld(out);
  }

  entryWorld(out: Vector3): Vector3 {
    out.set(0, 0, lerp(-0.05, START_Z - 0.05, Math.max(0, this.extension)));
    return this.group.localToWorld(out);
  }

  get haziness(): number {
    return this.hazeAmount;
  }

  update(ctx: FrameContext): void {
    // A mechanical ease with slight overshoot (≈1.5 s), following the model's D.
    const k = ctx.reducedMotion ? 30 : 22;
    const c = ctx.reducedMotion ? 11 : 5.6;
    this.extVel += (k * (ctx.beam.D - this.extension) - c * this.extVel) * ctx.dt;
    this.extension += this.extVel * ctx.dt;
    const e = this.extension;
    const ec = Math.min(1, Math.max(0, e));

    const radii: number[] = [];
    const zs: number[] = [];
    for (let i = 0; i < N; i++) {
      const r = lerp(1, 0.62 - i * 0.08, ec);
      const z = lerp((i - (N - 1) / 2) * 0.02, START_Z + i * SPACING, e);
      const rx = r * lerp(PANCAKE.rx, 1, ec);
      const ry = r * lerp(PANCAKE.ry, 1, ec);
      const el = this.elements[i];
      el.position.z = z;
      el.scale.set(rx, ry, 1);
      radii.push(Math.min(rx, ry));
      zs.push(z);
    }
    for (let i = 0; i < N - 1; i++) {
      const s = this.sleeves[i];
      const len = Math.max(0.01, zs[i + 1] - zs[i]);
      const el = this.elements[i];
      s.position.z = (zs[i] + zs[i + 1]) / 2;
      s.scale.set(el.scale.x * 0.97, el.scale.y * 0.97, len);
      s.visible = ec > 0.04;
    }

    const glow = 0.4 + 1.6 * ctx.beam.F;
    this.rimGlow.color.setRGB(0.3 * glow, 0.2 * glow, 1.0 * glow);
    this.glassMat.emissive.setRGB(0.08 * glow, 0.05 * glow, 0.3 * glow);

    // When Se starves, a coherent beam dies in here as indigo haze.
    const target = ctx.beam.C * (1 - seGate(ctx.beam.T));
    this.hazeAmount += (target - this.hazeAmount) * Math.min(1, ctx.dt * 3);
    const flicker = ctx.reducedMotion ? 1 : 0.85 + 0.15 * Math.sin(ctx.time * 7.3);
    this.haze.material.opacity = this.hazeAmount * 0.55 * flicker;
  }
}
