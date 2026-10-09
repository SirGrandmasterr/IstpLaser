/** Shared materials: cold machined hardware and the additive beam/glow shaders. */
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  ShaderMaterial,
  type Texture,
} from 'three';
import { brushedTexture, knurlTexture } from './textures';

let brushed: Texture | null = null;
let knurl: Texture | null = null;

/** Dark anodised titanium. */
export function titanium(tint = 0x262a33, roughness = 0.32): MeshStandardMaterial {
  brushed ??= brushedTexture();
  return new MeshStandardMaterial({
    color: tint,
    metalness: 0.92,
    roughness,
    bumpMap: brushed,
    bumpScale: 0.6,
  });
}

/** Knurled titanium for grip rings; `repeat` is the number of diamonds around. */
export function knurled(repeat: number, tint = 0x30343e): MeshStandardMaterial {
  knurl ??= knurlTexture();
  const t = knurl.clone();
  t.needsUpdate = true;
  t.repeat.set(repeat, 2);
  return new MeshStandardMaterial({ color: tint, metalness: 0.95, roughness: 0.38, bumpMap: t, bumpScale: 2.2 });
}

/** Optical glass. Transparent rather than transmissive to stay cheap on integrated GPUs. */
export function glass(color: number, opacity = 0.3): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    color,
    metalness: 0.05,
    roughness: 0.06,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.6,
    transparent: true,
    opacity,
    side: DoubleSide,
    depthWrite: false,
    emissive: new Color(0x000000),
  });
}

/**
 * Additive, view-dependent glow for instanced beam cylinders: bright where the
 * tube faces the camera, fading to nothing at its silhouette.
 */
export function beamMaterial(power: number, gain: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uPower: { value: power }, uGain: { value: gain } },
    vertexShader: /* glsl */ `
      varying vec3 vColor;
      varying float vFacing;
      void main() {
        mat4 m = modelMatrix * instanceMatrix;
        vec4 wp = m * vec4(position, 1.0);
        vec3 n = normalize(mat3(m) * vec3(normal.x, 0.0, normal.z));
        vec3 v = normalize(cameraPosition - wp.xyz);
        vFacing = abs(dot(n, v));
        #ifdef USE_INSTANCING_COLOR
          vColor = instanceColor;
        #else
          vColor = vec3(1.0);
        #endif
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uPower;
      uniform float uGain;
      varying vec3 vColor;
      varying float vFacing;
      void main() {
        float k = pow(vFacing, uPower) * uGain;
        gl_FragColor = vec4(vColor * k, 1.0);
      }
    `,
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  });
}

/** Additive point sprites with per-vertex colour (pre-multiplied intensity) and size. */
export function pointsMaterial(map: Texture, pixelRatio: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uMap: { value: map }, uScale: { value: 400 * pixelRatio } },
    vertexShader: /* glsl */ `
      attribute float size;
      attribute vec3 color;
      uniform float uScale;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * uScale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      varying vec3 vColor;
      void main() {
        float a = texture2D(uMap, gl_PointCoord).r;
        gl_FragColor = vec4(vColor * a, 1.0);
      }
    `,
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}
