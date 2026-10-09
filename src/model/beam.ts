/**
 * The beam model: the single place where the metaphor is turned into numbers.
 *
 * Pure and deterministic. Given the previous state, this frame's controls and a
 * timestep, it returns the next state. No Three.js, no DOM, so it is unit-tested
 * in isolation (see beam.test.ts).
 *
 *   A  Ti alignment          user control, snaps to 1 at ≥ TI_LOCK
 *   T  Se torque             simulated: particle impulses in, friction out
 *   D  Ni compiled direction user intent, gated by Ti coherence and Se energy
 *
 *   C = smoothstep(A)        coherence
 *   E = residual + T         energy (always faintly visible)
 *   F = D · C                focus (never exceeds coherence)
 *   authenticity = C · E · F
 */

export const TI_LOCK = 0.85;
export const SE_STARVE = 0.25;
export const NI_PRIMED = 0.6;
/** Ni has no direction at all: no intent left, barrel flat. */
export const NI_FLAT = 0.02;
export const E_RESIDUAL = 0.06;

/** Se friction: dT/dt = −(k·T + c). From full spin it halts in ≈ 3.8 s. */
export const SE_FRICTION_K = 0.45;
export const SE_FRICTION_C = 0.1;

/** Ni intent: ≈ 1 s of holding still compiles a direction; moving scatters it. */
export const NI_COMPILE_RATE = 1.0;
export const NI_SCATTER_RATE = 0.8;
/** How fast the realised direction D follows its gated target (per second). */
export const NI_EXTEND_RATE = 1.1;
export const NI_SAG_RATE = 0.8;

export type OutputMode = 'scribble' | 'groove' | 'puddle' | 'heart';

export interface BeamControls {
  /** Raw Ti alignment from the tuning ring or slider, 0..1 (1 = sweet spot). */
  alignment: number;
  /** Angular impulse delivered to the Se ring by particle hits since the last step. */
  torqueImpulse: number;
  /**
   * Ni drive, −1..1. Positive compiles a direction (reticle held still, or the
   * "compile" toggle on); negative scatters it (reticle moving, toggle off).
   */
  directionDrive: number;
}

/** How much of each output character is present. Always sums to 1. */
export interface OutputWeights {
  scribble: number;
  groove: number;
  puddle: number;
  heart: number;
}

export interface BeamState {
  /** Effective Ti alignment (after the lock snap). */
  A: number;
  /** Se normalised angular velocity. */
  T: number;
  /** Ni intent: what the person is trying to aim at, before gating. */
  intent: number;
  /** Ni realised direction (the barrel extension). */
  D: number;
  C: number;
  E: number;
  F: number;
  authenticity: number;
  tiLocked: boolean;
  seStarved: boolean;
  niPrimed: boolean;
  /** Ni's ceiling right now, from Ti coherence × Se energy (0..1). */
  niGate: number;
  /** Ti unlocked, Se starved and Ni without a direction, all at once. */
  dormant: boolean;
  /** The first failure along the beam decides the character. */
  output: OutputMode;
  weights: OutputWeights;
}

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function approach(current: number, target: number, upRate: number, downRate: number, dt: number): number {
  if (current < target) return Math.min(target, current + upRate * dt);
  return Math.max(target, current - downRate * dt);
}

/** Ti snaps into a rigid lock at the threshold. */
export function effectiveAlignment(raw: number): number {
  const a = clamp01(raw);
  return a >= TI_LOCK ? 1 : a;
}

/** Se's contribution to Ni's ceiling: fades out around the starvation threshold. */
export function seGate(T: number): number {
  return smoothstep(SE_STARVE - 0.08, SE_STARVE + 0.1, T);
}

/**
 * Continuous mix of output characters. Each stage has a "pass" score; the first
 * stage that fails claims the remaining weight, so earlier failures dominate and
 * later ones only modify.
 *
 * Ti's pass is C³ so the character stays a scribble until Ti is nearly locked.
 */
export function outputWeights(C: number, T: number, F: number): OutputWeights {
  const pTi = C * C * C;
  const pSe = seGate(T);
  const pNi = smoothstep(0.25, 0.9, F);
  return {
    scribble: 1 - pTi,
    groove: pTi * (1 - pSe),
    puddle: pTi * pSe * (1 - pNi),
    heart: pTi * pSe * pNi,
  };
}

export function classifyOutput(tiLocked: boolean, seStarved: boolean, niPrimed: boolean): OutputMode {
  if (!tiLocked) return 'scribble';
  if (seStarved) return 'groove';
  if (!niPrimed) return 'puddle';
  return 'heart';
}

/** Everything that can be derived from A, T, intent and D without integrating time. */
export function deriveBeamState(A: number, T: number, intent: number, D: number): BeamState {
  const C = smoothstep(0, 1, A);
  const E = E_RESIDUAL + (1 - E_RESIDUAL) * clamp01(T);
  const F = clamp01(D) * C;
  const tiLocked = A >= 1;
  const seStarved = T < SE_STARVE;
  const niPrimed = D >= NI_PRIMED;
  const niFlat = intent <= NI_FLAT && D <= NI_FLAT;
  return {
    A,
    T,
    intent,
    D,
    C,
    E,
    F,
    authenticity: C * E * F,
    tiLocked,
    seStarved,
    niPrimed,
    niGate: C * seGate(T),
    dormant: !tiLocked && seStarved && niFlat,
    output: classifyOutput(tiLocked, seStarved, niPrimed),
    weights: outputWeights(C, T, F),
  };
}

export const INITIAL_BEAM_STATE: BeamState = deriveBeamState(0, 0, 0, 0);

/**
 * Advance the beam model by `dt` seconds.
 *
 * Ni gating: the realised direction D chases `intent × C × seGate(T)`. Without a
 * coherent beam from Ti it cannot telescope fully; without energy from Se it
 * sags back toward the pancake. Intent itself survives a sag, so Ni re-extends
 * as soon as the upstream conditions return.
 */
export function computeBeamState(
  controls: BeamControls,
  dt: number,
  prev: BeamState = INITIAL_BEAM_STATE,
): BeamState {
  const step = Math.max(0, Math.min(dt, 0.1));

  const A = effectiveAlignment(controls.alignment);

  // Se: impulses in, friction out (linear drag plus a little dry friction).
  let T = prev.T + Math.max(0, controls.torqueImpulse);
  T -= (SE_FRICTION_K * T + SE_FRICTION_C) * step;
  T = clamp01(T);

  // Ni: intent compiles or scatters from the drive…
  const drive = Math.max(-1, Math.min(1, controls.directionDrive));
  const intent = clamp01(prev.intent + drive * (drive > 0 ? NI_COMPILE_RATE : NI_SCATTER_RATE) * step);

  // …and the realised direction follows the gated target.
  const C = smoothstep(0, 1, A);
  const target = intent * C * seGate(T);
  const D = approach(prev.D, target, NI_EXTEND_RATE, NI_SAG_RATE, step);

  return deriveBeamState(A, T, intent, D);
}
