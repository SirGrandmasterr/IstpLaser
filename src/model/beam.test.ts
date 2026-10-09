import { describe, expect, it } from 'vitest';
import {
  computeBeamState,
  deriveBeamState,
  effectiveAlignment,
  INITIAL_BEAM_STATE,
  SE_STARVE,
  TI_LOCK,
  type BeamControls,
  type BeamState,
} from './beam';
import { luminance, saturation, strokeStyleFor } from './stroke';

const FRAME = 1 / 60;

/** Run the model at 60 fps for `seconds`. `controls` may vary with time. */
function run(
  controls: BeamControls | ((t: number) => BeamControls),
  seconds: number,
  start: BeamState = INITIAL_BEAM_STATE,
): BeamState {
  let s = start;
  const steps = Math.round(seconds / FRAME);
  for (let i = 0; i < steps; i++) {
    const c = typeof controls === 'function' ? controls(i * FRAME) : controls;
    s = computeBeamState(c, FRAME, s);
  }
  return s;
}

/** Steady particle inflow that keeps Se spinning near full speed. */
const FED = 0.05;

function scenario(ti: boolean, se: boolean, ni: boolean): BeamControls {
  return { alignment: ti ? 1 : 0, torqueImpulse: se ? FED : 0, directionDrive: ni ? 1 : -1 };
}

describe('floor output table', () => {
  const combos = [
    [false, false, false],
    [false, false, true],
    [false, true, false],
    [false, true, true],
  ] as const;

  for (const [ti, se, ni] of combos) {
    it(`Ti off, Se ${se ? 'on' : 'off'}, Ni ${ni ? 'on' : 'off'} → burn-scribble`, () => {
      const s = run(scenario(ti, se, ni), 6);
      expect(s.output).toBe('scribble');
      expect(s.weights.scribble).toBeCloseTo(1, 5);
      const style = strokeStyleFor(s);
      expect(style.jitter).toBeGreaterThan(0.3);
      expect(style.offAxis).toBeGreaterThan(0.3);
      expect(style.sparks).toBeGreaterThan(10);
      expect(style.color[0]).toBeGreaterThan(1.2 * style.color[1]); // ember, not pink
      expect(luminance(style.color)).toBeLessThan(0.5);
      expect(style.ink).toBeGreaterThan(0.6); // scorches the paper
      expect(style.inkTone).toBeGreaterThan(0.9);
    });
  }

  it('Se energy modifies the scribble (later failure only modifies)', () => {
    const cold = strokeStyleFor(run(scenario(false, false, false), 6));
    const hot = strokeStyleFor(run(scenario(false, true, false), 6));
    expect(hot.sparks).toBeGreaterThan(cold.sparks);
    expect(saturation(hot.color)).toBeGreaterThan(saturation(cold.color));
    expect(hot.color[0]).toBeGreaterThan(2.5 * hot.color[1]); // a hot red ember
    expect(luminance(hot.color)).toBeGreaterThan(luminance(cold.color));
  });

  for (const ni of [false, true]) {
    it(`Ti on, Se off, Ni ${ni ? 'on' : 'off'} → dry colourless groove (Ti–Ni loop)`, () => {
      const s = run(scenario(true, false, ni), 6);
      expect(s.output).toBe('groove');
      expect(s.seStarved).toBe(true);
      expect(s.weights.groove).toBeGreaterThan(0.95);
      const style = strokeStyleFor(s);
      expect(saturation(style.color)).toBeLessThan(0.2);
      expect(style.alpha).toBeLessThan(0.5);
      expect(style.width).toBeLessThan(3);
      expect(style.coverage).toBeLessThan(0.7);
      expect(style.ink).toBeGreaterThan(0.3); // a scratch in the paper, not light
      expect(style.inkTone).toBeLessThan(0.1); // grey, not burnt
    });
  }

  it('Ti on, Se on, Ni off → washed-out pink puddle', () => {
    const s = run(scenario(true, true, false), 6);
    expect(s.output).toBe('puddle');
    expect(s.weights.puddle).toBeGreaterThan(0.95);
    const style = strokeStyleFor(s);
    expect(style.softness).toBeGreaterThan(0.9);
    expect(style.width).toBeGreaterThan(30);
    expect(style.alpha).toBeLessThan(0.4);
    expect(style.color[0]).toBeGreaterThan(style.color[1]); // pinkish
  });

  it('Ti on, Se on, Ni on → crisp, vibrant pink heart', () => {
    const s = run(scenario(true, true, true), 6);
    expect(s.output).toBe('heart');
    expect(s.weights.heart).toBeGreaterThan(0.95);
    expect(s.authenticity).toBeGreaterThan(0.9);
    const style = strokeStyleFor(s);
    expect(style.softness).toBeLessThan(0.15);
    expect(style.jitter).toBeLessThan(0.02);
    expect(style.offAxis).toBeLessThan(0.02);
    expect(saturation(style.color)).toBeGreaterThan(0.6);
    expect(style.glow).toBeGreaterThan(0.8);
    expect(style.ink).toBeLessThan(0.05);
  });

  it('output weights always sum to 1', () => {
    for (const A of [0, 0.3, 0.7, 0.84, 1])
      for (const T of [0, 0.2, 0.3, 1])
        for (const D of [0, 0.5, 1]) {
          const w = deriveBeamState(A, T, D, D).weights;
          expect(w.scribble + w.groove + w.puddle + w.heart).toBeCloseTo(1, 9);
        }
  });

  it('the drawing degrades continuously, not in steps', () => {
    let prev = strokeStyleFor(deriveBeamState(1, 1, 1, 1));
    for (let i = 1; i <= 50; i++) {
      const D = 1 - i / 50;
      const cur = strokeStyleFor(deriveBeamState(1, 1, D, D));
      expect(Math.abs(cur.softness - prev.softness)).toBeLessThan(0.1);
      expect(Math.abs(cur.width - prev.width)).toBeLessThan(8);
      prev = cur;
    }
  });
});

