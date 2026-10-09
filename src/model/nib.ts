/**
 * What actually reaches the nib. Pure, so the "dead nib" of the Ti–Ni loop is
 * unit-tested rather than left to whatever the scene happens to do.
 */
import { SE_STARVE, seGate, smoothstep, type BeamState } from './beam';

/**
 * Share of the beam that makes it out of Ni. A coherent beam needs Se's energy
 * or it dies inside Ni; an off-axis stray from an unaligned Ti bypasses Ni.
 */
export function niSurvival(C: number, T: number): number {
  return 1 - C + C * seGate(T);
}

/** Energy arriving at the nib: what survives Ni, times the beam's energy. */
export function arrivingEnergy(beam: Pick<BeamState, 'C' | 'T' | 'E'>): number {
  return niSurvival(beam.C, beam.T) * beam.E;
}

/**
 * How lit the nib is, 0..1, given the energy that arrives and how hard it is
 * pressed (actuation). Below starvation the nib is dead whatever the pressure:
 * no glow, no light, no spark.
 */
export function nibIntensity(energy: number, actuation: number): number {
  return actuation * smoothstep(SE_STARVE, SE_STARVE + 0.35, energy);
}
