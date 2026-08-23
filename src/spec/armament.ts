import { mm, deg } from './units.js';
import type { MetaOf } from './meta.js';

const BORE_MM = 88;
const CALIBRE_LENGTH = 56;

/**
 * 8.8 cm KwK 36 L/56 and the secondary armament.
 *
 * The Ausf. H carries the TZF 9b BINOCULAR sight, which is why the mantlet has
 * TWO apertures. The monocular TZF 9c and its single aperture only arrive in
 * March 1944. This is one of the most reliable variant discriminators available
 * and `tests/variants/configuration.test.ts` asserts the aperture count.
 */
export const GUN = {
  designation: '8.8 cm KwK 36 L/56',
  bore: mm(BORE_MM),
  /** Derived: L/56 means 56 calibres of barrel length. */
  barrelLength: mm(BORE_MM * CALIBRE_LENGTH),
  /** Outside diameter at the breech end of the tube. */
  breechEndDiameter: mm(180),
  /** Outside diameter at the muzzle, ahead of the brake thread. */
  muzzleDiameter: mm(122),

  muzzleBrake: {
    /** Heavy double-baffle type. Replaced by a lighter braked insert in April 1944. */
    type: 'double-baffle-heavy',
    length: mm(465),
    outerDiameter: mm(255),
    baffles: 2,
    /** Wall at the muzzle, so the bore is a hole you can look down. */
    muzzleWall: mm(18),
    /** Where each baffle slot starts and ends along the brake. */
    baffleStartFraction: 0.25,
    baffleEndFraction: 0.55,
  },

  elevation: {
    /**
     * UNCERTAINTY #3 — TIC-tech gives -6.5/+17; several secondary sources give
     * -8/+15. Also unresolved: whether depression was restricted over the
     * engine deck arc, which would make the limit a function of traverse.
     */
    min: deg(-6.5),
    max: deg(17),
    /** Trunnion axis height above ground, turret at nominal ride height. */
    trunnionY: mm(1980),
    /** Trunnion axis position relative to the turret ring centre. */
    trunnionZ: mm(430),
    /**
     * How much of the barrel's length sits BEHIND the trunnion.
     *
     * The trunnion is not at the breech: the gun is balanced about it, so a
     * fifth of the tube is behind and the recoil gear and breech block are
     * behind that again.
     */
    tubeBehindTrunnion: 0.18,
  },

  recoil: {
    /** Normal recoil stroke. */
    stroke: mm(580),
    /** Buffer trip point — beyond this the crew is warned of a long recoil. */
    warningStroke: mm(620),
  },

  ammunition: {
    /** Total main gun rounds carried. */
    rounds: 92,
    /** Complete round length, Pz.Gr. 39. */
    roundLength: mm(870),
    caseBaseDiameter: mm(146),
    /** Bins per sponson; the middle two of each hold ammunition. */
    binsPerSponson: 4,
    roundsPerAmmoBin: 16,
    /** Additional rounds stowed in the left sponson beside the driver. */
    roundsBesideDriver: 6,
  },

  coaxial: {
    designation: 'MG 34',
    bore: mm(7.92),
    barrelLength: mm(627),
  },

  hullMG: {
    designation: 'MG 34',
    bore: mm(7.92),
    /** Kugelblende ball mount outer diameter. */
    ballMountDiameter: mm(340),
    /** Traverse and elevation available in the ball mount. */
    traverse: deg(15),
    elevation: deg(10),
  },

  /** Rounds carried for both MG 34s. */
  mgRounds: 4800,
} as const;

/**
 * Powered traverse, Boehringer-Sturm L4S hydraulic motor driven off a secondary
 * shaft from the main engine. Times are for a full 360 degrees.
 */
export const TRAVERSE = {
  lowGearSeconds: 60,
  highGearAtIdleSeconds: 19,
  highGearAtMaxRpmSeconds: 10,
  /** Manual traverse via the gunner's handwheel, degrees per turn. */
  handwheelDegreesPerTurn: deg(1.9),
} as const;

const DRAWING_ESTIMATE =
  'Scaled from REF-drawing against the 6316 mm hull length. Not a dimensioned figure.';

