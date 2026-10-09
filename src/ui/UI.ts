/**
 * Vanilla DOM UI: intro, HUD gauges, control panel, state caption, engraved
 * plates with leader lines to each instrument, info cards, the story bar, and
 * the keyboard map. Reads the store every frame; writes only through the Controller.
 */
import { Vector2, Vector3, type PerspectiveCamera } from 'three';
import type { Controller } from '../app';
import type { OutputMode } from '../model/beam';
import { HOME } from '../scene/CameraRig';
import { SHEET_H, SHEET_W, sheetToWorld } from '../scene/layout';
import type { Instrument } from '../scene/types';
import type { Bus, Store } from '../state';
import { S, type InstrumentId, type PromptKind } from '../strings';

const pct = (v: number) => Math.round(v * 100);
const SVG = 'http://www.w3.org/2000/svg';
/** Gap between the instrument's rim and its plate, in px. */
const LEADER = 26;
/** A mode has to hold this long before it is announced to screen readers. */
const ANNOUNCE_AFTER = 0.8;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

interface Gauge {
  row: HTMLElement;
  fill: HTMLElement;
  value: HTMLElement;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

interface Label {
  id: InstrumentId;
  root: HTMLButtonElement;
  state: HTMLElement;
  line: SVGLineElement;
  dot: SVGCircleElement;
  /** World points: the instrument, and the point on its rim the leader starts from. */
  centre: Vector3;
  edge: Vector3;
  /** Compact plate size (role hidden), refreshed when the text changes. */
  w: number;
  h: number;
  /** This frame's layout. */
  rect: Rect;
  ex: number;
  ey: number;
  dx: number;
  dy: number;
  ax: number;
  ay: number;
  onScreen: boolean;
}

export class UI {
  private hudGauges: Record<'C' | 'E' | 'F', Gauge>;
  private hud: HTMLElement;
  private auth: HTMLElement;
  private authRow: HTMLElement;
  private authFill: HTMLElement;
  private loopBadge: HTMLElement;
  private caption: HTMLElement;
  private announcer: HTMLElement;
  private panel: HTMLElement;
  private slider: HTMLInputElement;
  private lockBtn: HTMLButtonElement;
  private feedBtn: HTMLButtonElement;
  private compileBtn: HTMLButtonElement;
  private labelsBtn: HTMLButtonElement;
  private muteBtn: HTMLButtonElement;
  private storyBtn: HTMLButtonElement;
  private seMeter: HTMLElement;
  private niMeter: HTMLElement;
  private card: HTMLElement;
  private cardTitle: HTMLElement;
  private cardBody: HTMLElement;
  private cardState: HTMLElement;
  private intro: HTMLElement;
  private storyBar: HTMLElement;
  private storyText: HTMLElement;
  private storyDots: HTMLElement[] = [];
  private panelToggle: HTMLButtonElement;
  private labelLayer: HTMLElement;
  private leaders: SVGSVGElement;
  private labels: Label[] = [];
  private occluders: Rect[] = [];
  private textClock = 0;
  private lastCaption = '';
  private announced: OutputMode | null = null;
  private candidate: OutputMode | null = null;
  private stableFor = 0;
  private heldFeedKeys = new Set<string>();
  private lastFocus: HTMLElement | null = null;
  private ndc = new Vector3();
  private dir = new Vector2();

