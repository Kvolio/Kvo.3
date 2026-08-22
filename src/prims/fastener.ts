import type { BufferGeometry} from 'three';
import { Matrix4, Vector2, Vector3 } from 'three';
import { MeshBuilder } from '../geom/MeshBuilder.js';
import { Region } from '../geom/attributes.js';
import { emitRevolve } from './lathe.js';
import { S, type MM } from '../spec/units.js';

/**
 * Fasteners, by registry rather than by geometry.
 *
 * A Tiger carries several thousand visible bolts, rivets and screws. Emitting
 * each as geometry would cost thousands of draw calls; emitting none would look
 * like a toy. So no part builder ever emits a fastener directly — it registers a
 * placement, and the assembly materialises every placement of a given kind into
 * a single InstancedMesh at the end. Around 4-8k fasteners land in three draw
 * calls.
 */

export type FastenerKind = 'hexBolt' | 'domedRivet' | 'countersunk' | 'castleNut';

export interface FastenerPlacement {
  readonly kind: FastenerKind;
  readonly matrix: Matrix4;
  /** Slight per-instance hue variation, so a row of bolts does not look stamped. */
  readonly tint: number;
  readonly region: Region;
}

export interface FastenerBatch {
  readonly kind: FastenerKind;
  readonly geometry: BufferGeometry;
  readonly matrices: Matrix4[];
  readonly tints: number[];
  readonly region: Region;
}

export interface FastenerSpec {
  /** Across-flats for hex heads, or head diameter for the round kinds. */
  readonly headSize: MM;
  readonly headHeight: MM;
  readonly shankDiameter: MM;
  readonly shankLength: MM;
}

/**
 * Standard sizes, in millimetres. Hull and turret fixings on the Tiger are
 * substantial: the final drive housings alone are held by a ring of bolts you
 * can see from several metres away, which is exactly why they cannot be a
 * normal map.
 */
export const FASTENER_SIZES: Record<FastenerKind, FastenerSpec> = {
  hexBolt: { headSize: 30 as MM, headHeight: 13 as MM, shankDiameter: 20 as MM, shankLength: 8 as MM },
  domedRivet: { headSize: 22 as MM, headHeight: 8 as MM, shankDiameter: 14 as MM, shankLength: 4 as MM },
  countersunk: { headSize: 18 as MM, headHeight: 5 as MM, shankDiameter: 12 as MM, shankLength: 3 as MM },
  castleNut: { headSize: 36 as MM, headHeight: 20 as MM, shankDiameter: 24 as MM, shankLength: 6 as MM },
};

/**
 * The registry threaded through every part builder.
 *
 * Placement matrices are in vehicle space: a builder that knows where a bolt
 * goes composes the matrix and forgets about it.
 */
export class FastenerRegistry {
  private readonly placements: FastenerPlacement[] = [];
  private readonly geometryCache = new Map<FastenerKind, BufferGeometry>();

  /**
   * Register a fastener. `normal` is the direction the head faces; the shank
   * runs the other way, into the material.
   */
  add(
    kind: FastenerKind,
    position: Vector3,
    normal: Vector3,
    opts?: { tint?: number; region?: Region },
  ): this {
    const up = new Vector3(0, 1, 0);
    const dir = normal.clone().normalize();
    const matrix = new Matrix4();

    if (Math.abs(dir.dot(up)) > 0.9999) {
      if (dir.y < 0) matrix.makeRotationX(Math.PI);
    } else {
      const axis = new Vector3().crossVectors(up, dir).normalize();
      matrix.makeRotationAxis(axis, Math.acos(Math.max(-1, Math.min(1, up.dot(dir)))));
    }
    matrix.setPosition(position);

    this.placements.push({
      kind,
      matrix,
      tint: opts?.tint ?? 0,
      region: opts?.region ?? Region.Exterior,
    });
    return this;
  }

