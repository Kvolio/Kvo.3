import { mm, deg } from './units.js';
import type { MetaOf } from './meta.js';

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
    /** Overall external length of the turret, front plate to rear plate. */
    length: mm(2680),
    /** External width across the turret sides. */
    width: mm(1860),
    /** Height from the ring plane to the underside of the roof plate. */
    interiorHeight: mm(830),
    /** Radius of the horseshoe curve at the turret rear. */
    rearRadius: mm(930),
    /** Front plate width, between the side plate inner faces. */
    frontPlateWidth: mm(1700),
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
    centreX: mm(-500),
    centreZ: mm(-820),
  },

  loaderHatch: {
    /** Long-hinge type. Changed to a short hinged version in March 1944. */
    type: 'long-hinge',
    diameter: mm(560),
    thickness: mm(25),
    openAngle: deg(100),
    centreX: mm(520),
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
  },

  /** Turret rear stowage bin, the so-called Rommelkiste. Added January 1943. */
  stowageBin: {
    width: mm(1500),
    height: mm(430),
    depth: mm(300),
  },

  /** Spare track links racked on the turret sides, visible in REF-photo-3. */
  spareTrackLinks: {
    perSide: 3,
  },
} as const;

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
    length: { tol: 40, source: 'REF-drawing', confidence: 'estimated', note: DRAWING_ESTIMATE },
    width: { tol: 30, source: 'REF-drawing', confidence: 'estimated', note: DRAWING_ESTIMATE },
    interiorHeight: {
      tol: 30,
      source: 'derived from heightToCupola less cupola height and roof thickness',
      confidence: 'estimated',
      note: DRAWING_ESTIMATE,
    },
    rearRadius: { tol: 40, source: 'REF-drawing plan view', confidence: 'estimated', note: DRAWING_ESTIMATE },
    frontPlateWidth: { tol: 30, source: 'REF-drawing front view', confidence: 'estimated', note: DRAWING_ESTIMATE },
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
    spacing: { tol: 15, source: 'REF-photo-1', confidence: 'estimated', note: PHOTO_ESTIMATE },
  },
  stowageBin: {
    width: { tol: 50, source: 'REF-photo-1', confidence: 'estimated', note: PHOTO_ESTIMATE },
    height: { tol: 30, source: 'REF-photo-1', confidence: 'estimated', note: PHOTO_ESTIMATE },
    depth: { tol: 30, source: 'REF-photo-1', confidence: 'estimated', note: PHOTO_ESTIMATE },
  },
  spareTrackLinks: {
    perSide: { tol: 0, source: 'REF-photo-3', confidence: 'secondary' },
  },
};
