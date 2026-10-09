/**
 * The laser, rebuilt every frame as a list of straight segments (instanced
 * cylinders with an additive core and a wide glow). Segmenting per stage lets
 * each instrument change the beam's colour, intensity and direction:
 * white-cyan through Ti, gold after Se, indigo inside Ni, rose at the nib.
 */
import { Color, CylinderGeometry, InstancedMesh, Matrix4, Quaternion, Vector3, type Scene } from 'three';
import { hashNoise, valueNoise } from '../model/heart';
import { seGate, smoothstep } from '../model/beam';
import { AXIS_U, AXIS_V, DIR, SOURCE, SE_POS, TI_POS } from './layout';
import { beamMaterial } from './materials';
import type { Fe } from './Fe';
import type { Ni } from './Ni';
import type { Ti } from './Ti';
import type { FrameContext } from './types';

const MAX = 320;

type RGB = readonly [number, number, number];
const CYAN: RGB = [0.72, 0.94, 1.0];
const ICE: RGB = [0.5, 0.78, 1.0];
const GOLD: RGB = [1.0, 0.7, 0.26];
const INDIGO: RGB = [0.4, 0.3, 1.0];
const ROSE: RGB = [1.0, 0.3, 0.64];

const mix = (a: RGB, b: RGB, t: number): [number, number, number] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const _m = new Matrix4();
const _q = new Quaternion();
const _pos = new Vector3();
const _dir = new Vector3();
const _scl = new Vector3();
const _c = new Color();
const UP = new Vector3(0, 1, 0);

/** Fixed spread of "possible vectors" for the unfocused Ni halo (Fibonacci sphere). */
const HALO_COUNT = 22;
const HALO_DIRS: Vector3[] = Array.from({ length: HALO_COUNT }, (_, i) => {
  const y = 1 - (i / (HALO_COUNT - 1)) * 2;
  const r = Math.sqrt(1 - y * y);
  const phi = i * 2.39996;
  return new Vector3(Math.cos(phi) * r, y, Math.sin(phi) * r);
});

export class Beam {
  private core: InstancedMesh;
  private glow: InstancedMesh;
  private n = 0;

  // Scratch points.
  private pTiIn = new Vector3();
  private pTiOut = new Vector3();
  private pSe = new Vector3();
  private pNiIn = new Vector3();
  private pNiOut = new Vector3();
  private g1 = new Vector3();
  private g2 = new Vector3();
  private ball = new Vector3();
  private tmpA = new Vector3();
  private tmpB = new Vector3();
  private off = new Vector3();

  constructor(scene: Scene) {
    const geo = new CylinderGeometry(1, 1, 1, 12, 1, true);
    this.core = new InstancedMesh(geo, beamMaterial(1.2, 1.0), MAX);
    this.glow = new InstancedMesh(geo, beamMaterial(2.6, 1.0), MAX);
    for (const m of [this.core, this.glow]) {
      m.frustumCulled = false;
      m.count = 0;
      m.renderOrder = 10;
      m.setColorAt(0, _c.setRGB(0, 0, 0));
      scene.add(m);
    }
  }

  private push(a: Vector3, b: Vector3, r: number, rgb: readonly number[], k: number, glowK = 1): void {
    if (this.n >= MAX || k <= 0.002) return;
    _dir.copy(b).sub(a);
    const len = _dir.length();
    if (len < 1e-4) return;
    _dir.divideScalar(len);
    _pos.copy(a).add(b).multiplyScalar(0.5);
    _q.setFromUnitVectors(UP, _dir);
    _m.compose(_pos, _q, _scl.set(r, len, r));
    this.core.setMatrixAt(this.n, _m);
    this.core.setColorAt(this.n, _c.setRGB(rgb[0] * k, rgb[1] * k, rgb[2] * k));
    _m.compose(_pos, _q, _scl.set(r * 4.5, len, r * 4.5));
    this.glow.setMatrixAt(this.n, _m);
    const g = 0.07 * k * glowK;
    this.glow.setColorAt(this.n, _c.setRGB(rgb[0] * g, rgb[1] * g, rgb[2] * g));
    this.n++;
  }

