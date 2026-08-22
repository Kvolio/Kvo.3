import type { Box3} from 'three';
import { Vector3 } from 'three';

/**
 * A capsule: a segment with a radius.
 *
 * The player is a capsule rather than a box because a capsule slides off
 * corners instead of catching on them, which matters a great deal on a vehicle
 * made almost entirely of 90-degree plate joints.
 */
export class Capsule {
  readonly start = new Vector3();
  readonly end = new Vector3();
  radius: number;

  constructor(start = new Vector3(), end = new Vector3(0, 1, 0), radius = 0.3) {
    this.start.copy(start);
    this.end.copy(end);
    this.radius = radius;
  }

  /** Total height including both hemispherical caps. */
  get height(): number {
    return this.start.distanceTo(this.end) + this.radius * 2;
  }

  get centre(): Vector3 {
    return new Vector3().addVectors(this.start, this.end).multiplyScalar(0.5);
  }

  /** Lowest point, which is where the feet are. */
  get footY(): number {
    return Math.min(this.start.y, this.end.y) - this.radius;
  }

  clone(): Capsule {
    return new Capsule(this.start, this.end, this.radius);
  }

  copy(other: Capsule): this {
    this.start.copy(other.start);
    this.end.copy(other.end);
    this.radius = other.radius;
    return this;
  }

  translate(v: Vector3): this {
    this.start.add(v);
    this.end.add(v);
    return this;
  }

  /** Place the capsule with its feet at `footPosition`. */
  setFromFoot(footPosition: Vector3, standingHeight: number, radius = this.radius): this {
    this.radius = radius;
    this.start.set(footPosition.x, footPosition.y + radius, footPosition.z);
    this.end.set(footPosition.x, footPosition.y + standingHeight - radius, footPosition.z);
    return this;
  }

  getBounds(target: Box3): Box3 {
    target.makeEmpty();
    target.expandByPoint(this.start);
    target.expandByPoint(this.end);
    target.expandByScalar(this.radius);
    return target;
  }

  /** Closest point on the capsule's axis to an arbitrary point. */
  closestPointOnAxis(point: Vector3, target: Vector3): Vector3 {
    const ab = _tmpA.subVectors(this.end, this.start);
    const lengthSq = ab.lengthSq();
    if (lengthSq < 1e-12) return target.copy(this.start);
    let t = _tmpB.subVectors(point, this.start).dot(ab) / lengthSq;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return target.copy(this.start).addScaledVector(ab, t);
  }
}

const _tmpA = new Vector3();
const _tmpB = new Vector3();
