/**
 * The guided story: ten scenes in three acts. Act I shows the construct
 * working; Act II breaks it stage by stage; in Act III the user repairs it
 * stage by stage with the real controls.
 *
 * A scene is a list of steps, run in order. Each step waits for its trigger
 * (scene time, the nib starting or finishing, a story event, a condition),
 * then changes the caption, acts on the same controls the user has, and/or
 * moves the camera. A step may carry a task: the scene then waits until the
 * user meets its condition by hand, or presses "Do it for {istp}".
 *
 * Pacing follows the reader: every caption and spoken line stays up for its
 * reading time (see `readingTime`), and a step that would replace the text
 * waits for it. Longer copy (German) simply takes longer. The visual beats
 * are spaced so each change can be watched, not just read about.
 *
 * Rules: the story never advances while the nib is writing, and holds on a
 * finished mark; whenever the nib writes, the camera cuts to the page; Skip
 * ends it at any point with all three conditions met.
 *
 * Act II and the beam model: the Ti–Ni loop and the dry groove both need a
 * locked Ti (with Ti unlocked, every mark is a scribble). So after the shatter
 * and the scribble, Ti re-sorts the pieces on its own (the loop is that private
 * rumination), and only after the groove does that private picture slip,
 * leaving the pipeline dormant for Act III.
 */
import { Vector3 } from 'three';
import type { Controller } from '../app';
import { HOME, type View } from '../scene/CameraRig';
import { NI_POS, SE_POS, SHEET_CENTER, TI_POS } from '../scene/layout';
import { LINE_FLIGHT } from '../scene/Messengers';
import type { Bus, Store } from '../state';
import { S, type Strings } from '../strings';

/** A piece of copy, read from the active strings whenever it is shown (so it follows a language switch). */
export type Copy = (s: Strings) => string;
export type TaskKind = 'ask' | 'feed' | 'compile';
export type Act = 1 | 2 | 3;

/** What the story bar shows. */
export interface StoryFrame {
  index: number;
  /** Each scene's act, for the progress dots. */
  acts: readonly Act[];
  act: Act;
  text: Copy | null;
  quote: Copy | null;
  /** The step the user is asked to do, while it is open. */
  task: { kind: TaskKind; hint: Copy } | null;
  /** "Do it for {istp}" was pressed and is under way. */
  assisted: boolean;
  /** The last step was done by hand: acknowledge it. */
  ack: boolean;
}

export interface StoryDisplay {
  showStory(frame: StoryFrame): void;
}

/** Reading pace while also watching the scene: a short pause, then this many characters a second. */
export const READ_PAUSE = 2;
export const READ_CPS = 15;

/** Seconds a caption needs on screen to be read. */
export function readingTime(text: string): number {
  const n = text.trim().length;
  return n ? READ_PAUSE + n / READ_CPS : 0;
}

/** Seconds to hold on a finished mark before the story moves on. */
export const HOLD = 5;
/** After "Do it for {istp}", the controls get this long to get there; then the story moves on regardless. */
export const ASSIST_TIMEOUT = 12;
/** Camera moves: into a new scene, and within one. */
const FLY = 3.0;
const FLY_STEP = 2.6;

type StoryEvent = 'line';

interface Clock {
  /** Scene time. */
  t: number;
  /** Since the previous step fired (or the task was done). */
  since: number;
  /** The nib started writing in this scene. */
  drew: boolean;
  /** Since the nib last finished (∞ if it hasn't in this scene). */
  sinceDraw: number;
  /** Story events since the previous step fired. */
  seen: Set<StoryEvent>;
  /** How long the bar's newest words have been up, and how long they need to be read. */
  shown: number;
  need: number;
  store: Store;
}

type Trigger = (c: Clock) => boolean;

