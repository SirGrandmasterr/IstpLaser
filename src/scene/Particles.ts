/**
 * Amber particles: real-time input from the surroundings. They fly in from
 * wherever the pointer is (or from the far edges of the scene for the steady
 * feed), curve round and strike the Se rim tangentially. Each hit adds torque.
 *
 * Also hosts the faint suspended-dust volume used as ambience.
 */
import { BufferAttribute, BufferGeometry, Points, Vector3, type Scene } from 'three';
import { DIR, SE_POS } from './layout';
import { pointsMaterial } from './materials';
import type { Se } from './Se';
import { glowTexture } from './textures';

const TRAIL = 4;
const MAX_FLASH = 32;

interface P {
  p0: Vector3;
  p1: Vector3;
  p2: Vector3;
  p3: Vector3;
  t: number;
  dur: number;
  size: number;
}

const _v = new Vector3();
const _w = new Vector3();

function bezier(p: P, t: number, out: Vector3): Vector3 {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return out
    .copy(p.p0)
    .multiplyScalar(a)
    .addScaledVector(p.p1, b)
    .addScaledVector(p.p2, c)
    .addScaledVector(p.p3, d);
}

export class Particles {
  private max: number;
  private live: P[] = [];
  private pool: P[] = [];
  private flashes: { p: Vector3; life: number }[] = [];
  private geo = new BufferGeometry();
  private pos: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private dustGeo = new BufferGeometry();
  private dustBase: Float32Array;
  private dustPos: Float32Array;
  private time = 0;

