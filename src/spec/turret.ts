import { mm, deg, port, starboard, type MM } from './units.js';
import type { MetaOf } from './meta.js';
import { ARMOUR } from './armour.js';

/**
 * Turret and commander's cupola.
 *
 * The Ausf. H turret is the ORIGINAL one: drum cupola with five vision slits,
 * one pistol port remaining at the left rear after the right-hand port was
 * replaced by the escape hatch in December 1942, three NbK 39 smoke dischargers
 * per side, 25 mm roof, and the 158-ball turret ring bearing.
 */
export const TURRET = {
  ring: {
    /** Outer diameter of the bearing assembly. Constant across all Tiger I turrets. */
    bearingOuterDiameter: mm(2100),
    /** Ball circle diameter on the original (Ausf. H) bearing. */
    ballCircleDiameter: mm(1990),
    /** Original bearing: 158 balls, alternating 40 mm load-bearing and 39 mm spacer. */
    ballCount: 158,
    loadBearingBallDiameter: mm(40),
    spacerBallDiameter: mm(39),
    /**
     * UNCERTAINTY #2 — the clear opening cut in the hull roof is NOT given by
     * any source consulted. 1830 mm is widely repeated without attribution.
     * This figure sets the turret basket diameter, which sets crew station
     * spacing, which sets the whole fighting compartment. It BLOCKS the Stage 2
     * and Stage 6 Gauntlets.
     */
    clearOpeningDiameter: mm(1830),
    /** Height of the ring plane above ground, at nominal ride height. */
    planeY: mm(1780),
    /** Longitudinal offset of the ring centre from the hull midpoint. */
    centreZ: mm(-165),
  },

  shell: {
    /**
     * Overall external length of the turret, front plate to rear plate.
     * Measured off the 1:50 plan view.
     */
    length: mm(2290),
    /**
     * External width across the turret sides.
     *
     * This was 1,860 mm, which is NARROWER THAN THE RING BEARING THE TURRET
     * SITS ON — the bearing's outer diameter is a sourced 2,100 mm. A turret
     * cannot be narrower than its own race. Measured off the plan view at
     * about 2,170 mm, which puts the side walls a plausible few centimetres
     * outboard of the bearing. `tests/spec/turretFit.test.ts` now asserts the
     * relationship so it cannot come back.
     */
    width: mm(2170),
    /** Height from the ring plane to the underside of the roof plate. */
    interiorHeight: mm(830),
    /**
     * How far the turret reaches forward of the ring centre.
     *
     * The rest of its length is behind, which is why a Tiger's turret overhangs
     * the engine deck: the bustle is longer than the nose.
     */
    frontOverhang: mm(1000),
  },

  /**
   * Drum cupola. Replaced in July 1943 by the shorter cast type with seven
   * periscopes, so its presence is an Ausf. H marker.
   */
  cupola: {
    type: 'drum',
    outerDiameter: mm(700),
    /** Height of the drum above the turret roof plate. */
    height: mm(280),
    wallThickness: mm(80),
    visionSlits: 5,
    slitWidth: mm(90),
    slitHeight: mm(22),
    /** Hatch opens on a single hinge and swings clear. */
    hatchDiameter: mm(480),
    hatchThickness: mm(60),
    hatchOpenAngle: deg(105),
    /** Cupola centre offset from the turret ring centre. Sits left and rear. */
    centreX: port(mm(500)),
    centreZ: mm(-820),
  },

  /**
   * The cast mantlet and the opening it covers.
   *
   * The Ausf. H carries the TZF 9b BINOCULAR sight, so there are TWO sight
   * apertures through the mantlet rather than the single one of the monocular
   * TZF 9c that replaces it in March 1944. That pair is one of the clearest
   * date markers on the whole vehicle, and it is why they are counted here.
   */
  mantlet: {
    width: mm(1300),
    height: mm(550),
    /** How far the casting stands proud of the front plate. */
    proud: mm(200),
    /** The opening cut in the front plate, behind the casting. */
    apertureWidth: mm(1000),
    apertureHeight: mm(480),
    sightApertures: 2,
    sightApertureDiameter: mm(60),
    /** Between the two sight apertures, centre to centre. */
    sightApertureSpacing: mm(140),
    /** Sight cluster offset from the bore, to the gunner's side. */
    sightOffsetX: mm(330),
    /** Clearance between the mantlet's bore and the tube through it. */
    boreClearance: mm(25),
    /** Edge band on the casting, for the chipping shader. */
    edgeBand: mm(45),
  },

  loaderHatch: {
    /** Long-hinge type. Changed to a short hinged version in March 1944. */
    type: 'long-hinge',
    diameter: mm(560),
    thickness: mm(25),
    openAngle: deg(100),
    centreX: starboard(mm(520)),
    centreZ: mm(-560),
  },

  /** Ausstiegluke, right side of the turret rear. Added December 1942. */
  escapeHatch: {
    width: mm(500),
    height: mm(500),
    thickness: mm(80),
    openAngle: deg(95),
    /** Centre height above the turret ring plane. */
    centreY: mm(420),
  },

  /** One remaining pistol port, at the left rear. Its right-hand twin became the escape hatch. */
  pistolPort: {
    diameter: mm(90),
    plugDiameter: mm(150),
    centreY: mm(430),
  },

  /** NbK 39 90 mm smoke candle dischargers, three per side. Deleted June 1943. */
  smokeDischargers: {
    perSide: 3,
    tubeDiameter: mm(90),
    tubeLength: mm(180),
    /** Angle above horizontal that the cluster points. */
    elevation: deg(45),
    spacing: mm(105),
    /** Wall of a tube, so the mouth is open rather than a bollard. */
    wallThickness: mm(8),
    /** Cluster centre, relative to the turret ring centre. */
    clusterZ: mm(420),
    /** How far the bracket holds the cluster off the turret side. */
    standoff: mm(60),
  },

  /** Turret rear stowage bin, the so-called Rommelkiste. Added January 1943. */
  stowageBin: {
    width: mm(1500),
    height: mm(430),
    depth: mm(300),
    /** How far the bin's top sits below the turret roof line. */
    dropBelowRoof: mm(120),
    /** Edge band on the sheet, for the chipping shader. */
    edgeBand: mm(30),
  },

  /** Spare track links racked on the turret sides, visible in REF-photo-3. */
  spareTrackLinks: {
    perSide: 3,
    /** Rack centre, relative to the turret ring centre. */
    centreZ: mm(-250),
  },
} as const;

