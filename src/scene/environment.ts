/** Deep-space stage: fog, a soft procedural environment map, dim lights and a dark floor. */
import {
  AmbientLight,
  CircleGeometry,
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PMREMGenerator,
  SpotLight,
  type Scene,
  type WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CONSTRUCT_CENTER, SHEET_CENTER } from './layout';
import { floorTexture } from './textures';

export const BG = new Color(0x05060b);

export function buildEnvironment(scene: Scene, renderer: WebGLRenderer): void {
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
  scene.environmentIntensity = 0.32;

  scene.add(new AmbientLight(0x1a2030, 0.6));
  scene.add(new HemisphereLight(0x5a6c99, 0x0a0806, 0.35));

  // A cool key light to pick out machined edges.
  const key = new DirectionalLight(0xb9cdf5, 1.1);
  key.position.set(-4, 10, 8);
  key.target.position.copy(CONSTRUCT_CENTER);
  scene.add(key, key.target);
  const rim = new DirectionalLight(0x6f7cff, 0.6);
  rim.position.set(6, 4, -8);
  scene.add(rim);

  // Soft pool of light on the paper.
  const spot = new SpotLight(0xfff1e0, 4.5, 14, 0.42, 0.85, 1.4);
  spot.position.set(SHEET_CENTER.x - 1.0, 7.5, SHEET_CENTER.z + 1.6);
  spot.target.position.copy(SHEET_CENTER);
  scene.add(spot, spot.target);

  const floor = new Mesh(
    new CircleGeometry(40, 64),
    new MeshStandardMaterial({ map: floorTexture(), roughness: 0.82, metalness: 0.25, color: 0xffffff }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(-1, 0, -1);
  floor.scale.setScalar(1);
  floor.name = 'floor';
  scene.add(floor);
}