  /** Register a ring of fasteners — bolt circles are everywhere on this vehicle. */
  addRing(
    kind: FastenerKind,
    centre: Vector3,
    normal: Vector3,
    radius: number,
    count: number,
    opts?: { startAngle?: number; region?: Region },
  ): this {
    const dir = normal.clone().normalize();
    const ref = Math.abs(dir.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
    const u = new Vector3().crossVectors(ref, dir).normalize();
    const v = new Vector3().crossVectors(dir, u).normalize();
    const start = opts?.startAngle ?? 0;

    for (let i = 0; i < count; i++) {
      const a = start + (i / count) * Math.PI * 2;
      const p = centre
        .clone()
        .addScaledVector(u, Math.cos(a) * radius)
        .addScaledVector(v, Math.sin(a) * radius);
      // Deterministic per-position jitter: a real bolt row is never uniform,
      // but it must not shimmer between frames or between test runs either.
      const tint = ((Math.sin(i * 12.9898) * 43758.5453) % 1) * 0.5;
      const placementOpts: { tint: number; region?: Region } = { tint };
      if (opts?.region !== undefined) placementOpts.region = opts.region;
      this.add(kind, p, dir, placementOpts);
    }
    return this;
  }

  count(kind?: FastenerKind): number {
    if (!kind) return this.placements.length;
    return this.placements.filter((p) => p.kind === kind).length;
  }

  /** Group placements into one batch per (kind, region), ready for InstancedMesh. */
  materialize(): FastenerBatch[] {
    const groups = new Map<string, FastenerPlacement[]>();
    for (const p of this.placements) {
      const key = `${p.kind}:${p.region}`;
      const list = groups.get(key);
      if (list) list.push(p);
      else groups.set(key, [p]);
    }

    const batches: FastenerBatch[] = [];
    for (const list of groups.values()) {
      const first = list[0]!;
      batches.push({
        kind: first.kind,
        region: first.region,
        geometry: this.geometryFor(first.kind),
        matrices: list.map((p) => p.matrix),
        tints: list.map((p) => p.tint),
      });
    }
    return batches;
  }

  private geometryFor(kind: FastenerKind): BufferGeometry {
    const cached = this.geometryCache.get(kind);
    if (cached) return cached;
    const geometry = buildFastenerGeometry(kind);
    this.geometryCache.set(kind, geometry);
    return geometry;
  }

  clear(): void {
    this.placements.length = 0;
  }
}

/**
 * One fastener, modelled at the origin with its head facing +Y and its shank
 * running down into -Y. Small enough that a few hundred triangles each is
 * irrelevant once instanced.
 */
export function buildFastenerGeometry(kind: FastenerKind): BufferGeometry {
  const spec = FASTENER_SIZES[kind];
  const mb = new MeshBuilder();
  const head = S(spec.headSize) / 2;
  const headHeight = S(spec.headHeight);
  const shank = S(spec.shankDiameter) / 2;
  const shankLength = S(spec.shankLength);

  mb.useMaterial('machinedSteel');

  switch (kind) {
    case 'hexBolt':
    case 'castleNut': {
      // Six flats. The across-flats figure is the wrench size, so the corner
      // radius is headSize / cos(30) — otherwise every bolt reads a size small.
      const cornerRadius = head / Math.cos(Math.PI / 6);
      emitRevolve(mb, {
        profile: [
          new Vector2(0, -shankLength),
          new Vector2(shank, -shankLength),
          new Vector2(shank, 0),
          new Vector2(cornerRadius, 0),
          new Vector2(cornerRadius, headHeight * 0.82),
          new Vector2(cornerRadius * 0.86, headHeight),
          new Vector2(0, headHeight),
        ],
        segments: 6,
        material: 'machinedSteel',
        region: Region.Exterior,
      });
      break;
    }
    case 'domedRivet': {
      const STEPS = 5;
      const dome: Vector2[] = [
        new Vector2(0, -shankLength),
        new Vector2(shank, -shankLength),
        new Vector2(shank, 0),
        new Vector2(head, 0),
      ];
      for (let i = 1; i <= STEPS; i++) {
        const a = (i / STEPS) * (Math.PI / 2);
        dome.push(new Vector2(head * Math.cos(a), headHeight * Math.sin(a)));
      }
      emitRevolve(mb, { profile: dome, segments: 12, material: 'machinedSteel' });
      break;
    }
    case 'countersunk': {
      emitRevolve(mb, {
        profile: [
          new Vector2(0, -shankLength),
          new Vector2(shank, -shankLength),
          new Vector2(head, 0),
          new Vector2(head, headHeight * 0.3),
          new Vector2(0, headHeight * 0.3),
        ],
        segments: 12,
        material: 'machinedSteel',
      });
      break;
    }
  }

  mb.weldVertices();
  mb.recomputeNormals(35);
  return mb.toGeometry().geometry;
}
