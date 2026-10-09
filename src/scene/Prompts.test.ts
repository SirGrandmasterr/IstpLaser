import { Scene, Texture, Vector3 } from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deriveBeamState } from '../model/beam';
import { Bus, createStore } from '../state';
import type { PromptKind } from '../strings';
import { Prompts } from './Prompts';
import type { Sheet } from './Sheet';
import type { Source } from './Source';

// Canvas textures need a DOM; the sequencing doesn't.
vi.mock('./textures', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./textures')>()),
  glowTexture: () => new Texture(),
}));

const DT = 1 / 60;
const heart = deriveBeamState(1, 1, 1, 1);

function setup() {
  const store = createStore(false);
  const bus = new Bus();
  const events: string[] = [];
  bus.on('promptStart', (k) => events.push(`start:${k}`));
  bus.on('promptArrive', (k) => events.push(`arrive:${k}`));
  bus.on('drawStart', (k) => events.push(`draw:${k}`));
  bus.on('drawEnd', (k) => events.push(`end:${k}`));
  const sheet = {
    begin: vi.fn(),
    end: vi.fn(),
    drawTo: vi.fn((_u: number, _s: unknown, _dt: number, out: Vector3) => out),
  };
  const source = { intake: new Vector3(-8, 6, 0) };
  const prompts = new Prompts(new Scene(), source as unknown as Source, sheet as unknown as Sheet, store, bus);
  const run = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds / DT); i++) prompts.update(DT, heart);
  };
  /** Step until the current prompt has finished writing (or give up). */
  const finish = () => {
    const ends = events.filter((e) => e.startsWith('end:')).length;
    for (let i = 0; i < 60 * 20 && events.filter((e) => e.startsWith('end:')).length === ends; i++) prompts.update(DT, heart);
  };
  return { store, events, sheet, prompts, run, finish };
}

describe('Prompts sequencing', () => {
  let s: ReturnType<typeof setup>;
  beforeEach(() => (s = setup()));

  it('runs incoming → charging → drawing → none, in that order', () => {
    s.prompts.trigger('okay');
    expect(s.store.prompt.phase).toBe('incoming');
    s.run(1.9);
    expect(s.store.prompt.phase).toBe('incoming');
    s.run(0.2);
    expect(s.store.prompt.phase).toBe('charging');
    s.run(0.6);
    expect(s.store.prompt.phase).toBe('drawing');
    expect(s.sheet.begin).toHaveBeenCalledTimes(1);
    s.finish();
    expect(s.store.prompt.phase).toBe('none');
    expect(s.sheet.end).toHaveBeenCalledTimes(1);
    expect(s.events).toEqual(['start:okay', 'arrive:okay', 'draw:okay', 'end:okay']);
  });

  it('one prompt at a time: requests while busy are queued, and the latest wins', () => {
    s.prompts.trigger('okay');
    s.run(0.5);
    s.prompts.trigger('hurting');
    s.run(3);
    s.prompts.trigger('thanked'); // replaces 'hurting' in the queue
    expect(s.store.prompt.kind).toBe('okay');
    s.finish();
    // The queued one starts as soon as the first has finished writing.
    expect(s.store.prompt.phase).toBe('incoming');
    expect(s.store.prompt.kind).toBe('thanked');
    s.finish();
    expect(s.store.prompt.phase).toBe('none');
    const starts = s.events.filter((e) => e.startsWith('start:'));
    expect(starts).toEqual(['start:okay', 'start:thanked']);
  });

  it('remembers the latest request for Space, even when it was only queued', () => {
    s.prompts.trigger('okay');
    s.prompts.trigger('hurting');
    expect(s.store.prompt.last).toBe<PromptKind>('hurting');
  });

  it('cancel drops the current prompt and anything queued', () => {
    s.prompts.trigger('okay');
    s.run(2.8); // drawing
    expect(s.store.prompt.phase).toBe('drawing');
    s.prompts.trigger('hurting');
    s.prompts.cancel();
    expect(s.store.prompt.phase).toBe('none');
    expect(s.sheet.end).toHaveBeenCalled();
    s.run(5);
    expect(s.store.prompt.phase).toBe('none');
  });
});