const read = (c: Clock) => c.shown >= c.need;
const at = (s: number): Trigger => (c) => c.t >= s;
const drawing: Trigger = (c) => c.drew;
const drawn: Trigger = (c) => c.drew && c.store.prompt.phase === 'none' && c.sinceDraw >= HOLD;
const on = (e: StoryEvent, orAfter: number): Trigger => (c) => c.seen.has(e) || c.since >= orAfter;
/** `lead` seconds before the current words have been read (to time something that should land just as they are). */
const readIn = (lead: number): Trigger => (c) => c.shown >= c.need - lead;
/** A condition, held for at least `min` after the previous step; gives up waiting after `max`. */
const when =
  (f: (s: Store) => boolean, min = 0, max = Infinity): Trigger =>
    (c) =>
      c.since >= min && (f(c.store) || c.since >= max);

export interface Task {
  kind: TaskKind;
  hint: Copy;
  /** The condition, met with the real controls. */
  met: (s: Store) => boolean;
  /** "Do it for {istp}". (Asking also repeats by itself until Ti locks.) */
  assist: (c: Controller) => void;
  /** If the assist hasn't got there after ASSIST_TIMEOUT. */
  force?: (c: Controller) => void;
  /** The caption once it is done. */
  done: Copy;
  /** As soon as it is met, either way. */
  then?: (c: Controller) => void;
}

export interface Step {
  when: Trigger;
  /** Replaces the caption (and the quote, unless one is given). Waits until the current words have been read. */
  text?: Copy;
  /** A line someone says, under the caption. Also waits for the current words. */
  quote?: Copy | null;
  act?: (c: Controller) => void;
  view?: View | 'page';
  task?: Task;
}

export interface Scene {
  act: Act;
  view: View | 'page';
  /** Shortest time on screen. */
  min: number;
  /** Seconds to linger once the last words have been read, for the picture. */
  hold: number;
  steps: Step[];
}

const mid = (...p: Vector3[]) => p.reduce((a, b) => a.clone().add(b)).multiplyScalar(1 / p.length);
const allThree = (s: Store) => s.beam.tiLocked && !s.beam.seStarved && s.beam.niPrimed;

export const TASKS: Record<TaskKind, Task> = {
  ask: {
    kind: 'ask',
    hint: (s) => s.story.hints.ask,
    met: (s) => s.beam.tiLocked,
    assist: () => { },
    force: (c) => c.setLock(true),
    done: (s) => s.story.s6.done,
  },
  feed: {
    kind: 'feed',
    hint: (s) => s.story.hints.feed,
    met: (s) => !s.beam.seStarved,
    assist: (c) => {
      c.setLock(true);
      c.setFeed(true);
    },
    done: (s) => s.story.s7.done,
    // They stay close: once Se is going, the input keeps coming.
    then: (c) => c.setFeed(true),
  },
  compile: {
    kind: 'compile',
    hint: (s) => s.story.hints.compile,
    met: (s) => s.beam.niPrimed,
    assist: (c) => {
      c.setLock(true);
      c.setFeed(true);
      c.setCompile(true);
    },
    done: (s) => s.story.s8.done,
  },
};

