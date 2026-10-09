/**
 * The sheet of paper on the floor: the social world. Two offscreen canvases:
 *   glow  – emissive light the nib writes (the heart, the wash, embers)
 *   mark  – what the nib does to the paper itself (burns, dry scratches)
 * Both fade a little every few frames so the last ~20 s of attempts stay visible.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Points,
  RingGeometry,
  CircleGeometry,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Scene,
  type Texture,
} from 'three';
import { valueNoise } from '../model/heart';
import { strokePath, type PathPoint } from '../model/path';
import type { StrokeStyle } from '../model/stroke';
import { RETICLE_LIMIT, SHEET_CENTER, SHEET_H, SHEET_W, sheetToWorld } from './layout';
import { pointsMaterial } from './materials';
import { glowTexture, paperTexture } from './textures';

const GW = 1024;
const GH = Math.round(GW / Math.SQRT2);
const MW = 512;
const MH = Math.round(MW / Math.SQRT2);
/** Fade so that a mark is ~2% after 20 s, applied in steps (8-bit canvases). */
const FADE_STEP = 0.2;
const FADE_ALPHA = 1 - Math.pow(0.02, FADE_STEP / 20);
const MAX_SPARKS = 140;
const TICKS = 28;
/** Width of the groove a dry ball scores into the paper (glow-canvas pixels). */
const SCORE_W = 6.5;

