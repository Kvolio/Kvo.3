import { Matrix4, Quaternion, Vector3, type Mesh } from 'three';
import type { DynamicHandle } from '../collision/CollisionWorld.js';

/**
 * A part that moves on a mechanism, with its collision moving with it.
 *
 * The collision world keeps a dynamic body's BVH in the body's OWN local space
 * and transforms the query capsule into it, so moving a part is a matrix write
 * rather than a rebuild. That is what makes an open hatch a hole the player can
 * actually drop through: the lid's solidity travels with the lid, and the roof
 * aperture it left behind was already a genuine hole in the plate rather than a
 * texture.
 *
 * The Tiger's forward hatches are the reason this is a two-stage mechanism and
 * not a hinge. Each lid rides a curved arm off a vertical post: it screws up
 * clear of its seat, then swings horizontally aside. A hinge would be simpler
 * and would look wrong from every angle — the lid would stand on edge instead
 * of lying flat beside its hole.
 */

export interface ArticulationStage {
  /** Rise along +Y, in scene units, applied before any swing. */
  readonly lift?: number;
  /** Swing about `axis` through `pivot`, in radians. */
  readonly swing?: number;
}

export interface ArticulationOptions {
  readonly id: string;
  readonly mesh: Mesh;
  readonly collision: DynamicHandle;
  /** Pivot point in vehicle space, scene units. */
  readonly pivot: Vector3;
  /** Swing axis in vehicle space. Normalised internally. */
  readonly axis: Vector3;
  /** Total rise before the swing begins, in scene units. */
  readonly lift: number;
  /** Total swing, in radians. */
  readonly swing: number;
  /**
   * Seconds for the full cycle. Real crews did not fling these open: the lid
   * screws up on a threaded post, which takes a moment.
   */
  readonly duration: number;
  /** Fraction of the cycle spent lifting before the swing starts. */
  readonly liftFraction?: number;
}

/** Smoothstep, so the lid eases out of rest rather than jerking. */
function ease(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

export class Articulation {
  readonly id: string;
  readonly mesh: Mesh;

  private readonly collision: DynamicHandle;
  private readonly pivot: Vector3;
  private readonly axis: Vector3;
  private readonly liftDistance: number;
  private readonly swingAngle: number;
  private readonly duration: number;
  private readonly liftFraction: number;

  /** 0 closed, 1 fully open. */
  private progress = 0;
  private target = 0;

  private readonly matrix = new Matrix4();
  private readonly rest: Matrix4;

  constructor(opts: ArticulationOptions) {
    this.id = opts.id;
    this.mesh = opts.mesh;
    this.collision = opts.collision;
    this.pivot = opts.pivot.clone();
    this.axis = opts.axis.clone().normalize();
    this.liftDistance = opts.lift;
    this.swingAngle = opts.swing;
    this.duration = Math.max(0.01, opts.duration);
    this.liftFraction = Math.min(0.9, Math.max(0.1, opts.liftFraction ?? 0.45));
    this.rest = opts.mesh.matrix.clone();
    this.apply();
  }

  get isOpen(): boolean {
    return this.target > 0.5;
  }

  /** True while the mechanism is still travelling. */
  get isMoving(): boolean {
    return Math.abs(this.progress - this.target) > 1e-4;
  }

  /** 0 closed, 1 fully open. */
  get openFraction(): number {
    return this.progress;
  }

  toggle(): void {
    this.target = this.target > 0.5 ? 0 : 1;
  }

  setOpen(open: boolean): void {
    this.target = open ? 1 : 0;
  }

  /** Snap to the target with no travel. For tests and for scene setup. */
  settle(): void {
    this.progress = this.target;
    this.apply();
  }

  update(dt: number): void {
    if (!this.isMoving) return;
    const step = dt / this.duration;
    this.progress =
      this.target > this.progress
        ? Math.min(this.target, this.progress + step)
        : Math.max(this.target, this.progress - step);
    this.apply();
  }

  private apply(): void {
    // Lift completes before the swing begins, because the lid has to clear its
    // seat before it can rotate — overlap the two and it sweeps through the
    // roof plate.
    const p = this.progress;
    const liftT = ease(Math.min(1, p / this.liftFraction));
    const swingT = ease(Math.max(0, (p - this.liftFraction) / (1 - this.liftFraction)));

    const lift = new Vector3(0, this.liftDistance * liftT, 0);
    const rotation = new Quaternion().setFromAxisAngle(this.axis, this.swingAngle * swingT);

    // Rotate about the pivot, then raise. Composed in vehicle space and applied
    // on top of the part's rest pose.
    this.matrix
      .makeTranslation(this.pivot.x, this.pivot.y, this.pivot.z)
      .multiply(new Matrix4().makeRotationFromQuaternion(rotation))
      .multiply(new Matrix4().makeTranslation(-this.pivot.x, -this.pivot.y, -this.pivot.z))
      .premultiply(new Matrix4().makeTranslation(lift.x, lift.y, lift.z))
      .multiply(this.rest);

    this.mesh.matrix.copy(this.matrix);
    this.mesh.matrixAutoUpdate = false;
    this.mesh.matrixWorldNeedsUpdate = true;
    this.collision.setMatrix(this.matrix);
  }
}
