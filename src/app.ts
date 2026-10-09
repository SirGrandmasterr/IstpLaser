/**
 * Wires everything together: the store, the beam model, the scene objects, the
 * interaction layer, the UI, the story and audio. One frame loop.
 */
import { ACESFilmicToneMapping, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { Audio } from './audio/Audio';
import { Interaction } from './interaction';
import { computeBeamState, INITIAL_BEAM_STATE, TI_LOCK } from './model/beam';
import { strokeStyleFor } from './model/stroke';
import { Beam } from './scene/Beam';
import { CameraRig, HOME, type View } from './scene/CameraRig';
import { buildEnvironment } from './scene/environment';
import { setPointsPixelRatio } from './scene/materials';
import { Fe } from './scene/Fe';
import { sheetToWorld } from './scene/layout';
import { Ni } from './scene/Ni';
import { Particles } from './scene/Particles';
import { Post } from './scene/post';
import { Prompts } from './scene/Prompts';
import { Se } from './scene/Se';
import { Sheet } from './scene/Sheet';
import { Source } from './scene/Source';
import { Ti, TI_RANGE } from './scene/Ti';
import type { FrameContext, Instrument } from './scene/types';
import { Bus, createStore, initialControls, type Mode, type Store } from './state';
import { Story } from './story/Story';
import { S, type InstrumentId, type PromptKind } from './strings';
import { UI } from './ui/UI';

/** Torque per particle hit; the steady feed rate keeps Se near full spin. */
const IMPULSE = 0.035;
const FEED_RATE = 19;
const KEY_FEED_RATE = 16;
/** Unlocking needs a deliberate pull past the lock threshold (hysteresis). */
const UNLOCK_AT = TI_LOCK - 0.06;
/** Story page framing: aim a little toward the viewer so the page sits above the story bar. */
const PAGE_AIM = new Vector3(0, 0.15, 0.55);
const PAGE_OFFSET = new Vector3(0.9, 3.4, 3.9);

/** The operations shared by the panel, the keyboard, the story and the scene. */
export interface Controller {
  setAlignment(v: number): void;
  setLock(on: boolean): void;
  setFeed(on: boolean): void;
  setCompile(on: boolean): void;
  prompt(kind: PromptKind): void;
  repeatPrompt(): void;
  reset(): void;
  setLabels(on: boolean): void;
  setMuted(muted: boolean): void;
  focus(id: InstrumentId | null): void;
  view(view: View, dur?: number): void;
  /** A framing in which the mark being written is the subject, with the nib in frame. */
  pageView(): View;
  startStory(): void;
  endStory(): void;
  setMode(mode: Mode): void;
  nudgeRing(dir: number): void;
  setKeyFeed(on: boolean): void;
  readonly hoveringTi: boolean;
}

export class App implements Controller {
  readonly store: Store;
  readonly bus = new Bus();
  private renderer: WebGLRenderer;
  private labels: CSS2DRenderer;
  private scene = new Scene();
  private rig: CameraRig;
  private post: Post;
  private source = new Source();
  private ti = new Ti();
  private se = new Se();
  private ni = new Ni();
  private fe = new Fe();
  private instruments: Instrument[];
  private beam: Beam;
  private sheet: Sheet;
  private particles: Particles;
  private prompts: Prompts;
  private interaction: Interaction;
  private audio = new Audio();
  private ui: UI;
  private story: Story;

  private time = 0;
  private last = 0;
  private raf = 0;
  private running = false;
  private feedAcc = 0;
  private keyFeed = false;
  private ringShown = TI_RANGE;
  private ringVel = 0;
  private wasLocked = false;
  private aimPoint = new Vector3();
  private pixelRatio: number;
  /** Resolution governor: average frame time over a window, step DPR down if slow. */
  private perf = { acc: 0, frames: 0, cooldown: 3 };

  constructor(private root: HTMLElement) {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.store = createStore(reduced);

    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.domElement.className = 'gl';
    this.renderer.domElement.setAttribute('aria-label', S.a11y.scene);
    this.renderer.domElement.setAttribute('role', 'img');
    root.appendChild(this.renderer.domElement);

    this.labels = new CSS2DRenderer();
    this.labels.domElement.className = 'labels';
    root.appendChild(this.labels.domElement);

    this.rig = new CameraRig(this.renderer.domElement);
    buildEnvironment(this.scene, this.renderer);
    this.instruments = [this.source, this.ti, this.se, this.ni, this.fe];
    for (const ins of this.instruments) this.scene.add(ins.group);
    this.beam = new Beam(this.scene);
    this.sheet = new Sheet(this.scene, this.pixelRatio);
    this.particles = new Particles(this.scene, this.se, this.pixelRatio, reduced);
    this.prompts = new Prompts(this.scene, this.source, this.sheet, this.store, this.bus);
    this.post = new Post(this.renderer, this.scene, this.rig.camera);

    this.interaction = new Interaction(
      this.renderer.domElement,
      this.rig,
      this.store,
      this.ti,
      this.sheet,
      this.particles,
      this.instruments,
      {
        focus: (id) => this.focus(id),
        activity: () => (this.store.idleTime = 0),
        locked: () => this.store.ui.mode === 'story',
      },
    );

    this.ui = new UI(root, this.store, this.bus, this, this.instruments, this.sheet, this.scene);
    this.story = new Story(this.store, this.bus, this, this.ui);

    this.bus.on('tiLock', () => this.audio.click());
    this.bus.on('ui', () => this.updateInsets());
    this.bus.on('promptArrive', () => this.audio.chime());

    window.addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.resize();
  }

  // ── Controller ──────────────────────────────────────────────────────────────

  setAlignment(v: number): void {
    const c = this.store.controls;
    c.alignmentTarget = null;
    c.alignment = Math.max(0, Math.min(1, v));
    if (c.alignment < UNLOCK_AT) c.tiLatched = false;
  }

  setLock(on: boolean): void {
    const c = this.store.controls;
    c.alignmentTarget = on ? 1 : 0;
    if (!on) c.tiLatched = false;
    this.bus.emit('ui');
  }

  setFeed(on: boolean): void {
    this.store.controls.feed = on;
    this.bus.emit('ui');
  }

  setCompile(on: boolean): void {
    this.store.controls.compile = on;
    // The toggle is now the standing intent; a resting reticle stops driving it.
    this.interaction.cancelDwell();
    this.bus.emit('ui');
  }

  prompt(kind: PromptKind): void {
    this.prompts.trigger(kind);
  }

  repeatPrompt(): void {
    this.prompts.trigger(this.store.prompt.last);
  }

  reset(): void {
    this.store.controls = initialControls();
    this.interaction.cancelDwell();
    this.store.torqueAccum = 0;
    this.store.beam = INITIAL_BEAM_STATE;
    this.ringShown = TI_RANGE;
    this.ringVel = 0;
    this.prompts.cancel();
    this.particles.clear();
    this.sheet.clear();
    this.keyFeed = false;
    this.focus(null);
    this.view(HOME);
    this.bus.emit('reset');
    this.bus.emit('ui');
  }

  setLabels(on: boolean): void {
    this.store.ui.labels = on;
    this.bus.emit('ui');
  }

  setMuted(muted: boolean): void {
    this.store.ui.muted = muted;
    this.audio.setMuted(muted);
    this.bus.emit('ui');
  }

  /** Keep the subject centred between the info card (left) and the panel (right). */
  private updateInsets(): void {
    const w = this.root.clientWidth;
    const wide = w >= 1024;
    const card = wide && this.store.ui.focus !== null ? 372 : 0;
    // On tablets the panel is a bottom drawer: lift the scene above it while it is open.
    const drawer = !wide && this.store.ui.panelOpen ? (this.root.querySelector('.panel')?.clientHeight ?? 0) + 60 : 0;
    this.rig.setInsets(card, wide && this.store.ui.panelOpen ? 332 : 0, drawer);
  }

  focus(id: InstrumentId | null): void {
    this.store.ui.focus = id;
    this.updateInsets();
    if (id) {
      const ins = this.instruments.find((i) => i.id === id);
      const view = ins?.view ?? (id === 'sheet' ? this.sheetView() : null);
      if (view) this.view(view);
    }
    this.bus.emit('focus', id);
  }

  private sheetView(): View {
    const t = sheetToWorld(0, 0);
    return { position: t.clone().add(new Vector3(0.8, 4.2, 4.2)), target: t };
  }

  view(view: View, dur = 1.4): void {
    this.rig.flyTo(view, this.store.ui.reducedMotion ? 0.01 : dur);
  }

  pageView(): View {
    const style = this.prompts.style ?? strokeStyleFor(this.store.beam);
    const c = this.sheet.markCenter(style, { x: 0, y: 0 }) ?? this.store.controls.reticle;
    // Lean toward the mark but keep the nib, upper left, in frame.
    const t = sheetToWorld(c.x * 0.75 - 0.25, c.y * 0.75 - 0.15).add(PAGE_AIM);
    return { target: t, position: t.clone().add(PAGE_OFFSET) };
  }

  startStory(): void {
    this.story.start();
  }

  endStory(): void {
    this.story.stop();
  }

  setMode(mode: Mode): void {
    this.store.ui.mode = mode;
    this.bus.emit('mode', mode);
    this.bus.emit('ui');
  }

  nudgeRing(dir: number): void {
    this.interaction.nudgeRing(dir);
  }

  setKeyFeed(on: boolean): void {
    this.keyFeed = on;
  }

  get hoveringTi(): boolean {
    return this.interaction.hoveringTi;
  }

  // ── Loop ────────────────────────────────────────────────────────────────────

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Debug/testing: advance the whole simulation by `seconds` in fixed steps, without rAF. */
  step(seconds: number, dt = 1 / 60): void {
    const n = Math.max(1, Math.round(seconds / dt));
    for (let i = 0; i < n; i++) this.update(dt, i === n - 1);
  }

  private onVisibility = (): void => {
    if (document.hidden) this.stop();
    else this.start();
  };

  private resize = (fromWindow: boolean | UIEvent = true): void => {
    if (fromWindow !== false) {
      this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      this.renderer.setPixelRatio(this.pixelRatio);
      this.perf.cooldown = 3;
    }
    setPointsPixelRatio(this.pixelRatio);
    const w = this.root.clientWidth;
    const h = this.root.clientHeight;
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
    this.post.setSize(w, h, this.pixelRatio);
    this.rig.resize(w, h);
    this.updateInsets();
  };

  private frame = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    const raw = Math.max(0, (now - this.last) / 1000);
    const dt = Math.min(0.05, raw);
    this.last = now;
    this.govern(raw);
    this.update(dt);
  };

  /**
   * Hold ~60 fps on modest GPUs: if the average frame over a 2 s window is slower
   * than ~45 fps, render at a lower pixel ratio (never below 0.75). It only steps
   * down; a resize re-evaluates from the cap.
   */
  private govern(raw: number): void {
    const p = this.perf;
    if (raw > 0.25) return; // tab switch or stall, not a rendering cost
    p.cooldown -= raw;
    if (p.cooldown > 0) return;
    p.acc += raw;
    p.frames++;
    if (p.acc < 2) return;
    const avg = p.acc / p.frames;
    p.acc = 0;
    p.frames = 0;
    if (avg > 1 / 45 && this.pixelRatio > 0.75) {
      this.pixelRatio = Math.max(0.75, this.pixelRatio - 0.25);
      this.renderer.setPixelRatio(this.pixelRatio);
      this.resize(false);
      p.cooldown = 1.5;
    }
  }

  private update(dt: number, render = true): void {
    this.time += dt;
    const store = this.store;
    const c = store.controls;
    store.idleTime += dt;

    // Ti: animated target (lock toggle / story), then latch with hysteresis.
    if (c.alignmentTarget !== null && !this.interaction.draggingRing) {
      const d = c.alignmentTarget - c.alignment;
      const step = dt * 1.1;
      c.alignment = Math.abs(d) <= step ? c.alignmentTarget : c.alignment + Math.sign(d) * step;
      if (c.alignment === c.alignmentTarget) c.alignmentTarget = null;
    }
    if (!c.tiLatched && c.alignment >= TI_LOCK) c.tiLatched = true;
    if (c.tiLatched && c.alignment < UNLOCK_AT) c.tiLatched = false;

    // Se: real-time input → particles → torque.
    this.interaction.update(dt);
    const rate = (c.feed ? FEED_RATE : 0) + (this.keyFeed ? KEY_FEED_RATE : 0);
    this.feedAcc += rate * dt * (store.ui.reducedMotion ? 0.5 : 1);
    while (this.feedAcc >= 1) {
      this.feedAcc -= 1;
      this.particles.spawnAmbient();
    }
    const hits = this.particles.update(dt);
    store.torqueAccum += hits * IMPULSE * (store.ui.reducedMotion ? 2 : 1);

    // Ni drive: reticle interaction wins; otherwise the compile toggle is the standing intent.
    const drive = c.reticleDrive ?? (c.compile ? 1 : -1);

    store.beam = computeBeamState(
      { alignment: c.tiLatched ? 1 : c.alignment, torqueImpulse: store.torqueAccum, directionDrive: drive },
      dt,
      store.beam,
    );
    store.torqueAccum = 0;
    const beam = store.beam;

    if (c.reticleDrive !== null) {
      if (beam.intent >= 0.999 && !c.compile) this.setCompile(true);
      if (beam.intent <= 0.001 && c.compile) this.setCompile(false);
    }
    if (beam.tiLocked !== this.wasLocked) {
      this.bus.emit(beam.tiLocked ? 'tiLock' : 'tiUnlock');
      this.bus.emit('ui');
      this.wasLocked = beam.tiLocked;
    }

    // Ring display: follows the hand, but snaps to the sweet spot with a spring when locked.
    const ringTarget = c.tiLatched ? 0 : c.tiSide * (1 - c.alignment) * TI_RANGE;
    if (c.tiLatched || c.alignmentTarget !== null) {
      this.ringVel += (320 * (ringTarget - this.ringShown) - 16 * this.ringVel) * dt;
      this.ringShown += this.ringVel * dt;
    } else {
      this.ringShown = ringTarget;
      this.ringVel = 0;
    }

    this.prompts.update(dt, beam);
    sheetToWorld(c.reticle.x, c.reticle.y, this.aimPoint);

    const ctx: FrameContext = {
      time: this.time,
      dt,
      beam,
      reducedMotion: store.ui.reducedMotion,
      tiRingAngle: this.ringShown,
      niExtension: this.ni.extension,
      actuation: this.prompts.actuation,
      sourceBoost: this.prompts.boost,
      drawPoint: this.prompts.drawPoint,
      aimPoint: this.aimPoint,
      drawing: store.prompt.phase === 'drawing',
      nibContact: this.prompts.style?.score ?? 0,
    };
    for (const ins of this.instruments) ins.update(ctx);
    this.beam.update(ctx, this.ti, this.ni, this.fe);
    this.sheet.setReticle(c.reticle.x, c.reticle.y, beam.intent, beam.D, this.time, store.ui.reducedMotion);
    this.sheet.update(dt);

    const st = this.prompts.style;
    this.audio.update(beam.T, ctx.drawing ? this.prompts.actuation * (0.3 + 0.7 * (st?.alpha ?? 0)) : 0, st ? 1 - st.inkTone * st.ink : 1);

    this.story.update(dt);
    this.ui.update(dt);

    const allowDrift = !store.ui.reducedMotion && store.ui.mode !== 'story' && store.ui.focus === null;
    this.rig.update(dt, store.idleTime, allowDrift);

    if (!render) return;
    this.post.render(this.time, store.ui.reducedMotion);
    this.labels.render(this.scene, this.rig.camera);
  }
}
