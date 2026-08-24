import { Matrix4, Vector2, Vector3 } from 'three';
import { Region, WEAR } from '../../geom/attributes.js';
import { rect, roundedRect } from '../../geom/poly2.js';
import { emitRevolve } from '../../prims/lathe.js';
import { S, SIDES, mm, sideSign, type MM, type Side } from '../../spec/units.js';
import { HULL, SPONSON_HALF_WIDTH } from '../../spec/hull.js';
import { structuralPlate } from '../emit.js';
import type { BuildContext, PartResult } from '../types.js';
import { facingOutboard } from './frames.js';

/**
 * The tools and kit racked along the hull sides.
 *
 * Every one of the three critics reported the hull as a bare shell, and they
 * were right — a Tiger's sponsons carry a tow cable, a jack and its block, a
 * crowbar, an axe, a shovel and a fire extinguisher, and without them the
 * vehicle looks like it has never left the factory.
 *
 * The exact arrangement varied between vehicles and between crews, so this is
 * declared RECONSTRUCTION: every item's presence is attested by the
 * photographs, its position is not. `reconstructed` on the part result is what
 * carries that into the Gauntlet report.
 */

/** Radial segments on a cylindrical tool. Small and numerous. */
const TOOL_SEGMENTS = 10;

/** Reported distance from a structural edge, for the chipping shader. */
const TOOL_EDGE_DIST = 20;

/** Edge band on a tool. Narrow, because the tools are small. */
const TOOL_EDGE_BAND = mm(TOOL_EDGE_DIST);

/** Corner radius of a boxed item, as a fraction of its height. */
const BOX_CORNER_FRACTION = 6;

/** Where a sponson-side item sits, in the plane standing off the hull. */
function onSponson(side: Side, y: MM, z: MM): Matrix4 {
  const sign = sideSign(side);
  const x = mm(SPONSON_HALF_WIDTH + HULL.stowage.standoff);
  const frame = facingOutboard(side, x);
  frame.setPosition(S(mm(sign * x)), S(y), S(z));
  return frame;
}

/** A tool lying along the hull side: a flat plate on its rack. */
function emitFlatTool(
  ctx: BuildContext,
  side: Side,
  opts: { centreZ: MM; lengthZ: MM; width: MM; depth: MM; y: MM },
): void {
  structuralPlate(ctx, {
    outline: rect(opts.lengthZ, opts.width),
    thickness: opts.depth,
    frame: onSponson(side, opts.y, opts.centreZ),
    chamfer: HULL.chamfer.side,
    region: Region.Exterior,
    materials: {
      inner: 'handledSteel',
      outer: 'handledSteel',
      edge: 'handledSteel',
    },
    // Everything on this rack was picked up, used and put back wet.
    wear: WEAR.handled,
    edgeBandWidth: TOOL_EDGE_BAND,
  });
}

/** A cylindrical tool lying fore and aft along the hull side. */
function emitBar(
  ctx: BuildContext,
  side: Side,
  opts: { centreZ: MM; lengthZ: MM; diameter: MM; y: MM; material: 'handledSteel' | 'canvas' },
): void {
  // Rotated about local Z, not local Y. `emitRevolve` turns about local Y, and
  // `facingOutboard` already maps local Y to world up — so a rotation about
  // local Y leaves the axis exactly where it was and the tool stands on end.
  // Every bar on the hull was standing vertically against the sponson.
  const frame = onSponson(side, opts.y, opts.centreZ).multiply(
    new Matrix4().makeRotationZ(Math.PI / 2),
  );
  emitRevolve(ctx.render, {
    profile: [
      new Vector2(0, S(mm(-opts.lengthZ / 2))),
      new Vector2(S(mm(opts.diameter / 2)), S(mm(-opts.lengthZ / 2))),
      new Vector2(S(mm(opts.diameter / 2)), S(mm(opts.lengthZ / 2))),
      new Vector2(0, S(mm(opts.lengthZ / 2))),
    ],
    segments: TOOL_SEGMENTS,
    material: opts.material,
    region: Region.Exterior,
    frame,
    wear: WEAR.handled,
    edgeDist: TOOL_EDGE_DIST,
  });
}

/** A box-shaped item — the jack, its block. */
function emitBox(
  ctx: BuildContext,
  side: Side,
  opts: { centreZ: MM; lengthZ: MM; height: MM; depth: MM; y: MM; material: 'handledSteel' | 'wood' },
): void {
  structuralPlate(ctx, {
    outline: roundedRect(opts.lengthZ, opts.height, mm(opts.height / BOX_CORNER_FRACTION), 3),
    thickness: opts.depth,
    frame: onSponson(side, opts.y, opts.centreZ),
    chamfer: HULL.chamfer.side,
    region: Region.Exterior,
    materials: {
      inner: opts.material,
      outer: opts.material,
      edge: opts.material,
    },
    wear: WEAR.handled,
    edgeBandWidth: TOOL_EDGE_BAND,
  });
}

export function buildStowage(ctx: BuildContext): PartResult {
  const start = ctx.render.triangleCount;
  const s = HULL.stowage;
  const y = s.railY;

  for (const side of SIDES) {
    // Port side: the heavy recovery kit — cable, jack, jack block.
    if (sideSign(side) > 0) {
      emitBar(ctx, side, { ...s.towCable, y, material: 'canvas' });
      emitBox(ctx, side, { ...s.jack, y, material: 'handledSteel' });
      emitBox(ctx, side, { ...s.jackBlock, y, material: 'wood' });
      continue;
    }

    // Starboard: the hand tools and the extinguisher.
    emitBar(ctx, side, { ...s.crowbar, y, material: 'handledSteel' });
    emitFlatTool(ctx, side, { ...s.axe, y });
    emitFlatTool(ctx, side, { ...s.shovel, y });

    const e = s.fireExtinguisher;
    const frame = onSponson(side, y, e.centreZ).multiply(
      new Matrix4().makeRotationX(-Math.PI / 2),
    );
    emitRevolve(ctx.render, {
      profile: [
        new Vector2(0, S(mm(-e.height / 2))),
        new Vector2(S(mm(e.diameter / 2)), S(mm(-e.height / 2))),
        new Vector2(S(mm(e.diameter / 2)), S(mm(e.height / 2))),
        new Vector2(0, S(mm(e.height / 2))),
      ],
      segments: TOOL_SEGMENTS,
      material: 'handledSteel',
      region: Region.Exterior,
      frame,
      wear: WEAR.handled,
      edgeDist: TOOL_EDGE_DIST,
    });
  }

  void Vector3;
  return {
    name: 'stowage',
    triangleCount: ctx.render.triangleCount - start,
    collision: [],
    frames: new Map(),
    // Attested by the photographs; positioned by reconstruction.
    reconstructed: true,
  };
}
