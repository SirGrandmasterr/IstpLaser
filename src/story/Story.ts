/**
 * Guided story: six captioned scenes, each with its own camera framing and a
 * timeline of actions on the same controls the user has. Ends by handing
 * control back with all three conditions met.
 */
import { Vector3 } from 'three';
import type { Controller } from '../app';
import { HOME, type View } from '../scene/CameraRig';
import { NI_POS, SE_POS, sheetToWorld, TI_POS } from '../scene/layout';
import type { Bus, Store } from '../state';
import { S } from '../strings';
import type { UI } from '../ui/UI';

interface Scene {
  dur: number;
  view: View;
  actions: [number, (c: Controller) => void][];
}

const v = (target: Vector3, offset: Vector3): View => ({ target, position: target.clone().add(offset) });
const mid = (...p: Vector3[]) => p.reduce((a, b) => a.clone().add(b)).multiplyScalar(1 / p.length);

function scenes(): Scene[] {
  const sheet = sheetToWorld(0, 0);
  return [
    // 1. Idle, all off: Ti loops the beam inside itself.
    { dur: 8.5, view: v(TI_POS.clone().add(new Vector3(0.6, -0.4, 0)), new Vector3(3.2, 2.4, 9)), actions: [] },
    // 2. A prompt with Ti off: burn-scribble.
    {
      dur: 9.5,
      view: v(mid(TI_POS, sheet).add(new Vector3(0.4, -0.2, 0)), new Vector3(3.6, 5.2, 13.4)),
      actions: [[0.6, (c) => c.prompt('okay')]],
    },
    // 3. Ti locks, Se starved: the beam dies in Ni; dry groove.
    {
      dur: 10,
      view: v(mid(TI_POS, NI_POS, sheet).add(new Vector3(0, 0.2, 0)), new Vector3(2.6, 4.2, 11.5)),
      actions: [
        [0.3, (c) => c.setLock(true)],
        [3.4, (c) => c.prompt('hurting')],
      ],
    },
    // 4. Particles arrive, ring spins up, Ni still flat: pink wash.
    {
      dur: 10,
      view: v(mid(SE_POS, sheet).add(new Vector3(0, 0.3, 0)), new Vector3(3.4, 3.8, 10.5)),
      actions: [
        [0.2, (c) => c.setFeed(true)],
        [3.4, (c) => c.prompt('okay')],
      ],
    },
    // 5. Ni telescopes: heart.
    {
      dur: 10,
      view: v(mid(NI_POS, sheet).add(new Vector3(-0.2, 0.3, 0)), new Vector3(2.6, 3.4, 8.6)),
      actions: [
        [0.2, (c) => c.setCompile(true)],
        [2.6, (c) => c.prompt('hurting')],
      ],
    },
    // 6. Hold on the heart; hand control back.
    { dur: 8.5, view: HOME, actions: [[0.8, (c) => c.prompt('thanked')]] },
  ];
}

export class Story {
  private list = scenes();
  private index = -1;
  private t = 0;
  private fired = 0;

  constructor(
    private store: Store,
    bus: Bus,
    private ctl: Controller,
    private ui: UI,
  ) {
    void bus;
  }

  get running(): boolean {
    return this.index >= 0;
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
    const sc = this.list[this.index];
    this.ctl.view(sc.view, this.index === 0 ? 2.4 : 2.2);
    this.ui.showStory(this.index, S.story.scenes[this.index]);
  }

  update(dt: number): void {
    if (!this.running || this.store.ui.mode !== 'story') return;
    this.t += dt;
    const sc = this.list[this.index];
    while (this.fired < sc.actions.length && this.t >= sc.actions[this.fired][0]) {
      sc.actions[this.fired][1](this.ctl);
      this.fired++;
    }
    // Don't cut away mid-stroke: wait for the nib to finish before moving on.
    if (this.t >= sc.dur && this.store.prompt.phase === 'none') this.next();
  }
}