function segment(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

interface Spark {
  p: Vector3;
  v: Vector3;
  life: number;
  max: number;
}

export interface Mark {
  /** Sheet-plane centre (metres). */
  cx: number;
  cy: number;
  /** Half-width of the heart (metres). */
  scale: number;
  seed: number;
  /** Direction the mark is thrown off-axis (unit, sheet plane). */
  ox: number;
  oy: number;
}

export class Sheet {
  readonly mesh: Mesh;
  readonly reticle = new Group();
  private glowCanvas = document.createElement('canvas');
  private markCanvas = document.createElement('canvas');
  private g: CanvasRenderingContext2D;
  private m: CanvasRenderingContext2D;
  private glowTex: CanvasTexture;
  private markTex: CanvasTexture;
  private fadeClock = 0;
  private dirty = 0;
  private frame = 0;

  private mark: Mark | null = null;
  private last: { x: number; y: number } | null = null;
  private lastSeg = 0;
  private pp: PathPoint = { x: 0, y: 0, seg: 0 };
  private sparkAcc = 0;
  private sparks: Spark[] = [];
  private sparkGeo = new BufferGeometry();
  private sparkPos = new Float32Array(MAX_SPARKS * 3);
  private sparkCol = new Float32Array(MAX_SPARKS * 3);
  private sparkSize = new Float32Array(MAX_SPARKS);
  private contact: Sprite;
  private reticleMat = new MeshBasicMaterial({ color: new Color(0.5, 0.4, 1.4), toneMapped: false, transparent: true, opacity: 0.9, depthWrite: false });
  private tickMat = new MeshBasicMaterial({ color: new Color(0.7, 0.55, 2.2), toneMapped: false, transparent: true, depthWrite: false });
  private ticks: Mesh[] = [];

  constructor(scene: Scene, pixelRatio: number) {
    this.glowCanvas.width = GW;
    this.glowCanvas.height = GH;
    this.markCanvas.width = MW;
    this.markCanvas.height = MH;
    // CPU-backed canvases: uploading a GPU-accelerated 2D canvas to WebGL forces a
    // readback (~8 ms for both on a desktop GPU); a software canvas is a plain copy.
    this.g = this.glowCanvas.getContext('2d', { willReadFrequently: true })!;
    this.m = this.markCanvas.getContext('2d', { willReadFrequently: true })!;
    this.clear();

    this.glowTex = new CanvasTexture(this.glowCanvas);
    this.glowTex.colorSpace = SRGBColorSpace;
    // The mark canvas is data (a multiplier), so it is sampled linearly.
    this.markTex = new CanvasTexture(this.markCanvas);

    const mat = new MeshStandardMaterial({
      map: paperTexture(),
      color: new Color(1.0, 0.95, 0.87),
      roughness: 0.92,
      metalness: 0,
      emissive: new Color(1, 1, 1),
      emissiveMap: this.glowTex,
      emissiveIntensity: 2.0,
    });
    const markTex: Texture = this.markTex;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uMark = { value: markTex };
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D uMark;')
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
           // Paper darkened by burns and scratches. The 8-bit fade toward white
           // stalls around 242/255, so that residue is mapped back to clean paper.
           vec3 markSample = texture2D(uMark, vEmissiveMapUv).rgb;
           diffuseColor.rgb *= clamp(markSample / 0.945, 0.0, 1.0);
           // The pool of light the page sits in: brightest at the middle, falling off to the corners.
           float pool = smoothstep(1.05, 0.25, length((vEmissiveMapUv - 0.5) * vec2(2.0, 1.45)));
           diffuseColor.rgb *= mix(0.58, 1.08, pool);`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#ifdef USE_EMISSIVEMAP
             vec4 emissiveColor = texture2D(emissiveMap, vEmissiveMapUv);
             // The fade toward black stalls around 13/255 (linear ≈ 0.004): clip it.
             totalEmissiveRadiance *= max(emissiveColor.rgb - 0.006, 0.0);
           #endif`,
        );
    };
    const geo = new PlaneGeometry(SHEET_W, SHEET_H);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new Mesh(geo, mat);
    this.mesh.name = 'sheet';
    this.mesh.position.copy(SHEET_CENTER);
    scene.add(this.mesh);

    // Ni's target reticle: a ring, a cross and a compile-progress dial of ticks.
    const ring = new Mesh(new RingGeometry(0.15, 0.17, 48), this.reticleMat);
    const dot = new Mesh(new CircleGeometry(0.018, 16), this.reticleMat);
    const crossGeo = new PlaneGeometry(0.08, 0.008);
    for (let i = 0; i < 4; i++) {
      const c = new Mesh(crossGeo, this.reticleMat);
      const a = (i * Math.PI) / 2;
      c.position.set(Math.cos(a) * 0.23, Math.sin(a) * 0.23, 0);
      c.rotation.z = a;
      this.reticle.add(c);
    }
    const tickGeo = new PlaneGeometry(0.012, 0.04);
    for (let i = 0; i < TICKS; i++) {
      const a = Math.PI / 2 - (i / TICKS) * Math.PI * 2;
      const t = new Mesh(tickGeo, this.tickMat);
      t.position.set(Math.cos(a) * 0.205, Math.sin(a) * 0.205, 0);
      t.rotation.z = a - Math.PI / 2;
      this.ticks.push(t);
      this.reticle.add(t);
    }
    this.reticle.add(ring, dot);
    this.reticle.rotation.x = -Math.PI / 2;
    this.reticle.renderOrder = 5;
    scene.add(this.reticle);

    // Sparks thrown off by a burning nib.
    this.sparkGeo.setAttribute('position', new BufferAttribute(this.sparkPos, 3));
    this.sparkGeo.setAttribute('color', new BufferAttribute(this.sparkCol, 3));
    this.sparkGeo.setAttribute('size', new BufferAttribute(this.sparkSize, 1));
    const sparkPts = new Points(this.sparkGeo, pointsMaterial(glowTexture(), pixelRatio));
    sparkPts.frustumCulled = false;
    scene.add(sparkPts);

    // Light where the beam touches the paper.
    this.contact = new Sprite(
      new SpriteMaterial({ map: glowTexture(), blending: AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }),
    );
    this.contact.scale.setScalar(0.6);
    scene.add(this.contact);
  }

  clear(): void {
    this.g.globalCompositeOperation = 'source-over';
    this.g.fillStyle = '#000';
    this.g.fillRect(0, 0, GW, GH);
    this.m.globalCompositeOperation = 'source-over';
    this.m.fillStyle = '#fff';
    this.m.fillRect(0, 0, MW, MH);
    this.dirty = 2;
    this.sparks.length = 0;
  }

  setReticle(x: number, y: number, intent: number, D: number, time: number, reducedMotion: boolean): void {
    sheetToWorld(x, y, this.reticle.position);
    this.reticle.position.y += 0.003;
    const lit = Math.round(intent * TICKS);
    for (let i = 0; i < TICKS; i++) this.ticks[i].visible = i < lit;
    const pulse = reducedMotion ? 1 : 0.85 + 0.15 * Math.sin(time * 5);
    const k = (0.5 + 1.4 * D) * pulse;
    this.reticleMat.color.setRGB(0.42 * k, 0.32 * k, 1.2 * k);
    this.reticle.rotation.z = reducedMotion ? 0 : time * 0.2 * (1 - D);
  }

  static clampReticle(x: number, y: number): { x: number; y: number } {
    return {
      x: Math.max(-RETICLE_LIMIT.x, Math.min(RETICLE_LIMIT.x, x)),
      y: Math.max(-RETICLE_LIMIT.y, Math.min(RETICLE_LIMIT.y, y)),
    };
  }

  begin(mark: Mark): void {
    this.mark = mark;
    this.last = null;
    this.lastSeg = 0;
  }

  end(): void {
    this.mark = null;
    this.last = null;
  }

  /** Centre of the mark being written (sheet plane): thrown off-axis, but never entirely off the page. */
  markCenter(style: StrokeStyle, out: { x: number; y: number }): { x: number; y: number } | null {
    const mk = this.mark;
    if (!mk) return null;
    const off = style.offAxis * mk.scale * 1.7;
    const mx = SHEET_W / 2 - 0.6 * mk.scale;
    const my = SHEET_H / 2 - 0.6 * mk.scale;
    out.x = Math.max(-mx, Math.min(mx, mk.cx + mk.ox * off));
    out.y = Math.max(-my, Math.min(my, mk.cy + mk.oy * off));
    return out;
  }

  /** Sheet-plane point (metres) on the path at progress u, for the current style. */
  pathPoint(u: number, style: StrokeStyle, out: { x: number; y: number }): { x: number; y: number } {
    const mk = this.mark!;
    const p = strokePath(u, { jitter: style.jitter, scrawl: style.scrawl, seed: mk.seed, frame: this.frame }, this.pp);
    const c = this.markCenter(style, out)!;
    out.x = c.x + p.x * mk.scale;
    out.y = c.y + p.y * mk.scale;
    return out;
  }

  /** Paint the stroke from the previous nib position to progress u. Returns the world draw point. */
  drawTo(u: number, style: StrokeStyle, dt: number, worldOut: Vector3): Vector3 {
    if (!this.mark) return worldOut;
    this.frame++;
    const p = this.pathPoint(u, style, { x: 0, y: 0 });
    sheetToWorld(p.x, p.y, worldOut);
    // A scrawl jumps: the nib lifts and lands somewhere else, so don't connect across.
    if (this.pp.seg !== this.lastSeg) this.last = null;
    this.lastSeg = this.pp.seg;
    const prev = this.last ?? p;
    const mk = this.mark;

    // A dry nib skips more often, in shorter beats.
    const visible = valueNoise(u * (34 + 40 * style.score), mk.seed + 3) > 1 - 2 * style.coverage;
    if (visible) this.paint(prev, p, style);
    this.last = p;
    this.dirty = Math.max(this.dirty, 1);

    // Sparks (scribble).
    this.sparkAcc += style.sparks * dt;
    while (this.sparkAcc >= 1) {
      this.sparkAcc -= 1;
      this.spawnSpark(worldOut);
    }

    const [r, g, b] = style.color;
    this.contact.position.copy(worldOut).setY(worldOut.y + 0.02);
    this.contact.material.color.setRGB(r, g, b);
    // Light where the beam touches the paper; a dry nib brings none.
    this.contact.material.opacity = Math.min(1, style.alpha * (0.2 + style.glow)) * (visible ? 1 : 0.4) * (1 - style.score);
    this.contact.scale.setScalar(0.25 + 0.6 * style.softness + 0.35 * style.glow);
    return worldOut;
  }

  private toGlow(p: { x: number; y: number }): [number, number] {
    return [(p.x / SHEET_W + 0.5) * GW, (0.5 - p.y / SHEET_H) * GH];
  }

  private paint(a: { x: number; y: number }, b: { x: number; y: number }, s: StrokeStyle): void {
    const [ax, ay] = this.toGlow(a);
    const [bx, by] = this.toGlow(b);
    const dist = Math.hypot(bx - ax, by - ay);
    const rgb = s.color.map((v) => Math.round(Math.min(1, v) * 255)).join(',');
    const g = this.g;
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    g.lineJoin = 'round';

    // How much of this is a burn (char that glows only at its edge) and how much
    // a dry score (no light at all, just a groove pressed into the paper).
    const burn = s.inkTone * Math.min(1, s.ink / 0.6);
    const score = s.score;

    // Crisp core of light.
    const coreA = s.alpha * (1 - s.softness) * (1 - score) * (1 - 0.9 * burn);
    if (coreA > 0.01) {
      g.strokeStyle = `rgba(${rgb},${coreA.toFixed(3)})`;
      g.lineWidth = s.width;
      segment(g, ax, ay, bx, by);
      if (s.glow > 0.4) {
        // Hot centre line, toward white.
        g.strokeStyle = `rgba(255,${150 + Math.round(40 * s.glow)},215,${(0.4 * s.glow * coreA).toFixed(3)})`;
        g.lineWidth = Math.max(1, s.width * 0.35);
        segment(g, ax, ay, bx, by);
      }
    }

    // A burn: embers glow along the edges of the char, hotter with more energy.
    if (burn > 0.05) {
      const heat = Math.min(1, 0.3 + 2 * s.glow);
      g.strokeStyle = `rgba(255,${Math.round(80 + 70 * heat * Math.random())},18,${(0.85 * burn * heat).toFixed(3)})`;
      g.lineWidth = s.width * 2.3;
      segment(g, ax, ay, bx, by);
      // The char itself gives off no light: cut the centre back to black.
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = `rgba(0,0,0,${(0.92 * burn).toFixed(3)})`;
      g.lineWidth = s.width * 1.5;
      segment(g, ax, ay, bx, by);
      g.globalCompositeOperation = 'lighter';
    }

    // A score: the paper displaced by the ball rises as a faint burr on either side.
    if (score > 0.05 && dist > 0.01) {
      const nx = (-(by - ay) / dist) * (SCORE_W * 0.5 + 1.6);
      const ny = ((bx - ax) / dist) * (SCORE_W * 0.5 + 1.6);
      g.lineWidth = 1.6;
      g.strokeStyle = `rgba(255,250,238,${(0.38 * score).toFixed(3)})`;
      segment(g, ax + nx, ay + ny, bx + nx, by + ny);
      g.strokeStyle = `rgba(255,250,238,${(0.18 * score).toFixed(3)})`;
      segment(g, ax - nx, ay - ny, bx - nx, by - ny);
    }

    // Soft halo stamps; deposit is per unit length so the result is speed-independent.
    const rad = s.width * 1.5 + s.softness * s.width * 1.3 + s.glow * 16;
    const deposit =
      s.alpha * (0.22 * s.glow + 3.2 * s.softness) * (1 - burn) * (1 - score) * Math.min(1, Math.max(dist, 2) / (rad * 0.5));
    if (deposit > 0.004) {
      // A soft wash converges on its colour (source-over) instead of adding up to white.
      g.globalCompositeOperation = s.softness > 0.5 ? 'source-over' : 'lighter';
      const steps = Math.max(1, Math.ceil(dist / (rad * 0.4)));
      const a1 = Math.min(1, deposit / steps);
      for (let i = 1; i <= steps; i++) {
        const x = ax + ((bx - ax) * i) / steps;
        const y = ay + ((by - ay) * i) / steps;
        const grad = g.createRadialGradient(x, y, 0, x, y, rad);
        grad.addColorStop(0, `rgba(${rgb},${a1.toFixed(4)})`);
        grad.addColorStop(1, `rgba(${rgb},0)`);
        g.fillStyle = grad;
        g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
    }

    // Ink: the paper itself, scorched or scored.
    if (s.ink > 0.02) {
      const m = this.m;
      const k = MW / GW;
      const tone = s.inkTone;
      m.globalCompositeOperation = 'source-over';
      m.lineCap = 'round';
      if (tone > 0.3) {
        // Scorched halo around the burn, under the charcoal core.
        m.strokeStyle = `rgba(62,36,20,${(0.38 * s.ink * tone).toFixed(3)})`;
        m.lineWidth = s.width * 5 * k;
        segment(m, ax * k, ay * k, bx * k, by * k);
      }
      const r = Math.round(50 - 30 * tone);
      const gg = Math.round(50 - 36 * tone);
      const bb = Math.round(56 - 42 * tone);
      m.strokeStyle = `rgba(${r},${gg},${bb},${s.ink.toFixed(3)})`;
      m.lineWidth = Math.max(1.3, (SCORE_W * (1 - tone) + s.width * 1.6 * tone) * k);
      segment(m, ax * k, ay * k, bx * k, by * k);
    }
  }

  private spawnSpark(at: Vector3): void {
    if (this.sparks.length >= MAX_SPARKS) return;
    const a = Math.random() * Math.PI * 2;
    const sp = 0.6 + Math.random() * 1.6;
    this.sparks.push({
      p: at.clone().setY(at.y + 0.02),
      v: new Vector3(Math.cos(a) * sp, 1.2 + Math.random() * 1.8, Math.sin(a) * sp),
      life: 0,
      max: 0.35 + Math.random() * 0.6,
    });
  }

  update(dt: number): void {
    // Fade in discrete steps (8-bit canvases cannot fade by tiny amounts per frame).
    this.fadeClock += dt;
    if (this.fadeClock >= FADE_STEP) {
      this.fadeClock -= FADE_STEP;
      this.g.globalCompositeOperation = 'source-over';
      this.g.fillStyle = `rgba(0,0,0,${FADE_ALPHA})`;
      this.g.fillRect(0, 0, GW, GH);
      this.m.globalCompositeOperation = 'source-over';
      this.m.fillStyle = `rgba(255,255,255,${FADE_ALPHA})`;
      this.m.fillRect(0, 0, MW, MH);
      this.dirty = 2;
    }
    if (this.dirty === 2 || (this.dirty === 1 && this.frame % 2 === 0)) {
      this.glowTex.needsUpdate = true;
      this.markTex.needsUpdate = true;
      this.dirty = 0;
    }
    if (!this.mark) this.contact.material.opacity = Math.max(0, this.contact.material.opacity - dt * 3);

    // Spark physics: ballistic, bounce once on the floor, cool from yellow to red.
    let n = 0;
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life += dt;
      if (s.life > s.max) {
        this.sparks.splice(i, 1);
        continue;
      }
      s.v.y -= 7 * dt;
      s.p.addScaledVector(s.v, dt);
      if (s.p.y < SHEET_CENTER.y + 0.01) {
        s.p.y = SHEET_CENTER.y + 0.01;
        s.v.y *= -0.35;
        s.v.x *= 0.6;
        s.v.z *= 0.6;
      }
    }
    for (const s of this.sparks) {
      const k = 1 - s.life / s.max;
      this.sparkPos[n * 3] = s.p.x;
      this.sparkPos[n * 3 + 1] = s.p.y;
      this.sparkPos[n * 3 + 2] = s.p.z;
      this.sparkCol[n * 3] = 2.2 * k;
      this.sparkCol[n * 3 + 1] = 0.9 * k * k;
      this.sparkCol[n * 3 + 2] = 0.2 * k * k * k;
      this.sparkSize[n] = 0.05 + 0.04 * k;
      n++;
    }
    this.sparkGeo.setDrawRange(0, n);
    (this.sparkGeo.attributes.position as BufferAttribute).needsUpdate = true;
    (this.sparkGeo.attributes.color as BufferAttribute).needsUpdate = true;
    (this.sparkGeo.attributes.size as BufferAttribute).needsUpdate = true;
  }
}