describe('derived quantities', () => {
  it('focus never exceeds coherence', () => {
    for (const A of [0, 0.2, 0.5, 0.8, 1])
      for (const D of [0, 0.4, 1]) {
        const s = deriveBeamState(A, 1, D, D);
        expect(s.F).toBeLessThanOrEqual(s.C + 1e-12);
      }
  });

  it('authenticity = C · E · F', () => {
    const s = deriveBeamState(0.7, 0.6, 0.8, 0.8);
    expect(s.authenticity).toBeCloseTo(s.C * s.E * s.F, 12);
  });

  it('energy keeps a small residual so the beam is always faintly visible', () => {
    expect(deriveBeamState(0, 0, 0, 0).E).toBeGreaterThan(0);
    expect(deriveBeamState(0, 0, 0, 0).E).toBeLessThan(0.1);
  });

  it('coherence is smoothstep(A); jitter scales with 1 − C', () => {
    expect(deriveBeamState(0.5, 1, 0, 0).C).toBeCloseTo(0.5, 9);
    const a = strokeStyleFor(deriveBeamState(0.3, 1, 0, 0));
    const b = strokeStyleFor(deriveBeamState(0.7, 1, 0, 0));
    expect(a.jitter).toBeGreaterThan(b.jitter);
  });
});

describe('Ti lock', () => {
  it('snaps to 1 at the threshold', () => {
    expect(effectiveAlignment(TI_LOCK)).toBe(1);
    expect(effectiveAlignment(0.86)).toBe(1);
    expect(effectiveAlignment(0.84)).toBeCloseTo(0.84, 9);
    const s = computeBeamState({ alignment: 0.9, torqueImpulse: 0, directionDrive: 0 }, FRAME);
    expect(s.tiLocked).toBe(true);
    expect(s.C).toBe(1);
  });
});