export function scenes(): Scene[] {
  // Story framings sit a little higher than the sandbox view: the story bar covers the bottom.
  const lift = new Vector3(0.3, -0.7, 0);
  const wide: View = { target: HOME.target.clone().add(lift), position: HOME.position.clone().add(lift).add(new Vector3(0.3, 0.4, 1.4)) };
  const ti: View = { target: TI_POS.clone().add(new Vector3(1.0, -1.0, 0)), position: TI_POS.clone().add(new Vector3(4.6, 2.6, 10.6)) };
  // Ti nearly face-on, so the facets can be seen settling, with the source and the space behind it,
  // where questions go out and answers come back.
  const ask: View = { target: TI_POS.clone().add(new Vector3(-0.9, -1.0, 0.6)), position: TI_POS.clone().add(new Vector3(5.6, 0, 10.4)) };
  const tiNi = mid(TI_POS, NI_POS);
  const chain: View = { target: tiNi.clone().add(new Vector3(0.6, -0.9, 0)), position: tiNi.clone().add(new Vector3(4.6, 3.6, 12.8)) };
  const se: View = { target: SE_POS.clone().add(new Vector3(0.5, -0.9, 0)), position: SE_POS.clone().add(new Vector3(3.6, 2.6, 9.6)) };
  const ni: View = { target: NI_POS.clone().add(new Vector3(0.6, -0.9, 0)), position: NI_POS.clone().add(new Vector3(3.6, 2.6, 7.6)) };
  const niSheet = mid(NI_POS, SHEET_CENTER);
  const niPage: View = { target: niSheet.clone().add(new Vector3(-0.5, 0.1, 0.6)), position: niSheet.clone().add(new Vector3(2.4, 4.0, 9.6)) };

  return [
    // ── Act I · Together ──
    // 1. All three hold. Once the scene has been taken in, a prompt; the nib writes a heart.
    {
      act: 1,
      view: wide,
      min: 0,
      hold: 1.5,
      steps: [
        { when: at(0), text: (s) => s.story.s1.caption },
        { when: at(4), quote: (s) => s.story.s1.prompt, act: (c) => c.prompt('thanked') },
        { when: drawing, text: (s) => s.story.s1.drawing },
      ],
    },

    // ── Act II · The break ──
    // 2. The companion's line flies into Ti, landing just as it has been read, and Ti shatters.
    {
      act: 2,
      view: ti,
      min: 0,
      hold: 2.5,
      steps: [
        { when: at(0), text: (s) => s.story.s2.caption },
        { when: at(2), quote: (s) => s.story.line },
        { when: readIn(LINE_FLIGHT), act: (c) => c.sendLine() },
        { when: on('line', LINE_FLIGHT + 1), text: (s) => s.story.s2.shattered, act: (c) => c.shatter() },
      ],
    },
    // 3. Asked to say something with Ti in pieces: a burn-scribble.
    {
      act: 2,
      view: 'page',
      min: 0,
      hold: 1.5,
      steps: [
        { when: at(0), quote: (s) => s.story.s3.prompt, act: (c) => c.prompt('okay') },
        { when: drawing, text: (s) => s.story.s3.drawing },
      ],
    },
    // 4. They stop cuddling: Se coasts down, in plain view. Alone, Ti puts its own picture
    //    together; the beam dies inside Ni and the Ti–Ni loop appears.
    {
      act: 2,
      view: chain,
      min: 0,
      hold: 2.5,
      steps: [
        { when: at(0), text: (s) => s.story.s4.caption },
        { when: at(2.5), act: (c) => c.setFeed(false) },
        { when: at(7.5), text: (s) => s.story.s4.alone, act: (c) => c.setLock(true) },
        { when: when((s) => s.beam.tiLocked && s.beam.seStarved, 3, 6), text: (s) => s.story.s4.loop },
      ],
    },
    // 5. Ni lets go of the direction. Asked again, nothing comes: a dry groove.
    //    Then the picture Ti built alone slips too: dormant.
    {
      act: 2,
      view: ni,
      min: 0,
      hold: 2.5,
      steps: [
        { when: at(0), text: (s) => s.story.s5.caption },
        { when: at(2), act: (c) => c.setCompile(false) },
        { when: at(5), quote: (s) => s.story.s5.prompt, act: (c) => c.prompt('hurting') },
        { when: drawing, text: (s) => s.story.s5.drawing },
        { when: drawn, view: ti, text: (s) => s.story.s5.dormant, act: (c) => c.setLock(false) },
        { when: when((s) => s.beam.dormant, 0, 4) },
      ],
    },

    // ── Act III · Repair ──
    // 6. Ti: ask.
    { act: 3, view: ask, min: 0, hold: 2, steps: [{ when: at(0), text: (s) => s.story.s6.caption, task: TASKS.ask }] },
    // 7. Se: closeness again.
    { act: 3, view: se, min: 0, hold: 2, steps: [{ when: at(0), text: (s) => s.story.s7.caption, task: TASKS.feed }] },
    // 8. Ni and the page: a direction.
    { act: 3, view: niPage, min: 0, hold: 2, steps: [{ when: at(0), text: (s) => s.story.s8.caption, task: TASKS.compile }] },
    // 9. The page: the heart again.
    {
      act: 3,
      view: 'page',
      min: 0,
      hold: 1.5,
      steps: [
        { when: at(0), quote: (s) => s.story.s9.prompt },
        {
          // The controls are the user's now; if something came undone, put it back before asking.
          when: when(allThree, 1, 3),
          act: (c) => {
            c.setLock(true);
            c.setFeed(true);
            c.setCompile(true);
            c.prompt('hurting');
          },
        },
        { when: drawing, text: (s) => s.story.s9.drawing },
      ],
    },
    // 10. Hand control back.
    { act: 3, view: wide, min: 0, hold: 3, steps: [{ when: at(0), text: (s) => s.story.s10.caption }] },
  ];
}