  /** A segment that has lost cohesion: broken into flickering dashes. */
  private pushBroken(a: Vector3, b: Vector3, r: number, rgb: readonly number[], k: number, broken: number, time: number): void {
    if (broken < 0.05) {
      this.push(a, b, r, rgb, k);
      return;
    }
    const pieces = 14;
    const tick = Math.floor(time * 18);
    for (let i = 0; i < pieces; i++) {
      const h = hashNoise(i * 7.3 + tick * 0.61);
      if (h < broken * 1.2 - 0.6) continue;
      const fl = 0.55 + 0.45 * hashNoise(i + tick * 1.7);
      this.tmpA.lerpVectors(a, b, i / pieces);
      this.tmpB.lerpVectors(a, b, (i + 0.72) / pieces);
      this.push(this.tmpA, this.tmpB, r * (1 - 0.4 * broken), rgb, k * fl);
    }
  }

  /** Lateral wander of the beam, scaled by Ti's lack of coherence. */
  private wander(seed: number, amp: number, time: number, out: Vector3): Vector3 {
    const u = valueNoise(time * 2.3 + seed * 10, seed) + 0.6 * hashNoise(Math.floor(time * 9) + seed);
    const v = valueNoise(time * 1.9 + seed * 20, seed + 3) + 0.6 * hashNoise(Math.floor(time * 11) + seed * 2);
    return out.copy(AXIS_U).multiplyScalar(u * amp * 0.6).addScaledVector(AXIS_V, v * amp * 0.6 + amp * 0.55);
  }