describe('Se flywheel', () => {
  const spun = deriveBeamState(1, 1, 0, 0);
  const idle: BeamControls = { alignment: 1, torqueImpulse: 0, directionDrive: 0 };

  it('coasts down to a halt in roughly three to four seconds', () => {
    expect(run(idle, 3, spun).T).toBeGreaterThan(0);
    expect(run(idle, 4.2, spun).T).toBe(0);
  });

  it('starves (below threshold) a couple of seconds after input stops', () => {
    expect(run(idle, 1.5, spun).seStarved).toBe(false);
    expect(run(idle, 2.6, spun).seStarved).toBe(true);
  });

  it('spins up from particle impulses and holds while fed', () => {
    const s = run({ alignment: 1, torqueImpulse: FED, directionDrive: 0 }, 3);
    expect(s.T).toBeGreaterThan(0.9);
    expect(s.T).toBeLessThanOrEqual(1);
  });

  it('a sparse trickle is not enough', () => {
    // One small hit every half second.
    let s = INITIAL_BEAM_STATE;
    let peak = 0;
    for (let i = 0; i < 300; i++) {
      s = computeBeamState({ alignment: 1, torqueImpulse: i % 30 === 0 ? 0.04 : 0, directionDrive: 0 }, FRAME, s);
      peak = Math.max(peak, s.T);
    }
    expect(peak).toBeGreaterThan(0);
    expect(peak).toBeLessThan(SE_STARVE);
  });
});

describe('Ni gating', () => {
  it('compiles intent after holding still for about a second', () => {
    const c = { alignment: 1, torqueImpulse: FED, directionDrive: 1 };
    expect(run(c, 0.5).intent).toBeLessThan(0.6);
    expect(run(c, 1.05).intent).toBeCloseTo(1, 1);
  });

  it('intent decays while the reticle keeps moving', () => {
    const compiled = run({ alignment: 1, torqueImpulse: FED, directionDrive: 1 }, 3);
    const moving = run({ alignment: 1, torqueImpulse: FED, directionDrive: -1 }, 1.5, compiled);
    expect(moving.intent).toBe(0);
    expect(moving.niPrimed).toBe(false);
  });

  it('telescopes fully only when the beam from Ti is coherent', () => {
    const unlocked = run({ alignment: 0.5, torqueImpulse: FED, directionDrive: 1 }, 6);
    expect(unlocked.D).toBeLessThanOrEqual(unlocked.C + 1e-9);
    expect(unlocked.niPrimed).toBe(false);
    const locked = run({ alignment: 1, torqueImpulse: FED, directionDrive: 1 }, 6);
    expect(locked.D).toBeCloseTo(1, 2);
    expect(locked.niPrimed).toBe(true);
  });

  it('cannot telescope while Se is starved', () => {
    const s = run({ alignment: 1, torqueImpulse: 0, directionDrive: 1 }, 6);
    expect(s.intent).toBe(1);
    expect(s.D).toBeLessThan(0.05);
  });

  it('sags back when Se starves, and re-extends when energy returns, without re-aiming', () => {
    const primed = run({ alignment: 1, torqueImpulse: FED, directionDrive: 1 }, 4);
    expect(primed.niPrimed).toBe(true);
    const starved = run({ alignment: 1, torqueImpulse: 0, directionDrive: 0 }, 5, primed);
    expect(starved.niPrimed).toBe(false);
    expect(starved.D).toBeLessThan(0.1);
    expect(starved.intent).toBe(1); // the direction is remembered…
    const refed = run({ alignment: 1, torqueImpulse: FED, directionDrive: 0 }, 3, starved);
    expect(refed.niPrimed).toBe(true); // …and Ni re-extends when Se comes back.
  });

  it('sags back when Ti unlocks', () => {
    const primed = run({ alignment: 1, torqueImpulse: FED, directionDrive: 1 }, 4);
    const unlocked = run({ alignment: 0.2, torqueImpulse: FED, directionDrive: 0 }, 3, primed);
    expect(unlocked.niPrimed).toBe(false);
    expect(unlocked.D).toBeLessThanOrEqual(unlocked.C + 1e-9);
  });

  it('extension takes on the order of a second and a half, not an instant', () => {
    const c = { alignment: 1, torqueImpulse: FED, directionDrive: 1 };
    const pre = run({ ...c, directionDrive: 0 }, 2); // spin Se up first
    expect(run(c, 0.5, pre).D).toBeLessThan(0.6);
    expect(run(c, 2.2, pre).D).toBeGreaterThan(0.95);
  });
});

describe('robustness', () => {
  it('clamps oversized timesteps and garbage inputs', () => {
    const s = computeBeamState({ alignment: 7, torqueImpulse: -3, directionDrive: 9 }, 50);
    expect(s.A).toBe(1);
    expect(s.T).toBeGreaterThanOrEqual(0);
    expect(s.intent).toBeLessThanOrEqual(1);
    for (const v of [s.C, s.E, s.F, s.authenticity]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
