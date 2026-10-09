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
  position: new Vector3(6.6, 8.4, 18.0),
  target: CONSTRUCT_CENTER.clone(),
};

const BASE_FOV = 38;
/** tan(half horizontal FOV) of the reference framing: 38° vertical over a 1108×900 visible area. */
const REF_HALF_TAN = Math.tan(((BASE_FOV / 2) * Math.PI) / 180) * (1108 / 900);

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class CameraRig {
  readonly camera: PerspectiveCamera;
  readonly controls: OrbitControls;
  private tween: { from: View; to: View; t: number; dur: number } | null = null;
  private driftPhase = 0;
  private sph = new Spherical();
  private tmp = new Vector3();

  constructor(dom: HTMLElement) {
    this.camera = new PerspectiveCamera(BASE_FOV, 1, 0.1, 200);
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

  private size = { w: 1, h: 1 };
  private insets = { left: 0, right: 0, bottom: 0 };

  resize(w: number, h: number): void {
    this.size = { w, h };
    this.applyOffset();
  }

  /**
   * Pixels covered by UI on each side (panel, info card). The projection is
   * shifted so the subject centres in the part of the screen that is visible.
   */
  setInsets(left: number, right: number, bottom = 0): void {
    const i = this.insets;
    if (i.left === left && i.right === right && i.bottom === bottom) return;
    this.insets = { left, right, bottom };
    this.applyOffset();
  }

  private applyOffset(): void {
    const { w, h } = this.size;
    const shift = (this.insets.right - this.insets.left) / 2;
    const shiftY = this.insets.bottom / 2;
    this.camera.aspect = w / h;
    // Keep the horizontal field of view over the *visible* area roughly constant,
    // so narrower screens widen the view instead of cropping the construct.
    // …and never let the visible strip (above a bottom drawer) drop below the base vertical FOV.
    const visH = Math.max(200, h - this.insets.bottom);
    const visibleAspect = Math.max(0.5, (w - this.insets.left - this.insets.right) / visH);
    const k = h / visH;
    const byWidth = 2 * Math.atan((REF_HALF_TAN / visibleAspect) * k);
    const byHeight = 2 * Math.atan(Math.tan(((BASE_FOV / 2) * Math.PI) / 180) * k);
    const fov = (Math.max(byWidth, byHeight) * 180) / Math.PI;
    this.camera.fov = Math.min(70, Math.max(BASE_FOV, fov));
    if (shift !== 0 || shiftY !== 0) this.camera.setViewOffset(w, h, shift, shiftY, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }
}
