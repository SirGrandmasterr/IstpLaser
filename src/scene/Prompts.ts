/**
 * Social prompts. A small white-pink orb drifts in from outside the scene into
 * the beam source, the source brightens, then Fe actuates and traces the heart
 * path according to whatever beam state it receives, frame by frame.
 */
import { AdditiveBlending, Color, Sprite, SpriteMaterial, Vector3, type Scene } from 'three';
import { strokeStyleFor, type StrokeStyle } from '../model/stroke';
import type { BeamState } from '../model/beam';
import type { Bus, Store } from '../state';
import type { PromptKind } from '../strings';
import { axisPoint, sheetToWorld, T_FLOOR, worldToSheet } from './layout';
import { Sheet } from './Sheet';
import type { Source } from './Source';
import { glowTexture } from './textures';

const INCOMING = 2.0;
const CHARGING = 0.6;
const SCALE: Record<PromptKind, number> = { okay: 0.46, hurting: 0.6, thanked: 0.52 };

const ease = (t: number) => t * t * (3 - 2 * t);

export class Prompts {
  private orb: Sprite;
  private halo: Sprite;
  private from = new Vector3();
  private ctrl = new Vector3();
  boost = 0;
  actuation = 0;
  readonly drawPoint = new Vector3();
  /** The style the nib is writing with right now (for captions and audio). */
  style: StrokeStyle | null = null;
  /** Output character at the moment Fe started writing. */
  drawnMode: BeamState['output'] | null = null;
  private pending: PromptKind | null = null;

  constructor(
    scene: Scene,
    private source: Source,
    private sheet: Sheet,
    private store: Store,
    private bus: Bus,
  ) {
    const tex = glowTexture();
    this.orb = new Sprite(
      new SpriteMaterial({ map: tex, color: new Color(1.6, 1.25, 1.45), blending: AdditiveBlending, transparent: true, depthWrite: false }),
    );
    this.halo = new Sprite(
      new SpriteMaterial({ map: tex, color: new Color(1, 0.45, 0.7), blending: AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.4 }),
    );
    this.orb.scale.setScalar(0.32);
    this.halo.scale.setScalar(1.1);
    this.orb.visible = this.halo.visible = false;
    scene.add(this.orb, this.halo);
  }

  get busy(): boolean {
    return this.store.prompt.phase !== 'none';
  }

  trigger(kind: PromptKind): void {
    const pr = this.store.prompt;
    pr.last = kind;
    if (pr.phase !== 'none') {
      // One at a time; queue the latest request.
      this.pending = kind;
      return;
    }
    pr.phase = 'incoming';
    pr.kind = kind;
    pr.t = 0;
    pr.progress = 0;
    // From well outside the frame, upper left and toward the viewer.
    this.from.copy(this.source.intake).add(new Vector3(-5.5 - Math.random() * 2, 3.2 + Math.random() * 1.5, 3 + Math.random() * 3));
    this.ctrl.copy(this.from).lerp(this.source.intake, 0.5).add(new Vector3(0.5, 1.6, -1.5));
    this.orb.visible = this.halo.visible = true;
    this.bus.emit('promptStart', kind);
  }

  cancel(): void {
    const pr = this.store.prompt;
    if (pr.phase === 'drawing') this.sheet.end();
    pr.phase = 'none';
    pr.kind = null;
    this.pending = null;
    this.orb.visible = this.halo.visible = false;
    this.style = null;
    this.drawnMode = null;
  }

  update(dt: number, beam: BeamState): void {
    const pr = this.store.prompt;
    pr.t += dt;

    if (pr.phase === 'incoming') {
      const k = ease(Math.min(1, pr.t / INCOMING));
      const u = 1 - k;
      // Quadratic Bézier drift into the back of the source.
      this.orb.position
        .copy(this.from)
        .multiplyScalar(u * u)
        .addScaledVector(this.ctrl, 2 * u * k)
        .addScaledVector(this.source.intake, k * k);
      this.halo.position.copy(this.orb.position);
      const fadeIn = Math.min(1, pr.t * 2);
      this.orb.material.opacity = fadeIn;
      this.halo.material.opacity = 0.4 * fadeIn;
      if (pr.t >= INCOMING) {
        pr.phase = 'charging';
        pr.t = 0;
        this.bus.emit('promptArrive', pr.kind!);
      }
    } else if (pr.phase === 'charging') {
      const k = Math.min(1, pr.t / CHARGING);
      this.orb.scale.setScalar(0.32 * (1 - k));
      this.halo.scale.setScalar(1.1 * (1 - k * 0.7));
      this.halo.material.opacity = 0.4 * (1 - k);
      this.boost = Math.max(this.boost, ease(k));
      if (pr.t >= CHARGING) {
        this.orb.visible = this.halo.visible = false;
        this.orb.scale.setScalar(0.32);
        this.halo.scale.setScalar(1.1);
        this.beginDrawing(beam);
      }
    } else if (pr.phase === 'drawing') {
      const style = strokeStyleFor(beam);
      this.style = style;
      pr.progress = Math.min(1, pr.progress + dt / style.duration);
      this.actuation = Math.min(1, this.actuation + dt * 6);
      this.sheet.drawTo(pr.progress, style, dt, this.drawPoint);
      this.boost = Math.max(0.35, this.boost - dt * 0.4);
      if (pr.progress >= 1) {
        this.sheet.end();
        const kind = pr.kind!;
        pr.phase = 'none';
        pr.kind = null;
        this.style = null;
        this.bus.emit('drawEnd', kind);
        if (this.pending) {
          const next = this.pending;
          this.pending = null;
          this.trigger(next);
        }
      }
    }

    if (pr.phase !== 'drawing') this.actuation = Math.max(0, this.actuation - dt * 3);
    if (pr.phase === 'none' || pr.phase === 'incoming') this.boost = Math.max(0, this.boost - dt * 0.8);
  }

  private beginDrawing(beam: BeamState): void {
    const pr = this.store.prompt;
    pr.phase = 'drawing';
    pr.t = 0;
    pr.progress = 0;
    const kind = pr.kind!;
    // Without a compiled direction the mark lands where the axis happens to fall,
    // not where Ni was aiming: direction literally decides where the feeling lands.
    const axis = worldToSheet(axisPoint(T_FLOOR));
    const aim = this.store.controls.reticle;
    const f = beam.F;
    const c = Sheet.clampReticle(axis.x + (aim.x - axis.x) * f, axis.y + (aim.y - axis.y) * f);
    const a = Math.random() * Math.PI * 2;
    this.sheet.begin({ cx: c.x, cy: c.y, scale: SCALE[kind], seed: Math.random() * 100, ox: Math.cos(a), oy: Math.sin(a) });
    this.drawnMode = beam.output;
    sheetToWorld(c.x, c.y, this.drawPoint);
    this.bus.emit('drawStart', kind);
  }
}
