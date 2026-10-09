/**
 * Diegetic interaction in the scene:
 *  - drag the knurled Ti ring (arrow keys while hovering it)
 *  - drag Ni's target reticle on the paper and hold it still to compile
 *  - any pointer movement or scrolling over the scene throws particles at Se
 *  - click an instrument to focus it
 */
import { Plane, Raycaster, Vector2, Vector3, type Object3D } from 'three';
import type { CameraRig } from './scene/CameraRig';
import { DIR, SE_POS, SHEET_CENTER, TI_POS, worldToSheet } from './scene/layout';
import type { Particles } from './scene/Particles';
import { Sheet } from './scene/Sheet';
import { TI_RANGE } from './scene/Ti';
import type { Ti } from './scene/Ti';
import type { Store } from './state';
import type { InstrumentId } from './strings';

/** Pixels of pointer travel per spawned particle. */
const PX_PER_PARTICLE = 34;
const MAX_POINTER_RATE = 36;

export interface InteractionHooks {
  focus(id: InstrumentId): void;
  activity(): void;
  /** The story locks the diegetic controls and pointer input to Se until Act III (the camera still orbits). */
  locked(): boolean;
}

export class Interaction {
  private ray = new Raycaster();
  private ndc = new Vector2();
  private tiPlane = new Plane().setFromNormalAndCoplanarPoint(DIR, TI_POS);
  private floorPlane = new Plane(new Vector3(0, 1, 0), -SHEET_CENTER.y);
  private sePlane = new Plane();
  private hit = new Vector3();
  private local = new Vector3();

  private down: { x: number; y: number; id: InstrumentId | null; t: number } | null = null;
  private ringDrag: { lastAngle: number; raw: number } | null = null;
  private reticleDrag = false;
  /** Released and left alone: a resting reticle is "held still" and keeps compiling. */
  private reticleDwell = false;
  private reticleMoved = 0;
  private reticleSpeed = 0;
  private stillFor = 0;
  private hoverTi = false;
  private lastPointer: { x: number; y: number } | null = null;
  private travel = 0;
  private spawnBudget = 0;
  private pendingPointer: { x: number; y: number } | null = null;
  private pickMap = new Map<Object3D, InstrumentId>();
  private pickList: Object3D[] = [];

  constructor(
    private dom: HTMLElement,
    private rig: CameraRig,
    private store: Store,
    private ti: Ti,
    private sheet: Sheet,
    private particles: Particles,
    instruments: { id: InstrumentId; pickables: Object3D[] }[],
    private hooks: InteractionHooks,
  ) {
    for (const ins of instruments) {
      for (const o of ins.pickables) {
        this.pickMap.set(o, ins.id);
        this.pickList.push(o);
      }
    }
    this.pickMap.set(sheet.mesh, 'sheet');
    this.pickList.push(sheet.mesh);

    // Capture phase so we can claim a drag before OrbitControls sees the event.
    dom.addEventListener('pointerdown', this.onDown, { capture: true });
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    dom.addEventListener('wheel', this.onWheel, { passive: true });
    rig.controls.addEventListener('start', () => {
      hooks.activity();
      rig.cancel();
    });
  }

  get draggingRing(): boolean {
    return this.ringDrag !== null;
  }

  get hoveringTi(): boolean {
    return this.hoverTi;
  }

