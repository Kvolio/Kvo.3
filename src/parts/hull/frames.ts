import { Matrix4 } from 'three';
import { mirrorX, type Poly2 } from '../../geom/poly2.js';
import { R, S, sideSign, type DEG, type MM } from '../../spec/units.js';
import type { Side } from '../../spec/units.js';

/**
 * Placement frames for armour plates.
 *
 * `plate()` builds in its own local XY with the OUTER face at z = 0 and the
 * material behind it, so a frame's +Z axis is always the direction the plate
 * faces. Getting one of these backwards produces a plate whose interior surface
 * is on the outside — which renders perfectly well and is completely wrong, so
 * they are named for what they do and used everywhere rather than composed
 * by hand at each call site.
 */

/** A horizontal plate facing up: a roof or a deck. Outline (x, y) maps to (x, -z). */
export function facingUp(height: MM): Matrix4 {
  const m = new Matrix4().makeRotationX(-Math.PI / 2);
  m.setPosition(0, S(height), 0);
  return m;
}

/** A horizontal plate facing down: a belly or a sponson underside. */
export function facingDown(height: MM): Matrix4 {
  const m = new Matrix4().makeRotationX(Math.PI / 2);
  m.setPosition(0, S(height), 0);
  return m;
}

/**
 * A vertical plate on one side, facing outboard.
 *
 * Placing the two sides means rotating through plus or minus ninety degrees
 * about the vertical, and those two rotations map the plate's local X axis to
 * OPPOSITE world directions: forward on the port side, aft on the starboard.
 * Feed the same profile to both and the starboard plate comes out reversed end
 * for end, with its nose slope at the tail — invisible from any angle showing
 * only one side, and invisible to a bounding box.
 *
 * Author profiles in world-Z terms and pass them through `sideProfile` so the
 * handedness is handled once, in the open, rather than at each call site.
 */
export function facingOutboard(side: Side, x: MM): Matrix4 {
  // `sideSign`, not a local `left ? -1 : 1`. This function predates the
  // laterality correction and kept the old convention, so `facingOutboard`
  // returned the STARBOARD frame when asked for port and vice versa. On the
  // symmetric plates it was written for that is invisible, which is why it
  // survived — but the first asymmetric part built on it put its material on
  // the wrong side of the plate and widened the vehicle by 240 mm, which the
  // numerical QA caught immediately.
  const sign = sideSign(side);
  const m = new Matrix4().makeRotationY((sign * Math.PI) / 2);
  m.setPosition(sign * S(x), 0, 0);
  return m;
}

/**
 * A plate across the vehicle facing forward, optionally tilted back from
 * vertical. `tilt` is measured from vertical, matching how German documentation
 * quotes plate angles: 0 is upright, 90 is flat.
 */
export function facingForward(z: MM, y: MM, tilt: DEG): Matrix4 {
  // Positive rotation, so a tilted plate faces forward and DOWN: on the Tiger's
  // nose the top edge is the foremost point, and the plate leans back beneath it.
  const m = new Matrix4().makeRotationX(R(tilt));
  m.setPosition(0, S(y), S(z));
  return m;
}

/**
 * A plate across the vehicle facing forward and UP, leaning back as it rises.
 *
 * The mirror of `facingForward`, and a distinction worth keeping separate: the
 * nose plate leans back as it descends, so its normal points forward and down,
 * while the upper glacis leans back as it climbs, so its normal points forward
 * and up. Both are quoted at an angle from vertical, and using the wrong one
 * gives a plate that is the right size and shape and faces into the ground.
 */
export function facingUpForward(z: MM, y: MM, tilt: DEG): Matrix4 {
  const m = new Matrix4().makeRotationX(-R(tilt));
  m.setPosition(0, S(y), S(z));
  return m;
}

/** A plate across the vehicle facing aft, tilted back from vertical. */
export function facingAft(z: MM, y: MM, tilt: DEG): Matrix4 {
  const m = new Matrix4().makeRotationY(Math.PI).multiply(new Matrix4().makeRotationX(R(tilt)));
  m.setPosition(0, S(y), S(z));
  return m;
}

/**
 * Adapt a side profile authored in world-Z to the side it is being placed on.
 * See `facingOutboard` for why this is necessary.
 */
export function sideProfile(side: Side, profileInWorldZ: Poly2): Poly2 {
  // Mirrored on whichever side `facingOutboard` rotates the other way, so the
  // two stay in step. Both now key off `sideSign`.
  return sideSign(side) > 0 ? profileInWorldZ : mirrorX(profileInWorldZ);
}

/** Horizontal run of a plate of the given height at the given angle from vertical. */
export function runFor(height: MM, tilt: DEG): number {
  return height * Math.tan(R(tilt));
}

/** Slant length of a plate spanning the given height at the given angle from vertical. */
export function slantFor(height: MM, tilt: DEG): number {
  return height / Math.cos(R(tilt));
}
