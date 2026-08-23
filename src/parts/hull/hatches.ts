import { Vector2, Vector3 } from 'three';
import { Region, WEAR } from '../../geom/attributes.js';
import { circle, rect, translate, type Poly2 } from '../../geom/poly2.js';
import { emitRevolve } from '../../prims/lathe.js';
import { S, mm, type MM } from '../../spec/units.js';
import { HULL } from '../../spec/hull.js';
import { structuralPlate } from '../emit.js';
import type { BuildContext, PartResult } from '../types.js';
import { facingUp } from './frames.js';

/**
 * The forward crew hatches: the driver's to port, the radio operator's to
 * starboard.
 *
 * Each lid is built as its own assembly rather than merged into the hull,
 * because it moves. The roof aperture it seats in is already a genuine hole
 * cut in the roof plate's outline, so an open hatch is a hole the player can
 * drop through without any of this having to be special-cased.
 *
 * The mechanism is a pivot post, not a hinge — see the note on
 * `HULL.driverHatch`. The lid screws straight up clear of its seat and then
 * swings horizontally aside, which is why Tiger lids sit flush in the roof
 * with no external hinge and lie flat beside their holes when open.
 */

/** Segments around a lid the player can walk up to and stand on. */
const LID_SEGMENTS = 32;

const {
  clearance: SEAT_CLEARANCE,
  flange: SEAT_FLANGE,
  proud: SEAT_PROUD,
  armInset: ARM_INSET,
} = HULL.hatchSeat;

/** Distance from a structural edge reported for the post, for the chip shader. */
const POST_EDGE_DIST = 30;


export type HatchId = 'driverHatch' | 'radioHatch';

export interface HatchGeometry {
  readonly part: PartResult;
  /** Pivot point in vehicle space, MILLIMETRES. */
  readonly pivot: readonly [MM, MM, MM];
}

/**
 * Build one lid, its arm and its post, in vehicle space.
 *
 * Everything is authored at the closed position. The articulation applies the
 * lift and swing on top, so the rest pose here is the pose the hull was cut
 * for and the seat can be checked against the aperture directly.
 */
export function buildHatchLid(ctx: BuildContext, id: HatchId): HatchGeometry {
  const spec = HULL[id];
  const start = ctx.render.triangleCount;

  const roofTop = mm(HULL.roofY);
  // The lid is thicker than the step it shows, so the balance hangs inside the
  // ring. A spigot that stopped at the roof's underside would leave the lid
  // resting on the roof like a coin on a drain.
  const spigotBottomY = mm(roofTop - (spec.thickness - SEAT_PROUD));

  // The step: a disc wider than the hole, bearing on the roof around it.
  const flangeRadius = mm(spec.diameter / 2 + SEAT_FLANGE);
  structuralPlate(ctx, {
    outline: translate(
      circle(flangeRadius, LID_SEGMENTS),
      spec.centreX,
      // Plate-local Y runs aft-negative on an upward-facing frame, matching the
      // roof it seats on.
      mm(-spec.centreZ),
    ),
    thickness: SEAT_PROUD,
    frame: facingUp(mm(roofTop + SEAT_PROUD)),
    chamfer: HULL.chamfer.structural,
    region: Region.Exterior,
    materials: { inner: 'interiorIvoryPaint' },
    // Crews went in and out over this all day, and stood on it to get at the
    // turret. It is the most worn surface on the vehicle.
    wear: WEAR.footTraffic,
  });

  // The spigot: a shallow plug that locates the lid in the aperture, so the
  // joint reads as a seated lid rather than a coin laid over a hole.
  const spigotRadius = mm(spec.diameter / 2 - SEAT_CLEARANCE);
  emitRevolve(ctx.render, {
    profile: [
      new Vector2(0, S(spigotBottomY)),
      new Vector2(S(spigotRadius), S(spigotBottomY)),
      new Vector2(S(spigotRadius), S(roofTop)),
      new Vector2(0, S(roofTop)),
    ],
    segments: LID_SEGMENTS,
    material: 'armourPaintedExterior',
    region: Region.Exterior,
    origin: new Vector3(S(spec.centreX), 0, S(spec.centreZ)),
    edgeDist: SEAT_FLANGE,
  });

  // The arm, from the lid's edge out to the post.
  const pivotX = mm(spec.centreX + Math.sign(spec.centreX) * spec.pivotOffsetX);
  const pivotZ = mm(spec.centreZ + spec.pivotOffsetZ);
  const armSpan = mm(Math.hypot(pivotX - spec.centreX, pivotZ - spec.centreZ));
  const armAngle = Math.atan2(pivotZ - spec.centreZ, pivotX - spec.centreX);

  const armOutline: Poly2 = rect(armSpan, spec.armWidth).map((p) => {
    const rotated = new Vector2(p.x, p.y).rotateAround(new Vector2(0, 0), armAngle);
    return new Vector2(
      rotated.x + (spec.centreX + pivotX) / 2,
      -(rotated.y + (spec.centreZ + pivotZ) / 2),
    );
  });
  // Set into the lid's own thickness rather than laid on top of it. Sitting the
  // arm proud of the lid's face makes it read as a rod dropped across the
  // hatch; countersunk, it reads as the bracket it is.
  structuralPlate(ctx, {
    outline: armOutline,
    thickness: spec.armThickness,
    frame: facingUp(mm(roofTop + SEAT_PROUD - ARM_INSET)),
    chamfer: HULL.chamfer.structural,
    region: Region.Exterior,
    materials: { inner: 'machinedSteel', outer: 'machinedSteel' },
  });

  // The post itself. It stands on the roof and does not move with the lid, but
  // it belongs to the same assembly because it is the mechanism's other half
  // and would otherwise be authored twice against two different pivots.
  const postRadius = mm(spec.postDiameter / 2);
  // Tall enough that the arm still has post to ride on at full lift.
  const postTopY = mm(roofTop + SEAT_PROUD + spec.armThickness + spec.liftHeight);
  emitRevolve(ctx.render, {
    profile: [
      new Vector2(0, S(roofTop)),
      new Vector2(S(postRadius), S(roofTop)),
      new Vector2(S(postRadius), S(postTopY)),
      new Vector2(0, S(postTopY)),
    ],
    segments: 20,
    material: 'machinedSteel',
    region: Region.Exterior,
    origin: new Vector3(S(pivotX), 0, S(pivotZ)),
    edgeDist: POST_EDGE_DIST,
  });

  return {
    part: {
      name: id,
      triangleCount: ctx.render.triangleCount - start,
      collision: [],
      frames: new Map(),
    },
    pivot: [pivotX, mm(roofTop), pivotZ],
  };
}
