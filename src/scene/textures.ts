/** Procedural textures, generated at runtime (no downloaded assets). */
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return [c, ctx];
}

/** Off-white paper with faint fibres and tooth. */
export function paperTexture(): Texture {
  const [c, ctx] = canvas(512, 512);
  ctx.fillStyle = '#e9e3d6';
  ctx.fillRect(0, 0, 512, 512);
  const img = ctx.getImageData(0, 0, 512, 512);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 10;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n * 0.9;
  }
  ctx.putImageData(img, 0, 0);
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = '#8a8070';
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const a = Math.random() * Math.PI;
    const l = 4 + Math.random() * 14;
    ctx.lineWidth = 0.5 + Math.random() * 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a + 0.4) * l * 0.5, y + Math.sin(a + 0.4) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(2, 1.4);
  return t;
}

/** Diamond knurl pattern as a bump map; repeat around the ring. */
export function knurlTexture(): Texture {
  const [c, ctx] = canvas(64, 64);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 64, 64);
  // Two crossed sets of grooves → raised diamonds.
  ctx.globalCompositeOperation = 'multiply';
  for (const flip of [1, -1]) {
    ctx.save();
    if (flip < 0) {
      ctx.translate(64, 0);
      ctx.scale(-1, 1);
    }
    for (let k = -64; k < 128; k += 16) {
      ctx.strokeStyle = '#303030';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(k, 0);
      ctx.lineTo(k + 64, 64);
      ctx.stroke();
    }
    ctx.restore();
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

/** Fine machined line texture for anodised surfaces (subtle bump). */
export function brushedTexture(): Texture {
  const [c, ctx] = canvas(256, 16);
  for (let x = 0; x < 256; x++) {
    const v = 110 + Math.random() * 40;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, 0, 1, 16);
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

/** Grid lines for the Se flywheel (u around the ring, v around the tube). */
export function gridTextures(): { map: Texture; emissive: Texture } {
  const W = 1024;
  const H = 128;
  const [c, ctx] = canvas(W, H);
  const [e, ectx] = canvas(W, H);
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#7a4f14');
  grad.addColorStop(0.5, '#d29a3c');
  grad.addColorStop(1, '#7a4f14');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, W, H);
  const meridians = 32;
  for (let i = 0; i < meridians; i++) {
    const x = (i / meridians) * W;
    const major = i % 4 === 0;
    ctx.fillStyle = 'rgba(40,22,4,0.85)';
    ctx.fillRect(x, 0, major ? 5 : 2, H);
    ectx.fillStyle = major ? '#ffcf73' : '#a86d1d';
    ectx.fillRect(x, 0, major ? 4 : 2, H);
  }
  for (let j = 0; j < 4; j++) {
    const y = (j / 4) * H;
    ctx.fillStyle = 'rgba(40,22,4,0.7)';
    ctx.fillRect(0, y, W, 2);
    ectx.fillStyle = '#8a5a18';
    ectx.fillRect(0, y, W, 1);
  }
  const map = new CanvasTexture(c);
  const emissive = new CanvasTexture(e);
  for (const t of [map, emissive]) {
    t.colorSpace = SRGBColorSpace;
    t.wrapS = t.wrapT = RepeatWrapping;
  }
  return { map, emissive };
}

/** Soft round sprite for glows and particles. */
export function glowTexture(): Texture {
  const [c, ctx] = canvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Very dark floor with a soft pool of light under the construct. */
export function floorTexture(): Texture {
  const [c, ctx] = canvas(512, 512);
  const g = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
  g.addColorStop(0, '#1b1e28');
  g.addColorStop(0.45, '#0d0f16');
  g.addColorStop(1, '#05060a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = 'rgba(120,140,190,0.05)';
  ctx.lineWidth = 1;
  for (let r = 24; r < 256; r += 24) {
    ctx.beginPath();
    ctx.arc(256, 256, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}
