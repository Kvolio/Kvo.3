import { Vector2, Vector3 } from 'three';
import { Region } from '../../geom/attributes.js';
import { rect, type Poly2 } from '../../geom/poly2.js';
import { emitRevolve } from '../../prims/lathe.js';
import { S, SIDES, mm, sideSign, type MM } from '../../spec/units.js';
import { ARMOUR } from '../../spec/armour.js';
import { HULL, LOWER_HALF_WIDTH } from '../../spec/hull.js';
import {
  COOLING,
  ENGINE,
  FINAL_DRIVE,
  STEERING,
  TRANSMISSION,
} from '../../spec/powertrain.js';
import { SPROCKET } from '../../spec/runningGear.js';
import { structuralPlate } from '../emit.js';
import type { BuildContext, PartResult } from '../types.js';
import { facingUp } from '../hull/frames.js';

/**
 * What fills the hull: the engine at the back, the transmission and steering
 * unit in the bow, and the radiators either side of the engine.
 *
 * A Tiger's layout is the opposite way round from most people's expectation.
 * The engine is at the REAR and the drive sprockets are at the FRONT, so a
 * propeller shaft runs the length of the fighting compartment UNDER the turret
 * basket to a gearbox in the bow. That shaft is why the basket floor sits where
 * it does, and it is the single fact that explains the interior's shape.
 *
 * Everything here is blocked out to its sourced envelope rather than detailed.
 * A Maybach HL 210 modelled cylinder by cylinder would be most of the triangle
 * budget and invisible behind a firewall; what matters is that the spaces are
 * occupied by objects of the right size in the right places, so the compartment
 * reads as full rather than as an empty box with a floor.
 */

/** Radial segments on shafts and housings. */
const SHAFT_SEGMENTS = 16;

/** Reported distance from a structural edge, for the chipping shader. */
const MACHINE_EDGE_DIST = 35;

/** Top of the belly plate. */
const FLOOR_TOP: MM = mm(HULL.floorY + ARMOUR.hull.sideWallProudOfBelly);

/** A rectangular box of machinery, sitting on the hull floor. */
function machineBox(
  ctx: BuildContext,
  opts: {
    width: MM;
    height: MM;
    length: MM;
    centreX: MM;
    centreZ: MM;
    baseY: MM;
    region: Region;
  },
): void {
  const outline: Poly2 = rect(opts.width, opts.length);
  const frame = facingUp(mm(opts.baseY + opts.height));
  frame.setPosition(S(opts.centreX), S(mm(opts.baseY + opts.height)), S(opts.centreZ));
  structuralPlate(ctx, {
    outline,
    thickness: opts.height,
    frame,
    chamfer: HULL.chamfer.side,
    region: opts.region,
    // Not bright machined steel: an engine bay is oily and a gearbox casing is
    // painted. A mirror finish in here reflects the sky through the hatches and
    // reads as blue plastic.
    materials: {
      inner: 'oiledFloorSteel',
      outer: 'oiledFloorSteel',
      edge: 'oiledFloorSteel',
    },
    edgeBandWidth: HULL.interiorEdgeBand,
  });
}

/** The Maybach HL 210 P45, blocked out to its sourced envelope. */
function buildEngine(ctx: BuildContext): void {
  machineBox(ctx, {
    width: ENGINE.width,
    height: ENGINE.height,
    length: ENGINE.length,
    centreX: mm(0),
    centreZ: ENGINE.centreZ,
    baseY: mm(FLOOR_TOP + ENGINE.baseAboveFloor),
    region: Region.EngineBay,
  });
}

/** The two radiator blocks, one either side of the engine. */
function buildRadiators(ctx: BuildContext): void {
  for (const side of SIDES) {
    machineBox(ctx, {
      width: COOLING.radiatorThickness,
      height: COOLING.radiatorHeight,
      length: COOLING.radiatorWidth,
      centreX: mm(sideSign(side) * COOLING.radiatorCentreX),
      centreZ: COOLING.radiatorCentreZ,
      baseY: mm(FLOOR_TOP + COOLING.radiatorBaseAboveFloor),
      region: Region.EngineBay,
    });
  }
}

/**
 * The Olvar gearbox, in the bow and offset to the RIGHT of the driver — which
 * is why the driver sits where he does and why the radio operator's station is
 * the cramped one.
 */
