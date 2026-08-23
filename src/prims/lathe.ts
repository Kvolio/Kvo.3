import type { Matrix4} from 'three';
import { Vector2, Vector3 } from 'three';
import type { MeshBuilder, MaterialId } from '../geom/MeshBuilder.js';
import type { Region } from '../geom/attributes.js';

/**
 * Surface of revolution about the local Y axis.
 *
 * Road wheels, hubs, the gun tube and its muzzle brake, shell cases, radiator
 * headers, the cupola drum, fan hubs and the torsion bar splines are all bodies
 * of revolution, so this is the second most-used primitive after `plate`.
 *
 * The profile is a polyline of (radius, height) pairs. A profile that touches
 * radius zero at either end closes itself; otherwise the ends are capped, so
 * the result is a closed solid either way and passes the manifold audit like
 * everything else.
 */

export interface RevolveOptions {
  /** Profile as (radius, y) pairs, scene units. Radius must not be negative. */
  readonly profile: readonly Vector2[];
  readonly segments?: number;
  /** Partial revolutions, radians. Defaults to a full turn. */
  readonly arcStart?: number;
  readonly arcLength?: number;
  readonly material?: MaterialId;
  readonly region?: Region;
  readonly wear?: number;
  /** Origin of the axis in the parent frame. */
  readonly origin?: Vector3;
  /**
   * Placement of the whole body in vehicle space, applied after `origin`.
   *
   * The revolve is always about LOCAL Y, which is right for a cupola or an
   * exhaust stack and wrong for anything that rolls: a road wheel, a sprocket
   * and an idler all turn about a lateral axis. Rather than teach this
   * primitive about arbitrary axes, the body is built upright and then placed —
   * the same bargain `emitPlate` already makes with its own frame.
   */
  readonly frame?: Matrix4;
  /** Millimetres from the nearest structural edge, for the chipping shader. */
  readonly edgeDist?: number;
}

