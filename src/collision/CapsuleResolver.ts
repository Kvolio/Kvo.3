import { Vector3 } from 'three';
import type { Capsule } from './Capsule.js';
import { CollisionFlags, type CollisionWorld, type Contact } from './CollisionWorld.js';

/**
 * Moves a capsule through the world without letting it pass through anything.
 *
 * Rapier's kinematic character controller would supply most of this already.
 * It was not used for three reasons: the dynamic-hatch behaviour above falls
 * out of BVH-per-body for free, a WASM payload is a real cost on a phone, and
 * — decisively — this resolver runs in a plain Node unit test, so "the player
 * cannot walk through armour" is asserted in the fast suite rather than only
 * in a browser.
 */

export interface MoveConfig {
  /** Steepest surface, in degrees from horizontal, that counts as ground. */
  readonly maxWalkableSlope: number;
  /** Distance to search below the feet when snapping to ground. */
  readonly groundSnapDistance: number;
  /** Penetration resolution passes per substep. */
  readonly iterations: number;
  /** Leave a sliver of overlap so the capsule stays in contact rather than chattering. */
  readonly skinWidth: number;
  /** Height the player steps over without a mantle. */
  readonly stepHeight: number;
}

export const DEFAULT_MOVE_CONFIG: MoveConfig = {
  maxWalkableSlope: 50,
  groundSnapDistance: 0.35,
  iterations: 4,
  skinWidth: 0.002,
  stepHeight: 0.45,
};

export interface MoveResult {
  grounded: boolean;
  readonly groundNormal: Vector3;
  /** How much overlap survived the resolution passes. Should be ~0. */
  penetrationRemaining: number;
  /** Body ids touched this move, for interaction and debug readouts. */
  readonly touched: string[];
  /** True when the capsule was blocked horizontally, so the player is against a wall. */
  blocked: boolean;
}

const _contacts: Contact[] = [];
const _mtv = new Vector3();
const _accum = new Vector3();
const _step = new Vector3();
const _down = new Vector3(0, -1, 0);
const _probeOrigin = new Vector3();

/**
 * Advance `capsule` by `delta`, resolving penetration as it goes.
 *
 * Substepping is by capsule radius: a fast player crossing a 25 mm plate in one
 * frame would otherwise tunnel through it, and armour that can be walked
 * through when moving quickly is not armour.
 */
export function resolveCapsule(
  world: CollisionWorld,
  capsule: Capsule,
  delta: Vector3,
  config: MoveConfig = DEFAULT_MOVE_CONFIG,
  result?: MoveResult,
): MoveResult {
  const out: MoveResult =
    result ??
    {
      grounded: false,
      groundNormal: new Vector3(0, 1, 0),
      penetrationRemaining: 0,
      touched: [],
      blocked: false,
    };

  out.grounded = false;
  out.groundNormal.set(0, 1, 0);
  out.penetrationRemaining = 0;
  out.touched.length = 0;
  out.blocked = false;

  const distance = delta.length();
  const substeps = Math.max(1, Math.ceil(distance / Math.max(capsule.radius * 0.5, 1e-4)));
  _step.copy(delta).divideScalar(substeps);

  const walkableCos = Math.cos((config.maxWalkableSlope * Math.PI) / 180);

  for (let s = 0; s < substeps; s++) {
    capsule.translate(_step);

    for (let iteration = 0; iteration < config.iterations; iteration++) {
      world.query(capsule, _contacts);
      if (_contacts.length === 0) break;

      // Averaging the contact normals by depth is what stops the capsule
      // jittering in a convex corner, where two surfaces each push it into the
      // other if resolved one at a time.
      _accum.set(0, 0, 0);
      let totalWeight = 0;
      let deepest = 0;

      for (const contact of _contacts) {
        if (contact.depth <= config.skinWidth) continue;
        const weight = contact.depth;
        _accum.addScaledVector(contact.normal, weight);
        totalWeight += weight;
        if (contact.depth > deepest) deepest = contact.depth;

        if (contact.normal.y >= walkableCos && (contact.flags & CollisionFlags.Walkable) !== 0) {
          out.grounded = true;
          out.groundNormal.copy(contact.normal);
        } else if (Math.abs(contact.normal.y) < 0.5) {
          out.blocked = true;
        }
        if (!out.touched.includes(contact.bodyId)) out.touched.push(contact.bodyId);
      }

      if (totalWeight === 0) break;

      _mtv.copy(_accum).divideScalar(totalWeight).normalize();
      capsule.translate(_mtv.multiplyScalar(deepest + config.skinWidth));

      if (iteration === config.iterations - 1) {
        world.query(capsule, _contacts);
        out.penetrationRemaining = _contacts.reduce((m, c) => Math.max(m, c.depth), 0);
      }
    }
  }

  return out;
}

/**
 * Probe downward for ground and snap to it.
 *
 * Kept separate from penetration resolution so that walking off a step reads as
 * following the ground rather than as falling and being caught, and so that the
 * slope limit is applied in one place.
 */
export function snapToGround(
  world: CollisionWorld,
  capsule: Capsule,
  config: MoveConfig = DEFAULT_MOVE_CONFIG,
): { grounded: boolean; normal: Vector3; drop: number } {
  _probeOrigin.copy(capsule.start);
  const hit = world.raycastFirst(
    _probeOrigin,
    _down,
    capsule.radius + config.groundSnapDistance,
  );

  if (!hit) return { grounded: false, normal: new Vector3(0, 1, 0), drop: 0 };

  const walkableCos = Math.cos((config.maxWalkableSlope * Math.PI) / 180);
  if (hit.normal.y < walkableCos) {
    // Too steep to stand on. The 25-degrees-from-vertical glacis lands here,
    // which is correct: you slide off it and have to route via the fenders.
    return { grounded: false, normal: hit.normal, drop: 0 };
  }

  const drop = hit.distance - capsule.radius;
  if (drop > 0) capsule.translate(new Vector3(0, -drop, 0));
  return { grounded: true, normal: hit.normal, drop };
}

/**
 * Can a capsule of this size stand at this position without overlapping
 * anything? The headroom test the mantle system depends on.
 */
export function isPositionClear(world: CollisionWorld, capsule: Capsule): boolean {
  world.query(capsule, _contacts);
  return _contacts.every((c) => c.depth <= DEFAULT_MOVE_CONFIG.skinWidth);
}
