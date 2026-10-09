/**
 * Ti: the kinematic kaleidoscope. A large disc of crystalline prisms on
 * micro-gimbals. Unaligned, the facets drift and tick like clockwork and trap
 * the beam; aligned, they snap into a rigid planar lock.
 */
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Euler,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import { smoothstep } from '../model/beam';
import { AXIS_QUAT, labelAnchor, TI_POS } from './layout';
import { glass, knurled, titanium } from './materials';
import type { FrameContext, Instrument } from './types';

export const TI_FACET_RADIUS = 1.86;
export const TI_RING_INNER = 2.12;
export const TI_RING_OUTER = 2.34;
/** Ring angle at which alignment reaches 0 (alignment = 1 − |angle| / TI_RANGE). */
export const TI_RANGE = Math.PI * 0.75;

interface Facet {
  x: number;
  y: number;
  down: boolean;
  p1: number;
  p2: number;
  p3: number;
  w1: number;
  w2: number;
  w3: number;
}

const _m = new Matrix4();
const _q = new Quaternion();
const _qBase = new Quaternion();
const _e = new Euler();
const _p = new Vector3();
const _s = new Vector3(1, 1, 1);
const Z = new Vector3(0, 0, 1);

export class Ti implements Instrument {
  readonly id = 'ti' as const;
  readonly group = new Group();
  readonly pickables: Object3D[] = [];
  readonly labelAnchor = labelAnchor(TI_POS, 2.75);
  readonly view = {
    position: TI_POS.clone().add(new Vector3(3.2, 2.0, 8.4)),
    target: TI_POS.clone(),
  };

  /** The knurled tuning ring; dragging it changes alignment. */
  readonly ring: Mesh;
  private ringPivot = new Group();
  private facets: InstancedMesh;
  private facetData: Facet[] = [];
  private facetMat = glass(0x9cc8ff, 0.3);
  private frameMat = titanium(0x252a34, 0.28);
  private notchMat = new MeshBasicMaterial({ color: new Color(0.5, 1.6, 2.2), toneMapped: false });
  private indexMat = new MeshBasicMaterial({ color: new Color(0.3, 0.9, 1.3), toneMapped: false });
  private body = new Group();

  private amp = 1;
  private ampVel = 0;
  private lockPulse = 0;
  private wasLocked = false;

  constructor() {
    this.group.position.copy(TI_POS);
    this.group.quaternion.copy(AXIS_QUAT);
    this.group.add(this.body);

    // Frame: a dark titanium hoop with a thin inner bezel.
    const frame = new Mesh(new TorusGeometry(2.0, 0.075, 16, 160), this.frameMat);
    const bezel = new Mesh(new TorusGeometry(1.93, 0.025, 8, 160), titanium(0x3a404c, 0.2));
    bezel.position.z = 0.05;
    this.body.add(frame, bezel);

    // Fixed index mark at the top of the frame: the sweet spot.
    const index = new Mesh(new BoxGeometry(0.05, 0.16, 0.05), this.indexMat);
    index.position.set(0, 2.06, 0.13);
    this.body.add(index);

    // Knurled tuning ring with a bright notch that has to meet the index mark.
    const profile = [
      new Vector2(TI_RING_INNER, -0.12),
      new Vector2(TI_RING_OUTER - 0.02, -0.12),
      new Vector2(TI_RING_OUTER, -0.1),
      new Vector2(TI_RING_OUTER, 0.1),
      new Vector2(TI_RING_OUTER - 0.02, 0.12),
      new Vector2(TI_RING_INNER, 0.12),
    ];
    const ringGeo = new LatheGeometry(profile, 180);
    ringGeo.rotateX(Math.PI / 2);
    this.ring = new Mesh(ringGeo, knurled(120));
    this.ring.name = 'ti-ring';
    const notch = new Mesh(new BoxGeometry(0.06, 0.24, 0.26), this.notchMat);
    notch.position.set(0, TI_RING_OUTER - 0.08, 0);
    this.ringPivot.add(this.ring, notch);
    this.body.add(this.ringPivot);

    // Facet mosaic: a triangular tiling of short prisms (a Fresnel-like array).
    const side = 0.33;
    const h = (side * Math.sqrt(3)) / 2;
    const geo = new CylinderGeometry((side / Math.sqrt(3)) * 0.93, (side / Math.sqrt(3)) * 0.93, 0.07, 3, 1);
    geo.rotateX(-Math.PI / 2);
    const rows = Math.ceil(TI_FACET_RADIUS / h) + 1;
    const cols = Math.ceil(TI_FACET_RADIUS / (side / 2)) + 1;
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let j = -rows; j <= rows; j++) {
      for (let i = -cols; i <= cols; i++) {
        const up = ((i + j) % 2 + 2) % 2 === 0;
        const x = (i * side) / 2;
        const y = j * h + (up ? h / 3 : (2 * h) / 3) - h / 2;
        if (Math.hypot(x, y) > TI_FACET_RADIUS - side * 0.35) continue;
        this.facetData.push({
          x,
          y,
          down: !up,
          p1: rnd() * 6.28,
          p2: rnd() * 6.28,
          p3: rnd() * 4,
          w1: 0.6 + rnd() * 1.1,
          w2: 0.5 + rnd() * 1.2,
          w3: 0.35 + rnd() * 0.6,
        });
      }
    }
    this.facets = new InstancedMesh(geo, this.facetMat, this.facetData.length);
    this.facets.name = 'ti-facets';
    this.facets.frustumCulled = false;
    this.body.add(this.facets);

