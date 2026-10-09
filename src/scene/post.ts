/** Bloom for the beam and heart; vignette and film grain on top. Hardware stays crisp. */
import { Vector2, type Camera, type Scene, type WebGLRenderer } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

const FinishShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.045 },
    uVignette: { value: 0.9 },
    uAspect: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uGrain;
    uniform float uVignette;
    uniform float uAspect;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
      float v = smoothstep(1.25, 0.25, length(q) * uVignette);
      c.rgb *= mix(0.55, 1.0, v);
      float g = hash(vUv * 1024.0 + fract(uTime * 7.13) * 91.7) - 0.5;
      c.rgb += g * uGrain * (0.6 + 0.4 * (1.0 - dot(c.rgb, vec3(0.333))));
      gl_FragColor = c;
    }
  `,
};

export class Post {
  readonly composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private finish: ShaderPass;

  constructor(renderer: WebGLRenderer, scene: Scene, camera: Camera) {
    const size = renderer.getSize(new Vector2());
    // EffectComposer's targets are HalfFloat by default, so the beam can exceed 1.0 before bloom.
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new Vector2(size.x / 2, size.y / 2), 0.62, 0.42, 0.88);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.finish = new ShaderPass(FinishShader);
    this.composer.addPass(this.finish);
  }

  setSize(w: number, h: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / 2, h / 2);
    this.finish.uniforms.uAspect.value = w / h;
  }

  render(time: number, reducedMotion: boolean): void {
    this.finish.uniforms.uTime.value = reducedMotion ? 0 : time;
    this.composer.render();
  }
}