  constructor(
    private root: HTMLElement,
    private store: Store,
    bus: Bus,
    private ctl: Controller,
    instruments: Instrument[],
    private camera: PerspectiveCamera,
  ) {
    // ── Brand ──
    const brand = el('header', 'brand');
    brand.append(el('h1', '', S.title), el('p', '', S.subtitle));
    root.append(brand);

    // ── Plates and their leader lines (under the rest of the UI) ──
    this.labelLayer = el('div', 'labels');
    this.leaders = document.createElementNS(SVG, 'svg');
    this.leaders.classList.add('leaders');
    this.leaders.setAttribute('aria-hidden', 'true');
    this.labelLayer.append(this.leaders);
    root.append(this.labelLayer);

    // ── HUD ──
    this.hud = el('section', 'hud');
    this.hud.setAttribute('aria-label', S.a11y.hud);
    const mk = (label: string, cls: string): Gauge => {
      const row = el('div', `gauge ${cls}`);
      row.setAttribute('role', 'meter');
      row.setAttribute('aria-label', label);
      row.setAttribute('aria-valuemin', '0');
      row.setAttribute('aria-valuemax', '100');
      row.setAttribute('aria-valuenow', '0');
      const name = el('span', 'gauge-name', label);
      name.setAttribute('aria-hidden', 'true');
      const track = el('span', 'gauge-track');
      const fill = el('span', 'gauge-fill');
      track.append(fill);
      const value = el('span', 'gauge-value', '0');
      value.setAttribute('aria-hidden', 'true');
      row.append(name, track, value);
      this.hud.append(row);
      return { row, fill, value };
    };
    this.hudGauges = {
      C: mk(S.hud.coherence, 'g-ti'),
      E: mk(S.hud.energy, 'g-se'),
      F: mk(S.hud.focus, 'g-ni'),
    };
    this.authRow = el('div', 'auth');
    this.authRow.setAttribute('role', 'meter');
    this.authRow.setAttribute('aria-label', S.hud.authenticity);
    this.authRow.setAttribute('aria-valuemin', '0');
    this.authRow.setAttribute('aria-valuemax', '100');
    this.authRow.setAttribute('aria-valuenow', '0');
    const authName = el('span', 'auth-name', S.hud.authenticity);
    authName.setAttribute('aria-hidden', 'true');
    this.auth = el('span', 'auth-value', '0');
    this.auth.setAttribute('aria-hidden', 'true');
    const authTrack = el('span', 'auth-track');
    this.authFill = el('span', 'auth-fill');
    authTrack.append(this.authFill);
    this.authRow.append(authName, this.auth, authTrack);
    this.loopBadge = el('span', 'loop-badge', S.hud.loop);
    this.loopBadge.title = S.a11y.loop;
    this.hud.append(this.authRow, this.loopBadge);
    root.append(this.hud);

    // ── Caption (visual) and a quieter live region for screen readers ──
    this.caption = el('p', 'caption');
    root.append(this.caption);
    this.announcer = el('p', 'sr-only');
    this.announcer.setAttribute('aria-live', 'polite');
    root.append(this.announcer);

    // ── Story bar ──
    this.storyBar = el('div', 'story-bar');
    this.storyBar.setAttribute('aria-live', 'polite');
    const dots = el('div', 'story-dots');
    dots.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < S.story.scenes.length; i++) {
      const d = el('span', 'dot');
      this.storyDots.push(d);
      dots.append(d);
    }
    this.storyText = el('p', 'story-text');
    const skip = el('button', 'btn ghost', S.story.skip);
    skip.type = 'button';
    skip.setAttribute('aria-label', S.a11y.skip);
    skip.addEventListener('click', () => ctl.endStory());
    const storyHead = el('div', 'story-head');
    storyHead.append(el('span', 'story-label', S.story.label), dots, skip);
    this.storyBar.append(storyHead, this.storyText);
    root.append(this.storyBar);

    // ── Panel ──
    this.panel = el('aside', 'panel');
    this.panel.id = 'panel';
    this.panel.setAttribute('aria-label', S.a11y.panel);
    this.panelToggle = el('button', 'panel-toggle btn', S.panel.expand);
    this.panelToggle.type = 'button';
    this.panelToggle.setAttribute('aria-controls', 'panel');
    this.panelToggle.addEventListener('click', () => {
      store.ui.panelOpen = !store.ui.panelOpen;
      this.syncPanelOpen();
      bus.emit('ui');
    });
    root.append(this.panelToggle);

