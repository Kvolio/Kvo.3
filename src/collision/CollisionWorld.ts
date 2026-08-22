import { Box3, FrontSide, Line3, Matrix4, Ray, Vector3, type BufferGeometry } from 'three';
import { MeshBVH, type ExtendedTriangle } from 'three-mesh-bvh';
import { Region } from '../geom/attributes.js';
import type { Capsule } from './Capsule.js';

/**
 * The collision world.
 *
 * Two design decisions here carry most of the weight, and both make the hard
 * requirements in the brief cheap rather than expensive.
 *
 * First, dynamic bodies keep their BVH in their OWN local space and are queried
 * by transforming the capsule into that space. A hatch swinging open therefore
 * needs no BVH rebuild at all — its matrix changes and it is done.
 *
 * Second, and more importantly: an aperture is a hole polygon in the plate
 * primitive, so a roof plate's collision geometry already HAS the hole in it.
 * The hatch lid is a separate body that plugs the hole when closed and swings
 * clear when open. "An open hatch is an opening you can climb through" is
 * therefore a consequence of how the armour was modelled, not a special case
 * anyone has to maintain.
 */

export const CollisionFlags = {
  None: 0,
  /** Surfaces the player may stand on. */
  Walkable: 1 << 0,
  /** Surfaces the mantle system may pull the player onto. */
  MantleTarget: 1 << 1,
  /** The invisible shell that stops the player leaving the world. */
  WorldBounds: 1 << 2,
  /** A hatch lid or similar: solid when closed, out of the way when open. */
  Closure: 1 << 3,
} as const;

export type CollisionFlag = number;

export interface CollisionBodyOptions {
  readonly id: string;
  readonly matrixWorld?: Matrix4;
  readonly region?: Region;
  readonly flags?: CollisionFlag;
}

export interface Contact {
  readonly normal: Vector3;
  readonly depth: number;
  readonly bodyId: string;
  readonly flags: CollisionFlag;
  readonly region: Region;
}

interface Body {
  id: string;
  bvh: MeshBVH;
  matrixWorld: Matrix4;
  inverse: Matrix4;
  worldBounds: Box3;
  localBounds: Box3;
  region: Region;
  flags: CollisionFlag;
  dynamic: boolean;
  enabled: boolean;
}

/** Handle for a body whose transform changes at runtime. */
export class DynamicHandle {
  constructor(
    private readonly body: Body,
    private readonly world: CollisionWorld,
  ) {}

  get id(): string {
    return this.body.id;
  }

  setMatrix(matrix: Matrix4): void {
    this.body.matrixWorld.copy(matrix);
    this.body.inverse.copy(matrix).invert();
    this.body.worldBounds.copy(this.body.localBounds).applyMatrix4(matrix);
    this.world.markDirty();
  }

  setEnabled(enabled: boolean): void {
    this.body.enabled = enabled;
    this.world.markDirty();
  }

  get enabled(): boolean {
    return this.body.enabled;
  }
}

export class CollisionWorld {
  private readonly bodies: Body[] = [];

  /** Bumped whenever a body moves, so callers can invalidate cached queries. */
  private revision = 0;

  get version(): number {
    return this.revision;
  }

  get bodyCount(): number {
    return this.bodies.length;
  }

  get triangleCount(): number {
    return this.bodies.reduce((n, b) => n + b.bvh.geometry.index!.count / 3, 0);
  }

  markDirty(): void {
    this.revision++;
  }

  addStatic(geometry: BufferGeometry, opts: CollisionBodyOptions): void {
    this.push(geometry, opts, false);
  }

  addDynamic(geometry: BufferGeometry, opts: CollisionBodyOptions): DynamicHandle {
    const body = this.push(geometry, opts, true);
    return new DynamicHandle(body, this);
  }

  private push(geometry: BufferGeometry, opts: CollisionBodyOptions, dynamic: boolean): Body {
    if (!geometry.index) {
      throw new Error(`collision: body "${opts.id}" needs indexed geometry`);
    }
    const bvh = new MeshBVH(geometry);
    const matrixWorld = (opts.matrixWorld ?? new Matrix4()).clone();
    geometry.computeBoundingBox();
    const localBounds = geometry.boundingBox!.clone();

    const body: Body = {
      id: opts.id,
      bvh,
      matrixWorld,
      inverse: matrixWorld.clone().invert(),
      localBounds,
      worldBounds: localBounds.clone().applyMatrix4(matrixWorld),
      region: opts.region ?? Region.Exterior,
      flags: opts.flags ?? CollisionFlags.Walkable,
      dynamic,
      enabled: true,
    };
    this.bodies.push(body);
    this.markDirty();
    return body;
  }

  remove(id: string): void {
    const index = this.bodies.findIndex((b) => b.id === id);
    if (index >= 0) {
      this.bodies.splice(index, 1);
      this.markDirty();
    }
  }

