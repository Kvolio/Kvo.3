import {
  BackSide,
  BufferAttribute,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PMREMGenerator,
  Scene,
  SphereGeometry,
  Vector3,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { QualitySettings } from '../core/QualityTier.js';

/**
 * Sky, lighting and image-based lighting — all of it generated, none of it
 * loaded.
 *
 * `Sky` and `RoomEnvironment` ship as *code* in three's examples, not as
 * assets, so a physically-plausible outdoor sky and a plausible interior light
 * probe both cost nothing but a PMREM pass. That matters here because the
 * project ships no image files at all, and unlit interiors would otherwise be
 * the obvious place to cheat.
 */

export interface EnvironmentOptions {
  /** Sun elevation above the horizon, degrees. */
  readonly sunElevation?: number;
  /** Sun compass bearing, degrees. */
  readonly sunAzimuth?: number;
  readonly turbidity?: number;
}

export class Environment {
  readonly sky: Sky;
  readonly sun = new DirectionalLight(0xfff3e0, 2.6);
  readonly fill: HemisphereLight;
  readonly sunDirection = new Vector3();

  private outdoorEnv: Texture | null = null;
  private indoorEnv: Texture | null = null;
  private pmrem: PMREMGenerator | null = null;

  constructor(
    private readonly scene: Scene,
    private readonly quality: QualitySettings,
    opts: EnvironmentOptions = {},
  ) {
    const elevation = opts.sunElevation ?? 38;
    const azimuth = opts.sunAzimuth ?? 138;

    this.sky = new Sky();
    // Comfortably inside the camera's far plane. A sky scaled past it is
    // clipped, and - worse - is invisible to the PMREM capture camera, which
    // silently yields a black environment probe and renders every metallic
    // surface in the scene black.
    this.sky.scale.setScalar(SKY_SCALE);
    const uniforms = this.sky.material.uniforms;
    uniforms['turbidity']!.value = opts.turbidity ?? 4.5;
    uniforms['rayleigh']!.value = 1.6;
    uniforms['mieCoefficient']!.value = 0.006;
    uniforms['mieDirectionalG']!.value = 0.82;

    const phi = ((90 - elevation) * Math.PI) / 180;
    const theta = (azimuth * Math.PI) / 180;
    this.sunDirection.setFromSphericalCoords(1, phi, theta);
    uniforms['sunPosition']!.value.copy(this.sunDirection);

    scene.add(this.sky);

    this.sun.position.copy(this.sunDirection).multiplyScalar(60);
    this.sun.target.position.set(0, 0, 0);
    scene.add(this.sun);
    scene.add(this.sun.target);

    if (quality.shadowMapSize > 0) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.setScalar(quality.shadowMapSize);
      // Tight frustum around the vehicle: a 57-tonne tank is about 8 m long, so
      // a 16 m box keeps texel density high where it matters.
      const extent = 9;
      this.sun.shadow.camera.left = -extent;
      this.sun.shadow.camera.right = extent;
      this.sun.shadow.camera.top = extent;
      this.sun.shadow.camera.bottom = -extent;
      this.sun.shadow.camera.near = 1;
      this.sun.shadow.camera.far = 140;
      this.sun.shadow.bias = -0.0008;
      this.sun.shadow.normalBias = 0.02;
    }

    // Sky bounce. Shadowed vertical armour under an open sky sits at roughly a
    // fifth of the sunlit faces, not at black, and this is what carries that.
    this.fill = new HemisphereLight(0xa9c4e0, 0x6a5c44, 0.95);
    scene.add(this.fill);
  }

  /** Build the IBL probes. Needs a renderer, so it happens after construction. */
  prepare(renderer: WebGLRenderer): void {
    this.pmrem = new PMREMGenerator(renderer);
    this.pmrem.compileEquirectangularShader();

    // The light probe is built from a bounded gradient dome, NOT from the
    // Preetham sky above.
    //
    // three's sky shader multiplies the sun disc by 19000, which overflows the
    // half-float render targets PMREM uses. The resulting Inf spreads through
    // the convolution as NaN, and a NaN environment map turns every physical
    // material in the scene pure black — swallowing emissive, and ignoring
    // exposure and light intensity, because NaN plus anything is NaN. It looks
    // exactly like a lighting failure and is not one.
    //
    // A probe's job here is the sky's ambient bounce; the sun is already a
    // DirectionalLight. So the dome carries the sky's colours without its
    // unbounded sun, which is both correct and incapable of overflowing.
    const skyScene = new Scene();
    const dome = buildSkyProbeDome(this.sunDirection.y);
    skyScene.add(dome);
    this.outdoorEnv = this.pmrem.fromScene(skyScene, 0.04, 0.1, PROBE_RADIUS * 4).texture;
    dome.geometry.dispose();
    (dome.material as MeshBasicMaterial).dispose();

    // A separate probe for interiors: inside the hull the dominant light is
    // bounce off painted plate, not sky, and using the outdoor probe in there
    // makes the fighting compartment look like it has no roof.
    const room = new RoomEnvironment();
    // Sigma kept under the sample limit; larger values clip with a warning and
    // give a worse probe rather than a smoother one.
    this.indoorEnv = this.pmrem.fromScene(room, 0.04).texture;
    room.dispose?.();

    this.scene.environment = this.outdoorEnv;
    this.scene.environmentIntensity = 1.15;
  }

  /** Swap the light probe as the player crosses between inside and outside. */
  setInterior(interior: boolean): void {
    const target = interior ? this.indoorEnv : this.outdoorEnv;
    if (target && this.scene.environment !== target) {
      this.scene.environment = target;
      this.scene.environmentIntensity = interior ? 0.6 : 1.15;
      this.fill.intensity = interior ? 0.3 : 0.95;
    }
  }

  get shadowsEnabled(): boolean {
    return this.quality.shadowMapSize > 0;
  }

  dispose(): void {
    this.outdoorEnv?.dispose();
    this.indoorEnv?.dispose();
    this.pmrem?.dispose();
    this.sky.geometry.dispose();
    this.sky.material.dispose();
  }
}

