import { Matrix4 } from 'three';
import { emitPlate, type PlateResult, type PlateSpec } from '../prims/plate.js';
import { emitWeld, type WeldProfile } from '../prims/weld.js';
import type { BuildContext } from './types.js';
import type { Vector3 } from 'three';
import type { Region } from '../geom/attributes.js';
import { mm } from '../spec/units.js';

/**
 * Emit one structural plate into both the render mesh and the collision mesh.
 *
 * The collision copy is the SAME outline built at the coarsest detail: no
 * chamfer bands, no inset tessellation, roughly a dozen triangles. That means
 * the collision surface cannot drift away from the visible one, because it is
 * generated from the same numbers by the same primitive — a class of bug that
 * is otherwise invisible until a player walks through a wall.
 */
export function structuralPlate(ctx: BuildContext, spec: PlateSpec): PlateResult {
  const plate = emitPlate(ctx.render, { ...spec, detail: ctx.detail });

  emitPlate(ctx.collision, {
    ...spec,
    detail: 2,
    chamfer: mm(0),
    edgeBandWidth: mm(0),
  });

  return plate;
}

/** Emit a weld bead along a joint. Welds are never part of collision. */
export function weldJoint(
  ctx: BuildContext,
  path: readonly Vector3[],
  normalA: Vector3,
  normalB: Vector3,
  profile: WeldProfile,
  region?: Region,
): void {
  // At the coarsest LOD the beads are below a pixel and cost more than they show.
  if (ctx.detail >= 2) return;
  emitWeld(ctx.render, {
    path,
    normalA,
    normalB,
    profile,
    ...(region !== undefined ? { region } : {}),
  });
}

/** A named mount frame, for parts that attach to this one. */
export function frame(position: Vector3, rotation?: Matrix4): Matrix4 {
  const m = rotation ? rotation.clone() : new Matrix4();
  m.setPosition(position);
  return m;
}