function buildTransmission(ctx: BuildContext): void {
  // Centred BETWEEN the two forward crew stations, derived from where they
  // actually are rather than carried as its own offset. The gearbox sits
  // between the driver and the radio operator; placing it 430 mm off the
  // vehicle's centreline instead put it in the radio operator's lap and blocked
  // his machine gun's sightline, which the vision tests refused.
  //
  // And it stands on the HULL floor, not on the crew floor over the torsion
  // bars — 200 mm higher, and the driver would be looking at his gearbox
  // instead of through his visor.
  machineBox(ctx, {
    width: TRANSMISSION.width,
    height: TRANSMISSION.height,
    length: TRANSMISSION.length,
    centreX: mm((HULL.driverVisor.centreX + HULL.hullMGMount.centreX) / 2),
    centreZ: TRANSMISSION.centreZ,
    baseY: FLOOR_TOP,
    region: Region.DriverCompartment,
  });
}

/** The steering unit, transverse in the bow ahead of the gearbox. */
function buildSteeringUnit(ctx: BuildContext): void {
  machineBox(ctx, {
    width: mm(LOWER_HALF_WIDTH * STEERING.widthFraction * 2),
    height: STEERING.unitHeight,
    length: STEERING.unitLength,
    centreX: mm(0),
    centreZ: STEERING.centreZ,
    baseY: FLOOR_TOP,
    region: Region.DriverCompartment,
  });
}

/**
 * The propeller shaft: engine to gearbox, the length of the fighting
 * compartment, under the turret basket.
 *
 * It is the reason the basket floor is where it is, so it is built rather than
 * assumed — if the shaft and the basket ever disagree, one of them is wrong and
 * the geometry will say which.
 */
function buildPropShaft(ctx: BuildContext): void {
  const y = mm(FLOOR_TOP + HULL.crewFloorHeight / 2);
  // Local +Y along world +Z, so the revolve's profile runs fore and aft.
  const frame = facingUp(mm(0)).makeRotationX(-Math.PI / 2);
  frame.setPosition(0, S(y), 0);

  emitRevolve(ctx.render, {
    profile: [
      new Vector2(0, S(TRANSMISSION.centreZ)),
      new Vector2(S(mm(TRANSMISSION.propShaftDiameter / 2)), S(TRANSMISSION.centreZ)),
      new Vector2(S(mm(TRANSMISSION.propShaftDiameter / 2)), S(ENGINE.centreZ)),
      new Vector2(0, S(ENGINE.centreZ)),
    ],
    segments: SHAFT_SEGMENTS,
    material: 'machinedSteel',
    region: Region.FightingCompartment,
    frame,
    edgeDist: MACHINE_EDGE_DIST,
  });
}

/** The final drive housings, where the shafts leave the hull to the sprockets. */
function buildFinalDrives(ctx: BuildContext): void {
  for (const side of SIDES) {
    const sign = sideSign(side);
    const frame = facingUp(mm(0)).makeRotationZ(Math.PI / 2);
    frame.setPosition(
      S(mm(sign * (LOWER_HALF_WIDTH - FINAL_DRIVE.housingDiameter / 2))),
      S(SPROCKET.centreY),
      S(SPROCKET.centreZ),
    );

    emitRevolve(ctx.render, {
      profile: [
        new Vector2(0, 0),
        new Vector2(S(mm(FINAL_DRIVE.housingDiameter / 2)), 0),
        new Vector2(
          S(mm(FINAL_DRIVE.housingDiameter / 2)),
          S(mm(sign * FINAL_DRIVE.housingProjection)),
        ),
        new Vector2(0, S(mm(sign * FINAL_DRIVE.housingProjection))),
      ],
      segments: SHAFT_SEGMENTS,
      material: 'machinedSteel',
      region: Region.Exterior,
      frame,
      edgeDist: MACHINE_EDGE_DIST,
    });
  }
}

export function buildPowertrain(ctx: BuildContext): PartResult {
  const start = ctx.render.triangleCount;
  buildEngine(ctx);
  buildRadiators(ctx);
  buildTransmission(ctx);
  buildSteeringUnit(ctx);
  buildPropShaft(ctx);
  buildFinalDrives(ctx);
  void Vector3;
  return {
    name: 'powertrain',
    triangleCount: ctx.render.triangleCount - start,
    collision: [],
    frames: new Map(),
  };
}
