import { Vector3 } from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Controller } from '../app';
import { deriveBeamState } from '../model/beam';
import type { View } from '../scene/CameraRig';
import { LINE_FLIGHT } from '../scene/Messengers';
import { Bus, createStore, type Mode, type Store } from '../state';
import { S } from '../strings';
import { ASSIST_TIMEOUT, HOLD, readingTime, scenes, Story, TASKS, type Copy, type StoryFrame, type TaskKind } from './Story';

const DT = 1 / 60;
const PAGE: View = { position: new Vector3(1, 2, 3), target: new Vector3() };

/**
 * A thin fake controller: records calls, and fakes just enough state. The
 * three conditions follow their toggles at once; a prompt stays in flight
 * until the test lets the nib finish; the line lands LINE_FLIGHT after it is sent.
 */
function fakeController(store: Store, bus: Bus, clock: { now: number; lineDue: number }) {
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
    sendLine: vi.fn(() => (clock.lineDue = clock.now + LINE_FLIGHT)),
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
  let frames: (StoryFrame & { at: number })[];
  const clock = { now: 0, lineDue: Infinity };
  const last = () => frames[frames.length - 1];
  const tick = () => {
    clock.now += DT;
    if (clock.now >= clock.lineDue) {
      clock.lineDue = Infinity;
      bus.emit('lineArrive');
    }
    story.update(DT);
  };
  const run = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds / DT); i++) tick();
  };
  /** Step until `done()` (or give up after `max` seconds); returns the time it took. */
  const until = (done: () => boolean, max = 120) => {
    const t0 = clock.now;
    while (!done() && clock.now - t0 < max) tick();
    return clock.now - t0;
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
    clock.now = 0;
    clock.lineDue = Infinity;
    f = fakeController(store, bus, clock);
    frames = [];
    story = new Story(store, bus, f.ctl, { showStory: (fr) => frames.push({ ...fr, at: clock.now }) });
  });

  it('starts from a reset, in working order, on scene 1 of Act I', () => {
    story.start();
    expect(f.calls.slice(-3)).toEqual(['reset', 'working', 'mode:story']);
    expect(story.scene).toBe(0);
    expect(last().act).toBe(1);
    expect(store.ui.storyAct).toBe(1);
    expect(story.count).toBe(10);
  });

  it('nothing new goes up until the caption on screen has been read', () => {
    story.start();
    const need = readingTime(S().story.s1.caption);
    run(need - 0.2);
    expect(f.spy.prompt).not.toHaveBeenCalled();
    expect(last().quote).toBeNull();
    run(0.4);
    expect(f.spy.prompt).toHaveBeenCalledTimes(1);
    expect(last().quote).not.toBeNull();
  });

  it('never moves on while a prompt is running; then holds on the mark until its caption is read', () => {
    story.start();
    run(60);
    expect(f.spy.prompt).toHaveBeenCalledTimes(1);
    expect(story.scene).toBe(0);
    finishDrawing();
    run(HOLD - 0.2);
    expect(story.scene).toBe(0);
    const waited = until(() => story.scene === 1);
    expect(story.scene).toBe(1);
    expect(waited + HOLD - 0.2).toBeGreaterThanOrEqual(readingTime(S().story.s1.drawing));
  });

  it('the line lands just as it has been read, and Ti shatters when it does', () => {
    story.start(1);
    until(() => f.spy.sendLine.mock.calls.length > 0, 30);
    const sent = clock.now;
    until(() => f.spy.shatter.mock.calls.length > 0, 30);
    expect(clock.now - sent).toBeCloseTo(LINE_FLIGHT, 1);
    // The line went up after the caption was read, and has been read by the time it lands.
    const s = S();
    expect(clock.now).toBeGreaterThanOrEqual(readingTime(s.story.s2.caption) + readingTime(s.story.line) - DT);
    expect(story.scene).toBe(1);
    until(() => story.scene === 2, 30);
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
    expect(last().text).toBe(TASKS[kind].done);
    until(() => story.scene !== index, 30);
    expect(story.scene).toBe(index + 1);
  });

  it('a step done at once is acknowledged at once, but its caption still gets read', () => {
    story.start(6);
    f.dormant();
    run(0.5);
    f.set('se', true, 'feed');
    run(0.1);
    expect(last().ack).toBe(true);
    expect(last().text).not.toBe(TASKS.feed.done);
    const waited = until(() => last().text === TASKS.feed.done, 30);
    expect(waited + 0.6).toBeGreaterThanOrEqual(readingTime(S().story.s7.caption) - DT);
  });

  it('“Do it for …” performs the step: feeding Se', () => {
    story.start(6);
    f.dormant();
    run(1);
    story.assist();
    expect(f.spy.setFeed).toHaveBeenLastCalledWith(true);
    run(0.1);
    expect(last().ack).toBe(false);
    until(() => story.scene === 7, 30);
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
    until(() => story.scene === 6, 30);
    expect(story.scene).toBe(6);
  });

  it('Act III never moves on while the nib is writing', () => {
    story.start(8);
    run(3);
    expect(store.prompt.phase).toBe('incoming');
    run(60);
    expect(story.scene).toBe(8);
    finishDrawing();
    until(() => story.scene !== 8, 30);
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

  it('plays all ten scenes through, every caption up for at least its reading time, and ends in the sandbox', () => {
    story.start();
    while (story.running && clock.now < 600) {
      run(0.1);
      if (store.prompt.phase !== 'none') finishDrawing();
      story.assist();
    }
    expect([...new Set(frames.map((fr) => fr.index))]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(f.spy.prompt).toHaveBeenCalledTimes(4);
    expect(store.ui.mode).toBe('sandbox');

    // Captions the story puts up in Acts I and II (in Act III the user's own actions set the pace).
    let shown = null as { text: Copy; at: number; act: number } | null;
    for (const fr of [...frames, { text: null, at: clock.now, act: 0 }]) {
      if (fr.text === shown?.text) continue;
      if (shown && shown.act < 3) expect(fr.at - shown.at, shown.text(S())).toBeGreaterThanOrEqual(readingTime(shown.text(S())) - DT);
      shown = fr.text ? { text: fr.text, at: fr.at, act: fr.act } : null;
    }
  });
});