export const GUN_META: MetaOf<typeof GUN> = {
  bore: { tol: 0.5, source: '8.8 cm designation', confidence: 'primary' },
  barrelLength: { tol: 10, source: 'derived: bore x 56 calibres', confidence: 'derived' },
  breechEndDiameter: { tol: 15, source: 'REF-drawing', confidence: 'estimated', note: DRAWING_ESTIMATE },
  muzzleDiameter: { tol: 10, source: 'REF-drawing', confidence: 'estimated', note: DRAWING_ESTIMATE },
  muzzleBrake: {
    length: { tol: 30, source: 'REF-photo-1, REF-drawing', confidence: 'estimated', note: DRAWING_ESTIMATE },
    outerDiameter: { tol: 20, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING_ESTIMATE },
    muzzleWall: { tol: 6, source: 'REF-photo-2', confidence: 'estimated', note: DRAWING_ESTIMATE },
    baffleStartFraction: { tol: 0.08, source: 'REF-photo-2', confidence: 'estimated', note: DRAWING_ESTIMATE },
    baffleEndFraction: { tol: 0.08, source: 'REF-photo-2', confidence: 'estimated', note: DRAWING_ESTIMATE },
    baffles: { tol: 0, source: 'REF-photo-1', confidence: 'secondary' },
  },
  elevation: {
    min: { tol: 1.5, source: 'TIC-tech', confidence: 'secondary', uncertainty: 3 },
    max: { tol: 2, source: 'TIC-tech', confidence: 'secondary', uncertainty: 3 },
    trunnionY: { tol: 40, source: 'REF-drawing', confidence: 'estimated', note: DRAWING_ESTIMATE },
    tubeBehindTrunnion: { tol: 0.05, source: 'REF-cutaway: gun balanced about the trunnion', confidence: 'estimated', note: DRAWING_ESTIMATE },
    trunnionZ: { tol: 40, source: 'REF-drawing', confidence: 'estimated', note: DRAWING_ESTIMATE },
  },
  recoil: {
    stroke: { tol: 40, source: 'REF-cutaway', confidence: 'estimated', note: DRAWING_ESTIMATE },
    warningStroke: { tol: 40, source: 'REF-cutaway', confidence: 'estimated', note: DRAWING_ESTIMATE },
  },
  ammunition: {
    rounds: { tol: 0, source: 'TIC-tech', confidence: 'secondary' },
    roundLength: { tol: 20, source: '8.8 cm Pz.Gr. 39 complete round', confidence: 'secondary' },
    caseBaseDiameter: { tol: 3, source: '88x571R case', confidence: 'secondary' },
    binsPerSponson: { tol: 0, source: 'T1I ammunition bins', confidence: 'secondary' },
    roundsPerAmmoBin: { tol: 0, source: 'T1I ammunition bins', confidence: 'secondary' },
    roundsBesideDriver: { tol: 0, source: 'T1I ammunition bins', confidence: 'secondary' },
  },
  coaxial: {
    bore: { tol: 0, source: 'MG 34 designation', confidence: 'primary' },
    barrelLength: { tol: 5, source: 'MG 34 specification', confidence: 'secondary' },
  },
  hullMG: {
    bore: { tol: 0, source: 'MG 34 designation', confidence: 'primary' },
    ballMountDiameter: { tol: 25, source: 'REF-photo-2', confidence: 'estimated', note: DRAWING_ESTIMATE },
    traverse: { tol: 3, source: 'Kugelblende 50 practice', confidence: 'estimated', note: DRAWING_ESTIMATE },
    elevation: { tol: 3, source: 'Kugelblende 50 practice', confidence: 'estimated', note: DRAWING_ESTIMATE },
  },
  mgRounds: { tol: 200, source: 'TIC-tech (4800)', confidence: 'secondary' },
};

export const TRAVERSE_META: MetaOf<typeof TRAVERSE> = {
  lowGearSeconds: { tol: 2, source: 'T1I-turret', confidence: 'secondary' },
  highGearAtIdleSeconds: { tol: 2, source: 'T1I-turret', confidence: 'secondary' },
  highGearAtMaxRpmSeconds: { tol: 1, source: 'T1I-turret', confidence: 'secondary' },
  handwheelDegreesPerTurn: {
    tol: 0.5,
    source: 'reconstructed',
    confidence: 'estimated',
    note:
      'No source consulted gives the manual traverse gear ratio. Chosen so that a ' +
      'full 360 degrees takes roughly 190 turns, which matches contemporary accounts ' +
      'of how laborious hand traverse was on the Tiger. Not documented.',
  },
};
