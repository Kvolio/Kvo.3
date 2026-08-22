import { Matrix4 } from 'three';
import { R, S, type DEG, type MM } from '../../spec/units.js';
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
 * Outline x runs aft on the starboard side and forward on the port side, so
 * that both are authored from the same profile.
 */
export function facingOutboard(side: Side, x: MM): Matrix4 {
  const sign = side === 'left' ? -1 : 1;
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

/** A plate across the vehicle facing aft, tilted back from vertical. */
export function facingAft(z: MM, y: MM, tilt: DEG): Matrix4 {
  const m = new Matrix4().makeRotationY(Math.PI).multiply(new Matrix4().makeRotationX(R(tilt)));
  m.setPosition(0, S(y), S(z));
  return m;
}

/** Horizontal run of a plate of the given height at the given angle from vertical. */
export function runFor(height: MM, tilt: DEG): number {
  return height * Math.tan(R(tilt));
}

/** Slant length of a plate spanning the given height at the given angle from vertical. */
export function slantFor(height: MM, tilt: DEG): number {
  return height / Math.cos(R(tilt));
}