/** Sky dome size in scene units. Must stay inside the camera's far plane. */
const SKY_SCALE = 1200;
/** Probe dome radius. Small, so the PMREM capture camera's frustum contains it. */
const PROBE_RADIUS = 40;

/**
 * A vertex-coloured dome standing in for the sky when generating the light
 * probe: zenith blue overhead, warm haze at the horizon, dull bounce below.
 *
 * Every value is bounded by construction, which is the entire point.
 */
function buildSkyProbeDome(sunHeight: number): Mesh {
  const geometry = new SphereGeometry(PROBE_RADIUS, 24, 16);
  const position = geometry.getAttribute('position');
  const colours = new Float32Array(position.count * 3);

  // Warmer and dimmer as the sun approaches the horizon.
  const daylight = Math.max(0.08, Math.min(1, sunHeight));
  const zenith = new Color(0x5b8ec4).multiplyScalar(0.9 * daylight);
  const horizon = new Color(0xcfc4a8).multiplyScalar(1.05 * daylight);
  const belowHorizon = new Color(0x5a4f3c).multiplyScalar(0.35 * daylight);
  const mixed = new Color();

  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i) / PROBE_RADIUS;
    if (y >= 0) {
      mixed.copy(horizon).lerp(zenith, Math.pow(y, 0.6));
    } else {
      mixed.copy(horizon).lerp(belowHorizon, Math.min(1, -y * 2.2));
    }
    colours[i * 3] = mixed.r;
    colours[i * 3 + 1] = mixed.g;
    colours[i * 3 + 2] = mixed.b;
  }
  geometry.setAttribute('color', new BufferAttribute(colours, 3));

  return new Mesh(
    geometry,
    new MeshBasicMaterial({ vertexColors: true, side: BackSide, toneMapped: false }),
  );
}
