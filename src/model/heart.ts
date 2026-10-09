/**
 * The heart path the nib traces, normalised to roughly [-1, 1] on both axes,
 * y up. u runs 0..1 once around, starting at the top notch.
 */
export function heartPoint(u: number): { x: number; y: number } {
  const t = Math.PI * 2 * u;
  const s = Math.sin(t);
  const x = 16 * s * s * s;
  const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
  // Raw extents: x ∈ [-16, 16], y ∈ [-17, ~5]; centre and scale.
  return { x: x / 16, y: (y + 6) / 11.5 };
}

/** Deterministic hash noise in [-1, 1], used for jitter so tests stay reproducible. */
export function hashNoise(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

/** Smooth 1D value noise in [-1, 1]. */
export function valueNoise(x: number, seed = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = hashNoise(i + seed * 101.3);
  const b = hashNoise(i + 1 + seed * 101.3);
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}
