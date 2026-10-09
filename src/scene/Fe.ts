/**
 * Fe: the nib. A tiny pink-sapphire ball held in a skeletal ballpoint socket,
 * with two galvo mirrors behind it that steer the beam. It has no controls of
 * its own: it only actuates under the pressure of a social prompt.
 *
 * It only glows with the energy that actually reaches it. When the beam starves
 * inside Ni, the nib is dead: the refill slides out, the cold ball presses into
 * the paper and drags a dry groove across it.
 */
import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  Quaternion,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import { arrivingEnergy, nibIntensity } from '../model/nib';
import { AXIS_QUAT, FE_POS, labelAnchor } from './layout';
import { knurled, titanium } from './materials';
import { glowTexture } from './textures';
import type { FrameContext, Instrument } from './types';

/** Galvo mirror positions in Fe's local frame (+Z along the beam). */
const GALVO_LOCAL = [new Vector3(0, 0.2, -0.95), new Vector3(0, -0.09, -0.66)];
const BALL_LOCAL = new Vector3(0, 0, 0.03);
const BALL_R = 0.068;
/** Where the refill leaves the collar, and where the socket's base sits behind the ball. */
const COLLAR_Z = -0.44;
const SOCKET_BASE = new Vector3(0, 0, -0.16);

const _a = new Vector3();
const _b = new Vector3();
const _n = new Vector3();
const _q = new Quaternion();
const _ball = new Vector3();
const _dir = new Vector3();
const Z = new Vector3(0, 0, 1);
const Y = new Vector3(0, 1, 0);
const COLLAR = new Vector3(0, 0, COLLAR_Z);

const ALIVE = new Color(0xff5aa8);
const DEAD = new Color(0x4a3a42);

const ease = (t: number) => t * t * (3 - 2 * t);

export class Fe implements Instrument {
  readonly id = 'fe' as const;
  readonly group = new Group();
  readonly pickables: Object3D[] = [];
  readonly labelAnchor = labelAnchor(FE_POS, 0.75);
  readonly view = {
    position: FE_POS.clone().add(new Vector3(-0.6, 1.0, 3.1)),
    target: FE_POS.clone().add(new Vector3(-0.3, -0.05, 0)),
  };

  private nib = new Group();
  /** Socket and ball: slides out on the refill when a dead nib has to press down. */
  private tip = new Group();
  private refill: Mesh;
  private ballMat = new MeshPhysicalMaterial({
    color: 0xff5aa8,
    metalness: 0,
    roughness: 0.04,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    ior: 1.77,
    envMapIntensity: 2,
    emissive: new Color(1, 0.25, 0.6),
    emissiveIntensity: 0.2,
  });
  private mirrors: Mesh[] = [];
  private light = new PointLight(0xff4fa0, 0, 3, 1.5);
  private spark: Sprite;
  private actuation = 0;
  private reach = 0;
  /** How lit the nib is right now (0 = dead), for the scene and tests in the browser. */
  lit = 0;

  constructor() {
    this.group.position.copy(FE_POS);
    this.group.quaternion.copy(AXIS_QUAT);
    this.group.add(this.nib);

    const ti = titanium(0x2a2d36, 0.26);
    // Socket: a short tapered tip that holds the ball.
    const socket = new LatheGeometry(
      [new Vector2(0.052, 0.0), new Vector2(0.075, -0.05), new Vector2(0.105, -0.16), new Vector2(0.1, -0.18)],
      40,
    );
    socket.rotateX(Math.PI / 2);
    const socketMesh = new Mesh(socket, ti);
    // Collar, knurled.
    const collar = new Mesh(new CylinderGeometry(0.2, 0.2, 0.12, 48, 1, true), knurled(36));
    collar.geometry.rotateX(Math.PI / 2);
    collar.position.z = -0.5;
    const collarCap = new Mesh(new TorusGeometry(0.2, 0.02, 8, 48), ti);
    collarCap.position.z = COLLAR_Z;
    // Throat ring the struts hold; the socket rests in it and slides out of it.
    const throat = new Mesh(new TorusGeometry(0.104, 0.012, 8, 40), ti);
    throat.position.z = -0.17;
    // Three struts from collar to throat: a skeletal cone so the beam stays visible.
    const strutGeo = new CylinderGeometry(0.012, 0.012, 1, 6);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
      const from = new Vector3(Math.cos(a) * 0.19, Math.sin(a) * 0.19, -0.46);
      const to = new Vector3(Math.cos(a) * 0.1, Math.sin(a) * 0.1, -0.17);
      const strut = new Mesh(strutGeo, ti);
      strut.position.copy(from).add(to).multiplyScalar(0.5);
      strut.scale.y = from.distanceTo(to);
      strut.quaternion.setFromUnitVectors(Y, to.clone().sub(from).normalize());
      this.nib.add(strut);
    }
    // The refill: a thin rod from the collar to the socket, mostly hidden at rest.
    this.refill = new Mesh(new CylinderGeometry(0.017, 0.017, 1, 10), titanium(0x3a3f4b, 0.22));
    this.refill.visible = false;
    const ball = new Mesh(new SphereGeometry(BALL_R, 32, 20), this.ballMat);
    ball.position.copy(BALL_LOCAL);
    this.tip.add(socketMesh, ball);
    this.nib.add(collar, collarCap, throat, this.refill, this.tip);