  clear(): void {
    this.bodies.length = 0;
    this.markDirty();
  }

  /** Bodies whose world bounds overlap `bounds`. The broadphase. */
  private candidates(bounds: Box3, out: Body[]): Body[] {
    out.length = 0;
    for (const body of this.bodies) {
      if (!body.enabled) continue;
      if (body.worldBounds.intersectsBox(bounds)) out.push(body);
    }
    return out;
  }

  /**
   * Collect every contact between `capsule` and the world.
   *
   * The capsule is transformed into each body's local space rather than the
   * body being transformed into the world, which is what lets a dynamic body
   * move without touching its BVH.
   *
   * Known limitation, inherent to surface-based collision: a capsule buried
   * deeper than its own radius finds no surface within reach and reports no
   * contacts. Substepping in the resolver prevents ever arriving in that state,
   * and SafePose recovery catches it if something else does.
   */
  query(capsule: Capsule, out: Contact[]): Contact[] {
    out.length = 0;
    capsule.getBounds(_queryBounds);
    this.candidates(_queryBounds, _candidateList);

    for (const body of _candidateList) {
      _localStart.copy(capsule.start).applyMatrix4(body.inverse);
      _localEnd.copy(capsule.end).applyMatrix4(body.inverse);

      // Uniform scale is assumed; the model uses none, but a scaled body would
      // need its radius adjusted here rather than silently mis-colliding.
      const radius = capsule.radius;

      _localBounds.makeEmpty();
      _localBounds.expandByPoint(_localStart);
      _localBounds.expandByPoint(_localEnd);
      _localBounds.expandByScalar(radius);

      body.bvh.shapecast({
        intersectsBounds: (box) => box.intersectsBox(_localBounds),
        intersectsTriangle: (tri: ExtendedTriangle) => {
          _localSegment.start.copy(_localStart);
          _localSegment.end.copy(_localEnd);
          const distance = tri.closestPointToSegment(_localSegment, _triPoint, _segPoint);
          if (distance >= radius) return false;

          _normal.subVectors(_segPoint, _triPoint);
          const length = _normal.length();
          if (length < 1e-9) {
            // Dead centre on the surface: fall back to the face normal so the
            // player is pushed out rather than jittering in place.
            tri.getNormal(_normal);
          } else {
            _normal.divideScalar(length);
          }

          // Back to world space.
          _worldNormal.copy(_normal).transformDirection(body.matrixWorld).normalize();

          out.push({
            normal: _worldNormal.clone(),
            depth: radius - distance,
            bodyId: body.id,
            flags: body.flags,
            region: body.region,
          });
          return false;
        },
      });
    }

    return out;
  }

  /**
   * Cast a ray and return the nearest hit distance, or null.
   * Used by ground probes, the mantle system and the suspension solver.
   */
  raycastFirst(
    origin: Vector3,
    direction: Vector3,
    maxDistance: number,
  ): { distance: number; normal: Vector3; bodyId: string; flags: CollisionFlag } | null {
    _rayBounds.makeEmpty();
    _rayBounds.expandByPoint(origin);
    _rayBounds.expandByPoint(_rayEnd.copy(origin).addScaledVector(direction, maxDistance));
    _rayBounds.expandByScalar(1e-3);
    this.candidates(_rayBounds, _candidateList);

    let best: { distance: number; normal: Vector3; bodyId: string; flags: CollisionFlag } | null =
      null;

    for (const body of _candidateList) {
      _localStart.copy(origin).applyMatrix4(body.inverse);
      _localDir.copy(direction).transformDirection(body.inverse).normalize();
      _ray.origin.copy(_localStart);
      _ray.direction.copy(_localDir);

      const hit = body.bvh.raycastFirst(_ray, FrontSide, 0, maxDistance);
      if (hit && hit.distance <= maxDistance) {
        if (best === null || hit.distance < best.distance) {
          const normal = hit.face
            ? _hitNormal.copy(hit.face.normal).transformDirection(body.matrixWorld).normalize().clone()
            : new Vector3(0, 1, 0);
          best = {
            distance: hit.distance,
            normal,
            bodyId: body.id,
            flags: body.flags,
          };
        }
      }
    }
    return best;
  }
}

// Scratch objects: collision runs every frame and must not allocate.
const _queryBounds = new Box3();
const _localBounds = new Box3();
const _rayBounds = new Box3();
const _candidateList: Body[] = [];
const _localStart = new Vector3();
const _localEnd = new Vector3();
const _localSegment = new Line3();
const _localDir = new Vector3();
const _rayEnd = new Vector3();
const _triPoint = new Vector3();
const _segPoint = new Vector3();
const _normal = new Vector3();
const _worldNormal = new Vector3();
const _hitNormal = new Vector3();

const _ray = new Ray();