    const sec = (title: string, cls = '') => {
      const s = el('section', `panel-sec ${cls}`);
      s.append(el('h2', '', title));
      this.panel.append(s);
      return s;
    };
    const kbd = (k: string) => {
      const e = el('kbd', '', k);
      e.setAttribute('aria-hidden', 'true');
      return e;
    };
    // Explicit names: the LED/label/key markup inside would otherwise be read (or dropped) piecemeal.
    const named = (b: HTMLButtonElement, label: string, key: string) => {
      b.type = 'button';
      b.setAttribute('aria-label', label);
      b.setAttribute('aria-keyshortcuts', key);
    };
    const toggle = (label: string, key: string, on: () => void, name = label) => {
      const b = el('button', 'btn toggle');
      named(b, name, key);
      b.setAttribute('aria-pressed', 'false');
      const led = el('span', 'led');
      led.setAttribute('aria-hidden', 'true');
      b.append(led, el('span', '', label), kbd(key));
      b.addEventListener('click', on);
      return b;
    };

    const conditions = sec(S.panel.heading);
    // Ti
    const ti = el('div', 'ctl c-ti');
    const tiHead = el('div', 'ctl-head');
    tiHead.append(el('span', 'sym', 'Ti'), el('span', 'ctl-name', S.panel.ti));
    this.slider = el('input', 'slider');
    this.slider.type = 'range';
    this.slider.min = '0';
    this.slider.max = '100';
    this.slider.value = '0';
    this.slider.setAttribute('aria-label', S.panel.ti);
    this.slider.addEventListener('input', () => ctl.setAlignment(Number(this.slider.value) / 100));
    this.lockBtn = toggle(S.panel.tiLock, '1', () => ctl.setLock(!this.isLocked()), S.a11y.lock);
    const tiRow = el('div', 'ctl-row');
    tiRow.append(this.slider, this.lockBtn);
    ti.append(tiHead, tiRow, el('p', 'hint', S.panel.tiHint));
    // Se
    const se = el('div', 'ctl c-se');
    const seHead = el('div', 'ctl-head');
    seHead.append(el('span', 'sym', 'Se'), el('span', 'ctl-name', S.panel.se));
    this.feedBtn = toggle(S.panel.seFeed, '2', () => ctl.setFeed(!store.controls.feed), S.a11y.feed);
    const seTrack = el('span', 'mini-track');
    seTrack.setAttribute('aria-hidden', 'true');
    this.seMeter = el('span', 'mini-fill');
    seTrack.append(this.seMeter);
    const seRow = el('div', 'ctl-row');
    seRow.append(seTrack, this.feedBtn);
    se.append(seHead, seRow, el('p', 'hint', S.panel.seHint));
    // Ni
    const ni = el('div', 'ctl c-ni');
    const niHead = el('div', 'ctl-head');
    niHead.append(el('span', 'sym', 'Ni'), el('span', 'ctl-name', S.panel.ni));
    this.compileBtn = toggle(S.panel.niCompile, '3', () => ctl.setCompile(!store.controls.compile), S.a11y.compile);
    const niTrack = el('span', 'mini-track');
    niTrack.setAttribute('aria-hidden', 'true');
    this.niMeter = el('span', 'mini-fill');
    niTrack.append(this.niMeter);
    const niRow = el('div', 'ctl-row');
    niRow.append(niTrack, this.compileBtn);
    ni.append(niHead, niRow, el('p', 'hint', S.panel.niHint));
    conditions.append(ti, se, ni);

    const prompts = sec(S.panel.prompts, 'prompts');
    for (const kind of Object.keys(S.prompts) as PromptKind[]) {
      const b = el('button', 'btn prompt', S.prompts[kind].button);
      b.type = 'button';
      b.addEventListener('click', () => ctl.prompt(kind));
      prompts.append(b);
    }
    const ph = el('p', 'hint');
    ph.append(kbd('Space'), document.createTextNode(' ' + S.panel.promptHint.replace(/^Space /, '')));
    prompts.append(ph);

