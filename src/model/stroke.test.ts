import { describe, expect, it } from 'vitest';
import { deriveBeamState, SE_STARVE, smoothstep } from './beam';
import { heartPoint } from './heart';
import { arrivingEnergy, nibIntensity } from './nib';
import { distanceToHeart, strokePath } from './path';
import { strokeStyleFor } from './stroke';

/** Fully settled states for the four rows of the floor table. */
const scribble = deriveBeamState(0, 1, 0, 0);
const groove = deriveBeamState(1, 0, 1, 0);
const puddle = deriveBeamState(1, 1, 0, 0);
const heart = deriveBeamState(1, 1, 1, 1);

describe('dry groove (Ti on, Se starved)', () => {
  it('scores the paper hard enough to see', () => {
    const s = strokeStyleFor(groove);
    expect(s.ink).toBeGreaterThanOrEqual(0.6);
    expect(s.score).toBeGreaterThan(0.95);
    expect(s.inkTone).toBeLessThan(0.1); // grey, not burnt
    expect(s.coverage).toBeLessThan(0.75); // the nib skips
  });

  it('only the groove scores; light-writing states do not', () => {
    for (const b of [scribble, puddle, heart]) expect(strokeStyleFor(b).score).toBeLessThan(0.05);
  });
});

describe('nib intensity', () => {
  it('is near zero whenever the energy reaching the nib is below starvation', () => {
    for (const E of [0, 0.06, 0.1, 0.2, SE_STARVE - 1e-6]) {
      expect(nibIntensity(E, 1)).toBeLessThan(0.02);
    }
  });

  it('is dead in the groove state even under full pressure', () => {
    expect(arrivingEnergy(groove)).toBeLessThan(SE_STARVE);
    expect(nibIntensity(arrivingEnergy(groove), 1)).toBeLessThan(0.02);
  });

  it('lights up when the beam arrives, in proportion to pressure', () => {
    for (const b of [puddle, heart]) {
      const e = arrivingEnergy(b);
      expect(nibIntensity(e, 1)).toBeGreaterThan(0.9);
      expect(nibIntensity(e, 0.5)).toBeCloseTo(0.5 * nibIntensity(e, 1), 9);
      expect(nibIntensity(e, 0)).toBe(0);
    }
  });

  it('a stray beam from an unaligned Ti bypasses Ni, so a hot scribble still reaches the nib', () => {
    expect(nibIntensity(arrivingEnergy(scribble), 1)).toBeGreaterThan(0.9);
    // …but a cold one (Se off too) barely does.
    expect(nibIntensity(arrivingEnergy(deriveBeamState(0, 0, 0, 0)), 1)).toBeLessThan(0.02);
  });

  it('comes back continuously as Se recovers', () => {
    let prev = nibIntensity(arrivingEnergy(deriveBeamState(1, 0, 1, 0)), 1);
    for (let i = 1; i <= 100; i++) {
      const cur = nibIntensity(arrivingEnergy(deriveBeamState(1, i / 100, 1, 0)), 1);
      expect(cur).toBeGreaterThanOrEqual(prev - 1e-9);
      expect(cur - prev).toBeLessThan(0.1);
      prev = cur;
    }
  });
});

/** Mean distance of the traced path from the ideal heart outline (heart units; the heart spans ~2). */
function meanDeviation(jitter: number, scrawl: number, seed: number): number {
  const n = 240;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const p = strokePath(i / n, { jitter, scrawl, seed, frame: i });
    sum += distanceToHeart(p.x, p.y);
  }
  return sum / n;
}

describe('burn-scribble shape', () => {
  const seeds = [3.7, 12.1, 41.9, 77.3, 95.5];

  it('the heart traces the heart exactly', () => {
    const s = strokeStyleFor(heart);
    for (const seed of seeds) expect(meanDeviation(s.jitter, s.scrawl, seed)).toBeLessThan(0.005);
    const p = strokePath(0.3, { jitter: 0, scrawl: 0, seed: 1, frame: 9 });
    const h = heartPoint(0.3);
    expect(p.x).toBeCloseTo(h.x, 12);
    expect(p.y).toBeCloseTo(h.y, 12);
  });

  it('a fully unaligned Ti breaks the silhouette: the scrawl strays far from the outline', () => {
    const s = strokeStyleFor(scribble);
    expect(s.scrawl).toBeGreaterThan(0.95);
    for (const seed of seeds) expect(meanDeviation(s.jitter, s.scrawl, seed)).toBeGreaterThan(0.25);
  });

  it('a nearly-locked Ti only hints at the heart; the scrawl grows continuously as C drops', () => {
    // Find A with C ≈ 0.7.
    let A = 0;
    while (smoothstep(0, 1, A) < 0.7) A += 0.001;
    const near = strokeStyleFor(deriveBeamState(A, 1, 0, 0));
    const far = strokeStyleFor(scribble);
    expect(near.scrawl).toBeGreaterThan(0.1);
    expect(near.scrawl).toBeLessThan(far.scrawl * 0.6);
    const dNear = seeds.reduce((a, seed) => a + meanDeviation(near.jitter, near.scrawl, seed), 0) / seeds.length;
    const dFar = seeds.reduce((a, seed) => a + meanDeviation(far.jitter, far.scrawl, seed), 0) / seeds.length;
    expect(dNear).toBeLessThan(dFar);
  });

  it('jumps: a scrawl lifts the nib and lands elsewhere, a heart never does', () => {
    const segs = new Set<number>();
    for (let i = 0; i <= 100; i++) segs.add(strokePath(i / 100, { jitter: 0.4, scrawl: 1, seed: 5, frame: 0 }).seg);
    expect(segs.size).toBeGreaterThan(3);
    for (let i = 0; i <= 100; i++) expect(strokePath(i / 100, { jitter: 0, scrawl: 0, seed: 5, frame: 0 }).seg).toBe(0);
  });
});