  private setNdc(e: PointerEvent | WheelEvent): void {
    const r = this.dom.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.rig.camera);
  }

  private ringAngleAt(): number | null {
    if (!this.ray.ray.intersectPlane(this.tiPlane, this.hit)) return null;
    this.local.copy(this.hit);
    this.ti.group.worldToLocal(this.local);
    return Math.atan2(this.local.y, this.local.x);
  }

  private pick(): { id: InstrumentId | null; ring: boolean; sheet: boolean } {
    const hits = this.ray.intersectObjects(this.pickList, false);
    if (!hits.length) return { id: null, ring: false, sheet: false };
    const o = hits[0].object;
    return { id: this.pickMap.get(o) ?? null, ring: o === this.ti.ring, sheet: o === this.sheet.mesh };
  }

  private onDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    this.hooks.activity();
    this.setNdc(e);
    const p = this.pick();
    this.down = { x: e.clientX, y: e.clientY, id: p.id, t: performance.now() };
    if (this.hooks.locked()) return;
    if (p.ring) {
      const a = this.ringAngleAt();
      if (a === null) return;
      const c = this.store.controls;
      c.alignmentTarget = null;
      this.ringDrag = { lastAngle: a, raw: c.tiSide * (1 - c.alignment) * TI_RANGE };
      this.claim(e, 'grabbing');
    } else if (p.sheet) {
      this.reticleDrag = true;
      this.reticleDwell = false;
      this.stillFor = 0;
      this.moveReticle();
      this.claim(e, 'grabbing');
    }
  };

  private claim(e: PointerEvent, cursor: string): void {
    this.rig.controls.enabled = false;
    this.rig.cancel();
    this.dom.style.cursor = cursor;
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  private moveReticle(): void {
    if (!this.ray.ray.intersectPlane(this.floorPlane, this.hit)) return;
    const s = worldToSheet(this.hit);
    const c = Sheet.clampReticle(s.x, s.y);
    const r = this.store.controls.reticle;
    this.reticleMoved += Math.hypot(c.x - r.x, c.y - r.y);
    r.x = c.x;
    r.y = c.y;
  }

  private onMove = (e: PointerEvent): void => {
    const overCanvas = e.target === this.dom;
    if (overCanvas || this.ringDrag || this.reticleDrag) {
      this.hooks.activity();
      // Pointer travel through the scene becomes sensory input for Se.
      if (this.lastPointer) this.travel += Math.hypot(e.clientX - this.lastPointer.x, e.clientY - this.lastPointer.y);
      this.lastPointer = { x: e.clientX, y: e.clientY };
      this.pendingPointer = { x: e.clientX, y: e.clientY };
    } else {
      this.lastPointer = null;
    }
    if (!overCanvas && !this.ringDrag && !this.reticleDrag) return;
    this.setNdc(e);

    if (this.ringDrag) {
      const a = this.ringAngleAt();
      if (a !== null) {
        let d = a - this.ringDrag.lastAngle;
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        this.ringDrag.lastAngle = a;
        this.ringDrag.raw = Math.max(-TI_RANGE, Math.min(TI_RANGE, this.ringDrag.raw + d));
        this.applyRing(this.ringDrag.raw);
      }
      return;
    }
    if (this.reticleDrag) {
      this.moveReticle();
      return;
    }
    // Hover feedback.
    const p = this.pick();
    this.hoverTi = p.id === 'ti';
    this.dom.style.cursor = this.hooks.locked() ? (p.id ? 'pointer' : '') : p.ring ? 'grab' : p.sheet ? 'crosshair' : p.id ? 'pointer' : '';
  };

  private applyRing(raw: number): void {
    const c = this.store.controls;
    c.alignment = Math.max(0, 1 - Math.abs(raw) / TI_RANGE);
    if (Math.abs(raw) > 1e-4) c.tiSide = Math.sign(raw);
  }

  /** The compile toggle or a reset takes over from a resting reticle. */
  cancelDwell(): void {
    this.reticleDwell = false;
    if (!this.reticleDrag) this.store.controls.reticleDrive = null;
  }

  /** Arrow keys while hovering Ti turn the ring by 5°. */
  nudgeRing(dir: number): void {
    const c = this.store.controls;
    c.alignmentTarget = null;
    const raw = c.tiSide * (1 - c.alignment) * TI_RANGE + dir * (Math.PI / 36);
    this.applyRing(Math.max(-TI_RANGE, Math.min(TI_RANGE, raw)));
  }

  private onUp = (e: PointerEvent): void => {
    const d = this.down;
    this.down = null;
    const wasDragging = this.ringDrag || this.reticleDrag;
    if (this.reticleDrag) {
      // Let go and leave it: a resting target counts as held still, so the
      // direction goes on compiling (moving it again scatters it).
      this.reticleDwell = true;
    }
    this.ringDrag = null;
    this.reticleDrag = false;
    this.rig.controls.enabled = true;
    if (wasDragging) this.dom.style.cursor = '';
    if (!d) return;
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    const quick = performance.now() - d.t < 400;
    // A click (not a drag) on an instrument focuses it; the sheet is for aiming.
    if (moved < 6 && quick && d.id && d.id !== 'sheet') this.hooks.focus(d.id);
  };

  private onWheel = (): void => {
    this.hooks.activity();
    if (this.hooks.locked()) return;
    for (let i = 0; i < 3; i++) this.particles.spawnAmbient();
  };

  /** Per-frame: spawn particles from pointer travel; derive Ni drive from the reticle. */
  update(dt: number): void {
    this.spawnBudget = Math.min(MAX_POINTER_RATE * 0.25, this.spawnBudget + MAX_POINTER_RATE * dt);
    // While the story drives, moving the pointer around isn't input for Se.
    if (this.hooks.locked()) this.travel = 0;
    if (this.pendingPointer && this.travel >= PX_PER_PARTICLE) {
      const r = this.dom.getBoundingClientRect();
      this.ndc.set(((this.pendingPointer.x - r.left) / r.width) * 2 - 1, -((this.pendingPointer.y - r.top) / r.height) * 2 + 1);
      this.ray.setFromCamera(this.ndc, this.rig.camera);
      const camDir = this.rig.camera.getWorldDirection(this.local);
      this.sePlane.setFromNormalAndCoplanarPoint(camDir, SE_POS);
      while (this.travel >= PX_PER_PARTICLE && this.spawnBudget >= 1) {
        this.travel -= PX_PER_PARTICLE;
        this.spawnBudget -= 1;
        if (this.ray.ray.intersectPlane(this.sePlane, this.hit)) {
          const from = this.hit.clone().add(new Vector3((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4));
          // Too close to the ring and they'd have no flight: push them outward.
          const off = from.clone().sub(SE_POS);
          if (off.length() < 2) from.copy(SE_POS).addScaledVector(off.normalize(), 2);
          from.y = Math.max(0.3, from.y);
          this.particles.spawnFrom(from);
        }
      }
      this.travel = Math.min(this.travel, PX_PER_PARTICLE * 3);
    }

    const c = this.store.controls;
    if (this.reticleDrag) {
      // Smoothed speed (≈0.12 s window) so sparse pointer events still read as "moving".
      const inst = this.reticleMoved / Math.max(dt, 1e-3);
      this.reticleMoved = 0;
      this.reticleSpeed += (inst - this.reticleSpeed) * Math.min(1, dt / 0.12);
      const moving = this.reticleSpeed > 0.3;
      if (moving) this.stillFor = 0;
      else this.stillFor += dt;
      c.reticleDrive = moving ? -1 : this.stillFor > 0.12 ? 1 : 0;
    } else if (this.reticleDwell) {
      this.reticleMoved = 0;
      this.reticleSpeed = 0;
      // Once compiled, the app switches the toggle on, which ends the dwell.
      c.reticleDrive = 1;
    } else {
      this.reticleMoved = 0;
      this.reticleSpeed = 0;
    }
  }
}
