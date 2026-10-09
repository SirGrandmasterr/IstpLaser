/**
 * Deep-space stage: fog, a soft procedural environment map, dim lights and a dark floor.
 * The ambient part dims a little while the pipeline is dormant.
 */
import {
  AmbientLight,
  CircleGeometry,
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PMREMGenerator,
  SpotLight,
  type Scene,
  type WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CONSTRUCT_CENTER, SHEET_CENTER } from './layout';
import { floorTexture, poolTexture } from './textures';

export const BG = new Color(0x05060b);

export interface Ambience {
  /** 0 = normal, 1 = dormant: the construct's ambient glow dims slightly. */
  setDormancy(k: number): void;
}

const ENV_INTENSITY = 0.32;

export function buildEnvironment(scene: Scene, renderer: WebGLRenderer): Ambience {
  scene.background = BG;
  scene.fog = new FogExp2(BG.getHex(), 0.028);

  // PMREM's one-off blur shaders trip harmless D3D precision notes (X4122) on
  // Windows/ANGLE; they are compiled, used once and disposed here, so skip the
  // info-log check just for this step.
  const check = renderer.debug.checkShaderErrors;
  renderer.debug.checkShaderErrors = false;
  const pmrem = new PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  renderer.debug.checkShaderErrors = check;
  scene.environment = env;
  scene.environmentIntensity = ENV_INTENSITY;

  const ambient = new AmbientLight(0x1a2030, 0.6);
  const hemi = new HemisphereLight(0x5a6c99, 0x0a0806, 0.35);
  scene.add(ambient, hemi);

  // A cool key light to pick out machined edges.
  const key = new DirectionalLight(0xb9cdf5, 1.1);
  key.position.set(-4, 10, 8);
  key.target.position.copy(CONSTRUCT_CENTER);
  scene.add(key, key.target);
  const rim = new DirectionalLight(0x6f7cff, 0.6);
  rim.position.set(6, 4, -8);
  scene.add(rim);

  // Soft pool of light on the paper.
  const spot = new SpotLight(0xfff1e0, 9, 14, 0.36, 0.85, 1.4);
  spot.position.set(SHEET_CENTER.x - 1.0, 7.5, SHEET_CENTER.z + 1.6);
  spot.target.position.copy(SHEET_CENTER);
  scene.add(spot, spot.target);
  // …and the warm spill it leaves on the floor around the page.
  const spill = new Mesh(
    new CircleGeometry(4.2, 48),
    new MeshBasicMaterial({ map: poolTexture(), color: 0xffe2c0, transparent: true, opacity: 0.1, depthWrite: false }),
  );
  spill.rotation.x = -Math.PI / 2;
  spill.position.set(SHEET_CENTER.x - 0.2, 0.002, SHEET_CENTER.z + 0.2);
  scene.add(spill);

  const floor = new Mesh(
    new CircleGeometry(40, 64),
    new MeshStandardMaterial({ map: floorTexture(), roughness: 0.82, metalness: 0.25, color: 0xffffff }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(-1, 0, -1);
  floor.scale.setScalar(1);
  floor.name = 'floor';
  scene.add(floor);

  return {
    setDormancy(k: number): void {
      scene.environmentIntensity = ENV_INTENSITY * (1 - 0.4 * k);
      ambient.intensity = 0.6 * (1 - 0.45 * k);
      hemi.intensity = 0.35 * (1 - 0.45 * k);
    },
  };
}
