import { Vector2, Vector3 } from 'three';
import type { MeshBuilder } from '../geom/MeshBuilder.js';
import { Region } from '../geom/attributes.js';
import { noise1 } from '../geom/noise.js';
import { emitSweep } from './sweep.js';
import { S, type MM } from '../spec/units.js';

/**
 * Fillet weld beads.
 *
 * The Tiger's welds are one of its most recognisable features, and faking them
 * with a texture is exactly the shortcut the brief rules out. They are cheap to
 * do properly here because the plate primitive already hands back the exact
 * edge polylines of both mating plates — the joint geometry is known
 * analytically, so the bead is a swept profile rather than a boolean or an
 * intersection-curve extraction.
 *
 * The characteristic stacked-dimes ripple comes from modulating the bead radius
 * along its length at roughly a 9 mm cadence, which is about the bead pitch a
 * welder lays down by hand.
 */

export type WeldProfile = 'fillet-6' | 'fillet-8' | 'fillet-12' | 'convex-16' | 'root-pass';

const LEG_SIZE: Record<WeldProfile, number> = {
  'fillet-6': 6,
  'fillet-8': 8,
  'fillet-12': 12,
  'convex-16': 16,
  'root-pass': 4,
};

/** How far the bead face bulges past the straight line between its two legs. */
const CONVEXITY: Record<WeldProfile, number> = {
  'fillet-6': 0.22,
  'fillet-8': 0.24,
  'fillet-12': 0.26,
  'convex-16': 0.34,
  'root-pass': 0.1,
};

export interface WeldSpec {
  /** The joint line, in vehicle space, scene units. */
  readonly path: readonly Vector3[];
  /** Outward surface normal of the first plate. */
  readonly normalA: Vector3;
  /** Outward surface normal of the second plate. */
  readonly normalB: Vector3;
  readonly profile?: WeldProfile;
  /** Bead-to-bead cadence along the seam, millimetres. */
  readonly ripplePitch?: MM;
  readonly seed?: number;
  readonly region?: Region;
  /** Resample the joint line to at most this spacing before sweeping. */
  readonly maxSegment?: MM;
}

/**
 * Emit a fillet weld into the corner between two surfaces.
 *
 * The bead's cross-section is closed by running back to the corner itself, so
 * the bead is a solid tube in its own right and passes the same manifold audit
 * as everything else rather than being an open ribbon laid over the seam.
 */
export function emitWeld(mb: MeshBuilder, spec: WeldSpec): { triangleCount: number } {
  const {
    path,
    normalA,
    normalB,
    profile = 'fillet-8',
    ripplePitch = 9 as MM,
    seed = 1337,
    region = Region.Exterior,
    maxSegment = 60 as MM,
  } = spec;

  if (path.length < 2) return { triangleCount: 0 };

  const nA = normalA.clone().normalize();
  const nB = normalB.clone().normalize();

  // A weld needs two distinct surfaces. Coplanar plates have a butt joint, not
  // a fillet, and sweeping one would emit a degenerate ribbon.
  if (Math.abs(nA.dot(nB)) > 0.999) return { triangleCount: 0 };

  const dense = resamplePath(path, S(maxSegment));

  // Overall tangent, used to pick which way each leg runs along its plate.
  const tangent = new Vector3().subVectors(dense[dense.length - 1]!, dense[0]!).normalize();

  const legA = new Vector3().crossVectors(tangent, nA).normalize();
  if (legA.dot(nB) < 0) legA.negate();
  const legB = new Vector3().crossVectors(tangent, nB).normalize();
  if (legB.dot(nA) < 0) legB.negate();

  const size = S(LEG_SIZE[profile] as MM);
  const convexity = CONVEXITY[profile];

  // Build the cross-section in the plane spanned by the two legs, expressed in
  // the sweep's own (normal, binormal) basis.
  const basisU = legA.clone();
  const basisV = new Vector3().crossVectors(tangent, basisU).normalize();

  const toUV = (v: Vector3): Vector2 => new Vector2(v.dot(basisU), v.dot(basisV));

  const endA = legA.clone().multiplyScalar(size);
  const endB = legB.clone().multiplyScalar(size);
  const outward = new Vector3().addVectors(nA, nB).normalize();

  const ARC_STEPS = 6;
  const section: Vector2[] = [toUV(new Vector3(0, 0, 0)), toUV(endA)];
  for (let i = 1; i < ARC_STEPS; i++) {
    const u = i / ARC_STEPS;
    const p = new Vector3().lerpVectors(endA, endB, u);
    p.addScaledVector(outward, size * convexity * Math.sin(Math.PI * u));
    section.push(toUV(p));
  }
  section.push(toUV(endB));

  // Total seam length, so the ripple keeps a constant cadence in millimetres
  // however the path happens to be sampled.
  let length = 0;
  for (let i = 1; i < dense.length; i++) length += dense[i]!.distanceTo(dense[i - 1]!);
  const ripple = S(ripplePitch);

  return emitSweep(mb, {
    profile: section,
    path: dense,
    material: 'weldBead',
    region,
    cap: true,
    // The section is expressed in (basisU, basisV), so the sweep must use the
    // same frame. Left to its own devices it seeds the frame from a world axis,
    // and the bead ends up rolled about the seam by an arbitrary angle — which
    // happens to look right whenever the two frames coincide, and is wrong
    // everywhere else. It also made the two sides of the hull disagree.
    initialNormal: basisU,
    offsetAt: (t) => {
      const s = t * length;
      // A hand-laid bead swells and shrinks as the welder works: a regular
      // stacked-dimes cadence plus enough irregularity that it never reads as a
      // sine wave.
      const dimes = 0.11 * Math.sin((2 * Math.PI * s) / ripple);
      const wander = 0.04 * (noise1(s / (ripple * 3.7), seed) * 2 - 1);
      return size * (dimes + wander);
    },
  });
}

/** Insert intermediate points so no segment exceeds `maxSegment` scene units. */
export function resamplePath(path: readonly Vector3[], maxSegment: number): Vector3[] {
  const out: Vector3[] = [path[0]!.clone()];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const d = a.distanceTo(b);
    const steps = Math.max(1, Math.ceil(d / maxSegment));
    for (let s = 1; s <= steps; s++) {
      out.push(new Vector3().lerpVectors(a, b, s / steps));
    }
  }
  return out;
}

/**
 * Weld along a plate edge run returned by `emitPlate`.
 * Convenience wrapper so hull assembly reads as a list of joints.
 */
export function emitWeldAlongEdge(
  mb: MeshBuilder,
  edge: readonly Vector3[],
  normalA: Vector3,
  normalB: Vector3,
  profile: WeldProfile = 'fillet-8',
  region: Region = Region.Exterior,
): { triangleCount: number } {
  return emitWeld(mb, { path: edge, normalA, normalB, profile, region });
}
