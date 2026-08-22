import { mm, deg, type MM } from './units.js';
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

  /** Height at which the nose plate gives way to the driver's front plate. */
  noseTopY: mm(1000),
  /** Height at which the driver's front plate gives way to the upper glacis. */
  driverPlateTopY: mm(1600),

  /** Longitudinal extent of the sponson floor, which is also the roof of the track run. */
  sponsonFloorY: mm(1120),

  /** Engine bay bulkhead position: the firewall between fighting compartment and engine. */
  firewallZ: mm(-1180),

  /** Driver's hatch centre, on the roof, port side. */
  driverHatch: {
    centreX: mm(-560),
    centreZ: mm(1880),
    diameter: mm(600),
    thickness: mm(100),
    openAngle: deg(95),
  },

  /** Radio operator's hatch, mirroring the driver's to starboard. */
  radioHatch: {
    centreX: mm(560),
    centreZ: mm(1880),
    diameter: mm(600),
    thickness: mm(100),
    openAngle: deg(95),
  },

  /** Driver's visor (Fahrersehklappe) in the front plate, with its sliding shutter. */
  driverVisor: {
    centreX: mm(-560),
    centreY: mm(1440),
    width: mm(280),
    height: mm(95),
    shutterThickness: mm(90),
  },

  /** Hull machine gun ball mount, starboard side of the front plate. */
  hullMGMount: {
    centreX: mm(560),
    centreY: mm(1430),
  },

  /** Bosch headlights on the glacis. Two of them until August 1943. */
  headlight: {
    centreX: mm(1080),
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
    /** Radiator grilles either side of the centre hatch. */
    grilleWidth: mm(700),
    grilleLength: mm(900),
    grilleCentreX: mm(1000),
  },

  /** Exhaust stacks on the rear plate. */
  exhaust: {
    centreX: mm(900),
    diameter: mm(150),
    height: mm(700),
    /** Armoured guard around the base, added January 1943. */
    guardDiameter: mm(260),
    guardHeight: mm(330),
  },

  /** Track guards over each track run. */
  trackGuard: {
    /** Thickness of the sheet. */
    thickness: mm(6),
    /** Outboard extent from the vehicle centreline. */
    outerX: mm(OVERALL.widthOverCombatTracks / 2),
    /** Height above ground at which the guard sits. */
    height: mm(1120),
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
export function hullProfile(): readonly (readonly [MM, MM])[] {
  const noseRun = (HULL.noseTopY - HULL.floorY) * Math.tan((ARMOUR.hull.nose.angle * Math.PI) / 180);
  const driverRun =
    (HULL.driverPlateTopY - HULL.noseTopY) *
    Math.tan((ARMOUR.hull.driverPlate.angle * Math.PI) / 180);
  const glacisRun =
    (HULL.roofY - HULL.driverPlateTopY) /
    Math.tan(((90 - ARMOUR.hull.upperGlacis.angle) * Math.PI) / 180);
  const rearRun = (HULL.roofY - HULL.floorY) * Math.tan((ARMOUR.hull.rear.angle * Math.PI) / 180);

  const noseTopZ = HULL.frontZ;
  const driverTopZ = mm(noseTopZ - driverRun);
  const glacisTopZ = mm(driverTopZ - glacisRun);

  return [
    [mm(noseTopZ), HULL.noseTopY],
    [mm(driverTopZ), HULL.driverPlateTopY],
    [mm(glacisTopZ), HULL.roofY],
    // The rear plate leans back at the top, so the roof overhangs the tail.
    [HULL.rearZ, HULL.roofY],
    [mm(HULL.rearZ + rearRun), HULL.floorY],
    [mm(noseTopZ - noseRun), HULL.floorY],
  ] as const;
}

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
  noseTopY: { tol: 60, source: 'REF-drawing', confidence: 'estimated', note: DRAWING },
  driverPlateTopY: { tol: 60, source: 'REF-drawing', confidence: 'estimated', note: DRAWING },
  sponsonFloorY: { tol: 50, source: 'REF-drawing', confidence: 'estimated', note: DRAWING },
  firewallZ: { tol: 80, source: 'REF-cutaway', confidence: 'estimated', note: DRAWING },
  driverHatch: {
    centreX: { tol: 40, source: 'REF-drawing plan view', confidence: 'estimated', note: DRAWING },
    centreZ: { tol: 50, source: 'REF-drawing plan view', confidence: 'estimated', note: DRAWING },
    diameter: { tol: 30, source: 'REF-drawing plan view', confidence: 'estimated', note: DRAWING },
    thickness: { tol: 10, source: 'matches roof-level armour practice', confidence: 'estimated', note: DRAWING },
    openAngle: { tol: 10, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING },
  },
  radioHatch: {
    centreX: { tol: 40, source: 'REF-drawing plan view', confidence: 'estimated', note: DRAWING },
    centreZ: { tol: 50, source: 'REF-drawing plan view', confidence: 'estimated', note: DRAWING },
    diameter: { tol: 30, source: 'REF-drawing plan view', confidence: 'estimated', note: DRAWING },
    thickness: { tol: 10, source: 'matches roof-level armour practice', confidence: 'estimated', note: DRAWING },
    openAngle: { tol: 10, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING },
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
  },
  headlight: {
    centreX: { tol: 50, source: 'REF-photo-2', confidence: 'estimated', note: DRAWING },
    diameter: { tol: 20, source: 'Bosch pattern headlight', confidence: 'estimated', note: DRAWING },
    depth: { tol: 20, source: 'Bosch pattern headlight', confidence: 'estimated', note: DRAWING },
  },
  engineDeck: {
    frontZ: { tol: 80, source: 'REF-drawing plan view', confidence: 'estimated', note: DRAWING },
    rearZ: { tol: 60, source: 'REF-drawing plan view', confidence: 'estimated', note: DRAWING },
    hatchWidth: { tol: 60, source: 'REF-drawing plan view', confidence: 'estimated', note: DRAWING },
    hatchLength: { tol: 60, source: 'REF-drawing plan view', confidence: 'estimated', note: DRAWING },
    grilleWidth: { tol: 60, source: 'REF-drawing plan view', confidence: 'estimated', note: DRAWING },
    grilleLength: { tol: 60, source: 'REF-drawing plan view', confidence: 'estimated', note: DRAWING },
    grilleCentreX: { tol: 60, source: 'REF-drawing plan view', confidence: 'estimated', note: DRAWING },
  },
  exhaust: {
    centreX: { tol: 50, source: 'REF-drawing rear view', confidence: 'estimated', note: DRAWING },
    diameter: { tol: 20, source: 'REF-drawing rear view', confidence: 'estimated', note: DRAWING },
    height: { tol: 50, source: 'REF-drawing rear view', confidence: 'estimated', note: DRAWING },
    guardDiameter: { tol: 30, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING },
    guardHeight: { tol: 30, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING },
  },
  trackGuard: {
    thickness: { tol: 2, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING },
    outerX: { tol: 15, source: 'derived from OVERALL.widthOverCombatTracks', confidence: 'derived' },
    height: { tol: 50, source: 'REF-drawing', confidence: 'estimated', note: DRAWING },
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