/**
 * Width of the front plate: it spans BETWEEN the side plates' inner faces, so
 * it follows from the shell and the side armour rather than being a third
 * number to keep in step with them. Carried separately it was 1,700 mm against
 * a 2,010 mm gap, and rendered as a panel floating in a hole.
 */
export const TURRET_FRONT_PLATE_WIDTH: MM = mm(
  TURRET.shell.width - ARMOUR.turret.side.thickness * 2,
);

/** How far the turret reaches AFT of the ring centre. The bustle. */
export const TURRET_REAR_OVERHANG: MM = mm(
  TURRET.shell.length - TURRET.shell.frontOverhang,
);

/** Radius of the horseshoe's rear curve: the turret's rear IS a semicircle. */
export const TURRET_REAR_RADIUS: MM = mm(TURRET.shell.width / 2);

/** Where that semicircle's centre sits, in turret-local Z. */
export const TURRET_REAR_ARC_Z: MM = mm(-(TURRET_REAR_OVERHANG - TURRET_REAR_RADIUS));

const MEASURED_FRONT =
  'REF-drawing front elevation, measured: the mantlet reads as a raised central ' +
  'casting on the turret front, scaled on the width over tracks. Good to about ' +
  '150 mm, hence the tolerances.';

const MEASURED_PLAN =
  'REF-drawing plan view, measured: the turret outline scanned column by column ' +
  'and scaled on the superstructure width, which the plan draws as a pair of ' +
  'straight lines. Good to about 150 mm at this resolution, which is why the ' +
  'tolerances are wide and why the ring-bearing constraint is asserted separately.';

const DRAWING_ESTIMATE =
  'Scaled from REF-drawing against the 6316 mm hull length. Not a dimensioned figure.';
const PHOTO_ESTIMATE = 'Proportioned from REF-photo-1 and REF-photo-3 against known dimensions.';

