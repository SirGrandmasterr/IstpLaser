/**
 * The source: a small emitter at the upper left. Its laser is the raw impulse,
 * what is actually felt. It brightens when a social prompt arrives.
 */
import {
  AdditiveBlending,
  CircleGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import { AXIS_QUAT, DIR, SOURCE } from './layout';
import { titanium } from './materials';
import { glowTexture } from './textures';
import type { FrameContext, Instrument } from './types';

export class Source implements Instrument {
  readonly id = 'source' as const;
  readonly group = new Group();
  readonly pickables: Object3D[] = [];
  readonly labelAnchor = SOURCE.clone().add(new Vector3(-0.4, 0.75, 0));
  readonly view = {
    position: SOURCE.clone().add(new Vector3(1.8, 0.9, 3.6)),
    target: SOURCE.clone().addScaledVector(DIR, 0.6),
  };
  /** Where an incoming prompt orb enters: the back of the housing. */
  readonly intake = SOURCE.clone().addScaledVector(DIR, -1.25);

  private apertureMat = new MeshBasicMaterial({ color: new Color(0.6, 1.4, 1.8), toneMapped: false });
  private glow: Sprite;

  constructor() {
    this.group.position.copy(SOURCE);
    this.group.quaternion.copy(AXIS_QUAT);

    const ti = titanium(0x2a2e38, 0.3);
    const housing = new Mesh(new CylinderGeometry(0.24, 0.27, 1.1, 40), ti);
    housing.geometry.rotateX(Math.PI / 2);
    housing.position.z = -0.6;
    const finGeo = new CylinderGeometry(0.36, 0.36, 0.03, 40);
    finGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < 5; i++) {
      const fin = new Mesh(finGeo, ti);
      fin.position.z = -1.0 + i * 0.12;
      this.group.add(fin);
      this.pickables.push(fin);
    }
    const aperture = new Mesh(new CircleGeometry(0.11, 32), this.apertureMat);
    aperture.position.z = -0.045;
    this.glow = new Sprite(
      new SpriteMaterial({
        map: glowTexture(),
        color: new Color(0.55, 0.9, 1.0),
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
        opacity: 0.6,
      }),
    );
    this.glow.scale.setScalar(0.9);
    this.group.add(housing, aperture, this.glow);
    this.pickables.push(housing, aperture);
  }

  update(ctx: FrameContext): void {
    const b = 1 + ctx.sourceBoost * 2.2;
    const hum = ctx.reducedMotion ? 1 : 0.94 + 0.06 * Math.sin(ctx.time * 3.1);
    this.apertureMat.color.setRGB(0.6 * b * hum, 1.4 * b * hum, 1.8 * b * hum);
    this.glow.material.opacity = Math.min(1, 0.45 * hum + 0.5 * ctx.sourceBoost);
    this.glow.scale.setScalar(0.9 + 1.4 * ctx.sourceBoost);
  }
}
