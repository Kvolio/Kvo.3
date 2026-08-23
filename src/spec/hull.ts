import { R, fromHorizontal, mm, deg, port, starboard, type MM } from './units.js';
import type { MetaOf } from './meta.js';
import { OVERALL } from './overall.js';
import { ARMOUR } from './armour.js';
import { TRACK, TRACK_CENTRE_X } from './runningGear.js';

/**
 * Hull layout.
 *
 * The Tiger's hull is two structures welded together: a lower hull (Wanne) that
 * is a plain box carrying the running gear, and a superstructure over it whose
 * sides run out past the tracks to form the sponsons. Nearly half the
 * ammunition lives in those sponsons, which is why they are so deep.
 *
 * Plate thicknesses and angles come from `ARMOUR` and are sourced. The
 * LANDMARKS below — where one plate stops and the next begins — are scaled from
 * the orthographic drawing and are reconstructed, so they carry wide tolerances
 * and are flagged accordingly. They are constrained, though: the profile has to
 * close on the sourced overall length, hull roof height and ground clearance,
 * and it has to leave room for a 2,100 mm turret ring.
 */

const FRONT_Z = OVERALL.length / 2;
const REAR_Z = -OVERALL.length / 2;

export const HULL = {
  frontZ: mm(FRONT_Z),
  rearZ: mm(REAR_Z),

  /** Underside of the belly plate. */
  floorY: OVERALL.groundClearance,
  /** Top surface of the hull roof and engine deck. */
  roofY: OVERALL.heightToHullRoof,

  /**
   * Lower hull width, outer face to outer face of the side plates.
   * Derived: the tracks run immediately outboard of it, so this is the overall
   * width less two track widths.
   */
  lowerWidth: mm(OVERALL.widthOverCombatTracks - TRACK.width * 2),

  /**
   * Superstructure width across the sponson outer faces. Narrower than the
   * width over the tracks — the track guards bridge the remaining gap.
   */
  superstructureWidth: mm(3240),

  /**
   * Height at which the nose plate gives way to the short glacis. The top edge
   * of the nose plate is the hull's foremost point.
   */
  noseTopY: mm(1150),
  /**
   * Horizontal run of the short glacis, from the top of the nose plate back to
   * the foot of the driver's front plate. Short, as its name says: this is the
   * step in the Tiger's front, not a deck.
   */
  glacisRun: mm(550),

  /** Longitudinal extent of the sponson floor, which is also the roof of the track run. */
  sponsonFloorY: mm(1120),

  /** Engine bay bulkhead position: the firewall between fighting compartment and engine. */
  firewallZ: mm(-1180),

  /**
   * How a crew hatch lid meets the hole it sits in.
   *
   * Shared by both forward hatches: they are the same casting handed, and
   * giving each its own copy of these would let the two drift apart.
   */
  hatchSeat: {
    /** Gap between the lid's spigot and the aperture, so it drops in. */
    clearance: mm(6),
    /** How far the lid's flange overhangs the hole it rests on. */
    flange: mm(55),
    /**
     * How far the closed lid stands above the roof.
     *
     * The rest of its hundred millimetres hangs down INSIDE the ring — a Tiger's
     * forward hatches are thick lids seated into their apertures, showing a low
     * step, not discs resting on the roof. The spigot depth follows from this
     * and the lid's thickness rather than being a third number to keep in step.
     */
    proud: mm(35),
    /** How far the pivot arm is let into the lid's top face. */
    armInset: mm(25),
  },

  /**
   * Driver's hatch, on the roof, port side.
   *
   * The Tiger's forward hatches do not hinge. Each lid is carried on a curved
   * arm off a vertical pivot post beside it: the lid screws straight UP clear
   * of its seat, then swings horizontally out of the way. That is why the lids
   * sit flush in the roof with no hinge visible on the outside, and it is
   * modelled as the two-stage motion it is rather than as a flap.
   */
  driverHatch: {
    centreX: port(mm(560)),
    centreZ: mm(1700),
    diameter: mm(600),
    thickness: mm(100),
    openAngle: deg(95),
    /** Rise before the swing starts. Must clear the seat lip. */
    liftHeight: mm(120),
    /** Pivot post, relative to the hatch centre. Outboard and aft of the lid. */
    pivotOffsetX: mm(430),
    pivotOffsetZ: mm(-150),
    postDiameter: mm(95),
    /** The arm from post to lid. */
    armWidth: mm(130),
    armThickness: mm(45),
  },

  /** Radio operator's hatch, mirroring the driver's to starboard. */
  radioHatch: {
    centreX: starboard(mm(560)),
    centreZ: mm(1700),
    diameter: mm(600),
    thickness: mm(100),
    openAngle: deg(95),
    liftHeight: mm(120),
    pivotOffsetX: mm(430),
    pivotOffsetZ: mm(-150),
    postDiameter: mm(95),
    armWidth: mm(130),
    armThickness: mm(45),
  },

  /** Driver's visor (Fahrersehklappe) in the front plate, with its sliding shutter. */
  driverVisor: {
    centreX: port(mm(560)),
    centreY: mm(1440),
    width: mm(280),
    height: mm(95),
    shutterThickness: mm(90),
  },

  /** Hull machine gun ball mount, starboard side of the front plate. */
  hullMGMount: {
    centreX: starboard(mm(560)),
    centreY: mm(1430),
    /**
     * The bore cut through the front plate. Smaller than the ball mount that
     * caps it, because the ball has to seat against armour rather than pass
     * through it.
     */
    apertureDiameter: mm(200),
  },

  /** Bosch headlights on the glacis. Two of them until August 1943. */
  headlight: {
    centreX: mm(1080),
    /**
     * Where along the glacis they stand. The glacis is only a 550 mm run, so
     * this is most of the way back along it, clear of the nose seam.
     */
    standZ: mm(2780),
    diameter: mm(180),
    depth: mm(120),
  },

  /** Engine deck: the raised rectangle carrying the radiator grilles and access hatches. */
  engineDeck: {
    frontZ: mm(-1180),
    rearZ: mm(-3020),
    /** Central engine access hatch. */
    hatchWidth: mm(900),
    hatchLength: mm(760),
    hatchCentreZ: mm(-1660),
    hatchThickness: mm(100),
    /** Radiator grilles either side of the centre hatch. */
    grilleWidth: mm(700),
    grilleLength: mm(900),
    grilleCentreX: mm(1000),
    grilleCentreZ: mm(-2400),
    /** The grille is a plate with slots, so the engine bay is genuinely open to air. */
    grilleThickness: mm(22),
    grilleSlats: 9,
    grilleSlotWidth: mm(34),
  },

  /**
   * Exhaust stacks on the rear plate, inboard of the Feifel canisters.
   *
   * These sat at 900 mm and interpenetrated the canisters by 145 mm — the two
   * were authored separately and never checked against each other.
   * `tests/parts/rearClash.test.ts` now asserts the clearance.
   */
  exhaust: {
    centreX: mm(700),
    diameter: mm(150),
    height: mm(700),
    /** Armoured guard around the base, added January 1943. */
    guardDiameter: mm(260),
    guardHeight: mm(330),
    /** Height of the stack's base above the ground. */
    baseY: mm(700),
    /** Wall thicknesses: the stack is open at the top and can be looked down. */
    wallThickness: mm(8),
    guardWallThickness: mm(12),
    /** Bolt circle fixing the guard to the rear plate. */
    guardBoltCircleRadius: mm(104),
    guardBoltCount: 6,
    guardBoltHeight: mm(40),
    guardBoltPlaneOffset: mm(52),
  },

  /** Track guards over each track run. */
  trackGuard: {
    /** Thickness of the sheet. */
    thickness: mm(6),
    /** Outboard extent from the vehicle centreline. */
    outerX: mm(OVERALL.widthOverCombatTracks / 2),
    /** Height above ground at which the guard sits. */
    height: mm(1120),
    /**
     * The guard runs past both ends of the hull. At the front this is what the
     * 1:50 drawing shows as a thin edge ahead of the nose, and reading that
     * edge as armour is what makes the front look like a vertical slab.
     */
    frontZ: mm(3480),
    rearZ: mm(-3330),
    /**
     * Sweep-back of the forward tip, outboard corner to inboard. From January
     * 1943 the front sections were cut as triangles rather than left square.
     */
    frontTriangleRun: mm(420),
    /** Matching sweep at the tail, so the guard does not end in a square edge. */
    rearTriangleRun: mm(210),
  },

  /**
   * Minenabwurfvorrichtung "S" — the S-mine dischargers, five of them, on the
   * superstructure roof edge. Short mortars firing a bounding anti-personnel
   * charge, for clearing infantry off the vehicle.
   *
   * See UNCERTAINTY #13: the count of five is well attested, their exact
   * stations are not.
   */
  sMineDischarger: {
    tubeDiameter: mm(96),
    tubeHeight: mm(190),
    /** Wall of the tube, so it reads as open rather than as a peg. */
    wallThickness: mm(10),
    baseDiameter: mm(150),
    baseHeight: mm(35),
    /** Inboard from the superstructure side, so the tube clears the edge. */
    inset: mm(130),
    /** Longitudinal stations, port and starboard alike. */
    stationsZ: [mm(2050), mm(-450)],
    /** The fifth sits on the centreline at the tail. */
    rearStationZ: mm(-2980),
  },

  /**
   * Edge breaks on the plates.
   *
   * Flame-cut armour has its arris knocked off before welding, so a perfectly
   * sharp edge reads as computer graphics — and the paint-chipping shader needs
   * a bevel to catch light on. Not a figure anyone recorded; sized from what a
   * cutting torch and a grinder leave behind.
   */
  chamfer: {
    structural: mm(6),
    belly: mm(4),
    side: mm(5),
  },

  /** Tow shackles at each corner. */
  towPoint: {
    centreX: mm(760),
    frontY: mm(700),
    rearY: mm(760),
    width: mm(120),
    thickness: mm(45),
  },
} as const;

