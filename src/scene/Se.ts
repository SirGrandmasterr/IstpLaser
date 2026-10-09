/**
 * Se: the dynamo. A gold flywheel torus around the beam. Particles from the
 * surroundings strike its rim and add torque; friction bleeds it off. While it
 * spins it glows and charges the beam passing through its hole.
 */
import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
} from 'three';
import { AXIS_QUAT, SE_POS } from './layout';
import { titanium } from './materials';
import { glowTexture, gridTextures } from './textures';
import type { FrameContext, Instrument } from './types';

export const SE_MAJOR = 1.05;
export const SE_TUBE = 0.27;
/** Peak angular velocity of the ring in rad/s. */
const MAX_SPIN = 9;

export class Se implements Instrument {
  readonly id = 'se' as const;
  readonly group = new Group();
  readonly pickables: Object3D[] = [];
  readonly labelAnchor = SE_POS.clone().add(new Vector3(0.1, 1.75, 0));
  readonly view = {
    position: SE_POS.clone().add(new Vector3(2.4, 1.3, 5.2)),
    target: SE_POS.clone(),
  };

  angle = 0;
  private rotor = new Group();
  private mat: MeshStandardMaterial;
  private halo: Sprite;
  private light = new PointLight(0xffb347, 0, 7, 1.6);
  private hitFlash = 0;

  constructor() {
    this.group.position.copy(SE_POS);
    this.group.quaternion.copy(AXIS_QUAT);

    const grid = gridTextures();
    this.mat = new MeshStandardMaterial({
      color: 0xffffff,
      map: grid.map,
      emissiveMap: grid.emissive,
      emissive: new Color(1.0, 0.62, 0.2),
      emissiveIntensity: 0.1,
      metalness: 0.85,
      roughness: 0.3,
    });
    const torus = new Mesh(new TorusGeometry(SE_MAJOR, SE_TUBE, 32, 160), this.mat);
    torus.name = 'se-ring';

    // Hub and spokes keep the hole open for the beam but make spin readable.
    const hubMat = titanium(0x3a2c18, 0.3);
    const hub = new Mesh(new TorusGeometry(0.42, 0.035, 8, 64), hubMat);
    this.rotor.add(torus, hub);
    const spokeGeo = new BoxGeometry(0.035, 0.42, 0.05);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const spoke = new Mesh(spokeGeo, hubMat);
      spoke.position.set(Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0);
      spoke.rotation.z = a - Math.PI / 2;
      this.rotor.add(spoke);
    }
    this.group.add(this.rotor);

    this.halo = new Sprite(
      new SpriteMaterial({
        map: glowTexture(),
        color: new Color(1.0, 0.6, 0.2),
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      }),
    );
    this.halo.scale.setScalar(4.2);
    this.group.add(this.halo, this.light);

    this.pickables.push(torus, hub);
  }

  /** World point on the outer rim at angle θ (in the ring's rotating frame or fixed frame). */
  rimWorld(theta: number, out: Vector3): Vector3 {
    const r = SE_MAJOR + SE_TUBE * 0.85;
    out.set(Math.cos(theta) * r, Math.sin(theta) * r, 0);
    return out.applyQuaternion(AXIS_QUAT).add(SE_POS);
  }

  /** Tangent (direction of spin) at rim angle θ, world space. */
  tangentWorld(theta: number, out: Vector3): Vector3 {
    out.set(-Math.sin(theta), Math.cos(theta), 0);
    return out.applyQuaternion(AXIS_QUAT);
  }

  onHit(): void {
    this.hitFlash = Math.min(1, this.hitFlash + 0.35);
  }

  update(ctx: FrameContext): void {
    const T = ctx.beam.T;
    this.angle += T * MAX_SPIN * ctx.dt;
    this.rotor.rotation.z = this.angle;
    this.hitFlash = Math.max(0, this.hitFlash - ctx.dt * 3);

    const lum = T * T * 0.6 + T * 0.9 + this.hitFlash * 0.4;
    this.mat.emissiveIntensity = 0.08 + lum * 1.6;
    this.halo.material.opacity = Math.min(0.55, T * 0.45 + this.hitFlash * 0.15);
    this.light.intensity = T * 9 + this.hitFlash * 2;
  }
}
