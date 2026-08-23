import { Vector2, Vector3 } from 'three';
import { Region } from '../../geom/attributes.js';
import { circle, rect, translate, type Poly2 } from '../../geom/poly2.js';
import { emitRevolve } from '../../prims/lathe.js';
import { S, mm, type MM } from '../../spec/units.js';
import { ARMOUR } from '../../spec/armour.js';
import { HULL, LOWER_HALF_WIDTH } from '../../spec/hull.js';
import { TURRET } from '../../spec/turret.js';
import { structuralPlate } from '../emit.js';
import type { BuildContext, PartResult } from '../types.js';
import { facingUp } from '../hull/frames.js';

/**
 * The inside of the hull: the firewall, the turret basket, and the floor the
 * crew actually stood on.
 *
 * This is the difference between a hull that is hollow and a hull you can be
 * inside. Dropping through an open hatch already works — the roof apertures are
 * genuine holes and the plates are real solids — but what you land in is an
 * empty box until the compartments exist.
 *
 * Everything here is `Region.FightingCompartment` or `EngineBay` rather than
 * `Exterior`, which is what the X-ray view and the interior paint scheme key
 * off.
 */

/** Segments on the basket wall. It is stood inside and looked along. */
const BASKET_SEGMENTS = 32;

/** Reported distance from a structural edge, for the chipping shader. */
const INTERIOR_EDGE_DIST = 40;

/** Top of the belly plate: the floor of the fighting compartment. */
const FLOOR_TOP: MM = mm(HULL.floorY + ARMOUR.hull.sideWallProudOfBelly);

/**
 * The firewall between the fighting compartment and the engine bay.
 *
 * It is what makes the engine bay a separate space rather than the back half of
 * one long room, and it is why a Tiger's crew could not reach the engine from
 * inside.
 */
function buildFirewall(ctx: BuildContext): void {
  const width = mm(HULL.lowerWidth - ARMOUR.hull.sideLower.thickness * 2);
  const height = mm(HULL.sponsonFloorY - FLOOR_TOP);

  structuralPlate(ctx, {
    outline: rect(width, height),
    thickness: HULL.firewallThickness,
    frame: firewallFrame(mm(FLOOR_TOP + height / 2)),
    chamfer: HULL.chamfer.side,
    region: Region.EngineBay,
    materials: {
      inner: 'interiorIvoryPaint',
      outer: 'interiorIvoryPaint',
      edge: 'interiorIvoryPaint',
    },
    edgeBandWidth: HULL.interiorEdgeBand,
  });
}

/** A forward-facing bulkhead at the firewall station. */
function firewallFrame(centreY: MM): ReturnType<typeof facingUp> {
  const m = facingUp(mm(0)).identity();
  m.setPosition(0, S(centreY), S(HULL.firewallZ));
  return m;
}

/**
 * The turret basket: the floor that hangs from the turret ring and turns with
 * the turret, carrying the gunner and loader round with the gun.
 *
 * Built here rather than with the turret because it is what the interior reads
 * as from inside the hull, and because its diameter is set by the ring's clear
 * opening — UNCERTAINTY #2, adopted at 1,830 mm and declared as reconstruction.
 */
function buildTurretBasket(ctx: BuildContext): void {
  const radius = mm(TURRET.ring.clearOpeningDiameter / 2 - TURRET.basket.clearance);
  const floorY = mm(FLOOR_TOP + TURRET.basket.floorAboveHull);
  const centreZ = TURRET.ring.centreZ;

  // The basket floor.
  structuralPlate(ctx, {
    outline: translate(circle(radius, BASKET_SEGMENTS), mm(0), mm(-centreZ)),
    thickness: TURRET.basket.floorThickness,
    frame: facingUp(mm(floorY + TURRET.basket.floorThickness)),
    chamfer: HULL.chamfer.side,
    region: Region.FightingCompartment,
    materials: {
      inner: 'oiledFloorSteel',
      outer: 'oiledFloorSteel',
      edge: 'oiledFloorSteel',
    },
    edgeBandWidth: HULL.interiorEdgeBand,
  });

  // The tubular frame hanging it from the ring.
  for (let i = 0; i < TURRET.basket.hangers; i++) {
    const a = (i / TURRET.basket.hangers) * Math.PI * 2;
    emitRevolve(ctx.render, {
      profile: [
        new Vector2(0, S(floorY)),
        new Vector2(S(mm(TURRET.basket.hangerDiameter / 2)), S(floorY)),
        new Vector2(S(mm(TURRET.basket.hangerDiameter / 2)), S(TURRET.ring.planeY)),
        new Vector2(0, S(TURRET.ring.planeY)),
      ],
      segments: 10,
      material: 'oiledFloorSteel',
      region: Region.FightingCompartment,
      origin: new Vector3(
        S(mm(Math.cos(a) * radius * TURRET.basket.hangerRadiusFraction)),
        0,
        S(mm(centreZ + Math.sin(a) * radius * TURRET.basket.hangerRadiusFraction)),
      ),
      edgeDist: INTERIOR_EDGE_DIST,
    });
  }
}

/**
 * Covers over the torsion bars.
 *
 * Sixteen bars run transversely under the floor, and the crew walked on the
 * plates covering them. Without these the fighting compartment floor is the
 * belly plate, which is 200 mm lower than the crew actually stood.
 */
function buildTorsionCovers(ctx: BuildContext): void {
  const width = mm(HULL.lowerWidth - ARMOUR.hull.sideLower.thickness * 2);
  const frontZ = HULL.firewallZ;
  const rearZ = mm(HULL.frontZ - HULL.driverFloorRun);

  structuralPlate(ctx, {
    outline: rect(width, mm(rearZ - frontZ)),
    thickness: HULL.crewFloorThickness,
    frame: facingUp(mm(FLOOR_TOP + HULL.crewFloorHeight + HULL.crewFloorThickness)),
    chamfer: HULL.chamfer.side,
    region: Region.FightingCompartment,
    materials: {
      inner: 'oiledFloorSteel',
      outer: 'oiledFloorSteel',
      edge: 'oiledFloorSteel',
    },
    edgeBandWidth: HULL.interiorEdgeBand,
  });
  void LOWER_HALF_WIDTH;
}

export function buildInteriorStructure(ctx: BuildContext): PartResult {
  const start = ctx.render.triangleCount;
  buildFirewall(ctx);
  buildTorsionCovers(ctx);
  buildTurretBasket(ctx);
  return {
    name: 'interiorStructure',
    triangleCount: ctx.render.triangleCount - start,
    collision: [],
    frames: new Map(),
  };
}

/** Unused import guard: the outline helper is shared with other interior parts. */
export type InteriorOutline = Poly2;