/** Half the lower hull width: the outer face of a lower side plate. */
export const LOWER_HALF_WIDTH: MM = mm(HULL.lowerWidth / 2);

/** Half the superstructure width: the outer face of a sponson side plate. */
export const SPONSON_HALF_WIDTH: MM = mm(HULL.superstructureWidth / 2);

/** How far a sponson overhangs the lower hull on one side. */
export const SPONSON_DEPTH: MM = mm(SPONSON_HALF_WIDTH - LOWER_HALF_WIDTH);

/**
 * The hull's longitudinal profile, as (z, y) pairs running clockwise from the
 * top of the nose. Used to build the side plates and to check the silhouette.
 */
/**
 * Where the short glacis meets the driver's front plate. Derived: the glacis
 * rises across its run at its own angle.
 */
export const DRIVER_PLATE_FOOT_Y: MM = mm(
  HULL.noseTopY + HULL.glacisRun * Math.tan(R(fromHorizontal(ARMOUR.hull.shortGlacis.angle))),
);

/** Longitudinal position where the short glacis meets the driver's front plate. */
export const GLACIS_HEAD_Z: MM = mm(HULL.frontZ - HULL.glacisRun);

/** Outer face of the driver's front plate at a given height. */
export function driverPlateOuterZ(y: MM): MM {
  return mm(GLACIS_HEAD_Z - (y - DRIVER_PLATE_FOOT_Y) * Math.tan(R(ARMOUR.hull.driverPlate.angle)));
}

