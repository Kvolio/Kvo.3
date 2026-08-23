import { Matrix4, Vector3 } from 'three';
import { S, sideSign, type MM, type Side } from '../../spec/units.js';

/**
 * Placement frames for things that roll.
 *
 * `emitRevolve` turns a profile about its own LOCAL Y. Everything in the
 * running gear turns about a LATERAL axis instead, so each body is built
 * upright and then laid over — local +Y onto world +X or -X depending on the
 * side, which also mirrors the body so that a wheel's outer face is outboard on
 * both sides rather than outboard on one and buried in the hull on the other.
 */
export function rollingFrame(side: Side, x: MM, y: MM, z: MM): Matrix4 {
  const sign = sideSign(side);
  // Local +Y to world +X for port, -X for starboard.
  const m = new Matrix4().makeRotationZ((-sign * Math.PI) / 2);
  m.setPosition(new Vector3(S(mmTimes(x, sign)), S(y), S(z)));
  return m;
}

/**
 * A rolling body on the vehicle centreline plane, laid over the same way but
 * without a side to mirror against. For anything spanning both tracks.
 */
export function axleFrame(x: MM, y: MM, z: MM): Matrix4 {
  const m = new Matrix4().makeRotationZ(-Math.PI / 2);
  m.setPosition(new Vector3(S(x), S(y), S(z)));
  return m;
}

/** Multiply a millimetre length by a sign without losing the brand. */
function mmTimes(v: MM, sign: number): MM {
  return (v * sign) as MM;
}
