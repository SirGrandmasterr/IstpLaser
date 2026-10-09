/**
 * Orbit camera with limits (never below the floor), smooth focus moves to an
 * instrument or a story framing, and a gentle idle drift when nobody is touching it.
 */
import { MathUtils, PerspectiveCamera, Spherical, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CONSTRUCT_CENTER } from './layout';

export interface View {
  position: Vector3;
  target: Vector3;
}

export const HOME: View = {
  position: new Vector3(7.2, 8.6, 15.5),
  target: CONSTRUCT_CENTER.clone(),
};

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class CameraRig {
  readonly camera: PerspectiveCamera;
  readonly controls: OrbitControls;
  private tween: { from: View; to: View; t: number; dur: number } | null = null;
  private driftPhase = 0;
  private sph = new Spherical();
  private tmp = new Vector3();

  constructor(dom: HTMLElement) {
    this.camera = new PerspectiveCamera(38, 1, 0.1, 200);
    this.camera.position.copy(HOME.position);
    this.controls = new OrbitControls(this.camera, dom);
    this.controls.target.copy(HOME.target);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 2.2;
    this.controls.maxDistance = 30;
    this.controls.maxPolarAngle = MathUtils.degToRad(84);
    this.controls.minPolarAngle = MathUtils.degToRad(8);
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = true;
    this.controls.update();
  }

  get busy(): boolean {
    return this.tween !== null;
  }

  flyTo(view: View, dur = 1.4): void {
    this.tween = {
      from: { position: this.camera.position.clone(), target: this.controls.target.clone() },
      to: { position: view.position.clone(), target: view.target.clone() },
      t: 0,
      dur,
    };
  }

  cancel(): void {
    this.tween = null;
  }

  update(dt: number, idle: number, allowDrift: boolean): void {
    if (this.tween) {
      const tw = this.tween;
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      const k = ease(tw.t);
      this.camera.position.lerpVectors(tw.from.position, tw.to.position, k);
      this.controls.target.lerpVectors(tw.from.target, tw.to.target, k);
      if (tw.t >= 1) this.tween = null;
    } else if (allowDrift && idle > 5) {
      // Gentle drift: a slow sway in azimuth around the current target.
      const ramp = Math.min(1, (idle - 5) / 3);
      this.driftPhase += dt;
      const off = this.tmp.copy(this.camera.position).sub(this.controls.target);
      this.sph.setFromVector3(off);
      this.sph.theta += Math.cos(this.driftPhase * 0.12) * 0.012 * dt * ramp;
      off.setFromSpherical(this.sph);
      this.camera.position.copy(this.controls.target).add(off);
    }
    this.controls.update();
    // Keep the camera above the floor even while panning.
    if (this.camera.position.y < 0.3) this.camera.position.y = 0.3;
  }

  /**
   * @param rightInset pixels covered by the side panel; the projection is shifted
   * so the construct centres in the visible part of the screen.
   */
  resize(w: number, h: number, rightInset = 0): void {
    this.camera.aspect = w / h;
    if (rightInset > 0) this.camera.setViewOffset(w, h, rightInset / 2, 0, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }
}
