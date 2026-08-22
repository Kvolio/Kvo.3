/**
 * Units and the vehicle coordinate frame.
 *
 * The specification is authored in MILLIMETRES because that is the unit every
 * historical source quotes. The scene is in METRES because that keeps shadow
 * bias, camera near/far planes, light falloff and the suspension integrator in
 * numeric ranges they behave well in.
 *
 * `S()` is the only conversion between the two, and it is called at the point a
 * vertex is written — never earlier. Mixing the two silently is the single
 * easiest way to put a 15 mm error into a turret roof, so the branded types
 * below make it a compile error rather than a rendering surprise.
 */

/** A length in millimetres. */
export type MM = number & { readonly __unit: 'mm' };

/** An angle in degrees. */
export type DEG = number & { readonly __unit: 'deg' };

/** A mass in kilograms. */
export type KG = number & { readonly __unit: 'kg' };

export const mm = (v: number): MM => v as MM;
export const deg = (v: number): DEG => v as DEG;
export const kg = (v: number): KG => v as KG;

/** Millimetres per scene unit. The scene is in metres. */
export const MM_PER_SCENE_UNIT = 1000;

/** Convert a spec length to scene units. The only mm -> scene conversion. */
export const S = (v: MM): number => v / MM_PER_SCENE_UNIT;

/** Convert a scene length back to millimetres. For measurement overlays and tests. */
export const toMM = (v: number): MM => mm(v * MM_PER_SCENE_UNIT);

/** Convert a spec angle to radians. */
export const R = (v: DEG): number => (v * Math.PI) / 180;

/** Convert radians back to spec degrees. */
export const toDEG = (v: number): DEG => deg((v * 180) / Math.PI);

/**
 * Vehicle coordinate frame (right-handed, three.js convention):
 *
 *   +X  starboard (the vehicle's right, the radio operator's side)
 *   +Y  up
 *   +Z  forward (the direction the gun points at zero traverse)
 *
 * Origin sits on the GROUND PLANE, on the vehicle's lateral centreline, at the
 * longitudinal midpoint of the hull. That choice lets the sourced figures be
 * used directly and unmodified:
 *
 *   y = 0                      ground
 *   y = GROUND_CLEARANCE        underside of the hull floor plate
 *   y = HULL.heightToRoof       hull roof
 *   y = OVERALL.heightToCupola  top of the commander's cupola
 *
 * and the hull spans z = -HULL.length/2 .. +HULL.length/2.
 */
export const AXIS = {
  starboard: 'x',
  up: 'y',
  forward: 'z',
} as const;

/** Side of the vehicle. The Tiger's running gear is genuinely asymmetric, so this is load-bearing. */
export type Side = 'left' | 'right';

export const SIDES: readonly Side[] = ['left', 'right'] as const;

/** Sign of the X axis for a given side. Left is port, which is -X. */
export const sideSign = (side: Side): -1 | 1 => (side === 'left' ? -1 : 1);
