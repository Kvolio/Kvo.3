import { mm, deg } from './units.js';
import type { MetaOf } from './meta.js';

/**
 * Armour plate thicknesses and angles.
 *
 * Angles are measured FROM VERTICAL, which is how German wartime documentation
 * quotes them: 0 deg is a vertical plate, 90 deg is horizontal. The upper
 * glacis at 80 deg is therefore nearly flat, not nearly upright.
 *
 * All hull figures now trace to the Jentz & Doyle armour summary, which agrees
 * with the SHAEF armour-arrangement diagram of October 1944 on the plates both
 * describe. The turret side and rear thicknesses remain reconstructed and still
 * block Gauntlet B — see docs/UNCERTAINTY.md.
 */
export const ARMOUR = {
  hull: {
    /** Lower front / nose plate. */
    nose: { thickness: mm(100), angle: deg(25) },
    /** Driver's front plate, carrying the visor and the hull MG ball mount. */
    driverPlate: { thickness: mm(100), angle: deg(9) },
    /** Upper glacis, sloping back over the driver's compartment. */
    upperGlacis: { thickness: mm(60), angle: deg(80) },
    /** Superstructure side, above the track run — the sponson outer wall. */
    sideUpper: { thickness: mm(80), angle: deg(0) },
    /** Lower hull side, behind the running gear. */
    sideLower: { thickness: mm(60), angle: deg(0) },
    rear: { thickness: mm(80), angle: deg(9) },
    roof: { thickness: mm(25), angle: deg(90) },
    floor: { thickness: mm(25), angle: deg(90) },
    /**
     * The lower side walls run 5 mm past the belly plate, so the floor sits in
     * a shallow tray rather than flush. Small, but it is the difference between
     * a hull that reads as fabricated and one that reads as extruded.
     */
    sideWallProudOfBelly: mm(5),
  },
  turret: {
    front: { thickness: mm(100), angle: deg(8) },
    /** Cast mantlet. See UNCERTAINTY #4 — the quoted figure may be a single section of a varying one. */
    mantlet: { thickness: mm(120), angle: deg(0) },
    side: { thickness: mm(80), angle: deg(0) },
    rear: { thickness: mm(80), angle: deg(0) },
    /** 25 mm on the Ausf. H. Raised to 40 mm only in March 1944. */
    roof: { thickness: mm(25), angle: deg(90) },
  },
} as const;

const SOURCED = 'TIC-tech';
const JENTZ = 'Jentz & Doyle, via Tank Encyclopedia armour summary';

export const ARMOUR_META: MetaOf<typeof ARMOUR> = {
  hull: {
    nose: {
      thickness: { tol: 0, source: JENTZ, confidence: 'secondary' },
      // Jentz gives 25 deg; the Tiger I Information Center gives 24. Within tolerance.
      angle: { tol: 1.5, source: JENTZ, confidence: 'secondary' },
    },
    driverPlate: {
      thickness: { tol: 0, source: JENTZ, confidence: 'secondary' },
      angle: {
        tol: 2,
        source: 'REF-drawing',
        confidence: 'estimated',
        note:
          'The driver plate angle is not quoted separately by the sources consulted; ' +
          'scaled from the drawing. Small, but it sets where the visor and MG mount sit.',
      },
    },
    upperGlacis: {
      thickness: { tol: 0, source: JENTZ, confidence: 'secondary' },
      angle: { tol: 2, source: JENTZ, confidence: 'secondary' },
    },
    sideUpper: {
      thickness: { tol: 0, source: JENTZ, confidence: 'secondary' },
      angle: { tol: 0, source: JENTZ, confidence: 'secondary' },
    },
    sideLower: {
      thickness: { tol: 0, source: JENTZ, confidence: 'secondary' },
      angle: { tol: 0, source: JENTZ, confidence: 'secondary' },
    },
    rear: {
      thickness: { tol: 0, source: JENTZ, confidence: 'secondary' },
      angle: { tol: 1, source: JENTZ, confidence: 'secondary' },
    },
    roof: {
      thickness: { tol: 0, source: `${JENTZ}; SHAEF armour arrangement diagram, Oct 1944`, confidence: 'secondary' },
      angle: { tol: 0, source: 'REF-drawing', confidence: 'secondary' },
    },
    floor: {
      thickness: { tol: 0, source: `${JENTZ}; SHAEF armour arrangement diagram, Oct 1944`, confidence: 'secondary' },
      angle: { tol: 0, source: 'REF-drawing', confidence: 'secondary' },
    },
    sideWallProudOfBelly: { tol: 1, source: 'T1I hull dimensions', confidence: 'secondary' },
  },
  turret: {
    front: {
      thickness: { tol: 0, source: SOURCED, confidence: 'secondary' },
      angle: { tol: 1, source: SOURCED, confidence: 'secondary' },
    },
    mantlet: {
      thickness: { tol: 0, source: SOURCED, confidence: 'secondary', uncertainty: 4 },
      angle: { tol: 1, source: SOURCED, confidence: 'secondary' },
    },
    side: {
      thickness: { tol: 0, source: `${JENTZ}; Wikipedia specification box concurs`, confidence: 'secondary' },
      angle: { tol: 0, source: 'REF-drawing', confidence: 'secondary' },
    },
    rear: {
      thickness: { tol: 0, source: `${JENTZ}; Wikipedia specification box concurs`, confidence: 'secondary' },
      angle: { tol: 0, source: 'REF-drawing', confidence: 'secondary' },
    },
    roof: {
      thickness: { tol: 0, source: 'TIC-changes', confidence: 'secondary' },
      angle: { tol: 0, source: 'REF-drawing', confidence: 'secondary' },
    },
  },
};
