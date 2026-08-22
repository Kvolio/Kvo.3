import { mm, deg } from './units.js';
import type { MetaOf } from './meta.js';

/**
 * Armour plate thicknesses and angles.
 *
 * Angles are measured FROM VERTICAL, which is how German wartime documentation
 * quotes them: 0 deg is a vertical plate, 90 deg is horizontal. The upper
 * glacis at 80 deg is therefore nearly flat, not nearly upright.
 *
 * Only six of these figures are sourced. The remainder are carried at
 * `confidence: 'estimated'` and BLOCK Gauntlet A from passing — see
 * docs/UNCERTAINTY.md. They are here so the hull can be built, not because they
 * are established.
 */
export const ARMOUR = {
  hull: {
    /** Lower front / nose plate. */
    nose: { thickness: mm(100), angle: deg(24) },
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
const ESTIMATE_NOTE =
  'Not sourced. Reconstructed for buildability; blocks Gauntlet A until confirmed.';

export const ARMOUR_META: MetaOf<typeof ARMOUR> = {
  hull: {
    nose: {
      thickness: { tol: 0, source: SOURCED, confidence: 'secondary' },
      angle: { tol: 1, source: SOURCED, confidence: 'secondary' },
    },
    driverPlate: {
      thickness: { tol: 0, source: 'Tank Encyclopedia summary', confidence: 'estimated', note: ESTIMATE_NOTE },
      angle: { tol: 2, source: 'REF-drawing', confidence: 'estimated', note: ESTIMATE_NOTE },
    },
    upperGlacis: {
      thickness: { tol: 0, source: 'Tank Encyclopedia summary', confidence: 'estimated', note: ESTIMATE_NOTE },
      angle: { tol: 2, source: 'REF-drawing', confidence: 'estimated', note: ESTIMATE_NOTE },
    },
    sideUpper: {
      thickness: { tol: 0, source: 'Tank Encyclopedia summary', confidence: 'secondary' },
      angle: { tol: 0, source: 'REF-drawing', confidence: 'secondary' },
    },
    sideLower: {
      thickness: { tol: 0, source: 'Tank Encyclopedia summary', confidence: 'secondary' },
      angle: { tol: 0, source: 'REF-drawing', confidence: 'secondary' },
    },
    rear: {
      thickness: { tol: 0, source: 'Tank Encyclopedia summary', confidence: 'estimated', note: ESTIMATE_NOTE },
      angle: { tol: 2, source: 'REF-drawing', confidence: 'estimated', note: ESTIMATE_NOTE },
    },
    roof: {
      thickness: { tol: 0, source: 'Tank Encyclopedia summary', confidence: 'estimated', note: ESTIMATE_NOTE },
      angle: { tol: 0, source: 'REF-drawing', confidence: 'secondary' },
    },
    floor: {
      thickness: { tol: 0, source: 'Tank Encyclopedia summary', confidence: 'estimated', note: ESTIMATE_NOTE },
      angle: { tol: 0, source: 'REF-drawing', confidence: 'secondary' },
    },
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
      thickness: { tol: 0, source: 'Tank Encyclopedia summary', confidence: 'estimated', note: ESTIMATE_NOTE },
      angle: { tol: 0, source: 'REF-drawing', confidence: 'secondary' },
    },
    rear: {
      thickness: { tol: 0, source: 'Tank Encyclopedia summary', confidence: 'estimated', note: ESTIMATE_NOTE },
      angle: { tol: 0, source: 'REF-drawing', confidence: 'secondary' },
    },
    roof: {
      thickness: { tol: 0, source: 'TIC-changes', confidence: 'secondary' },
      angle: { tol: 0, source: 'REF-drawing', confidence: 'secondary' },
    },
  },
};