export function emitRevolve(mb: MeshBuilder, opts: RevolveOptions): { triangleCount: number } {
  const {
    profile,
    segments = 32,
    arcStart = 0,
    arcLength = Math.PI * 2,
    material = 'machinedSteel',
    region,
    wear,
    origin = new Vector3(),
    frame,
    edgeDist = 0,
  } = opts;

  if (profile.length < 2 || segments < 3) return { triangleCount: 0 };

  const start = mb.triangleCount;

  // Positions through the frame, normals through its rotation. Every vertex in
  // this function goes through `put` so that none can be emitted unplaced.
  const put = (position: Vector3, normal: Vector3, uv: Vector2): number => {
    if (frame !== undefined) {
      position.applyMatrix4(frame);
      normal.transformDirection(frame);
    }
    return mb.vert(position, normal, uv);
  };
  const fullTurn = Math.abs(arcLength - Math.PI * 2) < 1e-6;
  const ringCount = fullTurn ? segments : segments + 1;

  // A profile whose ends coincide — a tube wall running out and back — already
  // encloses its own volume. Capping it as well would bury two discs inside the
  // solid and leave the manifold audit reporting geometry that is not there.
  const first = profile[0]!;
  const last = profile[profile.length - 1]!;
  const profileClosed = first.distanceTo(last) < 1e-9;

  mb.group(material, () => {
    mb.withState(
      {
        ...(region !== undefined ? { region } : {}),
        ...(wear !== undefined ? { wear } : {}),
        edgeDist,
      },
      () => {
        // Profile-space normals, rotated into place per segment.
        const profileNormals: Vector2[] = profile.map((_, i) => {
          const prev = profile[Math.max(0, i - 1)]!;
          const next = profile[Math.min(profile.length - 1, i + 1)]!;
          const t = new Vector2(next.x - prev.x, next.y - prev.y);
          if (t.lengthSq() < 1e-16) return new Vector2(1, 0);
          t.normalize();
          // Outward normal of a profile travelling upward is to its right.
          return new Vector2(t.y, -t.x);
        });

        const rings: number[][] = [];
        for (let p = 0; p < profile.length; p++) {
          const { x: radius, y: height } = profile[p]!;
          const pn = profileNormals[p]!;
          const ring: number[] = [];

          if (radius < 1e-9) {
            // A pole: one shared vertex rather than a fan of coincident ones.
            const nrm = new Vector3(0, Math.sign(pn.y) || 1, 0);
            const idx = put(
              new Vector3(origin.x, origin.y + height, origin.z),
              nrm,
              new Vector2(0.5, p / (profile.length - 1)),
            );
            for (let s = 0; s < ringCount; s++) ring.push(idx);
          } else {
            for (let s = 0; s < ringCount; s++) {
              const a = arcStart + (s / segments) * arcLength;
              const cos = Math.cos(a);
              const sin = Math.sin(a);
              ring.push(
                put(
                  new Vector3(
                    origin.x + cos * radius,
                    origin.y + height,
                    origin.z + sin * radius,
                  ),
                  new Vector3(cos * pn.x, pn.y, sin * pn.x).normalize(),
                  new Vector2(s / segments, p / (profile.length - 1)),
                ),
              );
            }
          }
          rings.push(ring);
        }

        // Rings run bottom to top, so the upper ring is the `lower` argument:
        // that is what puts the wall normals outward rather than into the solid.
        for (let p = 0; p + 1 < rings.length; p++) {
          mb.ring(rings[p + 1]!, rings[p]!, fullTurn);
        }

        // Cap any open end. A profile that reaches the axis has already closed
        // itself at the pole, so only genuinely open rims need a disc.
        const capEnd = (ringIndex: number, downward: boolean): void => {
          const pt = profile[ringIndex]!;
          if (pt.x < 1e-9) return;
          const nrm = new Vector3(0, downward ? -1 : 1, 0);
          const hub = put(
            new Vector3(origin.x, origin.y + pt.y, origin.z),
            nrm,
            new Vector2(0.5, 0.5),
          );
          const loop = downward ? [...rings[ringIndex]!] : [...rings[ringIndex]!].reverse();
          mb.fan(hub, loop, fullTurn);
        };
        if (!profileClosed) {
          capEnd(0, true);
          capEnd(profile.length - 1, false);
        }

        // A partial revolution leaves two flat faces where the sweep starts
        // and stops. Close them against a single shared column of axis vertices
        // rather than re-emitting the axis for every quad.
        if (!fullTurn && !profileClosed) {
          const axisColumn = profile.map((pt) =>
            put(
              new Vector3(origin.x, origin.y + pt.y, origin.z),
              new Vector3(0, 1, 0),
              new Vector2(0, 0),
            ),
          );
          for (const [edgeIdx, flip] of [
            [0, true],
            [ringCount - 1, false],
          ] as const) {
            for (let p = 0; p + 1 < profile.length; p++) {
              const a = rings[p]![edgeIdx]!;
              const b = rings[p + 1]![edgeIdx]!;
              const axisA = axisColumn[p]!;
              const axisB = axisColumn[p + 1]!;
              if (flip) mb.quad(axisA, axisB, b, a);
              else mb.quad(a, b, axisB, axisA);
            }
          }
        }
      },
    );
  });

  return { triangleCount: mb.triangleCount - start };
}

/** A straight tube profile: outer wall, inner wall, and the two rims. */
export function tubeProfile(
  outerRadius: number,
  innerRadius: number,
  length: number,
  y0 = 0,
): Vector2[] {
  return [
    new Vector2(innerRadius, y0),
    new Vector2(outerRadius, y0),
    new Vector2(outerRadius, y0 + length),
    new Vector2(innerRadius, y0 + length),
    new Vector2(innerRadius, y0),
  ];
}

/** A solid cylinder profile. */
export function cylinderProfile(radius: number, length: number, y0 = 0): Vector2[] {
  return [
    new Vector2(0, y0),
    new Vector2(radius, y0),
    new Vector2(radius, y0 + length),
    new Vector2(0, y0 + length),
  ];
}
