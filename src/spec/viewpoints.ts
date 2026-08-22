import { mm, deg, type MM, type DEG } from './units.js';
import { OVERALL } from './overall.js';

/**
 * Named camera poses.
 *
 * These serve three jobs at once, which is why they live in the spec rather
 * than in the UI: they are the inspection positions the teleport buttons jump
 * to, the deterministic poses the Playwright visual suite renders from, and the
 * orthographic views the silhouette test measures against the drawing.
 */

export type ViewpointKind = 'exterior' | 'interior' | 'detail' | 'orthographic';

export interface Viewpoint {
  readonly id: string;
  readonly label: string;
  readonly kind: ViewpointKind;
  /** Eye position in vehicle coordinates. */
  readonly eye: readonly [MM, MM, MM];
  /** Point the camera looks at. */
  readonly target: readonly [MM, MM, MM];
  /** Orthographic views record the frustum height so renders are scale-exact. */
  readonly orthoHeight?: MM;
  /**
   * Interior viewpoints require the player to actually be inside. Teleporting
   * to one opens the named hatch first rather than passing through armour.
   */
  readonly viaHatch?: string;
}

/** Eye height of a standing 1.75 m adult, for the exterior walk-around poses. */
const EYE = mm(1650);

const p = (x: number, y: number, z: number): readonly [MM, MM, MM] => [mm(x), mm(y), mm(z)];

/** Six exterior inspection positions, matching the brief's position system. */
export const EXTERIOR_VIEWPOINTS: readonly Viewpoint[] = [
  {
    id: 'ext-front',
    label: 'Front',
    kind: 'exterior',
    eye: p(0, EYE, 7600),
    target: p(0, 1400, 0),
  },
  {
    id: 'ext-left',
    label: 'Left side',
    kind: 'exterior',
    eye: p(-6200, EYE, 0),
    target: p(0, 1400, 0),
  },
  {
    id: 'ext-right',
    label: 'Right side',
    kind: 'exterior',
    eye: p(6200, EYE, 0),
    target: p(0, 1400, 0),
  },
  {
    id: 'ext-rear',
    label: 'Rear',
    kind: 'exterior',
    eye: p(0, EYE, -6600),
    target: p(0, 1400, 0),
  },
  {
    id: 'ext-engine-deck',
    label: 'Engine deck',
    kind: 'exterior',
    eye: p(0, mm(1780 + 1650), -2000),
    target: p(0, 2200, 0),
  },
  {
    id: 'ext-turret-roof',
    label: 'Turret roof',
    kind: 'exterior',
    eye: p(0, mm(2610 + 1650), -1400),
    target: p(0, 2610, 900),
  },
];

/**
 * Six interior stations. Eye positions are seated head heights, so these read
 * as a crewman's view rather than a floating camera.
 */
export const INTERIOR_VIEWPOINTS: readonly Viewpoint[] = [
  {
    id: 'int-driver',
    label: 'Driver',
    kind: 'interior',
    eye: p(-560, 1310, 1950),
    target: p(-560, 1240, 3200),
    viaHatch: 'driver',
  },
  {
    id: 'int-radio',
    label: 'Radio operator',
    kind: 'interior',
    eye: p(560, 1310, 1950),
    target: p(560, 1240, 3200),
    viaHatch: 'radio',
  },
  {
    id: 'int-gunner',
    label: 'Gunner',
    kind: 'interior',
    eye: p(-430, 1900, -100),
    target: p(-430, 1900, 1400),
    viaHatch: 'cupola',
  },
  {
    id: 'int-loader',
    label: 'Loader',
    kind: 'interior',
    eye: p(520, 1980, -400),
    target: p(0, 1850, 400),
    viaHatch: 'loader',
  },
  {
    id: 'int-commander',
    label: 'Commander',
    kind: 'interior',
    eye: p(-500, 2180, -700),
    target: p(-200, 2050, 800),
    viaHatch: 'cupola',
  },
  {
    id: 'int-engine',
    label: 'Engine compartment',
    kind: 'interior',
    eye: p(0, 1550, -1600),
    target: p(0, 1100, -2600),
    viaHatch: 'engine-deck-centre',
  },
];

/**
 * Orthographic views used by `tests/e2e/silhouette.spec.ts`. Rendering at a
 * known frustum height makes the render scale-exact, so the binary silhouette
 * mask can be compared against an outline drawn from the spec.
 */
export const ORTHOGRAPHIC_VIEWPOINTS: readonly Viewpoint[] = [
  {
    id: 'ortho-left',
    label: 'Orthographic left elevation',
    kind: 'orthographic',
    eye: p(-20000, 1500, 0),
    target: p(0, 1500, 0),
    orthoHeight: mm(4000),
  },
  {
    id: 'ortho-front',
    label: 'Orthographic front elevation',
    kind: 'orthographic',
    eye: p(0, 1500, 20000),
    target: p(0, 1500, 0),
    orthoHeight: mm(4000),
  },
  {
    id: 'ortho-rear',
    label: 'Orthographic rear elevation',
    kind: 'orthographic',
    eye: p(0, 1500, -20000),
    target: p(0, 1500, 0),
    orthoHeight: mm(4000),
  },
  {
    id: 'ortho-plan',
    label: 'Orthographic plan',
    kind: 'orthographic',
    eye: p(0, 20000, 0),
    target: p(0, 0, 0),
    orthoHeight: mm(9000),
  },
];

/** Close-range poses for the visual critic. The model has to hold up here. */
export const DETAIL_VIEWPOINTS: readonly Viewpoint[] = [
  { id: 'det-sprocket', label: 'Drive sprocket', kind: 'detail', eye: p(-2600, 900, 3100), target: p(-1500, 800, 2470) },
  { id: 'det-idler', label: 'Idler and tensioner', kind: 'detail', eye: p(-2600, 800, -3100), target: p(-1500, 715, -2510) },
  { id: 'det-cupola', label: 'Commander cupola', kind: 'detail', eye: p(-1600, 3100, -1900), target: p(-500, 2750, -985) },
  { id: 'det-mantlet', label: 'Mantlet and sight apertures', kind: 'detail', eye: p(-900, 2100, 3400), target: p(0, 1980, 1600) },
  { id: 'det-feifel', label: 'Feifel air cleaners', kind: 'detail', eye: p(-1600, 1900, -4400), target: p(-1080, 1550, -3158) },
  { id: 'det-suspension', label: 'Interleaved running gear', kind: 'detail', eye: p(-3400, 700, 700), target: p(-1497, 400, 300) },
];

export const ALL_VIEWPOINTS: readonly Viewpoint[] = [
  ...EXTERIOR_VIEWPOINTS,
  ...INTERIOR_VIEWPOINTS,
  ...DETAIL_VIEWPOINTS,
  ...ORTHOGRAPHIC_VIEWPOINTS,
];

export function viewpointById(id: string): Viewpoint | undefined {
  return ALL_VIEWPOINTS.find((v) => v.id === id);
}

/** Default field of view for the first-person camera. */
export const PLAYER_FOV: DEG = deg(70);

/**
 * Radius of the walkable ground disc around the vehicle. Large enough that the
 * whole tank can be walked around and viewed from a distance; bounded so the
 * anti-trap world-bounds collider has something to be.
 */
export const WORLD_RADIUS: MM = mm(OVERALL.length * 6);