/** Outer face of the short glacis at a given longitudinal position. */
export function glacisOuterY(z: MM): MM {
  return mm(
    HULL.noseTopY +
      (HULL.frontZ - z) * Math.tan(R(fromHorizontal(ARMOUR.hull.shortGlacis.angle))),
  );
}

/**
 * Underside of the short glacis. What anything tucked beneath it — the lower
 * hull side plates, the forward sponson structure — has to stop short of.
 */
export function glacisInnerY(z: MM): MM {
  return mm(
    glacisOuterY(z) -
      ARMOUR.hull.shortGlacis.thickness * Math.sin(R(ARMOUR.hull.shortGlacis.angle)),
  );
}

/** Inner face of the driver's front plate at a given height. */
export function driverPlateInnerZ(y: MM): MM {
  return mm(
    driverPlateOuterZ(y) -
      ARMOUR.hull.driverPlate.thickness / Math.cos(R(ARMOUR.hull.driverPlate.angle)),
  );
}

/** Where the driver's front plate meets the hull roof. */
export const DRIVER_PLATE_HEAD_Z: MM = driverPlateOuterZ(HULL.roofY);

/**
 * The hull's longitudinal profile, as (z, y) pairs running clockwise from the
 * top of the nose. Used to build the side plates and to check the silhouette.
 *
 * The front is FOUR distinct planes, not one: nose, short glacis, driver's
 * plate, roof. A profile with only three is the wedge fault.
 */