export const TURRET_META: MetaOf<typeof TURRET> = {
  ring: {
    bearingOuterDiameter: { tol: 5, source: 'T1I-ring', confidence: 'secondary' },
    ballCircleDiameter: { tol: 5, source: 'T1I-ring', confidence: 'secondary' },
    ballCount: { tol: 0, source: 'T1I-ring (original design)', confidence: 'secondary' },
    loadBearingBallDiameter: { tol: 0.5, source: 'T1I-ring', confidence: 'secondary' },
    spacerBallDiameter: { tol: 0.5, source: 'T1I-ring', confidence: 'secondary' },
    clearOpeningDiameter: {
      tol: 30,
      source: 'widely repeated in secondary literature without attribution',
      confidence: 'estimated',
      uncertainty: 2,
      note: 'Blocks Stage 2 and Stage 6 Gauntlets. Drives the entire interior layout.',
    },
    planeY: { tol: 15, source: 'derived from OVERALL.heightToHullRoof', confidence: 'derived' },
    centreZ: { tol: 40, source: 'REF-drawing', confidence: 'estimated', note: DRAWING_ESTIMATE },
  },
  shell: {
    length: { tol: 150, source: MEASURED_PLAN, confidence: 'estimated', note: DRAWING_ESTIMATE },
    width: { tol: 150, source: MEASURED_PLAN, confidence: 'estimated', note: DRAWING_ESTIMATE },
    frontOverhang: { tol: 120, source: MEASURED_PLAN, confidence: 'estimated', note: DRAWING_ESTIMATE },
    interiorHeight: {
      tol: 30,
      source: 'derived from heightToCupola less cupola height and roof thickness',
      confidence: 'estimated',
      note: DRAWING_ESTIMATE,
    },
  },
  cupola: {
    outerDiameter: { tol: 25, source: 'REF-photo-1', confidence: 'estimated', note: PHOTO_ESTIMATE },
    height: { tol: 25, source: 'REF-photo-1', confidence: 'estimated', note: PHOTO_ESTIMATE },
    wallThickness: { tol: 10, source: 'Tank Encyclopedia summary', confidence: 'estimated', note: PHOTO_ESTIMATE },
    visionSlits: { tol: 0, source: 'T1I drum cupola', confidence: 'secondary' },
    slitWidth: { tol: 10, source: 'REF-photo-1', confidence: 'estimated', note: PHOTO_ESTIMATE },
    slitHeight: { tol: 5, source: 'REF-photo-1', confidence: 'estimated', note: PHOTO_ESTIMATE },
    hatchDiameter: { tol: 25, source: 'REF-photo-1', confidence: 'estimated', note: PHOTO_ESTIMATE },
    hatchThickness: { tol: 10, source: 'REF-photo-1', confidence: 'estimated', note: PHOTO_ESTIMATE },
    hatchOpenAngle: { tol: 10, source: 'REF-photo-1', confidence: 'estimated', note: PHOTO_ESTIMATE },
    centreX: { tol: 30, source: 'REF-drawing plan view', confidence: 'estimated', note: DRAWING_ESTIMATE },
    centreZ: { tol: 30, source: 'REF-drawing plan view', confidence: 'estimated', note: DRAWING_ESTIMATE },
  },
  mantlet: {
    width: { tol: 150, source: MEASURED_FRONT, confidence: 'estimated', note: DRAWING_ESTIMATE },
    height: { tol: 120, source: MEASURED_FRONT, confidence: 'estimated', note: DRAWING_ESTIMATE },
    proud: { tol: 80, source: MEASURED_FRONT, confidence: 'estimated', note: DRAWING_ESTIMATE },
    apertureWidth: { tol: 120, source: MEASURED_FRONT, confidence: 'estimated', note: DRAWING_ESTIMATE },
    apertureHeight: { tol: 100, source: MEASURED_FRONT, confidence: 'estimated', note: DRAWING_ESTIMATE },
    sightApertures: { tol: 0, source: 'TIC-changes: TZF 9b is binocular until Mar 1944', confidence: 'secondary' },
    sightApertureDiameter: { tol: 15, source: 'REF-photo-2', confidence: 'estimated', note: DRAWING_ESTIMATE },
    sightApertureSpacing: { tol: 30, source: 'REF-photo-2', confidence: 'estimated', note: DRAWING_ESTIMATE },
    boreClearance: { tol: 10, source: 'fitting clearance', confidence: 'estimated', note: DRAWING_ESTIMATE },
    edgeBand: { tol: 15, source: 'shader band, not a measured dimension', confidence: 'estimated', note: DRAWING_ESTIMATE },
    sightOffsetX: { tol: 80, source: 'REF-photo-2', confidence: 'estimated', note: DRAWING_ESTIMATE },
  },
  loaderHatch: {
    diameter: { tol: 25, source: 'REF-drawing plan view', confidence: 'estimated', note: DRAWING_ESTIMATE },
    thickness: { tol: 5, source: 'matches turret roof thickness', confidence: 'estimated', note: DRAWING_ESTIMATE },
    openAngle: { tol: 10, source: 'REF-drawing', confidence: 'estimated', note: DRAWING_ESTIMATE },
    centreX: { tol: 30, source: 'REF-drawing plan view', confidence: 'estimated', note: DRAWING_ESTIMATE },
    centreZ: { tol: 30, source: 'REF-drawing plan view', confidence: 'estimated', note: DRAWING_ESTIMATE },
  },
  escapeHatch: {
    width: { tol: 30, source: 'REF-drawing', confidence: 'estimated', note: DRAWING_ESTIMATE },
    height: { tol: 30, source: 'REF-drawing', confidence: 'estimated', note: DRAWING_ESTIMATE },
    thickness: { tol: 5, source: 'matches turret side thickness', confidence: 'estimated', note: DRAWING_ESTIMATE },
    openAngle: { tol: 10, source: 'REF-drawing', confidence: 'estimated', note: DRAWING_ESTIMATE },
    centreY: { tol: 30, source: 'REF-drawing', confidence: 'estimated', note: DRAWING_ESTIMATE },
  },
  pistolPort: {
    diameter: { tol: 10, source: 'REF-drawing', confidence: 'estimated', note: DRAWING_ESTIMATE },
    plugDiameter: { tol: 15, source: 'REF-drawing', confidence: 'estimated', note: DRAWING_ESTIMATE },
    centreY: { tol: 30, source: 'REF-drawing', confidence: 'estimated', note: DRAWING_ESTIMATE },
  },
  smokeDischargers: {
    perSide: { tol: 0, source: 'TIC-changes, REF-photo-1', confidence: 'secondary' },
    tubeDiameter: { tol: 5, source: 'NbK 39 90 mm designation', confidence: 'secondary' },
    tubeLength: { tol: 20, source: 'REF-photo-1', confidence: 'estimated', note: PHOTO_ESTIMATE },
    elevation: { tol: 10, source: 'REF-photo-1', confidence: 'estimated', note: PHOTO_ESTIMATE },
    wallThickness: { tol: 3, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING_ESTIMATE },
    standoff: { tol: 30, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING_ESTIMATE },
    clusterZ: { tol: 120, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING_ESTIMATE },
    spacing: { tol: 15, source: 'REF-photo-1', confidence: 'estimated', note: PHOTO_ESTIMATE },
  },
  stowageBin: {
    edgeBand: { tol: 12, source: 'shader band, not a measured dimension', confidence: 'estimated', note: DRAWING_ESTIMATE },
    dropBelowRoof: { tol: 50, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING_ESTIMATE },
    width: { tol: 50, source: 'REF-photo-1', confidence: 'estimated', note: PHOTO_ESTIMATE },
    height: { tol: 30, source: 'REF-photo-1', confidence: 'estimated', note: PHOTO_ESTIMATE },
    depth: { tol: 30, source: 'REF-photo-1', confidence: 'estimated', note: PHOTO_ESTIMATE },
  },
  spareTrackLinks: {
    centreZ: { tol: 150, source: 'REF-photo-3: links racked on the turret side', confidence: 'estimated', note: DRAWING_ESTIMATE },
    perSide: { tol: 0, source: 'REF-photo-3', confidence: 'secondary' },
  },
};
