import { Vector3 } from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Controller } from '../app';
import { deriveBeamState } from '../model/beam';
import type { View } from '../scene/CameraRig';
import { Bus, createStore, type Mode, type Store } from '../state';
import { ASSIST_TIMEOUT, HOLD, scenes, Story, type StoryFrame, type TaskKind } from './Story';

const DT = 1 / 60;
const PAGE: View = { position: new Vector3(1, 2, 3), target: new Vector3() };

/**
 * A thin fake controller: records calls, and fakes just enough state. The
 * three conditions follow their toggles at once; a prompt stays in flight
 * until the test lets the nib finish.
 */
function fakeController(store: Store, bus: Bus) {
  const calls: string[] = [];
  const on = { ti: false, se: false, ni: false };
  const apply = () => (store.beam = deriveBeamState(on.ti ? 1 : 0, on.se ? 1 : 0, on.ni ? 1 : 0, on.ni ? 1 : 0));
  const set = (k: keyof typeof on, v: boolean, name: string) => {
    on[k] = v;
    apply();
    calls.push(`${name}:${v}`);
  };
  const ctl = {
    reset: vi.fn(() => {
      set('ti', false, 'lock');
      set('se', false, 'feed');
      set('ni', false, 'compile');
      calls.push('reset');
    }),
    setWorking: vi.fn(() => {
      on.ti = on.se = on.ni = true;
      apply();
      calls.push('working');
    }),
    setMode: vi.fn((m: Mode) => {
      store.ui.mode = m;
      calls.push(`mode:${m}`);
    }),
    view: vi.fn(),
    pageView: vi.fn(() => PAGE),
    prompt: vi.fn(() => (store.prompt.phase = 'incoming')),
    setLock: vi.fn((v: boolean) => set('ti', v, 'lock')),
    setFeed: vi.fn((v: boolean) => set('se', v, 'feed')),
    setCompile: vi.fn((v: boolean) => set('ni', v, 'compile')),
    shatter: vi.fn(() => set('ti', false, 'shatter')),
    sendLine: vi.fn(),
    // Questions go out, but the fake never answers: only a lock or the assist timeout ends the step.
    ask: vi.fn(() => {
      bus.emit('ask');
      return true;
    }),
    asking: false,
  };
  /** Ti unlocked, Se starved, Ni flat: how Act III begins. */
  const dormant = () => {
    on.ti = on.se = on.ni = false;
    apply();
  };
  return { ctl: ctl as unknown as Controller, spy: ctl, calls, set, dormant };
}

describe('Story sequencing', () => {
  let store: Store;
  let bus: Bus;
  let story: Story;
  let f: ReturnType<typeof fakeController>;
  let frames: StoryFrame[];
  const last = () => frames[frames.length - 1];
  const run = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds / DT); i++) story.update(DT);
  };
  /** The nib writes and finishes. */
  const finishDrawing = () => {
    bus.emit('drawStart', 'okay');
    store.prompt.phase = 'none';
    bus.emit('drawEnd', 'okay');
  };

  beforeEach(() => {
    store = createStore(false);
    bus = new Bus();
    f = fakeController(store, bus);
    frames = [];
    story = new Story(store, bus, f.ctl, { showStory: (fr) => frames.push(fr) });
  });

  it('starts from a reset, in working order, on scene 1 of Act I', () => {
    story.start();
    expect(f.calls.slice(-3)).toEqual(['reset', 'working', 'mode:story']);
    expect(story.scene).toBe(0);
    expect(last().act).toBe(1);
    expect(store.ui.storyAct).toBe(1);
    expect(story.count).toBe(10);
  });

  it('Acts I and II advance on time, but never while a prompt is running; then they hold on the mark', () => {
    story.start();
    run(scenes()[0].min + 6); // the prompt fired at 3 s and is still in flight
    expect(f.spy.prompt).toHaveBeenCalledTimes(1);
    expect(story.scene).toBe(0);
    finishDrawing();
    run(HOLD - 0.2);
    expect(story.scene).toBe(0);
    run(0.4);
    expect(story.scene).toBe(1);
  });

  it('a scene without a prompt advances after its time (the shatter comes on the line, or soon after)', () => {
    story.start(1);
    run(scenes()[1].min - 0.2);
    expect(f.spy.shatter).toHaveBeenCalledTimes(1);
    expect(story.scene).toBe(1);
    run(0.4);
    expect(story.scene).toBe(2);
  });

  it('cuts to the page when the nib starts writing', () => {
    story.start();
    f.spy.view.mockClear();
    bus.emit('drawStart', 'okay');
    expect(f.spy.view).toHaveBeenCalledWith(PAGE, expect.any(Number));
  });

  const repairs: [number, TaskKind, () => void][] = [
    [5, 'ask', () => f.set('ti', true, 'lock')],
    [6, 'feed', () => f.set('se', true, 'feed')],
    [7, 'compile', () => f.set('ni', true, 'compile')],
  ];

  it.each(repairs)('Act III scene %i waits for its condition (%s), then acknowledges the user', (index, kind, fix) => {
    story.start(index);
    f.dormant();
    run(60);
    expect(story.scene).toBe(index);
    expect(last().act).toBe(3);
    expect(last().task?.kind).toBe(kind);
    fix();
    run(0.1);
    expect(last().task).toBeNull();
    expect(last().ack).toBe(true);
    run(4);
    expect(story.scene).toBe(index + 1);
  });

  it('“Do it for …” performs the step: feeding Se', () => {
    story.start(6);
    f.dormant();
    run(1);
    story.assist();
    expect(f.spy.setFeed).toHaveBeenLastCalledWith(true);
    run(0.1);
    expect(last().ack).toBe(false);
    run(4);
    expect(story.scene).toBe(7);
  });

  it('“Do it for …” keeps asking, shows the questions, and moves on even if no answer locks Ti', () => {
    story.start(5);
    f.dormant();
    story.assist();
    run(1);
    expect(f.spy.ask).toHaveBeenCalled();
    expect(last().quote).not.toBeNull();
    run(ASSIST_TIMEOUT);
    expect(f.spy.setLock).toHaveBeenLastCalledWith(true);
    run(4);
    expect(story.scene).toBe(6);
  });

  it('Act III never moves on while the nib is writing', () => {
    story.start(8);
    run(1);
    expect(store.prompt.phase).toBe('incoming');
    run(30);
    expect(story.scene).toBe(8);
    finishDrawing();
    run(HOLD + 0.2);
    expect(story.scene).toBe(9);
  });

  it.each(scenes().map((_, i) => i))('skip from scene %i ends in the sandbox with all three conditions met', (index) => {
    story.start(index);
    f.dormant();
    run(2);
    story.stop();
    expect(f.calls.slice(-4)).toEqual(['lock:true', 'feed:true', 'compile:true', 'mode:sandbox']);
    expect(store.beam.tiLocked && !store.beam.seStarved && store.beam.niPrimed).toBe(true);
    expect(story.running).toBe(false);
    expect(store.ui.storyAct).toBe(0);
  });

  it('plays all ten scenes through and ends in the sandbox', () => {
    story.start();
    for (let i = 0; i < 2000 && story.running; i++) {
      run(0.1);
      if (store.prompt.phase !== 'none') finishDrawing();
      story.assist();
    }
    expect([...new Set(frames.map((fr) => fr.index))]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(f.spy.prompt).toHaveBeenCalledTimes(4);
    expect(store.ui.mode).toBe('sandbox');
  });
});