    // Galvo mirrors on tiny motors.
    // Satin rather than chrome: a mirror-finish highlight from the nib light blooms into a blob.
    const chrome = new MeshStandardMaterial({ color: 0x8e96a8, metalness: 1, roughness: 0.32, envMapIntensity: 0.8 });
    const motorGeo = new CylinderGeometry(0.035, 0.035, 0.12, 16);
    for (const p of GALVO_LOCAL) {
      const mirror = new Mesh(new BoxGeometry(0.15, 0.1, 0.012), chrome);
      mirror.position.copy(p);
      const motor = new Mesh(motorGeo, ti);
      motor.position.copy(p).add(new Vector3(0.12, 0, 0));
      motor.rotation.z = Math.PI / 2;
      this.mirrors.push(mirror);
      this.group.add(mirror, motor);
      this.pickables.push(mirror, motor);
    }

    this.spark = new Sprite(
      new SpriteMaterial({
        map: glowTexture(),
        color: new Color(1, 0.35, 0.7),
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      }),
    );
    this.spark.position.copy(BALL_LOCAL);
    this.spark.scale.setScalar(0.32);
    this.light.position.copy(BALL_LOCAL);
    this.tip.add(this.spark, this.light);
    this.pickables.push(socketMesh, collar, ball);
  }

  galvoWorld(i: 0 | 1, out: Vector3): Vector3 {
    return this.group.localToWorld(out.copy(GALVO_LOCAL[i]));
  }

  ballWorld(out: Vector3): Vector3 {
    return this.tip.localToWorld(out.copy(BALL_LOCAL));
  }

  /** Orient each galvo so it reflects `prev → mirror → next` (prev/next in world space). */
  steer(i: 0 | 1, prev: Vector3, next: Vector3): void {
    const m = this.mirrors[i];
    const p = this.galvoWorld(i, _a);
    const din = _b.copy(p).sub(prev).normalize();
    const dout = _n.copy(next).sub(p).normalize();
    const normal = dout.sub(din).normalize();
    // Into Fe's local frame.
    _q.copy(this.group.quaternion).invert();
    normal.applyQuaternion(_q);
    m.quaternion.setFromUnitVectors(Z, normal);
  }

  update(ctx: FrameContext): void {
    this.actuation += (ctx.actuation - this.actuation) * Math.min(1, ctx.dt * 8);
    const a = this.actuation;
    // Pressure: the nib presses forward a touch when it writes.
    this.nib.position.z = 0.06 * a;
    const wobble = ctx.drawing && !ctx.reducedMotion ? 0.004 * Math.sin(ctx.time * 60) : 0;
    this.nib.position.x = wobble;

    // Only what actually arrives can light the nib. Starved, it is dead whatever the pressure.
    const energy = arrivingEnergy(ctx.beam);
    const live = nibIntensity(energy, 1);
    const idle = live * energy * (1 - a);
    this.lit = nibIntensity(energy, a);
    // A dead nib is a dull, cold bead rather than a gem.
    this.ballMat.color.copy(DEAD).lerp(ALIVE, live);
    this.ballMat.emissiveIntensity = 0.03 + 0.3 * idle + 1.4 * this.lit;
    this.light.intensity = 2.2 * this.lit;
    this.spark.material.opacity = 0.35 * this.lit;

    // A dead nib that has to write anyway reaches down and presses the cold ball into the paper.
    const want = ctx.drawing ? ctx.actuation * ctx.nibContact : 0;
    this.reach += (want - this.reach) * Math.min(1, ctx.dt * (want > this.reach ? 5 : 3));
    this.placeTip(ctx, ease(Math.min(1, this.reach)));
  }

  /** Slide the socket out along the refill so the ball sits on the draw point (r = 0: at rest). */
  private placeTip(ctx: FrameContext, r: number): void {
    if (r < 1e-3) {
      this.tip.position.set(0, 0, 0);
      this.tip.quaternion.identity();
      this.refill.visible = false;
      return;
    }
    this.nib.updateMatrixWorld();
    // Target ball centre, resting on the paper at the draw point, in the nib's frame.
    _ball.copy(ctx.drawPoint);
    _ball.y += BALL_R + 0.004;
    this.nib.worldToLocal(_ball);
    _ball.lerpVectors(BALL_LOCAL, _ball, r);
    _dir.copy(_ball).sub(COLLAR).normalize();
    this.tip.quaternion.setFromUnitVectors(Z, _dir);
    this.tip.position.copy(BALL_LOCAL).applyQuaternion(this.tip.quaternion).negate().add(_ball);

    // Refill from the collar to the socket's base.
    _a.copy(SOCKET_BASE).applyQuaternion(this.tip.quaternion).add(this.tip.position);
    const len = _a.distanceTo(COLLAR);
    this.refill.position.copy(_a).add(COLLAR).multiplyScalar(0.5);
    this.refill.quaternion.setFromUnitVectors(Y, _dir);
    this.refill.scale.set(1, Math.max(0.01, len), 1);
    this.refill.visible = true;
  }
}
