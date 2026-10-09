/**
 * The path the nib traces, in heart units (the heart spans roughly [-1, 1] on
 * both axes), before the mark's size, centre and off-axis throw are applied.
 * Pure and deterministic for a given seed and frame, so its shape is testable.
 *
 *   jitter  gentle wobble and zigzag from Ti's lack of coherence (1 − C)
 *   scrawl  how far the heart breaks into a burn-scribble: only part of the
 *           path is traced, with reversals, overshoots, big jagged teeth and
 *           jumps where the nib lifts and lands somewhere else
 */
import { clamp01 } from './beam';
import { hashNoise, heartPoint, valueNoise } from './heart';

export interface PathOptions {
  jitter: number;
  scrawl: number;
  seed: number;
  /** Frame counter: adds frame-to-frame chatter to a jittery nib. */
  frame: number;
}

export interface PathPoint {
  x: number;
  y: number;
  /** Changes when the nib lifts and lands elsewhere: don't connect across it. */
  seg: number;
}

/** A scrawl is thrown in this many disconnected pieces. */
export const SCRAWL_PIECES = 5;
/** Below this the mark is still one continuous stroke. */
const BREAK_AT = 0.3;
const TEETH = 26;

const unit = (n: number) => hashNoise(n) * 0.5 + 0.5;

export function strokePath(u: number, o: PathOptions, out: PathPoint = { x: 0, y: 0, seg: 0 }): PathPoint {
  const s = clamp01(o.scrawl);
  const seed = o.seed;

  // Only part of the path is traced, and the nib keeps doubling back on itself:
  // the oscillation's slope (0.08 · 2π · 5.5 ≈ 2.8) beats the forward rate.
  const start = s * 0.6 * unit(seed * 3.1);
  const span = 1 - 0.5 * s;
  const param =
    start + u * span + s * (0.08 * Math.sin(u * Math.PI * 2 * 5.5 + seed) + 0.05 * valueNoise(u * 13, seed + 7));
  const hp = heartPoint(param);

  // Thrown in pieces: each one rotated, stretched and shoved somewhere else.
  const seg = s > BREAK_AT ? Math.min(SCRAWL_PIECES - 1, Math.floor(u * SCRAWL_PIECES)) : 0;
  const h = (k: number) => hashNoise(seed * 17.3 + seg * 5.7 + k * 1.31);
  const rot = s * (0.7 * hashNoise(seed * 2.3) + 0.6 * h(1));
  const sx = 1 + s * 0.6 * h(2);
  const sy = 1 + s * 0.6 * h(3);
  let x = hp.x * sx;
  let y = hp.y * sy;
  const c = Math.cos(rot);
  const sn = Math.sin(rot);
  const rx = x * c - y * sn;
  const ry = x * sn + y * c;
  x = rx + s * 0.75 * h(4);
  y = ry + s * 0.6 * h(5);

  // Big, uneven teeth (sharp triangle wave); now and then one overshoots.
  const tu = u * TEETH;
  const tooth = Math.floor(tu);
  const tri = 1 - 4 * Math.abs(tu - tooth - 0.5);
  const amp = 0.16 + 0.5 * Math.pow(unit(tooth * 3.7 + seed), 3);
  const ang = hashNoise(tooth * 1.9 + seed * 0.7) * Math.PI;
  x += s * amp * tri * Math.cos(ang);
  y += s * amp * tri * Math.sin(ang);
  // Chatter: the nib never quite settles from one frame to the next.
  x += s * 0.07 * hashNoise(o.frame * 1.37 + seed);
  y += s * 0.07 * hashNoise(o.frame * 2.11 + seed);

  // Gentle wobble and fine zigzag from (1 − C), as for any less-than-locked Ti.
  const j = o.jitter;
  const wob = 1 + 0.6 * j * valueNoise(u * 3, seed);
  const zx = 0.55 * valueNoise(u * 26, seed + 1) + 0.45 * hashNoise(o.frame * 1.37 + seed);
  const zy = 0.55 * valueNoise(u * 26, seed + 2) + 0.45 * hashNoise(o.frame * 2.11 + seed);
  out.x = x * wob + zx * j;
  out.y = y * wob + zy * j;
  out.seg = seg;
  return out;
}

/** Distance from a point to the ideal heart outline (heart units), by dense sampling. */
export function distanceToHeart(x: number, y: number, samples = 400): number {
  let best = Infinity;
  for (let i = 0; i < samples; i++) {
    const p = heartPoint(i / samples);
    const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}
