/**
 * How the nib writes, given the beam. Pure: maps a BeamState to brush parameters
 * that Sheet.ts turns into pixels.
 *
 * The four output characters are presets; the beam's output weights blend them
 * (so the first failure dominates), then the continuous conditions modify the
 * result: jitter from 1 − C, softness and width from 1 − F, brightness and
 * saturation from E.
 */
import type { BeamState, OutputWeights } from './beam';
import { clamp01 } from './beam';

export interface StrokeStyle {
  /** Linear-ish RGB, 0..1. */
  color: [number, number, number];
  /** Opacity of the core line. */
  alpha: number;
  /** Core width in canvas pixels (on a 1024² sheet). */
  width: number;
  /** 0 = crisp line, 1 = all soft halo, no edge. */
  softness: number;
  /** Position jitter as a fraction of the heart's size. */
  jitter: number;
  /** Offset of the whole mark away from the aimed point, fraction of heart size. */
  offAxis: number;
  /** Sparks per second thrown off by the nib. */
  sparks: number;
  /** Fraction of the path that actually leaves a mark (scratchy dry nib < 1). */
  coverage: number;
  /** Additive glow strength around the line. */
  glow: number;
  /** Seconds the nib takes to trace the path. */
  duration: number;
  /** How much the mark darkens the paper itself (burn, scratch), 0..1. */
  ink: number;
  /** Ink colour: 0 = grey scratch, 1 = charcoal burn. */
  inkTone: number;
}

type Preset = Omit<StrokeStyle, 'color'> & { color: [number, number, number] };

export const PRESETS: Record<keyof OutputWeights, Preset> = {
  // Ti off: jagged, dark, off-axis burn with sparks.
  scribble: {
    color: [0.95, 0.26, 0.06],
    alpha: 0.95,
    width: 4,
    softness: 0.1,
    jitter: 0.32,
    offAxis: 0.45,
    sparks: 40,
    coverage: 1,
    glow: 0.35,
    duration: 2.2,
    ink: 0.85,
    inkTone: 1,
  },
  // Se starved: faint, dry, colourless scratch.
  groove: {
    color: [0.62, 0.62, 0.64],
    alpha: 0.4,
    width: 2.4,
    softness: 0.0,
    jitter: 0.03,
    offAxis: 0.05,
    sparks: 0,
    coverage: 0.55,
    glow: 0.0,
    duration: 4.2,
    ink: 0.7,
    inkTone: 0,
  },
  // Ni flat: washed-out pink puddle of light, no edges.
  puddle: {
    color: [1.0, 0.6, 0.8],
    alpha: 0.38,
    width: 36,
    softness: 1.0,
    jitter: 0.08,
    offAxis: 0.0,
    sparks: 0,
    coverage: 1,
    glow: 0.4,
    duration: 3.6,
    ink: 0,
    inkTone: 0,
  },
  // All three: smooth, vibrant, glowing pink heart.
  heart: {
    color: [1.0, 0.24, 0.62],
    alpha: 1.0,
    width: 12,
    softness: 0.05,
    jitter: 0.0,
    offAxis: 0.0,
    sparks: 0,
    coverage: 1,
    glow: 1.0,
    duration: 3.4,
    ink: 0,
    inkTone: 0,
  },
};

const KEYS = ['scribble', 'groove', 'puddle', 'heart'] as const;

function blend(weights: OutputWeights, pick: (p: Preset) => number): number {
  let sum = 0;
  for (const k of KEYS) sum += weights[k] * pick(PRESETS[k]);
  return sum;
}

function saturate(rgb: [number, number, number], s: number): [number, number, number] {
  const l = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  return [l + (rgb[0] - l) * s, l + (rgb[1] - l) * s, l + (rgb[2] - l) * s];
}

export function strokeStyleFor(beam: BeamState): StrokeStyle {
  const w = beam.weights;
  const color: [number, number, number] = [
    blend(w, (p) => p.color[0]),
    blend(w, (p) => p.color[1]),
    blend(w, (p) => p.color[2]),
  ];

  // E: brightness and saturation.
  const sat = 0.15 + 0.85 * clamp01((beam.E - 0.1) / 0.7);
  const bright = 0.3 + 0.7 * clamp01(beam.E / 0.8);
  const c = saturate(color, sat).map((v) => clamp01(v * bright)) as [number, number, number];

  // C: jitter. F: softness and width.
  const jitter = blend(w, (p) => p.jitter) + 0.08 * (1 - beam.C);
  const softness = clamp01(blend(w, (p) => p.softness) + 0.25 * (1 - beam.F) * (1 - w.scribble - w.groove));
  const width = blend(w, (p) => p.width) * (1 + 0.6 * (1 - beam.F) * w.puddle);

  return {
    color: c,
    alpha: blend(w, (p) => p.alpha),
    width,
    softness,
    jitter,
    offAxis: blend(w, (p) => p.offAxis) * (1 - beam.C),
    // Later conditions modify: more energy, hotter scribble.
    sparks: blend(w, (p) => p.sparks) * (0.4 + 0.6 * beam.E),
    coverage: blend(w, (p) => p.coverage),
    glow: blend(w, (p) => p.glow) * beam.E,
    duration: blend(w, (p) => p.duration),
    ink: blend(w, (p) => p.ink),
    inkTone: w.scribble + w.groove > 1e-6 ? w.scribble / (w.scribble + w.groove) : 0,
  };
}

export function luminance(rgb: [number, number, number]): number {
  return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
}

export function saturation(rgb: [number, number, number]): number {
  const max = Math.max(...rgb);
  const min = Math.min(...rgb);
  return max <= 0 ? 0 : (max - min) / max;
}
