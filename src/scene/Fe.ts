/**
 * Fe: the nib. A tiny pink-sapphire ball held in a skeletal ballpoint socket,
 * with two galvo mirrors behind it that steer the beam. It has no controls of
 * its own: it only actuates under the pressure of a social prompt.
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
import { AXIS_QUAT, FE_POS } from './layout';
import { knurled, titanium } from './materials';
import { glowTexture } from './textures';
import type { FrameContext, Instrument } from './types';

/** Galvo mirror positions in Fe's local frame (+Z along the beam). */
const GALVO_LOCAL = [new Vector3(0, 0.2, -0.95), new Vector3(0, -0.09, -0.66)];
const BALL_LOCAL = new Vector3(0, 0, 0.03);

const _a = new Vector3();
const _b = new Vector3();
const _n = new Vector3();
const _q = new Quaternion();
const Z = new Vector3(0, 0, 1);

export class Fe implements Instrument {
  readonly id = 'fe' as const;
  readonly group = new Group();
  readonly pickables: Object3D[] = [];
  readonly labelAnchor = FE_POS.clone().add(new Vector3(0.45, 0.85, 0));
  readonly view = {
    position: FE_POS.clone().add(new Vector3(1.6, 0.9, 3.2)),
    target: FE_POS.clone().add(new Vector3(0.1, -0.15, 0)),
  };

  private nib = new Group();
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
    collarCap.position.z = -0.44;
    // Three struts from collar to socket: a skeletal cone so the beam stays visible.
    const strutGeo = new CylinderGeometry(0.012, 0.012, 1, 6);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
      const from = new Vector3(Math.cos(a) * 0.19, Math.sin(a) * 0.19, -0.46);
      const to = new Vector3(Math.cos(a) * 0.1, Math.sin(a) * 0.1, -0.17);
      const strut = new Mesh(strutGeo, ti);
      strut.position.copy(from).add(to).multiplyScalar(0.5);
      strut.scale.y = from.distanceTo(to);
      strut.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), to.clone().sub(from).normalize());
      this.nib.add(strut);
    }
    const ball = new Mesh(new SphereGeometry(0.068, 32, 20), this.ballMat);
    ball.position.copy(BALL_LOCAL);
    this.nib.add(socketMesh, collar, collarCap, ball);

    // Galvo mirrors on tiny motors.
    const chrome = new MeshStandardMaterial({ color: 0xe8ecf4, metalness: 1, roughness: 0.04 });
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
    this.spark.scale.setScalar(0.5);
    this.nib.add(this.spark, this.light);
    this.pickables.push(socketMesh, collar, ball);
  }

  galvoWorld(i: 0 | 1, out: Vector3): Vector3 {
    return this.group.localToWorld(out.copy(GALVO_LOCAL[i]));
  }

  ballWorld(out: Vector3): Vector3 {
    return this.nib.localToWorld(out.copy(BALL_LOCAL));
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
    this.ballMat.emissiveIntensity = 0.15 + 0.35 * ctx.beam.E * (1 - a) + 3.2 * a;
    this.light.intensity = 3.5 * a;
    this.spark.material.opacity = 0.75 * a;
  }
}