  constructor(scene: Scene, private se: Se, pixelRatio: number, reduced: boolean) {
    this.max = reduced ? 90 : 220;
    const slots = this.max * TRAIL + MAX_FLASH;
    this.pos = new Float32Array(slots * 3);
    this.col = new Float32Array(slots * 3);
    this.size = new Float32Array(slots);
    this.geo.setAttribute('position', new BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new BufferAttribute(this.col, 3));
    this.geo.setAttribute('size', new BufferAttribute(this.size, 1));
    const tex = glowTexture();
    const pts = new Points(this.geo, pointsMaterial(tex, pixelRatio));
    pts.frustumCulled = false;
    pts.renderOrder = 11;
    scene.add(pts);

    // Suspended dust: faint, slowly drifting, nothing that reads as a support.
    const n = reduced ? 260 : 700;
    this.dustBase = new Float32Array(n * 3);
    this.dustPos = new Float32Array(n * 3);
    const dcol = new Float32Array(n * 3);
    const dsize = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.dustBase[i * 3] = -13 + Math.random() * 24;
      this.dustBase[i * 3 + 1] = 0.2 + Math.random() * 9;
      this.dustBase[i * 3 + 2] = -9 + Math.random() * 15;
      const k = 0.05 + Math.random() * 0.09;
      dcol[i * 3] = k * 0.8;
      dcol[i * 3 + 1] = k * 0.9;
      dcol[i * 3 + 2] = k * 1.2;
      dsize[i] = 0.025 + Math.random() * 0.035;
    }
    this.dustPos.set(this.dustBase);
    this.dustGeo.setAttribute('position', new BufferAttribute(this.dustPos, 3));
    this.dustGeo.setAttribute('color', new BufferAttribute(dcol, 3));
    this.dustGeo.setAttribute('size', new BufferAttribute(dsize, 1));
    const dust = new Points(this.dustGeo, pointsMaterial(tex, pixelRatio));
    dust.frustumCulled = false;
    scene.add(dust);
  }

  get count(): number {
    return this.live.length;
  }

  private take(): P | null {
    if (this.live.length >= this.max) return null;
    return (
      this.pool.pop() ?? {
        p0: new Vector3(),
        p1: new Vector3(),
        p2: new Vector3(),
        p3: new Vector3(),
        t: 0,
        dur: 1,
        size: 0.1,
      }
    );
  }

  /** Launch a particle from `from` toward a random point on the Se rim. */
  spawnFrom(from: Vector3): void {
    const p = this.take();
    if (!p) return;
    const theta = Math.random() * Math.PI * 2;
    this.se.rimWorld(theta, p.p3);
    const tangent = this.se.tangentWorld(theta, _v);
    const radial = _w.copy(p.p3).sub(SE_POS).normalize();
    p.p0.copy(from);
    // Arrive along the tangent, slightly from outside.
    p.p2.copy(p.p3).addScaledVector(tangent, -1.4).addScaledVector(radial, 0.35);
    p.p1
      .copy(p.p0)
      .lerp(p.p2, 0.35)
      .add(_v.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).multiplyScalar(2.2));
    p.t = 0;
    p.dur = 0.55 + p.p0.distanceTo(p.p3) / 7 + Math.random() * 0.3;
    p.size = 0.07 + Math.random() * 0.06;
    this.live.push(p);
  }

  /** From the far surroundings (steady feed, scroll, held key). */
  spawnAmbient(): void {
    for (let tries = 0; tries < 6; tries++) {
      _w.set(Math.random() * 2 - 1, Math.random() * 1.6 - 0.5, Math.random() * 2 - 1).normalize();
      // Keep clear of the beam axis so particles visibly come from the world, not the beam.
      if (Math.abs(_w.dot(DIR)) > 0.7) continue;
      const r = 6 + Math.random() * 3;
      const from = _v.copy(SE_POS).addScaledVector(_w, r);
      from.y = Math.max(0.4, from.y);
      this.spawnFrom(from.clone());
      return;
    }
  }

  /** Advance particles. Returns the number of rim hits this frame. */
  update(dt: number): number {
    this.time += dt;
    let hits = 0;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.t += dt / p.dur;
      if (p.t >= 1) {
        hits++;
        this.se.onHit();
        if (this.flashes.length < MAX_FLASH) this.flashes.push({ p: p.p3.clone(), life: 0 });
        this.live.splice(i, 1);
        this.pool.push(p);
      }
    }

    let n = 0;
    for (const p of this.live) {
      // Ease-in: they accelerate as they're drawn to the ring.
      const tt = p.t * p.t * (1.6 - 0.6 * p.t);
      for (let k = 0; k < TRAIL; k++) {
        const t = Math.max(0, tt - k * 0.035);
        bezier(p, t, _v);
        const fade = (1 - k / TRAIL) * Math.min(1, p.t * 6);
        this.pos[n * 3] = _v.x;
        this.pos[n * 3 + 1] = _v.y;
        this.pos[n * 3 + 2] = _v.z;
        this.col[n * 3] = 1.9 * fade;
        this.col[n * 3 + 1] = 1.05 * fade;
        this.col[n * 3 + 2] = 0.28 * fade;
        this.size[n] = p.size * (1 - k * 0.18);
        n++;
      }
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life += dt;
      if (f.life > 0.28) {
        this.flashes.splice(i, 1);
        continue;
      }
      const k = 1 - f.life / 0.28;
      this.pos[n * 3] = f.p.x;
      this.pos[n * 3 + 1] = f.p.y;
      this.pos[n * 3 + 2] = f.p.z;
      this.col[n * 3] = 2.4 * k;
      this.col[n * 3 + 1] = 1.6 * k;
      this.col[n * 3 + 2] = 0.6 * k;
      this.size[n] = 0.18 + 0.25 * (1 - k);
      n++;
    }
    this.geo.setDrawRange(0, n);
    (this.geo.attributes.position as BufferAttribute).needsUpdate = true;
    (this.geo.attributes.color as BufferAttribute).needsUpdate = true;
    (this.geo.attributes.size as BufferAttribute).needsUpdate = true;

    // Dust drifts on slow currents.
    const d = this.dustPos;
    const b = this.dustBase;
    const t = this.time;
    for (let i = 0; i < d.length; i += 3) {
      d[i] = b[i] + Math.sin(t * 0.07 + b[i + 1]) * 0.4;
      d[i + 1] = b[i + 1] + Math.sin(t * 0.05 + b[i + 2] * 0.7) * 0.25;
      d[i + 2] = b[i + 2] + Math.cos(t * 0.06 + b[i]) * 0.4;
    }
    (this.dustGeo.attributes.position as BufferAttribute).needsUpdate = true;
    return hits;
  }

  clear(): void {
    while (this.live.length) this.pool.push(this.live.pop()!);
    this.flashes.length = 0;
  }
}
