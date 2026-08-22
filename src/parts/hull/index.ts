import { MeshBuilder } from '../../geom/MeshBuilder.js';
import { FastenerRegistry } from '../../prims/fastener.js';
import { AusfH_Feb1943, type VariantConfig } from '../../spec/variants.js';
import { combineParts, type BuildContext, type PartResult } from '../types.js';
import { buildLowerHull } from './lowerHull.js';

export { buildLowerHull };

/** Assemble the hull. */
export function buildHull(ctx: BuildContext): PartResult {
  return combineParts('hull', [buildLowerHull(ctx)]);
}

export interface BuiltAssembly {
  readonly part: PartResult;
  readonly context: BuildContext;
}

/**
 * Build an assembly standalone, for tests and for the viewer.
 *
 * Finishing is deliberate rather than automatic: welding and normal
 * recomputation are what turn a pile of separately-emitted plates into one
 * surface, and doing them once at the end is far cheaper than per part.
 */
export function buildAssembly(
  builder: (ctx: BuildContext) => PartResult,
  opts: { variant?: VariantConfig; detail?: 0 | 1 | 2 } = {},
): BuiltAssembly {
  const context: BuildContext = {
    variant: opts.variant ?? AusfH_Feb1943,
    detail: opts.detail ?? 0,
    render: new MeshBuilder(),
    collision: new MeshBuilder(),
    fasteners: new FastenerRegistry(),
  };

  const part = builder(context);

  context.render.weldVertices();
  context.render.recomputeNormals(38);
  context.collision.weldVertices();
  context.collision.recomputeNormals(60, false);

  return { part, context };
}
