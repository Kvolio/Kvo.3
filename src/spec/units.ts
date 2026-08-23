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

/**
 * Convert an angle quoted FROM VERTICAL, as German documentation quotes plate
 * angles, into one measured from horizontal.
 *
 * A plate at 80 degrees from vertical is 10 degrees above horizontal — nearly
 * flat — and mixing the two conventions turns a front deck into a windscreen.
 */
export const fromHorizontal = (v: DEG): DEG => deg(90 - v);

/** Convert radians back to spec degrees. */
export const toDEG = (v: number): DEG => deg((v * 180) / Math.PI);

/**
 * Vehicle coordinate frame (right-handed, three.js convention):
 *
 *   +X  PORT (the vehicle's left, the driver's side)
 *   +Y  up
 *   +Z  forward (the direction the gun points at zero traverse)
 *
 * Note the first line, which is the opposite of most people's first guess and
 * was wrong here for several stages. In a right-handed frame with +Y up and +Z
 * forward, the vehicle's own starboard side is `forward x up = -X`. Face north
 * with +Z north and +Y up: +X comes out WEST, and your right hand points east.
 *
 * A tank built on the wrong reading of that is a perfect mirror image of itself
 * — driver and radio operator swapped, cupola on the wrong side of the turret —
 * and it looks entirely plausible until it is set beside a photograph. Rather
 * than leave the sign to be re-derived correctly every time, laterality is
 * written by NAME below: `port()` and `starboard()` take a positive magnitude
 * and place it. `tests/spec/laterality.test.ts` re-derives starboard from the
 * cross product and measures the built geometry, so a comment cannot lie about
 * which side anything is on.
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

/**
 * Sign of the X axis for a given side. Port (the vehicle's left) is +X — see
 * the frame note above before changing this.
 */
export const sideSign = (side: Side): -1 | 1 => (side === 'left' ? 1 : -1);

/** Place a positive magnitude on the vehicle's port (left) side. */
export const port = (magnitude: MM): MM => mm(Math.abs(magnitude));

/** Place a positive magnitude on the vehicle's starboard (right) side. */
export const starboard = (magnitude: MM): MM => mm(-Math.abs(magnitude));

/**
 * The vehicle's starboard direction, derived rather than asserted. Tests use
 * this so that laterality is checked against the frame's own definition.
 */
export const STARBOARD_X = -1;
