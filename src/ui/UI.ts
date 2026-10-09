/**
 * Vanilla DOM UI: intro (names, language), HUD gauges and badges, control
 * panel, state caption, engraved plates with leader lines to each instrument,
 * info cards, the story bar, and the keyboard map. Reads the store every frame;
 * writes only through the Controller. Every string is bound through `Texts`,
 * so a language switch or new names re-render the whole UI in place.
 */
import { Vector2, Vector3, type PerspectiveCamera } from 'three';
import type { Controller } from '../app';
import { t } from '../i18n/format';
import type { OutputMode } from '../model/beam';
import { HOME } from '../scene/CameraRig';
import { SHEET_H, SHEET_W, sheetToWorld } from '../scene/layout';
import type { Instrument } from '../scene/types';
import type { Bus, Store } from '../state';
import type { StoryFrame, TaskKind } from '../story/Story';
import { currentPeople, S, type InstrumentId, type PromptKind } from '../strings';
import { el, kbd, SVG, Texts, type Get } from './dom';
import { LangSwitch, PeopleForm } from './PeopleForm';
import { StoryBar } from './StoryBar';

const pct = (v: number) => Math.round(v * 100);
/** Gap between the instrument's rim and its plate, in px. */
const LEADER = 26;
/** A mode has to hold this long before it is announced to screen readers. */
const ANNOUNCE_AFTER = 0.8;
const PROMPT_KINDS: PromptKind[] = ['okay', 'hurting', 'thanked'];

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
  private texts = new Texts();
  private hudGauges: Record<'C' | 'E' | 'F', Gauge>;
  private hud: HTMLElement;
  private auth: HTMLElement;
  private authRow: HTMLElement;
  private authFill: HTMLElement;
  private loopBadge: HTMLElement;
  private dormantBadge: HTMLElement;
  private caption: HTMLElement;
  private announcer: HTMLElement;
  private panel: HTMLElement;
  private slider: HTMLInputElement;
  private lockBtn: HTMLButtonElement;
  private askBtn: HTMLButtonElement;
  private shatterBtn: HTMLButtonElement;
  private feedBtn: HTMLButtonElement;
  private compileBtn: HTMLButtonElement;
  private labelsBtn: HTMLButtonElement;
  private muteBtn: HTMLButtonElement;
  private storyBtn: HTMLButtonElement;
  private resetBtn: HTMLButtonElement;
  private promptBtns: HTMLButtonElement[] = [];
  private namesBtn: HTMLButtonElement;
  private namesBox: HTMLFormElement;
  private seMeter: HTMLElement;
  private niMeter: HTMLElement;
  private card: HTMLElement;
  private cardTitle: HTMLElement;
  private cardBody: HTMLElement;
  private cardState: HTMLElement;
  private intro: HTMLElement;
  private introForm: PeopleForm;
  private panelForm: PeopleForm;
  private storyBar: StoryBar;
  private panelToggle: HTMLButtonElement;
  private labelLayer: HTMLElement;
  private leaders: SVGSVGElement;
  private labels: Label[] = [];
  private occluders: Rect[] = [];
  /** The control the story is waiting for, and where its cue goes. */
  private cue: TaskKind | null = null;
  private cueTargets!: Record<TaskKind, { button: HTMLElement; block: HTMLElement }>;
  private storyH = -1;
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
    const tx = this.texts;

    // ── Brand ──
    const brand = el('header', 'brand');
    brand.append(
      tx.text(el('h1'), (s) => s.title),
      tx.text(el('p'), (s) => s.subtitle),
    );
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
    tx.attr(this.hud, 'aria-label', (s) => s.a11y.hud);
    const meter = (row: HTMLElement, label: Get) => {
      row.setAttribute('role', 'meter');
      tx.attr(row, 'aria-label', label);
      row.setAttribute('aria-valuemin', '0');
      row.setAttribute('aria-valuemax', '100');
      row.setAttribute('aria-valuenow', '0');
    };
    const mk = (label: Get, cls: string): Gauge => {
      const row = el('div', `gauge ${cls}`);
      meter(row, label);
      const name = tx.text(el('span', 'gauge-name'), label);
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
      C: mk((s) => s.hud.coherence, 'g-ti'),
      E: mk((s) => s.hud.energy, 'g-se'),
      F: mk((s) => s.hud.focus, 'g-ni'),
    };
    this.authRow = el('div', 'auth');
    meter(this.authRow, (s) => s.hud.authenticity);
    const authName = tx.text(el('span', 'auth-name'), (s) => s.hud.authenticity);
    authName.setAttribute('aria-hidden', 'true');
    this.auth = el('span', 'auth-value', '0');
    this.auth.setAttribute('aria-hidden', 'true');
    const authTrack = el('span', 'auth-track');
    this.authFill = el('span', 'auth-fill');
    authTrack.append(this.authFill);
    this.authRow.append(authName, this.auth, authTrack);
    const badges = el('div', 'badges');
    this.loopBadge = tx.text(el('span', 'badge loop-badge'), (s) => s.hud.loop);
    tx.attr(this.loopBadge, 'title', (s) => s.a11y.loop);
    this.dormantBadge = tx.text(el('span', 'badge dormant-badge'), (s) => s.hud.dormant);
    tx.attr(this.dormantBadge, 'title', (s) => s.a11y.dormant);
    badges.append(this.loopBadge, this.dormantBadge);
    this.hud.append(this.authRow, badges);
    root.append(this.hud);

    // ── Caption (visual) and a quieter live region for screen readers ──
    this.caption = el('p', 'caption');
    root.append(this.caption);
    this.announcer = el('p', 'sr-only');
    this.announcer.setAttribute('aria-live', 'polite');
    root.append(this.announcer);

    // ── Story bar ──
    this.storyBar = new StoryBar(
      tx,
      () => ctl.endStory(),
      () => ctl.assistStory(),
    );
    root.append(this.storyBar.root);

    // ── Panel ──
    this.panel = el('aside', 'panel');
    this.panel.id = 'panel';
    tx.attr(this.panel, 'aria-label', (s) => s.a11y.panel);
    this.panelToggle = el('button', 'panel-toggle btn');
    this.panelToggle.type = 'button';
    this.panelToggle.setAttribute('aria-controls', 'panel');
    this.panelToggle.addEventListener('click', () => {
      store.ui.panelOpen = !store.ui.panelOpen;
      this.syncPanelOpen();
      bus.emit('ui');
    });
    root.append(this.panelToggle);

    const sec = (title: Get, cls = '') => {
      const s = el('section', `panel-sec ${cls}`);
      s.append(tx.text(el('h2'), title));
      this.panel.append(s);
      return s;
    };
    // Explicit names: the LED/label/key markup inside would otherwise be read (or dropped) piecemeal.
    const named = (b: HTMLButtonElement, label: Get, shortcut: string) => {
      b.type = 'button';
      tx.attr(b, 'aria-label', label);
      b.setAttribute('aria-keyshortcuts', shortcut);
    };
    const toggle = (label: Get, key: string, on: () => void, name: Get = label) => {
      const b = el('button', 'btn toggle');
      named(b, name, key);
      b.setAttribute('aria-pressed', 'false');
      const led = el('span', 'led');
      led.setAttribute('aria-hidden', 'true');
      b.append(led, tx.text(el('span'), label), kbd(key));
      b.addEventListener('click', on);
      return b;
    };
    const action = (cls: string, label: Get, key: string, shortcut: string, on: () => void, name: Get) => {
      const b = el('button', `btn action ${cls}`);
      named(b, name, shortcut);
      b.append(tx.text(el('span'), label), kbd(key));
      b.addEventListener('click', on);
      return b;
    };
    const control = (cls: string, sym: string, name: Get) => {
      const block = el('div', `ctl ${cls}`);
      const head = el('div', 'ctl-head');
      head.append(el('span', 'sym', sym), tx.text(el('span', 'ctl-name'), name));
      block.append(head);
      return block;
    };
    const row = (...children: HTMLElement[]) => {
      const r = el('div', 'ctl-row');
      r.append(...children);
      return r;
    };
    const miniTrack = () => {
      const track = el('span', 'mini-track');
      track.setAttribute('aria-hidden', 'true');
      const fill = el('span', 'mini-fill');
      track.append(fill);
      return { track, fill };
    };

    const conditions = sec((s) => s.panel.heading);
    // Ti
    const ti = control('c-ti', 'Ti', (s) => s.panel.ti);
    this.slider = el('input', 'slider');
    this.slider.type = 'range';
    this.slider.min = '0';
    this.slider.max = '100';
    this.slider.value = '0';
    tx.attr(this.slider, 'aria-label', (s) => s.panel.ti);
    this.slider.addEventListener('input', () => ctl.setAlignment(Number(this.slider.value) / 100));
    this.lockBtn = toggle((s) => s.panel.tiLock, '1', () => ctl.setLock(!this.isLocked()), (s) => s.a11y.lock);
    this.askBtn = action('ask', (s) => s.panel.tiAsk, 'Q', 'Q', () => ctl.ask(), (s) => s.a11y.ask);
    this.shatterBtn = action('shatter', (s) => s.panel.tiShatter, '⇧1', 'Shift+1', () => ctl.shatter(), (s) => s.a11y.shatter);
    ti.append(row(this.slider, this.lockBtn), row(this.askBtn, this.shatterBtn), tx.text(el('p', 'hint'), (s) => s.panel.tiHint));
    // Se
    const se = control('c-se', 'Se', (s) => s.panel.se);
    this.feedBtn = toggle((s) => s.panel.seFeed, '2', () => ctl.setFeed(!store.controls.feed), (s) => s.a11y.feed);
    const seTrack = miniTrack();
    this.seMeter = seTrack.fill;
    se.append(row(seTrack.track, this.feedBtn), tx.text(el('p', 'hint'), (s) => s.panel.seHint));
    // Ni
    const ni = control('c-ni', 'Ni', (s) => s.panel.ni);
    this.compileBtn = toggle((s) => s.panel.niCompile, '3', () => ctl.setCompile(!store.controls.compile), (s) => s.a11y.compile);
    const niTrack = miniTrack();
    this.niMeter = niTrack.fill;
    ni.append(row(niTrack.track, this.compileBtn), tx.text(el('p', 'hint'), (s) => s.panel.niHint));
    conditions.append(ti, se, ni);
    this.cueTargets = {
      ask: { button: this.askBtn, block: ti },
      feed: { button: this.feedBtn, block: se },
      compile: { button: this.compileBtn, block: ni },
    };

    const prompts = sec((s) => s.panel.prompts, 'prompts');
    for (const kind of PROMPT_KINDS) {
      const b = tx.text(el('button', 'btn prompt'), (s) => s.prompts[kind].button);
      b.type = 'button';
      b.addEventListener('click', () => ctl.prompt(kind));
      prompts.append(b);
      this.promptBtns.push(b);
    }
    const ph = el('p', 'hint');
    ph.append(
      tx.text(kbd(''), (s) => s.panel.spaceKey),
      document.createTextNode(' '),
      tx.text(el('span'), (s) => s.panel.promptHint),
    );
    prompts.append(ph);

    const view = sec((s) => s.panel.view, 'view');
    const grid = el('div', 'btn-grid');
    const plain = (label: Get, key: string, on: () => void) => {
      const b = el('button', 'btn');
      named(b, label, key);
      b.append(tx.text(el('span'), label), kbd(key));
      b.addEventListener('click', on);
      grid.append(b);
      return b;
    };
    this.storyBtn = plain((s) => s.panel.story, 'S', () => (store.ui.mode === 'story' ? ctl.endStory() : ctl.startStory()));
    this.resetBtn = plain((s) => s.panel.reset, 'R', () => ctl.reset());
    this.labelsBtn = toggle((s) => s.panel.labels, 'L', () => ctl.setLabels(!store.ui.labels));
    this.muteBtn = toggle((s) => s.panel.mute, 'M', () => ctl.setMuted(!store.ui.muted));
    grid.append(this.labelsBtn, this.muteBtn);

    // Names (an inline editor) and the language.
    const namesRow = el('div', 'names-row');
    this.namesBtn = tx.text(el('button', 'btn names-btn'), (s) => s.panel.names);
    this.namesBtn.type = 'button';
    tx.attr(this.namesBtn, 'aria-label', (s) => s.a11y.names);
    this.namesBtn.setAttribute('aria-expanded', 'false');
    this.namesBtn.setAttribute('aria-controls', 'names-box');
    this.namesBtn.addEventListener('click', () => this.openNames(this.namesBox.hidden));
    const panelLang = new LangSwitch(tx, (l) => ctl.setLanguage(l));
    namesRow.append(this.namesBtn, panelLang.root);
    this.namesBox = el('form', 'names-box');
    this.namesBox.id = 'names-box';
    this.namesBox.hidden = true;
    this.panelForm = new PeopleForm(tx, 'panel', (p) => ctl.setPeople(p));
    const done = tx.text(el('button', 'btn'), (s) => s.panel.namesDone);
    done.type = 'submit';
    this.namesBox.addEventListener('submit', (e) => {
      e.preventDefault();
      this.openNames(false);
      this.namesBtn.focus();
    });
    this.namesBox.append(this.panelForm.root, done);
    view.append(grid, namesRow, this.namesBox);

    const keys = el('details', 'keys');
    keys.append(tx.text(el('summary'), (s) => s.keys.heading));
    const dl = el('dl');
    tx.add(() => dl.replaceChildren(...S().keys.list.flatMap(([k, v]) => [el('dt', '', k), el('dd', '', v)])));
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
    const close = tx.text(el('button', 'btn ghost card-close'), (s) => s.close);
    close.type = 'button';
    close.addEventListener('click', () => this.closeCard());
    this.card.append(this.cardTitle, this.cardState, this.cardBody, close);
    root.append(this.card);
    tx.add(() => this.fillCard());

    // ── Plates ──
    for (const ins of instruments) this.addLabel(ins.id, ins.group.position.clone(), ins.labelAnchor);
    // The page's plate hangs off its near-left corner, away from the beam.
    this.addLabel('sheet', sheetToWorld(0, 0), sheetToWorld(-SHEET_W / 2 + 0.15, -SHEET_H / 2 + 0.1));

    // ── Intro ──
    this.intro = el('div', 'intro');
    this.intro.setAttribute('role', 'dialog');
    this.intro.setAttribute('aria-modal', 'true');
    this.intro.setAttribute('aria-labelledby', 'intro-title');
    const box = el('form', 'intro-box');
    box.noValidate = true;
    box.addEventListener('submit', (e) => {
      e.preventDefault();
      ctl.startStory();
    });
    const top = el('div', 'intro-top');
    const h = tx.text(el('h2'), (s) => s.intro.heading);
    h.id = 'intro-title';
    const introLang = new LangSwitch(tx, (l) => ctl.setLanguage(l));
    top.append(h, introLang.root);
    const body = el('div', 'intro-body');
    tx.add(() => body.replaceChildren(...S().intro.body.map((p) => el('p', '', p))));
    const who = tx.text(el('h3', 'intro-who'), (s) => s.intro.who);
    this.introForm = new PeopleForm(tx, 'intro', (p) => ctl.setPeople(p));
    const actions = el('div', 'intro-actions');
    const go = el('button', 'btn primary');
    named(go, (s) => s.intro.story, 'S');
    go.type = 'submit';
    go.append(tx.text(el('span'), (s) => s.intro.story), kbd('S'));
    const free = tx.text(el('button', 'btn'), (s) => s.intro.sandbox);
    free.type = 'button';
    free.addEventListener('click', () => ctl.setMode('sandbox'));
    actions.append(go, free);
    box.append(top, body, tx.text(el('p', 'disclaimer'), (s) => s.intro.disclaimer), who, this.introForm.root, actions);
    this.intro.append(box);
    root.append(this.intro);
    requestAnimationFrame(() => go.focus());

    bus.on('ui', () => this.sync());
    bus.on('mode', () => this.sync());
    bus.on('focus', (id) => this.showCard(id));
    bus.on('text', () => this.renderText());
    bus.on('drawStart', () => {
      // The one moment worth announcing outside a mode change: what the nib is about to write.
      if (this.store.ui.mode !== 'story') this.announce(S().caption.drawing[this.store.beam.output]);
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
    const tx = this.texts;
    const root = el('button', `plate p-${id}`);
    root.type = 'button';
    const state = el('span', 'plate-state');
    root.append(tx.text(el('span', 'plate-name'), (s) => s.labels[id].name), state, tx.text(el('span', 'plate-role'), (s) => s.labels[id].role));
    root.addEventListener('click', () => this.ctl.focus(id));
    root.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.labelLayer.append(root);
    const line = document.createElementNS(SVG, 'line');
    line.classList.add(`l-${id}`);
    const dot = document.createElementNS(SVG, 'circle');
    dot.classList.add(`l-${id}`);
    dot.setAttribute('r', '2.2');
    this.leaders.append(line, dot);
    const label: Label = {
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
    };
    this.labels.push(label);
    // New text: re-measure (and re-name) on the next update.
    tx.add(() => (label.w = 0));
  }

  private syncPanelOpen(): void {
    const open = this.store.ui.panelOpen;
    this.root.classList.toggle('panel-closed', !open);
    this.panelToggle.setAttribute('aria-expanded', String(open));
    this.panelToggle.textContent = open ? S().panel.collapse : S().panel.expand;
  }

  private openNames(open: boolean): void {
    this.namesBox.hidden = !open;
    this.namesBtn.setAttribute('aria-expanded', String(open));
    if (open) {
      this.panelForm.set(currentPeople());
      this.panelForm.focus();
    }
  }

  /** Language or names changed: every string is read again. */
  private renderText(): void {
    this.texts.render();
    this.introForm.set(currentPeople());
    this.panelForm.set(currentPeople());
    this.syncPanelOpen();
    this.lastCaption = '';
    this.textClock = 1;
    this.sync();
  }

  /** Discrete UI state (toggles, mode). Cheap; called on events. */
  sync(): void {
    const { controls: c, ui } = this.store;
    const s = S();
    this.lockBtn.setAttribute('aria-pressed', String(this.isLocked()));
    this.feedBtn.setAttribute('aria-pressed', String(c.feed));
    this.compileBtn.setAttribute('aria-pressed', String(c.compile));
    this.labelsBtn.setAttribute('aria-pressed', String(ui.labels));
    this.muteBtn.setAttribute('aria-pressed', String(!ui.muted));
    const story = ui.mode === 'story';
    // Act III hands the controls over; before that, the story drives.
    const handsOff = story && ui.storyAct < 3;
    this.root.classList.toggle('labels-off', !ui.labels);
    this.root.classList.toggle('mode-story', story);
    this.root.classList.toggle('hands-on', story && !handsOff);
    this.root.classList.toggle('mode-intro', ui.mode === 'intro');
    for (const b of [this.slider, this.lockBtn, this.shatterBtn, this.feedBtn, this.compileBtn]) b.disabled = handsOff;
    this.askBtn.disabled = handsOff || this.store.beam.tiLocked;
    for (const b of this.promptBtns) b.disabled = story;
    this.resetBtn.disabled = story;
    this.storyBtn.querySelector('span')!.textContent = story ? s.story.skip : s.panel.story;
    this.storyBtn.setAttribute('aria-label', story ? s.a11y.skip : s.panel.story);
    this.intro.hidden = ui.mode !== 'intro';
    this.applyCue();
    this.measureOccluders();
  }

  showStory(frame: StoryFrame): void {
    this.cue = frame.task?.kind ?? null;
    this.storyBar.show(frame);
    this.sync();
  }

  /** In Act III the control the story is waiting for gets a soft pulsing outline (static with reduced motion). */
  private applyCue(): void {
    const active = this.store.ui.mode === 'story' ? this.cue : null;
    for (const kind of Object.keys(this.cueTargets) as TaskKind[]) {
      const { button, block } = this.cueTargets[kind];
      button.classList.toggle('cue', kind === active);
      block.classList.toggle('cue-on', kind === active);
    }
    // On tablets the panel may be a closed drawer: point at its toggle instead.
    this.panelToggle.classList.toggle('cue', active !== null && !this.store.ui.panelOpen);
  }

  private showCard(id: InstrumentId | null): void {
    if (!id) {
      this.card.classList.remove('open');
      this.measureOccluders();
      return;
    }
    if (!this.card.classList.contains('open')) this.lastFocus = document.activeElement as HTMLElement | null;
    this.card.dataset.id = id;
    this.card.classList.add('open');
    this.fillCard();
    this.card.querySelector<HTMLButtonElement>('.card-close')?.focus({ preventScroll: true });
    this.measureOccluders();
  }

  private fillCard(): void {
    const id = this.card.dataset.id as InstrumentId | undefined;
    if (!id) return;
    const info = S().info[id];
    this.cardTitle.textContent = info.title;
    this.cardBody.replaceChildren(...info.body.map((p) => el('p', '', p)));
    this.updateCardState();
  }

  private closeCard(): void {
    this.ctl.focus(null);
    if (this.store.ui.mode !== 'story') this.ctl.view(HOME);
    this.lastFocus?.focus?.({ preventScroll: true });
  }

  private conditionText(id: InstrumentId): string {
    const b = this.store.beam;
    const pr = this.store.prompt;
    const C = S().condition;
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
        return S().markName[b.output];
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

  private idleText(mode: OutputMode): string {
    return this.store.beam.dormant ? S().caption.dormant : S().caption.idle[mode];
  }

  private captionText(): string {
    const pr = this.store.prompt;
    const b = this.store.beam;
    const s = S();
    if (pr.phase === 'incoming' && pr.kind) return t(s.caption.incoming, { prompt: s.prompts[pr.kind].caption });
    if (pr.phase === 'charging') return s.caption.charging;
    if (pr.phase === 'drawing') return s.caption.drawing[b.output];
    return this.idleText(b.output);
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
      this.announce(this.idleText(mode));
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
    this.dormantBadge.classList.toggle('on', b.dormant);
    if (document.activeElement !== this.slider) this.slider.value = String(Math.round(this.store.controls.alignment * 100));
    this.slider.style.setProperty('--v', `${this.store.controls.alignment * 100}%`);
    const lockPressed = String(this.isLocked());
    if (this.lockBtn.getAttribute('aria-pressed') !== lockPressed) this.lockBtn.setAttribute('aria-pressed', lockPressed);
    const compilePressed = String(this.store.controls.compile);
    if (this.compileBtn.getAttribute('aria-pressed') !== compilePressed) this.compileBtn.setAttribute('aria-pressed', compilePressed);
    const askOff = (this.store.ui.mode === 'story' && this.store.ui.storyAct < 3) || b.tiLocked;
    if (this.askBtn.disabled !== askOff) this.askBtn.disabled = askOff;

    const cap = this.captionText();
    if (cap !== this.lastCaption) {
      this.caption.textContent = cap;
      this.lastCaption = cap;
    }
    this.updateAnnouncement(step);
    const names = S().labels;
    for (const l of this.labels) {
      const t = this.conditionText(l.id);
      if (l.state.textContent !== t || l.w === 0) {
        l.state.textContent = t;
        l.root.setAttribute('aria-label', `${names[l.id].name}, ${names[l.id].role}: ${t}`);
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
    add(this.storyBar.root);
    add(this.root.querySelector('.brand'));
    if (this.card.classList.contains('open')) add(this.card);
    this.occluders = out;
    // The tablet drawer stacks above the story bar, whatever its height.
    const h = Math.round(this.storyBar.root.offsetHeight);
    if (h !== this.storyH) {
      this.storyH = h;
      this.root.style.setProperty('--story-h', `${h}px`);
    }
  }

  /**
   * Lay the plates out for this frame's camera: each sits a short leader away
   * from its instrument's rim, on the side away from the beam; overlapping plates
   * are pushed further out; a plate under any piece of UI is hidden. The size
   * comes from the app (reading it here would force a layout every frame).
   */
  placeLabels(W: number, H: number): void {
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
    const tag = target?.tagName;
    const type = tag === 'INPUT' ? (target as HTMLInputElement).type : '';
    // Typing a name: every key is the field's, except Escape, which leaves it.
    const typing = tag === 'TEXTAREA' || !!target?.isContentEditable || (tag === 'INPUT' && !['range', 'radio', 'checkbox', 'button'].includes(type));
    const inField = tag === 'INPUT' || tag === 'TEXTAREA';
    const onButton = tag === 'BUTTON' || tag === 'SUMMARY';
    const ui = this.store.ui;
    const story = ui.mode === 'story';
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;

    if (typing) {
      if (k === 'Escape') {
        if (this.namesBox.contains(target)) {
          this.openNames(false);
          this.namesBtn.focus();
        } else target?.blur();
      }
      return;
    }
    if (k === 'Escape') {
      if (this.card.classList.contains('open')) this.closeCard();
      else if (!this.namesBox.hidden) this.openNames(false);
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
    // Until Act III the story drives the conditions.
    if (story && ui.storyAct < 3) return;
    if (e.code === 'Digit1' && e.shiftKey) {
      e.preventDefault();
      if (!e.repeat) this.ctl.shatter();
      return;
    }
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
      case 'q':
        if (!e.repeat) this.ctl.ask();
        return;
      case ' ':
        if (onButton || inField || story) return; // let the focused control handle it; no prompts mid-story
        e.preventDefault();
        if (!e.repeat) this.ctl.repeatPrompt();
        return;
      case 'r':
        if (!story) this.ctl.reset();
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
