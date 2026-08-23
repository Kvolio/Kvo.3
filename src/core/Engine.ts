import type {
  Vector3} from 'three';
import {
  ACESFilmicToneMapping,
  OrthographicCamera,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import { R } from '../spec/units.js';
import { PLAYER_FOV } from '../spec/viewpoints.js';
import type { QualitySettings } from './QualityTier.js';

/**
 * Renderer, scene and camera.
 *
 * Thin by design: everything interesting lives in the systems that use it. Its
 * one real job is honouring the quality tier, since that is what makes the same
 * build run acceptably on a phone and on a desktop without a separate mobile
 * path.
 */
export class Engine {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly canvas: HTMLCanvasElement;

  private resizeObserver: ResizeObserver | null = null;

  /**
   * When set, rendering uses this instead of the player's camera.
   *
   * Orthographic elevations are how a silhouette is judged against a scale
   * drawing — a perspective view of a 6.3 m hull from any practical distance
   * foreshortens the far end and makes proportions unarguable in the wrong
   * direction.
   */
  private overrideCamera: OrthographicCamera | null = null;

  constructor(
    private readonly container: HTMLElement,
    private readonly quality: QualitySettings,
  ) {
    this.renderer = new WebGLRenderer({
      antialias: quality.antialias,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.canvas = this.renderer.domElement;
    this.renderer.setPixelRatio(this.effectivePixelRatio());
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.62;

    if (quality.shadowMapSize > 0) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = PCFSoftShadowMap;
    }

    container.appendChild(this.canvas);

    this.camera = new PerspectiveCamera(PLAYER_FOV, 1, 0.02, 3000);
    // Near plane at 20 mm: the player can put their eye right against a weld
    // bead or a bolt head, and a typical 0.1 m near plane would clip it away.

    this.resize();
    this.observeResize();
  }

  private effectivePixelRatio(): number {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
    return Math.min(dpr, this.quality.maxPixelRatio);
  }

  private observeResize(): void {
    if (typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
  }

  resize(): void {
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  setFieldOfView(degrees: number): void {
    this.camera.fov = degrees;
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    this.renderer.render(this.scene, this.overrideCamera ?? this.camera);
  }

  /**
   * Look at the vehicle down a fixed axis with an orthographic camera, framed to
   * an exact height in scene units so the render has a known millimetres-per-
   * pixel scale and can be measured rather than eyeballed.
   */
  setOrthographicView(eye: Vector3, target: Vector3, frustumHeight: number): void {
    const aspect = this.camera.aspect;
    const halfHeight = frustumHeight / 2;
    const halfWidth = halfHeight * aspect;

    const camera = this.overrideCamera ?? new OrthographicCamera(0, 0, 0, 0, 0.1, 20000);
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.position.copy(eye);
    // Looking straight down needs an up vector that is not also straight down.
    //
    // For the plan view that choice fixes which way round the vehicle reads,
    // and getting it wrong makes a correct model look mirrored. With up = -Z,
    // the vehicle's FORWARD points to the bottom of the frame and its PORT side
    // — the driver's, and the commander's cupola — is on the RIGHT. Screen right
    // is forward x up = (0,-1,0) x (0,0,-1) = +X, and +X is port; see the frame
    // note in spec/units.ts, which is the opposite of most people's first guess.
    const looksVertical = Math.abs(eye.clone().sub(target).normalize().y) > 0.99;
    camera.up.set(0, looksVertical ? 0 : 1, looksVertical ? -1 : 0);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    this.overrideCamera = camera;
  }

  /** Millimetres per rendered pixel for the current orthographic view. */
  orthographicScale(): number | null {
    if (!this.overrideCamera) return null;
    const height = this.overrideCamera.top - this.overrideCamera.bottom;
    return (height * 1000) / (this.container.clientHeight || 1);
  }

  clearOrthographicView(): void {
    this.overrideCamera = null;
  }

  /** Draw calls, triangles and memory for the debug overlay and the perf tests. */
  stats(): { calls: number; triangles: number; geometries: number; textures: number } {
    const info = this.renderer.info;
    return {
      calls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
    };
  }

  dispose(): void {
    this.resizeObserver?.disconnect();
    this.renderer.dispose();
    this.canvas.remove();
  }
}

/** Degrees of field of view, as radians, for anything that needs the frustum. */
export const playerFovRadians = R(PLAYER_FOV);
