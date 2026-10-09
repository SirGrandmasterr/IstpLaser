import { Vector3 } from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Controller } from '../app';
import type { View } from '../scene/CameraRig';
import { Bus, createStore, type Mode, type Store } from '../state';
import { HOLD, scenes, Story } from './Story';

const DT = 1 / 60;
const PAGE: View = { position: new Vector3(1, 2, 3), target: new Vector3() };

/** A controller that records calls and fakes just enough state for the story. */
function fakeController(store: Store) {
  const calls: string[] = [];
  const ctl = {
    reset: vi.fn(() => calls.push('reset')),
    setMode: vi.fn((m: Mode) => {
      store.ui.mode = m;
      calls.push(`mode:${m}`);
    }),
    view: vi.fn(),
    pageView: vi.fn(() => PAGE),
    // A prompt starts something the story has to wait for.
    prompt: vi.fn(() => (store.prompt.phase = 'incoming')),
    setLock: vi.fn((on: boolean) => calls.push(`lock:${on}`)),
    setFeed: vi.fn((on: boolean) => calls.push(`feed:${on}`)),
    setCompile: vi.fn((on: boolean) => calls.push(`compile:${on}`)),
  };
  return { ctl: ctl as unknown as Controller, spy: ctl, calls };
}

describe('Story sequencing', () => {
  let store: Store;
  let bus: Bus;
  let story: Story;
  let f: ReturnType<typeof fakeController>;
  const shown: number[] = [];
  const run = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds / DT); i++) story.update(DT);
  };

  beforeEach(() => {
    store = createStore(false);
    bus = new Bus();
    f = fakeController(store);
    shown.length = 0;
    story = new Story(store, bus, f.ctl, { showStory: (i) => shown.push(i) });
    story.start();
  });

  it('starts from a reset, in story mode, on scene 1', () => {
    expect(f.calls.slice(0, 2)).toEqual(['reset', 'mode:story']);
    expect(story.scene).toBe(0);
    expect(shown).toEqual([0]);
  });

  it('a scene without a prompt advances after its duration', () => {
    const dur = scenes()[0].dur;
    run(dur - 0.1);
    expect(story.scene).toBe(0);
    run(0.2);
    expect(story.scene).toBe(1);
  });

  it('never cuts away while a prompt is still running, and holds on the finished mark', () => {
    run(scenes()[0].dur + 0.05); // scene 2: a prompt fires at 0.6 s
    expect(story.scene).toBe(1);
    run(1);
    expect(f.spy.prompt).toHaveBeenCalledTimes(1);
    expect(store.prompt.phase).not.toBe('none');

    // Long past the scene's duration: still waiting for the nib.
    run(scenes()[1].dur + 5);
    expect(story.scene).toBe(1);

    // The nib finishes; the story holds on the mark for HOLD seconds, then moves on.
    store.prompt.phase = 'none';
    bus.emit('drawEnd', 'okay');
    run(HOLD - 0.2);
    expect(story.scene).toBe(1);
    run(0.4);
    expect(story.scene).toBe(2);
  });

  it('cuts to the page when the nib starts writing', () => {
    run(scenes()[0].dur + 0.05);
    f.spy.view.mockClear();
    bus.emit('drawStart', 'okay');
    expect(f.spy.pageView).toHaveBeenCalled();
    expect(f.spy.view).toHaveBeenCalledWith(PAGE, expect.any(Number));
  });

  it('every scene in which the nib writes cuts to the page', () => {
    for (const sc of scenes()) {
      const writes = sc.actions.length > 0 && sc.actions.some(([, act]) => act.toString().includes('prompt'));
      expect(sc.page).toBe(writes);
    }
  });

  it('skip hands control back with all three conditions met', () => {
    story.stop();
    expect(f.calls).toEqual(expect.arrayContaining(['lock:true', 'feed:true', 'compile:true', 'mode:sandbox']));
    expect(story.running).toBe(false);
    run(30);
    expect(shown).toEqual([0]);
  });

  it('runs all six scenes and ends in the sandbox', () => {
    for (let i = 0; i < 6; i++) {
      run(12);
      if (store.prompt.phase !== 'none') {
        store.prompt.phase = 'none';
        bus.emit('drawEnd', 'okay');
        run(HOLD + 0.1);
      }
    }
    expect(shown).toEqual([0, 1, 2, 3, 4, 5]);
    expect(story.running).toBe(false);
    expect(store.ui.mode).toBe('sandbox');
  });
});