export function hullProfile(): readonly (readonly [MM, MM])[] {
  const noseRun = (HULL.noseTopY - HULL.floorY) * Math.tan(R(ARMOUR.hull.nose.angle));
  const rearRun = (HULL.roofY - HULL.floorY) * Math.tan(R(ARMOUR.hull.rear.angle));

  return [
    [HULL.frontZ, HULL.noseTopY],
    [GLACIS_HEAD_Z, DRIVER_PLATE_FOOT_Y],
    [DRIVER_PLATE_HEAD_Z, HULL.roofY],
    [HULL.rearZ, HULL.roofY],
    [mm(HULL.rearZ + rearRun), HULL.floorY],
    [mm(HULL.frontZ - noseRun), HULL.floorY],
  ] as const;
}

const MEASURED =
  'Measured off the 1:50 side elevation, calibrated at 20.3 mm/px on the sourced hull length ' +
  'and cross-checked against the roof height (1827 mm measured vs 1780 mm sourced, 2.6 per cent). ' +
  'The drawing resolves the front step and the roof front edge but not a 60 mm plate, so the ' +
  'plate angles come from Jentz & Doyle and only the transition heights come from here.';
const CHAMFER_NOTE =
  'Not documented. Sized from what flame cutting and grinding leave on plate of this thickness.';
const DRAWING =
  'Scaled from REF-drawing against the sourced 6316 mm hull length, 1780 mm roof height and ' +
  '470 mm ground clearance, and constrained to clear the 2100 mm turret ring.';