    this.pickables.push(frame, this.facets, bezel, this.ring);
  }

  get facetCount(): number {
    return this.facetData.length;
  }

  /** World position of facet `i` (for the beam's internal bounce loop). */
  facetWorld(i: number, out: Vector3): Vector3 {
    const f = this.facetData[((i % this.facetData.length) + this.facetData.length) % this.facetData.length];
    out.set(f.x, f.y, 0);
    return this.group.localToWorld(out);
  }

  update(ctx: FrameContext): void {
    const { beam, dt, time } = ctx;
    const locked = beam.tiLocked;

    // Facets gradually settle as alignment improves, then snap at the lock.
    const target = locked ? 0 : 1 - 0.7 * smoothstep(0.15, 0.85, beam.A);
    const k = locked ? 260 : 40;
    const c = locked ? 9 : 11;
    this.ampVel += (k * (target - this.amp) - c * this.ampVel) * dt;
    this.amp += this.ampVel * dt;

    if (locked && !this.wasLocked) this.lockPulse = 1;
    this.wasLocked = locked;
    this.lockPulse = Math.max(0, this.lockPulse - dt * 2.2);

    // Mechanical settle: a small jolt along the axis when it locks.
    const jolt = this.lockPulse * this.lockPulse;
    this.body.position.z = -0.05 * jolt * Math.cos((1 - this.lockPulse) * 22);

    const amp = ctx.reducedMotion ? this.amp * 0.5 : this.amp;
    for (let i = 0; i < this.facetData.length; i++) {
      const f = this.facetData[i];
      const tick = time * f.w3 + f.p3;
      const stepped = Math.floor(tick) + smoothstep(0, 0.25, tick - Math.floor(tick));
      _e.set(
        amp * 0.75 * Math.sin(time * f.w1 + f.p1),
        amp * 0.75 * Math.sin(time * f.w2 + f.p2),
        (f.down ? Math.PI : 0) + amp * 0.8 * Math.sin(stepped * 1.7 + f.p1),
      );
      _q.setFromEuler(_e);
      _qBase.identity();
      _p.set(f.x, f.y, amp * 0.07 * Math.sin(time * f.w2 * 1.3 + f.p3));
      _m.compose(_p, _q.premultiply(_qBase), _s);
      this.facets.setMatrixAt(i, _m);
    }
    this.facets.instanceMatrix.needsUpdate = true;

    // Trapped light makes an unaligned disc glow from inside; a lock flashes cyan.
    const trapped = (1 - beam.C) * 0.28;
    this.facetMat.emissive.setRGB(0.12 * trapped + 0.25 * this.lockPulse, 0.35 * trapped + 0.6 * this.lockPulse, 0.9 * trapped + 0.9 * this.lockPulse);
    this.facetMat.opacity = 0.26 + 0.12 * beam.C;

    // Ring and notch.
    this.ringPivot.quaternion.setFromAxisAngle(Z, ctx.tiRingAngle);
    const near = 1 - Math.min(1, Math.abs(ctx.tiRingAngle) / 0.6);
    const glow = 0.6 + 1.6 * near + 2 * this.lockPulse;
    this.notchMat.color.setRGB(0.25 * glow, 0.75 * glow, 1.0 * glow);
    const iglow = locked ? 2.2 : 0.8 + near;
    this.indexMat.color.setRGB(0.25 * iglow, 0.8 * iglow, 1.1 * iglow);
  }
}
