import { MeshBuilder } from '../../geom/MeshBuilder.js';
import { FastenerRegistry } from '../../prims/fastener.js';
import { AusfH_Feb1943, type VariantConfig } from '../../spec/variants.js';
import { combineParts, type BuildContext, type PartResult } from '../types.js';
import { buildLowerHull } from './lowerHull.js';
import { buildSuperstructure } from './superstructure.js';
import { buildRearFittings } from './rearFittings.js';
import { buildFittings } from './fittings.js';
import { buildVisionPorts } from './visionPorts.js';
import { buildRunningGear } from '../running/suspension.js';
import { buildTracks } from '../running/track.js';
import { buildInteriorStructure } from '../interior/structure.js';
import { buildPowertrain } from '../interior/powertrain.js';
import { buildTurret } from '../turret/shell.js';
import { buildGun } from '../turret/gun.js';
import { buildTurretFittings } from '../turret/fittings.js';

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
/**
 * Everything that does not traverse: hull, running gear and tracks.
 *
 * Split from the turret because the turret moves. They are mounted as separate
 * bodies so that traversing is a matrix write rather than a rebuild, exactly as
 * with the hatch lids.
 */
export function buildHullOnly(ctx: BuildContext): PartResult {
  return combineParts('hull', [
    buildLowerHull(ctx),
    buildSuperstructure(ctx),
    buildRearFittings(ctx),
    buildFittings(ctx),
    buildVisionPorts(ctx),
    buildRunningGear(ctx),
    buildTracks(ctx),
    buildInteriorStructure(ctx),
    buildPowertrain(ctx),
  ]);
}

/** The turret and everything that turns with it, at zero traverse. */
export function buildTurretAssembly(ctx: BuildContext): PartResult {
  return combineParts('turret', [
    buildTurret(ctx),
    buildGun(ctx),
    buildTurretFittings(ctx),
  ]);
}

/**
 * The whole vehicle at zero traverse, as one assembly.
 *
 * This is what the geometry tests measure: they care where things are relative
 * to each other, and a turret that could be anywhere is a turret nothing can be
 * checked against. The viewer mounts the two halves separately.
 */
export function buildHull(ctx: BuildContext): PartResult {
  return combineParts('vehicle', [buildHullOnly(ctx), buildTurretAssembly(ctx)]);
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
