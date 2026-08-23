import { MeshBuilder } from '../../geom/MeshBuilder.js';
import { FastenerRegistry } from '../../prims/fastener.js';
import { AusfH_Feb1943, type VariantConfig } from '../../spec/variants.js';
import { combineParts, type BuildContext, type PartResult } from '../types.js';
import { buildLowerHull } from './lowerHull.js';
import { buildSuperstructure } from './superstructure.js';
import { buildRearFittings } from './rearFittings.js';
import { buildFittings } from './fittings.js';
import { buildRunningGear } from '../running/suspension.js';
import { buildTracks } from '../running/track.js';
import { buildTurret } from '../turret/shell.js';

export { buildLowerHull, buildSuperstructure, buildRearFittings };

/**
 * Normals smooth across joints shallower than this and stay hard beyond it.
 * Armour plate wants a crisp arris, so the threshold sits well below the
 * shallowest real bend on the vehicle.
 */
const RENDER_SMOOTHING_DEGREES = 38;
/** Collision geometry is faceted; smoothing it would only cost time. */
const COLLISION_SMOOTHING_DEGREES = 60;

/** Assemble the hull. */
export function buildHull(ctx: BuildContext): PartResult {
  return combineParts('hull', [
    buildLowerHull(ctx),
    buildSuperstructure(ctx),
    buildRearFittings(ctx),
    buildFittings(ctx),
    buildRunningGear(ctx),
    buildTracks(ctx),
    buildTurret(ctx),
  ]);
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
  context.render.recomputeNormals(RENDER_SMOOTHING_DEGREES);
  context.collision.weldVertices();
  context.collision.recomputeNormals(COLLISION_SMOOTHING_DEGREES, false);

  return { part, context };
}
