import type { Vector3 } from 'three';
import { Region } from '../geom/attributes.js';

/**
 * Last-known-good positions, so the player can never be permanently stuck.
 *
 * The brief is explicit that the player must not become trapped inside moving
 * components or fall through the floor. Three independent defences cover that;
 * this is the last of them, and the only one that can recover from a failure
 * nobody anticipated. `recoveries` is asserted to be zero in the walkthrough
 * test, so if this ever fires in practice it is a finding rather than a
 * quietly-handled edge case.
 */

export interface Pose {
  readonly position: Vector3;
  readonly yaw: number;
  readonly region: Region;
  readonly time: number;
}

export type StuckReason =
  | 'penetration'
  | 'below-world'
  | 'unknown-region'
  | 'not-a-number';

export class SafePoseBuffer {
  private readonly poses: Pose[] = [];
  private readonly capacity: number;
  /** How far back to rewind, so recovery lands before whatever went wrong. */
  private readonly rewindSeconds: number;

  private recoveryCount = 0;
  private lastReason: StuckReason | null = null;

  constructor(opts: { capacity?: number; rewindSeconds?: number } = {}) {
    this.capacity = opts.capacity ?? 60;
    this.rewindSeconds = opts.rewindSeconds ?? 0.5;
  }

  get recoveries(): number {
    return this.recoveryCount;
  }

  get lastStuckReason(): StuckReason | null {
    return this.lastReason;
  }

  get size(): number {
    return this.poses.length;
  }

  /** Record a pose that is known good: grounded, not penetrating, region known. */
  record(position: Vector3, yaw: number, region: Region, time: number): void {
    this.poses.push({ position: position.clone(), yaw, region, time });
    if (this.poses.length > this.capacity) this.poses.shift();
  }

  /**
   * The newest pose at least `rewindSeconds` older than `now`.
   * Rewinding to the immediately previous frame would usually put the player
   * straight back into whatever they were caught in.
   */
  recover(now: number): Pose | null {
    for (let i = this.poses.length - 1; i >= 0; i--) {
      const pose = this.poses[i]!;
      if (now - pose.time >= this.rewindSeconds) return pose;
    }
    return this.poses[0] ?? null;
  }

  noteRecovery(reason: StuckReason): void {
    this.recoveryCount++;
    this.lastReason = reason;
  }

  reset(): void {
    this.poses.length = 0;
    this.recoveryCount = 0;
    this.lastReason = null;
  }
}

/** Decide whether a pose is broken enough to warrant rewinding. */
export function detectStuck(opts: {
  position: Vector3;
  penetrationRemaining: number;
  capsuleRadius: number;
  worldFloorY: number;
  region: Region;
  unknownRegionSeconds: number;
}): StuckReason | null {
  const { position, penetrationRemaining, capsuleRadius, worldFloorY, region } = opts;

  if (
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.y) ||
    !Number.isFinite(position.z)
  ) {
    return 'not-a-number';
  }
  // Below the world floor by more than a step means the player fell through
  // something, not down something.
  if (position.y < worldFloorY - 2) return 'below-world';
  // Still buried after the resolver has done its passes.
  if (penetrationRemaining > capsuleRadius) return 'penetration';
  if (region === Region.Internal && opts.unknownRegionSeconds > 0.5) return 'unknown-region';
  return null;
}
