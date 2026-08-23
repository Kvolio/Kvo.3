import { Vector2, Vector3 } from 'three';
import type { MeshBuilder, MaterialId } from '../geom/MeshBuilder.js';
import { ensureCCW, triangulate } from '../geom/poly2.js';
import type { Region } from '../geom/attributes.js';

/**
 * Sweep a closed 2D profile along a 3D path.
 *
 * The workhorse behind weld beads, tow cables, hydraulic lines, conduit runs,
 * exhaust pipes and the Feifel trunking. Frames are parallel-transported rather
 * than rebuilt from a fixed up-vector, so a path that turns through vertical —
 * a cable draped over a fender, a pipe rising through the engine bay — does not
 * flip the profile inside out halfway along.
 */

export interface SweepOptions {
  /** Closed cross-section in profile-local XY, scene units. */
  readonly profile: readonly Vector2[];
  /** Path through space, scene units. */
  readonly path: readonly Vector3[];
  readonly closed?: boolean;
  /** Scale the profile along the path, e.g. to taper a bead into a corner. */
  readonly scaleAt?: (t: number, index: number) => number;
  /** Displace the profile radially, for a rippled weld bead. */
  readonly offsetAt?: (t: number, index: number, profileIndex: number) => number;
  readonly material?: MaterialId;
  readonly region?: Region;
  readonly wear?: number;
  readonly cap?: boolean;
  /**
   * Fix the frame's normal at the start of the path.
   *
   * Without this the frame is seeded from whichever axis is least parallel to
   * the tangent, which is fine for a hose but wrong for anything whose section
   * has a required orientation — a weld fillet has to sit in the corner it is
   * welding, not at an arbitrary roll about the seam.
   */
  readonly initialNormal?: Vector3;
}

