import { mm, kg, type MM, type KG } from './units.js';
import type { MetaOf } from './meta.js';

/**
 * Vehicle envelope. These are the figures the whole reconstruction is measured
 * against — `tests/geometry/bbox.test.ts` builds the model and asserts its
 * actual bounding box against them, so an error here surfaces as a test failure
 * rather than as a tank that looks subtly wrong.
 */
export const OVERALL = {
  /** Hull length excluding the gun. */
  length: mm(6316),
  /** Overall length with the gun at zero traverse and zero elevation. */
  lengthGunForward: mm(8450),
  /** Width over the Kgs 63/725/130 combat tracks. */
  widthOverCombatTracks: mm(3720),
  /** Width over the narrow transport tracks. */
  widthOverTransportTracks: mm(3140),
  /** Ground to the top of the hull roof plate. */
  heightToHullRoof: mm(1780),
  /** Ground to the top of the commander's cupola. */
  heightToCupola: mm(3000),
  /** Ground to the underside of the hull floor plate. */
  groundClearance: mm(470),
  /** Length of track in contact with the ground at nominal ride height. */
  trackContactLength: mm(3605),
  combatWeight: kg(57250),
} as const;

export const OVERALL_META: MetaOf<typeof OVERALL> = {
  length: { tol: 5, source: 'TIC-tech', confidence: 'secondary' },
  lengthGunForward: { tol: 20, source: 'TIC-tech', confidence: 'secondary' },
  widthOverCombatTracks: {
    tol: 15,
    source: 'TIC-tech',
    confidence: 'secondary',
    uncertainty: 5,
    note: 'Sources give 3720 / 3705 / 3547 mm. Spread of 173 mm is visible in the frontal silhouette.',
  },
  widthOverTransportTracks: { tol: 20, source: 'TIC-tech', confidence: 'secondary' },
  heightToHullRoof: { tol: 10, source: 'TIC-tech', confidence: 'secondary' },
  heightToCupola: {
    tol: 20,
    source: 'TIC-tech',
    confidence: 'secondary',
    note: 'Drum cupola (Ausf. H). The July 1943 cast cupola is lower.',
  },
  groundClearance: { tol: 10, source: 'TIC-tech', confidence: 'secondary' },
  trackContactLength: { tol: 15, source: 'TIC-tech', confidence: 'secondary' },
  combatWeight: { tol: 500, source: 'TIC-tech', confidence: 'secondary' },
};

/** Static mass carried by each of the sixteen torsion-bar stations, in kg. */
export const MASS_PER_STATION: KG = kg(OVERALL.combatWeight / 16);

/** Height of the hull floor plate's outer face above ground, at nominal ride height. */
export const HULL_FLOOR_Y: MM = OVERALL.groundClearance;
