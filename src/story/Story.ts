/**
 * Guided story: six captioned scenes, each with its own camera framing and a
 * timeline of actions on the same controls the user has. Whenever the nib
 * writes, the camera cuts to the page so the mark is the subject, then holds on
 * the finished mark before moving on. Ends by handing control back with all
 * three conditions met.
 */
import { Vector3 } from 'three';
import type { Controller } from '../app';
import { HOME, type View } from '../scene/CameraRig';
import { NI_POS, TI_POS } from '../scene/layout';
import type { Bus, Store } from '../state';
import { S } from '../strings';

export interface Scene {
  dur: number;
  view: View;
  /** Cut to the page when the nib starts writing. */
  page: boolean;
  actions: [number, (c: Controller) => void][];
}

/** What the story needs from the UI. */
export interface StoryDisplay {
  showStory(index: number, text: string): void;
}

/** Seconds to hold on a finished mark before the next scene. */
export const HOLD = 1.6;

const mid = (...p: Vector3[]) => p.reduce((a, b) => a.clone().add(b)).multiplyScalar(1 / p.length);

export function scenes(): Scene[] {
  // Story framings sit a little higher than the sandbox view: the story bar covers the bottom.
  const lift = new Vector3(0.3, -0.7, 0);
  const wide: View = { target: HOME.target.clone().add(lift), position: HOME.position.clone().add(lift).add(new Vector3(0.3, 0.4, 1.4)) };
  const tiNi = mid(TI_POS, NI_POS);
  return [
    // 1. Idle, all off: Ti loops the beam inside itself.
    { dur: 8.5, page: false, view: { target: TI_POS.clone().add(new Vector3(1.3, -1.0, 0)), position: TI_POS.clone().add(new Vector3(5.6, 2.6, 10.6)) }, actions: [] },
    // 2. A prompt with Ti off: burn-scribble.
    { dur: 9, page: true, view: wide, actions: [[0.6, (c) => c.prompt('okay')]] },
    // 3. Ti locks, Se starved: the beam dies in Ni and loops back to Ti; the dead nib scores a dry groove.
    {
      dur: 9.5,
      page: true,
      view: { target: tiNi.clone().add(new Vector3(0.6, -0.9, 0)), position: tiNi.clone().add(new Vector3(4.6, 3.6, 12.8)) },
      actions: [
        [0.3, (c) => c.setLock(true)],
        [2.6, (c) => c.prompt('hurting')],
      ],
    },
    // 4. Particles arrive, ring spins up, Ni still flat: pink wash.
    {
      dur: 9,
      page: true,
      view: wide,
      actions: [
        [0.2, (c) => c.setFeed(true)],
        [3.0, (c) => c.prompt('okay')],
      ],
    },
    // 5. Ni telescopes: heart.
    {
      dur: 9,
      page: true,
      view: { target: NI_POS.clone().add(new Vector3(0.6, -0.9, 0)), position: NI_POS.clone().add(new Vector3(3.6, 2.6, 7.6)) },
      actions: [
        [0.2, (c) => c.setCompile(true)],
        [2.4, (c) => c.prompt('hurting')],
      ],
    },
    // 6. Hold on the heart; hand control back.
    { dur: 8.5, page: true, view: wide, actions: [[0.8, (c) => c.prompt('thanked')]] },
  ];
}

export class Story {
  private list = scenes();
  private index = -1;
  private t = 0;
  private fired = 0;
  /** Seconds since the nib last finished writing (∞ if it hasn't in this scene). */
  private sinceDraw = Infinity;

  constructor(
    private store: Store,
    bus: Bus,
    private ctl: Controller,
    private ui: StoryDisplay,
  ) {
    bus.on('drawStart', () => {
      if (this.running && this.list[this.index].page) this.ctl.view(this.ctl.pageView(), 1.3);
    });
    bus.on('drawEnd', () => (this.sinceDraw = 0));
  }

  get running(): boolean {
    return this.index >= 0;
  }

  get scene(): number {
    return this.index;
  }

  start(): void {
    this.ctl.reset();
    this.ctl.setMode('story');
    this.index = -1;
    this.next();
  }

  /** Skip / exit: hand control back with all three conditions met. */
  stop(): void {
    if (!this.running) return;
    this.index = -1;
    this.ctl.setLock(true);
    this.ctl.setFeed(true);
    this.ctl.setCompile(true);
    this.ctl.setMode('sandbox');
  }

  private next(): void {
    this.index++;
    if (this.index >= this.list.length) {
      this.stop();
      return;
    }
    this.t = 0;
    this.fired = 0;
    this.sinceDraw = Infinity;
    const sc = this.list[this.index];
    this.ctl.view(sc.view, this.index === 0 ? 2.4 : 2.2);
    this.ui.showStory(this.index, S.story.scenes[this.index]);
  }

  update(dt: number): void {
    if (!this.running || this.store.ui.mode !== 'story') return;
    this.t += dt;
    this.sinceDraw += dt;
    const sc = this.list[this.index];
    while (this.fired < sc.actions.length && this.t >= sc.actions[this.fired][0]) {
      sc.actions[this.fired][1](this.ctl);
      this.fired++;
    }
    // Don't cut away mid-stroke: wait for the nib to finish, then hold on the mark.
    if (this.t >= sc.dur && this.store.prompt.phase === 'none' && this.sinceDraw >= HOLD) this.next();
  }
}
