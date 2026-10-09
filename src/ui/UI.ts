/**
 * Vanilla DOM UI: intro, HUD gauges, control panel, state caption, CSS2D labels
 * anchored to each instrument, info cards, the story bar, and the keyboard map.
 * Reads the store every frame; writes only through the Controller.
 */
import type { Scene } from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Controller } from '../app';
import { HOME } from '../scene/CameraRig';
import { sheetToWorld } from '../scene/layout';
import type { Sheet } from '../scene/Sheet';
import type { Instrument } from '../scene/types';
import type { Bus, Store } from '../state';
import { S, type InstrumentId, type PromptKind } from '../strings';

const pct = (v: number) => Math.round(v * 100);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

interface Gauge {
  fill: HTMLElement;
  value: HTMLElement;
}

interface Label {
  id: InstrumentId;
  root: HTMLElement;
  state: HTMLElement;
  obj: CSS2DObject;
}

export class UI {
  private hudGauges: Record<'C' | 'E' | 'F', Gauge>;
  private auth: HTMLElement;
  private authFill: HTMLElement;
  private loopBadge: HTMLElement;
  private caption: HTMLElement;
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
  private labels: Label[] = [];
  private textClock = 0;
  private lastCaption = '';
  private heldFeedKeys = new Set<string>();
  private lastFocus: HTMLElement | null = null;