export const HULL_META: MetaOf<typeof HULL> = {
  frontZ: { tol: 3, source: 'derived from OVERALL.length', confidence: 'derived' },
  rearZ: { tol: 3, source: 'derived from OVERALL.length', confidence: 'derived' },
  floorY: { tol: 10, source: 'derived from OVERALL.groundClearance', confidence: 'derived' },
  roofY: { tol: 10, source: 'derived from OVERALL.heightToHullRoof', confidence: 'derived' },
  lowerWidth: {
    tol: 30,
    source: 'derived: overall width less two track widths',
    confidence: 'derived',
    uncertainty: 5,
  },
  superstructureWidth: { tol: 60, source: 'REF-drawing front view', confidence: 'estimated', note: DRAWING },
  noseTopY: { tol: 90, source: 'REF-drawing side view, measured', confidence: 'estimated', note: MEASURED },
  glacisRun: { tol: 120, source: 'REF-drawing side view, measured', confidence: 'estimated', note: MEASURED },
  sponsonFloorY: { tol: 50, source: 'REF-drawing', confidence: 'estimated', note: DRAWING },
  firewallZ: { tol: 80, source: 'REF-cutaway', confidence: 'estimated', note: DRAWING },
  hatchSeat: {
    clearance: { tol: 3, source: 'fitting practice for a dropped-in lid', confidence: 'estimated', note: DRAWING },
    flange: { tol: 20, source: 'REF-photo-1: the lid rim stands proud of the roof', confidence: 'estimated', note: DRAWING },
    proud: { tol: 15, source: 'REF-photo-1: the lid shows a low step', confidence: 'estimated', note: DRAWING },
    armInset: { tol: 15, source: 'REF-photo-1: the arm is flush, not proud', confidence: 'estimated', note: DRAWING },
  },
  driverHatch: {
    centreX: { tol: 40, source: 'REF-drawing plan view', confidence: 'estimated', note: DRAWING },
    centreZ: { tol: 50, source: 'REF-drawing plan view', confidence: 'estimated', note: DRAWING },
    diameter: { tol: 30, source: 'REF-drawing plan view', confidence: 'estimated', note: DRAWING },
    thickness: { tol: 10, source: 'matches roof-level armour practice', confidence: 'estimated', note: DRAWING },
    openAngle: { tol: 10, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING },
    liftHeight: { tol: 40, source: 'pivot-post mechanism, REF-photo-1', confidence: 'estimated', note: DRAWING },
    pivotOffsetX: { tol: 60, source: 'pivot-post mechanism, REF-photo-1', confidence: 'estimated', note: DRAWING },
    pivotOffsetZ: { tol: 60, source: 'pivot-post mechanism, REF-photo-1', confidence: 'estimated', note: DRAWING },
    postDiameter: { tol: 20, source: 'pivot-post mechanism, REF-photo-1', confidence: 'estimated', note: DRAWING },
    armWidth: { tol: 25, source: 'pivot-post mechanism, REF-photo-1', confidence: 'estimated', note: DRAWING },
    armThickness: { tol: 15, source: 'pivot-post mechanism, REF-photo-1', confidence: 'estimated', note: DRAWING },
  },
  radioHatch: {
    centreX: { tol: 40, source: 'REF-drawing plan view', confidence: 'estimated', note: DRAWING },
    centreZ: { tol: 50, source: 'REF-drawing plan view', confidence: 'estimated', note: DRAWING },
    diameter: { tol: 30, source: 'REF-drawing plan view', confidence: 'estimated', note: DRAWING },
    thickness: { tol: 10, source: 'matches roof-level armour practice', confidence: 'estimated', note: DRAWING },
    openAngle: { tol: 10, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING },
    liftHeight: { tol: 40, source: 'pivot-post mechanism, REF-photo-1', confidence: 'estimated', note: DRAWING },
    pivotOffsetX: { tol: 60, source: 'pivot-post mechanism, REF-photo-1', confidence: 'estimated', note: DRAWING },
    pivotOffsetZ: { tol: 60, source: 'pivot-post mechanism, REF-photo-1', confidence: 'estimated', note: DRAWING },
    postDiameter: { tol: 20, source: 'pivot-post mechanism, REF-photo-1', confidence: 'estimated', note: DRAWING },
    armWidth: { tol: 25, source: 'pivot-post mechanism, REF-photo-1', confidence: 'estimated', note: DRAWING },
    armThickness: { tol: 15, source: 'pivot-post mechanism, REF-photo-1', confidence: 'estimated', note: DRAWING },
  },
  driverVisor: {
    centreX: { tol: 40, source: 'REF-photo-2', confidence: 'estimated', note: DRAWING },
    centreY: { tol: 40, source: 'REF-photo-2', confidence: 'estimated', note: DRAWING },
    width: { tol: 25, source: 'REF-photo-2', confidence: 'estimated', note: DRAWING },
    height: { tol: 15, source: 'REF-photo-2', confidence: 'estimated', note: DRAWING },
    shutterThickness: { tol: 15, source: 'REF-photo-2', confidence: 'estimated', note: DRAWING },
  },
  hullMGMount: {
    centreX: { tol: 40, source: 'REF-photo-2', confidence: 'estimated', note: DRAWING },
    centreY: { tol: 40, source: 'REF-photo-2', confidence: 'estimated', note: DRAWING },
    apertureDiameter: { tol: 25, source: 'REF-photo-2', confidence: 'estimated', note: DRAWING },
  },
  headlight: {
    standZ: { tol: 90, source: 'REF-photo-2: lamps stand on the glacis', confidence: 'estimated', note: DRAWING },
    centreX: { tol: 50, source: 'REF-photo-2', confidence: 'estimated', note: DRAWING },
    diameter: { tol: 20, source: 'Bosch pattern headlight', confidence: 'estimated', note: DRAWING },
    depth: { tol: 20, source: 'Bosch pattern headlight', confidence: 'estimated', note: DRAWING },
  },
  engineDeck: {
    frontZ: { tol: 80, source: 'REF-drawing plan view', confidence: 'estimated', note: DRAWING },
    rearZ: { tol: 60, source: 'REF-drawing plan view', confidence: 'estimated', note: DRAWING },
    hatchWidth: { tol: 60, source: 'REF-drawing plan view', confidence: 'estimated', note: DRAWING },
    hatchLength: { tol: 60, source: 'REF-drawing plan view', confidence: 'estimated', note: DRAWING },
    hatchCentreZ: { tol: 80, source: 'REF-drawing plan view', confidence: 'estimated', note: DRAWING },
    hatchThickness: { tol: 15, source: 'matches roof-level armour practice', confidence: 'estimated', note: DRAWING },
    grilleWidth: { tol: 60, source: 'REF-drawing plan view', confidence: 'estimated', note: DRAWING },
    grilleLength: { tol: 60, source: 'REF-drawing plan view', confidence: 'estimated', note: DRAWING },
    grilleCentreX: { tol: 60, source: 'REF-drawing plan view', confidence: 'estimated', note: DRAWING },
    grilleCentreZ: { tol: 80, source: 'REF-drawing plan view', confidence: 'estimated', note: DRAWING },
    grilleThickness: { tol: 8, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING },
    grilleSlats: { tol: 2, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING },
    grilleSlotWidth: { tol: 8, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING },
  },
  exhaust: {
    centreX: { tol: 50, source: 'REF-drawing rear view', confidence: 'estimated', note: DRAWING },
    diameter: { tol: 20, source: 'REF-drawing rear view', confidence: 'estimated', note: DRAWING },
    height: { tol: 50, source: 'REF-drawing rear view', confidence: 'estimated', note: DRAWING },
    guardDiameter: { tol: 30, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING },
    guardHeight: { tol: 30, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING },
    baseY: { tol: 60, source: 'REF-drawing rear view', confidence: 'estimated', note: DRAWING },
    wallThickness: { tol: 3, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING },
    guardWallThickness: { tol: 4, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING },
    guardBoltCircleRadius: { tol: 20, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING },
    guardBoltCount: { tol: 2, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING },
    guardBoltHeight: { tol: 20, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING },
    guardBoltPlaneOffset: { tol: 20, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING },
  },
  trackGuard: {
    thickness: { tol: 2, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING },
    outerX: { tol: 15, source: 'derived from OVERALL.widthOverCombatTracks', confidence: 'derived' },
    height: { tol: 50, source: 'REF-drawing', confidence: 'estimated', note: DRAWING },
    frontZ: { tol: 90, source: 'REF-drawing side view: guard edge ahead of the nose', confidence: 'estimated', note: DRAWING },
    rearZ: { tol: 90, source: 'REF-drawing side view', confidence: 'estimated', note: DRAWING },
    frontTriangleRun: { tol: 90, source: 'TIC-changes: triangular front sections from Jan 1943', confidence: 'estimated', note: DRAWING },
    rearTriangleRun: { tol: 70, source: 'REF-drawing side view', confidence: 'estimated', note: DRAWING },
  },
  sMineDischarger: {
    tubeDiameter: { tol: 15, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING },
    wallThickness: { tol: 4, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING },
    tubeHeight: { tol: 40, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING },
    baseDiameter: { tol: 25, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING },
    baseHeight: { tol: 15, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING },
    inset: { tol: 50, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING },
    stationsZ: { tol: 250, source: 'UNCERTAINTY #13: count attested, stations are not', confidence: 'estimated', note: DRAWING },
    rearStationZ: { tol: 250, source: 'UNCERTAINTY #13', confidence: 'estimated', note: DRAWING },
  },
  chamfer: {
    structural: { tol: 3, source: 'fabrication practice', confidence: 'estimated', note: CHAMFER_NOTE },
    belly: { tol: 3, source: 'fabrication practice', confidence: 'estimated', note: CHAMFER_NOTE },
    side: { tol: 3, source: 'fabrication practice', confidence: 'estimated', note: CHAMFER_NOTE },
  },
  towPoint: {
    centreX: { tol: 40, source: 'REF-photo-2', confidence: 'estimated', note: DRAWING },
    frontY: { tol: 40, source: 'REF-photo-2', confidence: 'estimated', note: DRAWING },
    rearY: { tol: 40, source: 'REF-drawing rear view', confidence: 'estimated', note: DRAWING },
    width: { tol: 20, source: 'REF-photo-2', confidence: 'estimated', note: DRAWING },
    thickness: { tol: 10, source: 'REF-photo-2', confidence: 'estimated', note: DRAWING },
  },
};

/** Re-exported so hull builders do not have to reach for the running gear spec. */
export { TRACK_CENTRE_X };
