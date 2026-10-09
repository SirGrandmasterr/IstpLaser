/**
 * The single source of truth. Scene objects, the panel, keyboard handlers and
 * the story all read and write this one object; the beam model turns its
 * controls into `beam` once per frame.
 */
import { INITIAL_BEAM_STATE, type BeamState } from './model/beam';
import type { InstrumentId, PromptKind } from './strings';

export type Mode = 'intro' | 'story' | 'sandbox';
export type PromptPhase = 'none' | 'incoming' | 'charging' | 'drawing';

export interface Controls {
  /** Raw Ti alignment 0..1 (1 = sweet spot). Ring angle is derived from it. */
  alignment: number;
  /** Which side of the sweet spot the ring sits on (+1 / −1). */
  tiSide: number;
  /** Animated target for alignment (lock toggle, story); null while the user drives it directly. */
  alignmentTarget: number | null;
  /** Latched lock so that the ring needs a deliberate pull to unlock (hysteresis). */
  tiLatched: boolean;
  /** Steady particle feed for lecture use. */
  feed: boolean;
  /** Ni compile toggle: the standing intent when the reticle is not being dragged. */
  compile: boolean;
  /** Ni drive from reticle interaction this frame (null when not dragging). */
  reticleDrive: number | null;
  /** Ni target on the sheet, metres in sheet-plane coordinates. */
  reticle: { x: number; y: number };
}

export interface PromptState {
  phase: PromptPhase;
  kind: PromptKind | null;
  last: PromptKind;
  /** Seconds since this phase began. */
  t: number;
  /** 0..1 nib progress along the path while drawing. */
  progress: number;
}

export interface UIState {
  mode: Mode;
  labels: boolean;
  muted: boolean;
  focus: InstrumentId | null;
  reducedMotion: boolean;
  panelOpen: boolean;
  /** The story's current act (1–3), 0 outside the story. Act III hands the controls to the user. */
  storyAct: number;
}

export interface Store {
  controls: Controls;
  /** Torque impulse delivered by particle hits since the last model step. */
  torqueAccum: number;
  beam: BeamState;
  prompt: PromptState;
  ui: UIState;
  /** Time since the user last touched anything (for idle camera drift). */
  idleTime: number;
}

export function initialControls(): Controls {
  return {
    alignment: 0,
    tiSide: 1,
    alignmentTarget: null,
    tiLatched: false,
    feed: false,
    compile: false,
    reticleDrive: null,
    reticle: { x: 0, y: 0 },
  };
}

export function createStore(reducedMotion: boolean): Store {
  return {
    controls: initialControls(),
    torqueAccum: 0,
    beam: INITIAL_BEAM_STATE,
    prompt: { phase: 'none', kind: null, last: 'okay', t: 0, progress: 0 },
    ui: { mode: 'intro', labels: true, muted: true, focus: null, reducedMotion, panelOpen: true, storyAct: 0 },
    idleTime: 0,
  };
}

type Listener<T> = (payload: T) => void;

export interface Events {
  tiLock: void;
  tiUnlock: void;
  /** Ti's picture broke at once. */
  shatter: void;
  /** A question left for the other person; its answer lands in Ti later. */
  ask: void;
  answer: void;
  /** The story's line reached Ti. */
  lineArrive: void;
  seHit: void;
  promptStart: PromptKind;
  promptArrive: PromptKind;
  drawStart: PromptKind;
  drawEnd: PromptKind;
  focus: InstrumentId | null;
  mode: Mode;
  ui: void;
  reset: void;
  /** Language or names changed: re-read every string. */
  text: void;
}

/** Tiny typed event bus for one-off moments (sounds, snaps, captions). */
export class Bus {
  private map = new Map<keyof Events, Set<Listener<unknown>>>();
  on<K extends keyof Events>(k: K, fn: Listener<Events[K]>): () => void {
    let set = this.map.get(k);
    if (!set) this.map.set(k, (set = new Set()));
    set.add(fn as Listener<unknown>);
    return () => set!.delete(fn as Listener<unknown>);
  }
  emit<K extends keyof Events>(k: K, ...payload: Events[K] extends void ? [] : [Events[K]]): void {
    this.map.get(k)?.forEach((fn) => fn(payload[0]));
  }
}