    const view = sec(S.panel.view, 'view');
    const grid = el('div', 'btn-grid');
    const plain = (label: string, key: string, on: () => void) => {
      const b = el('button', 'btn');
      named(b, label, key);
      b.append(el('span', '', label), kbd(key));
      b.addEventListener('click', on);
      grid.append(b);
      return b;
    };
    this.storyBtn = plain(S.panel.story, 'S', () => (store.ui.mode === 'story' ? ctl.endStory() : ctl.startStory()));
    plain(S.panel.reset, 'R', () => ctl.reset());
    this.labelsBtn = toggle(S.panel.labels, 'L', () => ctl.setLabels(!store.ui.labels));
    this.muteBtn = toggle(S.panel.mute, 'M', () => ctl.setMuted(!store.ui.muted));
    grid.append(this.labelsBtn, this.muteBtn);
    view.append(grid);

    const keys = el('details', 'keys');
    keys.append(el('summary', '', S.keys.heading));
    const dl = el('dl');
    for (const [k, v] of S.keys.list) dl.append(el('dt', '', k), el('dd', '', v));
    keys.append(dl);
    this.panel.append(keys);
    root.append(this.panel);

    // ── Info card ──
    this.card = el('div', 'card');
    this.card.setAttribute('role', 'dialog');
    this.card.setAttribute('aria-modal', 'false');
    this.card.setAttribute('aria-labelledby', 'card-title');
    this.cardTitle = el('h2', 'card-title');
    this.cardTitle.id = 'card-title';
    this.cardState = el('p', 'card-state');
    this.cardBody = el('div', 'card-body');
    const close = el('button', 'btn ghost card-close', S.close);
    close.type = 'button';
    close.addEventListener('click', () => this.closeCard());
    this.card.append(this.cardTitle, this.cardState, this.cardBody, close);
    root.append(this.card);

    // ── Plates ──
    for (const ins of instruments) this.addLabel(ins.id, ins.group.position.clone(), ins.labelAnchor);
    // The page's plate hangs off its near-left corner, away from the beam.
    this.addLabel('sheet', sheetToWorld(0, 0), sheetToWorld(-SHEET_W / 2 + 0.15, -SHEET_H / 2 + 0.1));

    // ── Intro ──
    this.intro = el('div', 'intro');
    this.intro.setAttribute('role', 'dialog');
    this.intro.setAttribute('aria-modal', 'true');
    this.intro.setAttribute('aria-labelledby', 'intro-title');
    const box = el('div', 'intro-box');
    const h = el('h2', '', S.intro.heading);
    h.id = 'intro-title';
    box.append(h);
    for (const p of S.intro.body) box.append(el('p', '', p));
    box.append(el('p', 'disclaimer', S.intro.disclaimer));
    const actions = el('div', 'intro-actions');
    const go = el('button', 'btn primary');
    named(go, S.intro.story, 'S');
    go.append(el('span', '', S.intro.story), kbd('S'));
    go.addEventListener('click', () => ctl.startStory());
    const free = el('button', 'btn');
    free.type = 'button';
    free.textContent = S.intro.sandbox;
    free.addEventListener('click', () => ctl.setMode('sandbox'));
    actions.append(go, free);
    box.append(actions);
    this.intro.append(box);
    root.append(this.intro);
    requestAnimationFrame(() => go.focus());

