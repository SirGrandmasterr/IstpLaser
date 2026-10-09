import type { Group, Object3D, Vector3 } from 'three';
import type { BeamState } from '../model/beam';
import type { InstrumentId } from '../strings';

/** Everything an instrument needs to animate itself this frame. */
export interface FrameContext {
  time: number;
  dt: number;
  beam: BeamState;
  reducedMotion: boolean;
  /** Ti ring angle (radians, 0 = sweet spot) as displayed. */
  tiRingAngle: number;
  /** Ni barrel extension after its spring (may overshoot 1 slightly). */
  niExtension: number;
  /** Fe actuation 0..1 (pressure on the nib). */
  actuation: number;
  /** Source brightness boost from an arriving prompt, 0..1. */
  sourceBoost: number;
  /** Where the nib is currently steering the beam (world). */
  drawPoint: Vector3;
  /** Where Ni is aiming (world, on the sheet). */
  aimPoint: Vector3;
  drawing: boolean;
  /** How much the stroke being written is a dry score (no light arrives; the ball must touch the paper). */
  nibContact: number;
}

export interface Instrument {
  readonly id: InstrumentId;
  readonly group: Group;
  /** Meshes that a click should resolve to this instrument. */
  readonly pickables: Object3D[];
  /** World point on the instrument's rim where its plate's leader line starts. */
  readonly labelAnchor: Vector3;
  /** Camera framing when focused. */
  readonly view: { position: Vector3; target: Vector3 };
  update(ctx: FrameContext): void;
}