  constructor(
    private root: HTMLElement,
    private store: Store,
    bus: Bus,
    private ctl: Controller,
    instruments: Instrument[],
    sheet: Sheet,
    scene: Scene,
  ) {
    // ── Brand ──
    const brand = el('header', 'brand');
    brand.append(el('h1', '', S.title), el('p', '', S.subtitle));
    root.append(brand);

    // ── HUD ──
    const hud = el('section', 'hud');
    hud.setAttribute('aria-label', S.a11y.hud);
    const mk = (key: 'C' | 'E' | 'F', label: string, cls: string): Gauge => {
      const row = el('div', `gauge ${cls}`);
      const name = el('span', 'gauge-name', label);
      const track = el('span', 'gauge-track');
      const fill = el('span', 'gauge-fill');
      track.append(fill);
      const value = el('span', 'gauge-value', '0');
      row.append(name, track, value);
      hud.append(row);
      void key;
      return { fill, value };
    };
    this.hudGauges = {
      C: mk('C', S.hud.coherence, 'g-ti'),
      E: mk('E', S.hud.energy, 'g-se'),
      F: mk('F', S.hud.focus, 'g-ni'),
    };
    const authRow = el('div', 'auth');
    const authName = el('span', 'auth-name', S.hud.authenticity);
    this.auth = el('span', 'auth-value', '0');
    const authTrack = el('span', 'auth-track');
    this.authFill = el('span', 'auth-fill');
    authTrack.append(this.authFill);
    authRow.append(authName, this.auth, authTrack);
    this.loopBadge = el('span', 'loop-badge', S.hud.loop);
    this.loopBadge.title = S.a11y.loop;
    hud.append(authRow, this.loopBadge);
    root.append(hud);

    // ── Caption ──
    this.caption = el('p', 'caption');
    this.caption.setAttribute('aria-live', 'polite');
    root.append(this.caption);

    // ── Story bar ──
    this.storyBar = el('div', 'story-bar');
    this.storyBar.setAttribute('aria-live', 'polite');
    const dots = el('div', 'story-dots');
    for (let i = 0; i < S.story.scenes.length; i++) {
      const d = el('span', 'dot');
      this.storyDots.push(d);
      dots.append(d);
    }
    this.storyText = el('p', 'story-text');
    const skip = el('button', 'btn ghost', S.story.skip);
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
    const kbd = (k: string) => el('kbd', '', k);
    const toggle = (label: string, key: string, on: () => void) => {
      const b = el('button', 'btn toggle');
      b.type = 'button';
      b.setAttribute('aria-pressed', 'false');
      b.append(el('span', 'led'), el('span', '', label), kbd(key));
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
    this.lockBtn = toggle(S.panel.tiLock, '1', () => ctl.setLock(!this.isLocked()));
    const tiRow = el('div', 'ctl-row');
    tiRow.append(this.slider, this.lockBtn);
    ti.append(tiHead, tiRow, el('p', 'hint', S.panel.tiHint));
    // Se
    const se = el('div', 'ctl c-se');
    const seHead = el('div', 'ctl-head');
    seHead.append(el('span', 'sym', 'Se'), el('span', 'ctl-name', S.panel.se));
    this.feedBtn = toggle(S.panel.seFeed, '2', () => ctl.setFeed(!store.controls.feed));
    const seTrack = el('span', 'mini-track');
    this.seMeter = el('span', 'mini-fill');
    seTrack.append(this.seMeter);
    const seRow = el('div', 'ctl-row');
    seRow.append(seTrack, this.feedBtn);
    se.append(seHead, seRow, el('p', 'hint', S.panel.seHint));
    // Ni
    const ni = el('div', 'ctl c-ni');
    const niHead = el('div', 'ctl-head');
    niHead.append(el('span', 'sym', 'Ni'), el('span', 'ctl-name', S.panel.ni));
    this.compileBtn = toggle(S.panel.niCompile, '3', () => ctl.setCompile(!store.controls.compile));
    const niTrack = el('span', 'mini-track');
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
      b.type = 'button';
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

    // ── Labels (engraved plates) ──
    for (const ins of instruments) this.addLabel(ins.id, ins.labelAnchor, scene);
    this.addLabel('sheet', sheetToWorld(-1.35, 0.95).setY(0.25), scene);
    void sheet;

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
    go.type = 'button';
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

  private addLabel(id: InstrumentId, at: { x: number; y: number; z: number }, scene: Scene): void {
    const root = el('button', `plate p-${id}`);
    root.type = 'button';
    const L = S.labels[id];
    const state = el('span', 'plate-state');
    root.append(el('span', 'plate-name', L.name), el('span', 'plate-role', L.role), state);
    root.addEventListener('click', () => this.ctl.focus(id));
    root.addEventListener('pointerdown', (e) => e.stopPropagation());
    const obj = new CSS2DObject(root);
    // Bottom-left corner at the anchor: plates extend up and away from the beam.
    // The source's plate hangs the other way (top-right corner at the anchor).
    if (id === 'source') obj.center.set(1, 0);
    else obj.center.set(0, 1);
    obj.position.set(at.x, at.y, at.z);
    scene.add(obj);
    this.labels.push({ id, root, state, obj });
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
    this.storyBtn.querySelector('span')!.textContent = story ? S.story.skip : S.panel.story;
    this.intro.hidden = ui.mode !== 'intro';
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

  /** Per frame: gauges are cheap transforms; text updates at ~10 Hz. */
  update(dt: number): void {
    const b = this.store.beam;
    const g = this.hudGauges;
    g.C.fill.style.transform = `scaleX(${b.C})`;
    g.E.fill.style.transform = `scaleX(${b.E})`;
    g.F.fill.style.transform = `scaleX(${b.F})`;
    this.authFill.style.transform = `scaleX(${b.authenticity})`;
    this.seMeter.style.transform = `scaleX(${b.T})`;
    this.niMeter.style.transform = `scaleX(${b.intent})`;

    this.textClock += dt;
    if (this.textClock < 0.1) return;
    this.textClock = 0;
    g.C.value.textContent = String(pct(b.C));
    g.E.value.textContent = String(pct(b.E));
    g.F.value.textContent = String(pct(b.F));
    this.auth.textContent = String(pct(b.authenticity));
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
    for (const l of this.labels) {
      const t = this.conditionText(l.id);
      if (l.state.textContent !== t) l.state.textContent = t;
      l.root.classList.toggle('ok', this.conditionOk(l.id));
    }
    this.updateCardState();
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