/** Parallel-transport frames along a path. */
export function transportFrames(
  path: readonly Vector3[],
  closed = false,
  initialNormal?: Vector3,
): { tangent: Vector3; normal: Vector3; binormal: Vector3 }[] {
  const n = path.length;
  const frames: { tangent: Vector3; normal: Vector3; binormal: Vector3 }[] = [];

  const tangents: Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const prev = path[Math.max(0, i - 1)]!;
    const next = path[Math.min(n - 1, i + 1)]!;
    const t = new Vector3().subVectors(next, prev);
    if (t.lengthSq() < 1e-16) t.set(0, 0, 1);
    tangents.push(t.normalize());
  }

  const t0 = tangents[0]!;
  let normal: Vector3;
  if (initialNormal) {
    // Orthogonalise against the tangent rather than trusting the caller to
    // have done it; a hint that is slightly off should still give a valid frame.
    normal = initialNormal.clone().addScaledVector(t0, -initialNormal.dot(t0));
    if (normal.lengthSq() < 1e-12) {
      const fallback = Math.abs(t0.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
      normal.crossVectors(fallback, t0);
    }
    normal.normalize();
  } else {
    // Seed from whichever axis is least parallel to the tangent.
    const seed = Math.abs(t0.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
    normal = new Vector3().crossVectors(seed, t0).normalize();
  }

  for (let i = 0; i < n; i++) {
    const t = tangents[i]!;
    if (i > 0) {
      // Rotate the previous normal by the same rotation that took the previous
      // tangent to this one; that is what keeps the profile from spinning.
      const prevT = tangents[i - 1]!;
      const axis = new Vector3().crossVectors(prevT, t);
      const sin = axis.length();
      if (sin > 1e-8) {
        axis.divideScalar(sin);
        const angle = Math.atan2(sin, prevT.dot(t));
        normal = normal.clone().applyAxisAngle(axis, angle);
      }
      // Re-orthogonalise against drift.
      normal.addScaledVector(t, -normal.dot(t)).normalize();
    }
    frames.push({
      tangent: t.clone(),
      normal: normal.clone(),
      binormal: new Vector3().crossVectors(t, normal).normalize(),
    });
  }

  if (closed && n > 2) {
    // Distribute the twist mismatch evenly so the seam is invisible.
    const first = frames[0]!;
    const last = frames[n - 1]!;
    const cos = Math.max(-1, Math.min(1, first.normal.dot(last.normal)));
    let angle = Math.acos(cos);
    if (new Vector3().crossVectors(last.normal, first.normal).dot(last.tangent) < 0) {
      angle = -angle;
    }
    for (let i = 0; i < n; i++) {
      const f = frames[i]!;
      f.normal.applyAxisAngle(f.tangent, (angle * i) / (n - 1)).normalize();
      f.binormal.crossVectors(f.tangent, f.normal).normalize();
    }
  }

  return frames;
}

export function emitSweep(mb: MeshBuilder, opts: SweepOptions): { triangleCount: number } {
  const {
    profile: rawProfile,
    path,
    closed = false,
    scaleAt,
    offsetAt,
    material = 'machinedSteel',
    region,
    wear,
    cap = true,
    initialNormal,
  } = opts;

  if (path.length < 2 || rawProfile.length < 3) return { triangleCount: 0 };

  // Normalise the section's winding once. Whether the swept tube faces outward
  // or inward otherwise depends on which way the caller happened to wind its
  // profile, which is a trap rather than a feature — a weld section built from
  // a corner outwards naturally comes out clockwise.
  const profile = ensureCCW(rawProfile);

  const start = mb.triangleCount;
  const frames = transportFrames(path, closed, initialNormal);

  // Profile centroid, so radial offsets push outward from the section's middle.
  const centroid = new Vector2();
  for (const p of profile) centroid.add(p);
  centroid.divideScalar(profile.length);

  mb.group(material, () => {
    mb.withState(
      {
        ...(region !== undefined ? { region } : {}),
        ...(wear !== undefined ? { wear } : {}),
        edgeDist: 0,
      },
      () => {
        const rings: number[][] = [];

        for (let i = 0; i < path.length; i++) {
          const t = path.length === 1 ? 0 : i / (path.length - 1);
          const frame = frames[i]!;
          const origin = path[i]!;
          const scale = scaleAt ? scaleAt(t, i) : 1;

          const ring: number[] = [];
          for (let j = 0; j < profile.length; j++) {
            const p = profile[j]!;
            let px = (p.x - centroid.x) * scale;
            let py = (p.y - centroid.y) * scale;

            if (offsetAt) {
              const len = Math.hypot(px, py);
              if (len > 1e-9) {
                const push = offsetAt(t, i, j);
                px += (px / len) * push;
                py += (py / len) * push;
              }
            }
            px += centroid.x;
            py += centroid.y;

            const pos = new Vector3()
              .copy(origin)
              .addScaledVector(frame.normal, px)
              .addScaledVector(frame.binormal, py);

            // Provisional normal; recomputeNormals fixes it once the strip exists.
            const nrm = new Vector3()
              .addScaledVector(frame.normal, px - centroid.x)
              .addScaledVector(frame.binormal, py - centroid.y);
            if (nrm.lengthSq() < 1e-16) nrm.copy(frame.normal);
            nrm.normalize();

            ring.push(mb.vert(pos, nrm, new Vector2(t, j / profile.length)));
          }
          rings.push(ring);
        }

        for (let i = 0; i + 1 < rings.length; i++) {
          mb.ring(rings[i]!, rings[i + 1]!);
        }

        if (closed && rings.length > 2) {
          mb.ring(rings[rings.length - 1]!, rings[0]!);
        } else if (cap) {
          // Cap by triangulating the section and reusing the ring's own
          // vertices. Fanning from a hub would be simpler, but a section that
          // already contains its own centre — a weld fillet does, at the corner
          // it sits in — would collapse that fan into degenerate triangles and
          // silently leave the bead open at both ends.
          capWithSection(mb, profile, rings[0]!, true);
          capWithSection(mb, profile, rings[rings.length - 1]!, false);
        }
      },
    );
  });

  return { triangleCount: mb.triangleCount - start };
}

/**
 * Close one end of a sweep using the section's own triangulation.
 *
 * `ring` holds the vertex indices already emitted for that end, in profile
 * order, so the cap shares them exactly and welds cleanly to the tube wall.
 */
function capWithSection(
  mb: MeshBuilder,
  profile: readonly Vector2[],
  ring: readonly number[],
  atStart: boolean,
): void {
  // The profile arrives already counter-clockwise, so triangulate() leaves the
  // ordering alone and its indices address `ring` directly.
  const tri = triangulate(profile);

  for (const [a, b, c] of tri.triangles) {
    const ia = ring[a];
    const ib = ring[b];
    const ic = ring[c];
    if (ia === undefined || ib === undefined || ic === undefined) continue;
    // A counter-clockwise section faces along +tangent, so the start cap — which
    // has to face back down the path — is the one that gets reversed.
    if (atStart) mb.tri(ia, ic, ib);
    else mb.tri(ia, ib, ic);
  }
}