    bus.on('ui', () => this.sync());
    bus.on('mode', () => this.sync());
    bus.on('focus', (id) => this.showCard(id));
    bus.on('drawStart', () => {
      // The one moment worth announcing outside a mode change: what the nib is about to write.
      if (this.store.ui.mode !== 'story') this.announce(S.caption.drawing[this.store.beam.output]);
    });
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', () => {
      this.heldFeedKeys.clear();
      ctl.setKeyFeed(false);
    });
    const mq = window.matchMedia('(max-width: 1023px)');
    store.ui.panelOpen = !mq.matches;
    mq.addEventListener('change', () => {
      store.ui.panelOpen = !mq.matches;
      this.syncPanelOpen();
      bus.emit('ui');
    });
    this.syncPanelOpen();
    this.sync();
  }

  private isLocked(): boolean {
    const c = this.store.controls;
    return c.alignmentTarget !== null ? c.alignmentTarget === 1 : c.tiLatched;
  }

  private addLabel(id: InstrumentId, centre: Vector3, edge: Vector3): void {
    const root = el('button', `plate p-${id}`);
    root.type = 'button';
    const L = S.labels[id];
    const state = el('span', 'plate-state');
    root.append(el('span', 'plate-name', L.name), state, el('span', 'plate-role', L.role));
    root.addEventListener('click', () => this.ctl.focus(id));
    root.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.labelLayer.append(root);
    const line = document.createElementNS(SVG, 'line');
    line.classList.add(`l-${id}`);
    const dot = document.createElementNS(SVG, 'circle');
    dot.classList.add(`l-${id}`);
    dot.setAttribute('r', '2.2');
    this.leaders.append(line, dot);
    this.labels.push({
      id,
      root,
      state,
      line,
      dot,
      centre,
      edge,
      w: 0,
      h: 0,
      rect: { x: 0, y: 0, w: 0, h: 0 },
      ex: 0,
      ey: 0,
      dx: 1,
      dy: -1,
      ax: 0,
      ay: 1,
      onScreen: false,
    });
  }

  private syncPanelOpen(): void {
    const open = this.store.ui.panelOpen;
    this.root.classList.toggle('panel-closed', !open);
    this.panelToggle.setAttribute('aria-expanded', String(open));
    this.panelToggle.textContent = open ? S.panel.collapse : S.panel.expand;
  }

  /** Discrete UI state (toggles, mode). Cheap; called on events. */
  sync(): void {
    const { controls: c, ui } = this.store;
    this.lockBtn.setAttribute('aria-pressed', String(this.isLocked()));
    this.feedBtn.setAttribute('aria-pressed', String(c.feed));
    this.compileBtn.setAttribute('aria-pressed', String(c.compile));
    this.labelsBtn.setAttribute('aria-pressed', String(ui.labels));
    this.muteBtn.setAttribute('aria-pressed', String(!ui.muted));
    this.root.classList.toggle('labels-off', !ui.labels);
    this.root.classList.toggle('mode-story', ui.mode === 'story');
    this.root.classList.toggle('mode-intro', ui.mode === 'intro');
    const story = ui.mode === 'story';
    for (const b of [this.slider, this.lockBtn, this.feedBtn, this.compileBtn]) b.disabled = story;
    this.panel.querySelectorAll<HTMLButtonElement>('.prompt').forEach((b) => (b.disabled = story));
    const storyLabel = story ? S.story.skip : S.panel.story;
    this.storyBtn.querySelector('span')!.textContent = storyLabel;
    this.storyBtn.setAttribute('aria-label', story ? S.a11y.skip : S.panel.story);
    this.intro.hidden = ui.mode !== 'intro';
    this.measureOccluders();
  }

  showStory(index: number, text: string): void {
    this.storyText.textContent = text;
    this.storyDots.forEach((d, i) => {
      d.classList.toggle('done', i < index);
      d.classList.toggle('now', i === index);
    });
  }

  private showCard(id: InstrumentId | null): void {
    if (!id) {
      this.card.classList.remove('open');
      this.measureOccluders();
      return;
    }
    if (!this.card.classList.contains('open')) this.lastFocus = document.activeElement as HTMLElement | null;
    const info = S.info[id];
    this.cardTitle.textContent = info.title;
    this.cardBody.replaceChildren(...info.body.map((p) => el('p', '', p)));
    this.card.dataset.id = id;
    this.card.classList.add('open');
    this.updateCardState();
    this.card.querySelector<HTMLButtonElement>('.card-close')?.focus({ preventScroll: true });
    this.measureOccluders();
  }

  private closeCard(): void {
    this.ctl.focus(null);
    if (this.store.ui.mode !== 'story') this.ctl.view(HOME);
    this.lastFocus?.focus?.({ preventScroll: true });
  }

  private conditionText(id: InstrumentId): string {
    const b = this.store.beam;
    const pr = this.store.prompt;
    const C = S.condition;
    switch (id) {
      case 'source':
        return pr.phase === 'charging' || pr.phase === 'drawing' ? C.sourceCharged : C.sourceIdle;
      case 'ti':
        return b.tiLocked ? C.tiAligned : C.tiSearching(pct(b.A));
      case 'se':
        return b.seStarved ? C.seStarved : C.seSpinning(pct(b.T));
      case 'ni':
        if (b.niPrimed) return C.niPrimed;
        if (b.intent > 0.5 && b.niGate < 0.6) return C.niSagging;
        if (b.intent > 0.02) return C.niCompiling(pct(b.intent));
        return C.niFlat;
      case 'fe':
        return pr.phase === 'drawing' ? C.feWriting : C.feIdle;
      case 'sheet':
        return C.sheet(b.output);
    }
  }

  private conditionOk(id: InstrumentId): boolean {
    const b = this.store.beam;
    switch (id) {
      case 'ti':
        return b.tiLocked;
      case 'se':
        return !b.seStarved;
      case 'ni':
        return b.niPrimed;
      case 'fe':
        return this.store.prompt.phase === 'drawing';
      case 'sheet':
        return b.output === 'heart';
      default:
        return true;
    }
  }

  private updateCardState(): void {
    const id = this.card.dataset.id as InstrumentId | undefined;
    if (!id || !this.card.classList.contains('open')) return;
    this.cardState.textContent = this.conditionText(id);
    this.cardState.classList.toggle('ok', this.conditionOk(id));
  }

  private captionText(): string {
    const pr = this.store.prompt;
    const b = this.store.beam;
    if (pr.phase === 'incoming' && pr.kind) return S.caption.incoming(S.prompts[pr.kind].caption);
    if (pr.phase === 'charging') return S.caption.charging;
    if (pr.phase === 'drawing') return S.caption.drawing[b.output];
    return S.caption.idle[b.output];
  }

  private announce(text: string): void {
    // Re-set even when unchanged so a repeated state is still read out.
    this.announcer.textContent = '';
    this.announcer.textContent = text;
  }

  /** Screen readers hear the state only when the output mode changes and holds, not every flicker. */
  private updateAnnouncement(dt: number): void {
    const mode = this.store.beam.output;
    if (mode !== this.candidate) {
      this.candidate = mode;
      this.stableFor = 0;
    }
    this.stableFor += dt;
    if (this.store.ui.mode !== 'sandbox') {
      // The story bar speaks for itself; don't queue a stale mode for later.
      this.announced = mode;
      return;
    }
    if (this.stableFor >= ANNOUNCE_AFTER && mode !== this.announced) {
      this.announced = mode;
      this.announce(S.caption.idle[mode]);
    }
  }

  /** Per frame: gauges are cheap transforms; text updates at ~10 Hz. */
  update(dt: number): void {
    const b = this.store.beam;
    const g = this.hudGauges;
    g.C.fill.style.transform = `scaleX(${b.C})`;
    // Shown as Se's spin (0 at rest): the beam's small residual glow is not fresh energy.
    g.E.fill.style.transform = `scaleX(${b.T})`;
    g.F.fill.style.transform = `scaleX(${b.F})`;
    this.authFill.style.transform = `scaleX(${b.authenticity})`;
    this.seMeter.style.transform = `scaleX(${b.T})`;
    this.niMeter.style.transform = `scaleX(${b.intent})`;

    this.textClock += dt;
    if (this.textClock < 0.1) return;
    const step = this.textClock;
    this.textClock = 0;
    const gauges: [Gauge, number][] = [
      [g.C, b.C],
      [g.E, b.T],
      [g.F, b.F],
    ];
    for (const [gauge, v] of gauges) {
      const t = String(pct(v));
      if (gauge.value.textContent !== t) {
        gauge.value.textContent = t;
        gauge.row.setAttribute('aria-valuenow', t);
      }
    }
    const a = String(pct(b.authenticity));
    if (this.auth.textContent !== a) {
      this.auth.textContent = a;
      this.authRow.setAttribute('aria-valuenow', a);
    }
    this.loopBadge.classList.toggle('on', b.tiLocked && b.seStarved);
    if (document.activeElement !== this.slider) this.slider.value = String(Math.round(this.store.controls.alignment * 100));
    this.slider.style.setProperty('--v', `${this.store.controls.alignment * 100}%`);
    const lockPressed = String(this.isLocked());
    if (this.lockBtn.getAttribute('aria-pressed') !== lockPressed) this.lockBtn.setAttribute('aria-pressed', lockPressed);
    const compilePressed = String(this.store.controls.compile);
    if (this.compileBtn.getAttribute('aria-pressed') !== compilePressed) this.compileBtn.setAttribute('aria-pressed', compilePressed);

    const cap = this.captionText();
    if (cap !== this.lastCaption) {
      this.caption.textContent = cap;
      this.lastCaption = cap;
    }
    this.updateAnnouncement(step);
    for (const l of this.labels) {
      const t = this.conditionText(l.id);
      if (l.state.textContent !== t || l.w === 0) {
        l.state.textContent = t;
        const L = S.labels[l.id];
        l.root.setAttribute('aria-label', `${L.name}, ${L.role}: ${t}`);
        l.w = l.root.offsetWidth;
        l.h = l.root.offsetHeight;
      }
      l.root.classList.toggle('ok', this.conditionOk(l.id));
    }
    this.updateCardState();
    this.measureOccluders();
  }

  /** Screen rectangles that plates must never sit under. */
  private measureOccluders(): void {
    const out: Rect[] = [];
    const add = (e: Element | null) => {
      if (!e) return;
      const r = e.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden') out.push({ x: r.left - 6, y: r.top - 6, w: r.width + 12, h: r.height + 12 });
    };
    add(this.panel);
    add(this.panelToggle);
    add(this.hud);
    add(this.caption);
    add(this.storyBar);
    add(this.root.querySelector('.brand'));
    if (this.card.classList.contains('open')) add(this.card);
    this.occluders = out;
  }

  /**
   * Lay the plates out for this frame's camera: each sits a short leader away
   * from its instrument's rim, on the side away from the beam; overlapping plates
   * are pushed further out; a plate under any piece of UI is hidden.
   */
  placeLabels(): void {
    const W = this.root.clientWidth;
    const H = this.root.clientHeight;
    const show = this.store.ui.labels && this.store.ui.mode !== 'intro';
    this.labelLayer.classList.toggle('hidden', !show);
    if (!show) return;
    this.camera.updateMatrixWorld();

    for (const l of this.labels) {
      this.ndc.copy(l.centre).project(this.camera);
      const cx = (this.ndc.x * 0.5 + 0.5) * W;
      const cy = (0.5 - this.ndc.y * 0.5) * H;
      const behind = this.ndc.z > 1;
      this.ndc.copy(l.edge).project(this.camera);
      l.ex = (this.ndc.x * 0.5 + 0.5) * W;
      l.ey = (0.5 - this.ndc.y * 0.5) * H;
      l.onScreen = !behind && this.ndc.z < 1;
      this.dir.set(l.ex - cx, l.ey - cy);
      if (this.dir.lengthSq() < 1) this.dir.set(1, -1);
      this.dir.normalize();
      l.dx = this.dir.x;
      l.dy = this.dir.y;
      // Which corner of the plate touches the leader: the one nearest the instrument.
      l.ax = 0.5 - 0.5 * Math.max(-1, Math.min(1, l.dx * 1.6));
      l.ay = 0.5 - 0.5 * Math.max(-1, Math.min(1, l.dy * 1.6));
      this.layout(l, LEADER);
    }
    // Push overlapping plates further out along their own leaders.
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < this.labels.length; i++) {
        for (let j = i + 1; j < this.labels.length; j++) {
          const a = this.labels[i];
          const b = this.labels[j];
          if (!a.onScreen || !b.onScreen || !overlaps(a.rect, b.rect)) continue;
          const ox = Math.min(a.rect.x + a.rect.w, b.rect.x + b.rect.w) - Math.max(a.rect.x, b.rect.x);
          const oy = Math.min(a.rect.y + a.rect.h, b.rect.y + b.rect.h) - Math.max(a.rect.y, b.rect.y);
          const push = Math.min(ox / Math.max(0.2, Math.abs(b.dx)), oy / Math.max(0.2, Math.abs(b.dy))) + 6;
          this.layout(b, Math.hypot(b.rect.x + b.ax * b.w - b.ex, b.rect.y + b.ay * b.h - b.ey) + push);
        }
      }
    }
    for (const l of this.labels) {
      const r = l.rect;
      const inView = l.onScreen && r.x > -r.w * 0.3 && r.y > -r.h * 0.3 && r.x + r.w < W + r.w * 0.3 && r.y + r.h < H + r.h * 0.3;
      const hidden = !inView || this.occluders.some((o) => overlaps(o, r));
      l.root.classList.toggle('occluded', hidden);
      l.line.classList.toggle('occluded', hidden);
      l.dot.classList.toggle('occluded', hidden);
      // Corner anchoring keeps a plate growing away from its leader when it expands on hover.
      l.root.style.transform = `translate(${r.x + l.ax * l.w}px, ${r.y + l.ay * l.h}px) translate(${-l.ax * 100}%, ${-l.ay * 100}%)`;
      const px = r.x + l.ax * l.w;
      const py = r.y + l.ay * l.h;
      l.line.setAttribute('x1', l.ex.toFixed(1));
      l.line.setAttribute('y1', l.ey.toFixed(1));
      l.line.setAttribute('x2', px.toFixed(1));
      l.line.setAttribute('y2', py.toFixed(1));
      l.dot.setAttribute('cx', l.ex.toFixed(1));
      l.dot.setAttribute('cy', l.ey.toFixed(1));
    }
  }

  private layout(l: Label, dist: number): void {
    const px = l.ex + l.dx * dist;
    const py = l.ey + l.dy * dist;
    l.rect.x = px - l.ax * l.w;
    l.rect.y = py - l.ay * l.h;
    l.rect.w = l.w;
    l.rect.h = l.h;
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    const inField = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
    const onButton = target?.tagName === 'BUTTON' || target?.tagName === 'SUMMARY';
    const ui = this.store.ui;
    const story = ui.mode === 'story';
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;

    if (k === 'Escape') {
      if (this.card.classList.contains('open')) this.closeCard();
      else if (ui.mode === 'intro') this.ctl.setMode('sandbox');
      else if (story) this.ctl.endStory();
      return;
    }
    if (ui.mode === 'intro') {
      if (k === 's') {
        e.preventDefault();
        this.ctl.startStory();
      }
      return;
    }
    if (inField && (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown')) return;

    switch (k) {
      case 's':
        if (story) this.ctl.endStory();
        else this.ctl.startStory();
        return;
      case 'l':
        this.ctl.setLabels(!ui.labels);
        return;
      case 'm':
        this.ctl.setMuted(!ui.muted);
        return;
    }
    if (story) return;
    switch (k) {
      case '1':
        this.ctl.setLock(!this.isLocked());
        return;
      case '2':
        this.ctl.setFeed(!this.store.controls.feed);
        return;
      case '3':
        this.ctl.setCompile(!this.store.controls.compile);
        return;
      case ' ':
        if (onButton) return; // let the focused button activate itself
        e.preventDefault();
        if (!e.repeat) this.ctl.repeatPrompt();
        return;
      case 'r':
        this.ctl.reset();
        return;
      case 'ArrowLeft':
      case 'ArrowRight':
        if (this.ctl.hoveringTi) {
          e.preventDefault();
          this.ctl.nudgeRing(k === 'ArrowLeft' ? -1 : 1);
        }
        return;
    }
    // Holding any other letter (F is the suggested one) is sensory input too.
    if (/^[a-z]$/.test(k) && !inField) {
      this.heldFeedKeys.add(k);
      this.ctl.setKeyFeed(true);
      this.store.idleTime = 0;
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (this.heldFeedKeys.delete(k) && this.heldFeedKeys.size === 0) this.ctl.setKeyFeed(false);
  };
}

