import type { BufferGeometry, Matrix4 } from 'three';
import type { MeshBuilder } from '../geom/MeshBuilder.js';
import type { FastenerRegistry } from '../prims/fastener.js';
import type { CollisionFlag } from '../collision/CollisionWorld.js';
import type { Region } from '../geom/attributes.js';
import type { VariantConfig } from '../spec/variants.js';

/**
 * The contract every part builder follows.
 *
 * A builder emits render geometry into a shared `MeshBuilder`, registers its
 * fasteners rather than emitting them, and hands back collision proxies and
 * named mount frames for whatever attaches to it. It returns `null` when the
 * active variant excludes the part, which is how a production change becomes a
 * data edit rather than a code edit.
 */

export interface CollisionProxy {
  readonly id: string;
  readonly geometry: BufferGeometry;
  readonly matrix?: Matrix4;
  readonly flags?: CollisionFlag;
  readonly region?: Region;
  /** Dynamic proxies move at runtime — hatch lids, the turret, swing arms. */
  readonly dynamic?: boolean;
}

export interface PartResult {
  readonly name: string;
  readonly triangleCount: number;
  readonly collision: CollisionProxy[];
  /** Attachment points for child parts, in vehicle space. */
  readonly frames: Map<string, Matrix4>;
  /**
   * True when the part's geometry is reconstructed rather than documented.
   * Surfaced in the Gauntlet report so a reconstruction is never presented as
   * historical fact.
   */
  readonly reconstructed?: boolean;
}

export interface BuildContext {
  readonly variant: VariantConfig;
  /** LOD. 0 is full detail; 2 drops chamfers, fasteners and edge bands. */
  readonly detail: 0 | 1 | 2;
  /** Render geometry accumulates here, so an assembly is few draw calls. */
  readonly render: MeshBuilder;
  /**
   * Coarse geometry for collision, built from the same outlines as the render
   * geometry so the two cannot drift apart.
   */
  readonly collision: MeshBuilder;
  readonly fasteners: FastenerRegistry;
}

export type PartBuilder = (ctx: BuildContext) => PartResult | null;

/** Merge several part results into one, for an assembly that returns a whole. */
export function combineParts(name: string, parts: (PartResult | null)[]): PartResult {
  const frames = new Map<string, Matrix4>();
  const collision: CollisionProxy[] = [];
  let triangleCount = 0;
  let reconstructed = false;

  for (const part of parts) {
    if (!part) continue;
    triangleCount += part.triangleCount;
    collision.push(...part.collision);
    for (const [key, value] of part.frames) frames.set(`${part.name}.${key}`, value);
    if (part.reconstructed) reconstructed = true;
  }

  return { name, triangleCount, collision, frames, reconstructed };
}