export class Story {
  private list = scenes();
  private index = -1;
  private stepAt = 0;
  private clock: Clock;
  private text: Copy | null = null;
  private quote: Copy | null = null;
  private task: Task | null = null;
  /** The open task's condition has been met; its caption moves on once the current words have been read. */
  private met = false;
  private assisted = false;
  private assistFor = 0;
  private ack = false;
  private asked = 0;

  constructor(
    private store: Store,
    bus: Bus,
    private ctl: Controller,
    private ui: StoryDisplay,
  ) {
    this.clock = { t: 0, since: 0, drew: false, sinceDraw: Infinity, seen: new Set(), shown: 0, need: 0, store };
    bus.on('drawStart', () => {
      if (!this.running) return;
      this.clock.drew = true;
      this.ctl.view(this.ctl.pageView(), 1.4);
    });
    bus.on('drawEnd', () => (this.clock.sinceDraw = 0));
    bus.on('lineArrive', () => this.clock.seen.add('line'));
    // Each question shows as it is asked.
    bus.on('ask', () => {
      if (!this.running || this.task?.kind !== 'ask' || this.met) return;
      const i = Math.min(this.asked++, 2);
      const question: Copy = (s) => s.story.questions[i];
      this.quote = question;
      // Asked by hand, maybe before the caption above it has been read: it still gets its time.
      const c = this.clock;
      c.need = Math.max(c.need - c.shown, readingTime(question(S())));
      c.shown = 0;
      this.show();
    });
  }

  get running(): boolean {
    return this.index >= 0;
  }

  get scene(): number {
    return this.index;
  }

  get count(): number {
    return this.list.length;
  }

  /** `from` skips ahead (tests, debugging); the construct isn't put into that scene's state. */
  start(from = 0): void {
    this.ctl.reset();
    this.ctl.setWorking();
    this.ctl.setMode('story');
    this.index = Math.max(0, Math.min(from, this.list.length - 1)) - 1;
    this.next();
  }

  /** Skip / the end: hand control back with all three conditions met. */
  stop(): void {
    if (!this.running) return;
    this.index = -1;
    this.task = null;
    this.store.ui.storyAct = 0;
    this.ctl.setLock(true);
    this.ctl.setFeed(true);
    this.ctl.setCompile(true);
    this.ctl.setMode('sandbox');
  }

  /** "Do it for {istp}". */
  assist(): void {
    if (!this.running || !this.task || this.met || this.assisted) return;
    this.assisted = true;
    this.assistFor = 0;
    this.task.assist(this.ctl);
    this.show();
  }