  update(ctx: FrameContext, ti: Ti, ni: Ni, fe: Fe): void {
    this.n = 0;
    const { beam, time } = ctx;
    const C = beam.C;
    const chaos = 1 - C;
    const motion = ctx.reducedMotion ? 0.35 : 1;
    const t = time * motion;

    // 1. Source → Ti: the raw impulse, crisp white-cyan.
    const I0 = 1.3 + 1.6 * ctx.sourceBoost;
    this.pTiIn.copy(TI_POS).addScaledVector(DIR, -0.04);
    this.push(SOURCE, this.pTiIn, 0.022, CYAN, I0);

    // 2. Inside Ti: closed, chaotic reflection loops among the facets.
    if (chaos > 0.01) {
      const bounces = Math.round(5 + 9 * chaos);
      const rate = 10 * motion;
      let prev = this.tmpA.copy(TI_POS);
      const first = new Vector3().copy(TI_POS);
      for (let i = 0; i < bounces; i++) {
        const idx = Math.floor((hashNoise(Math.floor(t * rate + i * 0.37) * 0.13 + i * 3.1) * 0.5 + 0.5) * ti.facetCount);
        const p = ti.facetWorld(idx, this.tmpB.clone());
        this.push(prev, p, 0.01, ICE, I0 * 0.42 * chaos);
        prev = p;
      }
      this.push(prev, first, 0.01, ICE, I0 * 0.42 * chaos);

      // Two or three flickering stray rays escape off-axis.
      for (let k = 0; k < 3; k++) {
        const flick = hashNoise(Math.floor(t * 13) + k * 17) > -0.2 ? 1 : 0.15;
        const idx = Math.floor((hashNoise(k * 11 + Math.floor(t * 2.5)) * 0.5 + 0.5) * ti.facetCount);
        const p = ti.facetWorld(idx, new Vector3());
        const ang = k * 2.1 + valueNoise(t * 0.8, k) * 1.4;
        _dir
          .copy(AXIS_U)
          .multiplyScalar(Math.cos(ang))
          .addScaledVector(AXIS_V, Math.sin(ang))
          .addScaledVector(DIR, 0.35 + 0.3 * hashNoise(k + 5))
          .normalize();
        const end = p.clone().addScaledVector(_dir, 3 + 1.5 * k);
        this.push(p, end, 0.008, ICE, I0 * 0.45 * chaos * flick * (k === 2 ? smoothstep(0.3, 0.7, chaos) : 1));
      }
    }

    // 3. Ti → Se. Coherent when locked; otherwise a weak erratic ray, off-axis.
    const q = 0.22 + 0.78 * C * C;
    const I1 = I0 * q;
    const jitterAmp = chaos * 1.05;
    this.pTiOut.copy(TI_POS).addScaledVector(DIR, 0.06);
    this.pSe.copy(SE_POS).add(this.wander(1, jitterAmp, t, this.off));
    const r1 = 0.012 + 0.01 * C;
    this.push(this.pTiOut, this.pSe, r1, CYAN, I1);

    // 4. Se charges the beam: brighter and warmer, proportional to spin.
    //    An off-axis ray misses the hole and only catches some of the glow.
    const charge = 0.45 + 0.85 * beam.E * (0.3 + 0.7 * C);
    const I2 = I1 * charge;
    const warm = Math.min(1, beam.T * 1.25) * (0.3 + 0.7 * C);
    const col2 = mix(CYAN, GOLD, warm);
    const gate = seGate(beam.T);
    // What survives Ni: a coherent beam needs Se's energy; a stray one bypasses Ni.
    const survive = 1 - C + C * gate;
    const broken = (1 - smoothstep(0.08, 0.45, beam.T)) * (0.4 + 0.6 * C);
    ni.entryWorld(this.pNiIn).add(this.wander(2, jitterAmp * 1.15, t, this.off));
    this.pushBroken(this.pSe, this.pNiIn, r1 * (0.8 + 0.5 * beam.E), col2, I2, broken, t);

    // 5. Inside Ni: deep indigo. Starved, the beam dies in here.
    ni.exitWorld(this.pNiOut).add(this.wander(2, jitterAmp * 1.1, t, this.off));
    const unfocused = 1 - beam.F;
    const rNi = 0.02 * (1 + 1.6 * unfocused);
    if (survive > 0.98) {
      this.push(this.pNiIn, this.pNiOut, rNi, INDIGO, I2 * 1.1);
    } else {
      const mid = this.tmpA.lerpVectors(this.pNiIn, this.pNiOut, 0.45);
      this.push(this.pNiIn, mid, rNi, INDIGO, I2 * 1.1);
      this.push(mid, this.pNiOut, rNi, INDIGO, I2 * 1.1 * survive);
    }
    // Weak back-reflection toward Ti: the Ti–Ni loop.
    const loop = C * (1 - gate);
    if (loop > 0.02) {
      const a = this.tmpA.copy(this.pNiIn).addScaledVector(AXIS_V, 0.07);
      const b = this.tmpB.copy(TI_POS).addScaledVector(AXIS_V, 0.07).addScaledVector(DIR, 0.08);
      const pulse = 0.6 + 0.4 * Math.sin(t * 4);
      this.push(a, b, 0.008, INDIGO, 1.1 * loop * pulse);
    }
    // Unprimed Ni is a diffuse splitter: a halo of possible vectors in every direction.
    const halo = unfocused * survive * (0.25 + 0.75 * C) * Math.max(0.15, beam.E);
    if (halo > 0.02) {
      const spin = t * 0.15;
      for (let i = 0; i < HALO_DIRS.length; i++) {
        const d = HALO_DIRS[i];
        _dir.set(d.x * Math.cos(spin) - d.z * Math.sin(spin), d.y, d.x * Math.sin(spin) + d.z * Math.cos(spin));
        const len = 1.1 + 0.9 * (hashNoise(i * 3.7) * 0.5 + 0.5);
        const end = this.tmpB.copy(this.pNiOut).addScaledVector(_dir, len);
        this.push(this.pNiOut, end, 0.006, mix(INDIGO, ROSE, 0.35), halo * I2 * 0.5, 0.6);
      }
    }

    // 6. Ni → galvo mirrors → ball: rose. An unfocused beam arrives wide and soft.
    const I3 = I2 * survive * (0.45 + 0.55 * beam.F);
    const r3 = 0.016 * (1 + 2.2 * unfocused * C);
    fe.galvoWorld(0, this.g1);
    fe.galvoWorld(1, this.g2);
    fe.ballWorld(this.ball);
    const col3 = mix(INDIGO, ROSE, 0.55);
    this.push(this.pNiOut, this.g1, r3, col3, I3);
    this.push(this.g1, this.g2, r3, mix(INDIGO, ROSE, 0.8), I3);
    this.push(this.g2, this.ball, r3, ROSE, I3);

    // 7. Out of the nib onto the page, only while Fe is actuated.
    const target = ctx.drawing ? ctx.drawPoint : ctx.aimPoint;
    fe.steer(0, this.pNiOut, this.g2);
    fe.steer(1, this.g1, this.ball);
    if (ctx.drawing) {
      this.push(this.ball, target, r3, ROSE, I3 * (0.45 + 0.65 * ctx.actuation));
    } else if (beam.F > 0.05 && survive > 0.3) {
      // Ni's compiled direction, shown as a faint aiming line onto the page.
      this.push(this.ball, target, 0.004, ROSE, 0.55 * beam.F * survive, 0.4);
    }

    this.core.count = this.n;
    this.glow.count = this.n;
    this.core.instanceMatrix.needsUpdate = true;
    this.glow.instanceMatrix.needsUpdate = true;
    if (this.core.instanceColor) this.core.instanceColor.needsUpdate = true;
    if (this.glow.instanceColor) this.glow.instanceColor.needsUpdate = true;
  }
}