  update(dt: number): void {
    if (!this.running || this.store.ui.mode !== 'story') return;
    const c = this.clock;
    c.t += dt;
    c.since += dt;
    c.sinceDraw += dt;
    c.shown += dt;
    this.fireReady();
    if (this.task) this.updateTask(dt);
    if (!this.running) return;
    const sc = this.list[this.index];
    const finished = !this.task && this.stepAt >= sc.steps.length;
    // Never cut away mid-stroke, and only once the last words have been read and the picture has had a moment.
    if (finished && c.t >= sc.min && c.shown >= c.need + sc.hold && this.store.prompt.phase === 'none' && c.sinceDraw >= HOLD) this.next();
  }

  private next(): void {
    this.index++;
    if (this.index >= this.list.length) {
      this.stop();
      return;
    }
    const sc = this.list[this.index];
    const c = this.clock;
    c.t = c.since = c.shown = c.need = 0;
    c.drew = false;
    c.sinceDraw = Infinity;
    c.seen.clear();
    this.stepAt = 0;
    this.text = this.quote = this.task = null;
    this.met = this.assisted = this.ack = false;
    this.asked = 0;
    this.store.ui.storyAct = sc.act;
    this.ctl.view(this.resolve(sc.view), FLY);
    this.fireReady();
    this.show();
  }

  /** New words went up: restart the reading clock for them. */
  private showing(words: string): void {
    this.clock.shown = 0;
    this.clock.need = readingTime(words);
  }

  private fireReady(): void {
    const steps = this.list[this.index].steps;
    let fired = false;
    while (!this.task && this.stepAt < steps.length) {
      const st = steps[this.stepAt];
      // Anything that replaces or adds words waits until the current ones have been read.
      if ((st.text || st.quote !== undefined) && !read(this.clock)) break;
      if (!st.when(this.clock)) break;
      this.fire(st);
      this.stepAt++;
      fired = true;
    }
    if (fired) this.show();
  }

  private fire(st: Step): void {
    st.act?.(this.ctl);
    if (st.view) this.ctl.view(this.resolve(st.view), FLY_STEP);
    const s = S();
    if (st.text) {
      this.text = st.text;
      this.quote = st.quote ?? null;
      this.showing(`${st.text(s)} ${st.quote?.(s) ?? ''}`);
    } else if (st.quote !== undefined) {
      this.quote = st.quote;
      this.showing(st.quote?.(s) ?? '');
    }
    if (st.task) {
      this.task = st.task;
      this.met = this.assisted = this.ack = false;
      this.asked = 0;
    }
    this.clock.since = 0;
    this.clock.seen.clear();
  }

  private updateTask(dt: number): void {
    const task = this.task!;
    if (!this.met && task.met(this.store)) this.meet(!this.assisted);
    if (!this.met && this.assisted) {
      this.assistFor += dt;
      // Asking for them: one question at a time, until Ti locks.
      if (task.kind === 'ask' && !this.ctl.asking) this.ctl.ask();
      if (this.assistFor >= ASSIST_TIMEOUT) {
        task.force?.(this.ctl);
        this.meet(false);
      }
    }
    // Acknowledged at once; the caption moves on once the current words have been read.
    if (this.met && read(this.clock)) this.complete();
  }

  private meet(byHand: boolean): void {
    this.met = true;
    this.ack = byHand;
    this.task!.then?.(this.ctl);
    this.show();
  }

  private complete(): void {
    const task = this.task!;
    this.task = null;
    this.text = task.done;
    this.quote = null;
    const s = S();
    this.showing(`${task.done(s)} ${this.ack ? s.story.byHand : ''}`);
    this.clock.since = 0;
    this.show();
  }

  private resolve(view: View | 'page'): View {
    return view === 'page' ? this.ctl.pageView() : view;
  }

  private show(): void {
    if (!this.running) return;
    const sc = this.list[this.index];
    this.ui.showStory({
      index: this.index,
      acts: this.list.map((s) => s.act),
      act: sc.act,
      text: this.text,
      quote: this.quote,
      task: this.task && !this.met ? { kind: this.task.kind, hint: this.task.hint } : null,
      assisted: this.assisted,
      ack: this.ack,
    });
  }
}
