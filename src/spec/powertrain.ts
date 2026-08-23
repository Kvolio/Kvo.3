import { mm, deg } from './units.js';
import type { MetaOf } from './meta.js';

/**
 * Engine, transmission, steering and final drives.
 *
 * The Ausf. H engine is the Maybach HL 210 P45 with the ALUMINIUM block. The
 * cast-iron HL 230 P45 only appears from Fgst. 250251 in May 1943, so fitting
 * one here would silently make the vehicle a later Ausf. E.
 */
export const ENGINE = {
  designation: 'Maybach HL 210 P45',
  /** Litres. */
  displacement: 21.33,
  cylinders: 12,
  /** V angle between the cylinder banks. */
  bankAngle: deg(60),
  blockMaterial: 'aluminium',
  /** Metric horsepower at 3000 rpm. */
  powerPS: 650,
  ratedRpm: 3000,
  /** Governed rpm in service. */
  governedRpm: 2600,

  /** Envelope without air cleaners, from the sourced imperial figures. */
  length: mm(1220),
  width: mm(970),
  height: mm(940),

  carburettors: {
    count: 4,
    designation: 'Solex Duplex 52 JFF 2-2U 2046',
    type: 'twin-choke downdraught',
  },
  /** Dry sump, litres. */
  oilCapacity: 28,
  fuelPumps: 4,
} as const;

export const COOLING = {
  /** Two transverse film-type radiators at the rear. */
  radiators: 2,
  radiatorWidth: mm(880),
  radiatorHeight: mm(620),
  radiatorThickness: mm(140),
  /** Twin fan assemblies each side, on a two-speed drive. */
  fanAssembliesPerSide: 2,
  fanDiameter: mm(520),
} as const;

export const FUEL = {
  tanks: 4,
  /** Litres, all four tanks. */
  totalCapacity: 569,
} as const;

export const TRANSMISSION = {
  designation: 'Maybach Olvar OG 40 12 16',
  type: 'hydraulically controlled semi-automatic pre-selector',
  forwardGears: 8,
  reverseGears: 4,
  /** Overall ratio in first. */
  ratioFirst: 15.4,
  /** Overall ratio in eighth. */
  ratioTop: 0.98,
  /** The gearbox sits to the RIGHT of the driver, not on the centreline. */
  centreX: mm(430),
  centreZ: mm(2050),
  length: mm(1150),
  width: mm(760),
  height: mm(780),
} as const;

export const STEERING = {
  /**
   * UNCERTAINTY #7 — TIC-trans names it the "Argus Lenkapparat L, ST, 0, 2,
   * designed by Henschel based on the British Merritt-Brown type"; other
   * sources call it the Henschel L 801. The mechanism is agreed; only the
   * designation is in doubt, so this must not be labelled confidently in the
   * interior annotations.
   */
  designation: 'regenerative dual-radius, Merritt-Brown derived',
  /** Mounted transversely in the bow, ahead of the driver and radio operator. */
  centreZ: mm(2620),
  /** Distinct turn radii available in each gear. */
  radiiPerGear: 2,
  /** Neutral turn diameter — the Tiger pivots within its own length. */
  neutralTurnDiameter: mm(3440),
  /** Argus disc brakes on each drive shaft; also the service brakes. */
  brakeDiscDiameter: mm(550),
  steeringWheelDiameter: mm(400),
} as const;

export const FINAL_DRIVE = {
  /** Two stages: spur reduction then epicyclic. */
  ratio: 10.55,
  /** Litres of oil per housing. */
  oilCapacity: 8,
  housingDiameter: mm(560),
  housingProjection: mm(180),
} as const;

/**
 * Feifel air pre-cleaner system, early round type. Fitted November 1942,
 * redesigned to the oval type in March 1943, deleted October 1943 — so the
 * round canisters are a tight Ausf. H marker.
 */
export const FEIFEL = {
  type: 'round-early',
  canisters: 2,
  canisterDiameter: mm(390),
  canisterHeight: mm(760),
  /** Cyclone tubes per canister. The March 1943 oval type has 14. */
  cycloneTubes: 18,
  mountingBoltsPerCanister: 4,
  trunkDiameter: mm(150),
  /** Lateral offset of each canister from the vehicle centreline, on the rear plate. */
  centreX: mm(1080),
  /** Height of the canister's base above the ground. */
  baseY: mm(940),
  /**
   * The canister's silhouette, as radius against height in millimetres: a
   * rolled rim at the base, a straight body, and a domed cap carrying the
   * clean-air outlet. Scaled off the drawing's rear view rather than
   * dimensioned anywhere, which is why this assembly is declared as
   * reconstruction.
   */
  profileRadius: [0, 140, 195, 195, 183, 107, 0],
  profileHeight: [0, 0, 68, 654, 707, 752, 760],
  /** Bolt circle fixing the canister to the rear plate. */
  boltCircleRadius: mm(146),
  /** How far forward of the canister axis that bolt circle sits. */
  boltPlaneOffset: mm(166),
  /** Height the trunk runs above the engine deck on its way forward. */
  trunkRise: mm(130),
  /**
   * Forward run of the bend that lifts the trunk from the canister's outlet to
   * its resting height on the deck. A shape parameter for that bend, kept
   * separate from `trunkRise` so neither number silently sets the other.
   */
  trunkBendRun: mm(120),
  /** Lateral position where the trunk crosses the deck, inboard of the canister. */
  trunkInboardX: mm(600),
  /** How far short of the engine hatch the trunk terminates. */
  trunkApproach: mm(260),
} as const;

export const PERFORMANCE = {
  /** Governed road speed, km/h. TIC-tech's 45.4 km/h is the ungoverned figure. */
  roadSpeed: 38,
  crossCountrySpeed: 20,
  /** Road range, km. */
  roadRange: 125,
} as const;

const DRAWING_ESTIMATE =
  'Scaled from REF-drawing and REF-cutaway against the 6316 mm hull length. Not a dimensioned figure.';

export const ENGINE_META: MetaOf<typeof ENGINE> = {
  displacement: { tol: 0.05, source: 'TIC-maybach', confidence: 'secondary' },
  cylinders: { tol: 0, source: 'TIC-maybach', confidence: 'secondary' },
  bankAngle: { tol: 0, source: 'Maybach HL series practice', confidence: 'estimated', note: 'Not stated in the consulted sources.' },
  powerPS: { tol: 0, source: 'TIC-maybach', confidence: 'secondary' },
  ratedRpm: { tol: 0, source: 'TIC-maybach', confidence: 'secondary' },
  governedRpm: { tol: 100, source: 'TIC-trans', confidence: 'estimated', note: 'Inferred from the 38 km/h governed road speed.' },
  length: { tol: 30, source: 'TIC-maybach (4 ft)', confidence: 'secondary' },
  width: { tol: 30, source: 'TIC-maybach (3 ft 2 in)', confidence: 'secondary' },
  height: { tol: 30, source: 'TIC-maybach (3 ft 1 in)', confidence: 'secondary' },
  carburettors: { count: { tol: 0, source: 'TIC-maybach', confidence: 'secondary' } },
  oilCapacity: { tol: 1, source: 'TIC-maybach', confidence: 'secondary' },
  fuelPumps: { tol: 0, source: 'TIC-maybach', confidence: 'secondary' },
};

export const COOLING_META: MetaOf<typeof COOLING> = {
  radiators: { tol: 0, source: 'TIC-maybach', confidence: 'secondary' },
  radiatorWidth: { tol: 50, source: 'REF-cutaway', confidence: 'estimated', note: DRAWING_ESTIMATE },
  radiatorHeight: { tol: 40, source: 'REF-cutaway', confidence: 'estimated', note: DRAWING_ESTIMATE },
  radiatorThickness: { tol: 20, source: 'REF-cutaway', confidence: 'estimated', note: DRAWING_ESTIMATE },
  fanAssembliesPerSide: { tol: 0, source: 'TIC-maybach', confidence: 'secondary' },
  fanDiameter: { tol: 40, source: 'REF-cutaway', confidence: 'estimated', note: DRAWING_ESTIMATE },
};

export const FUEL_META: MetaOf<typeof FUEL> = {
  tanks: { tol: 0, source: 'TIC-maybach', confidence: 'secondary' },
  totalCapacity: { tol: 5, source: 'TIC-tech', confidence: 'secondary' },
};

export const TRANSMISSION_META: MetaOf<typeof TRANSMISSION> = {
  forwardGears: { tol: 0, source: 'TIC-trans', confidence: 'secondary' },
  reverseGears: { tol: 0, source: 'TIC-trans', confidence: 'secondary' },
  ratioFirst: { tol: 0.1, source: 'TIC-trans', confidence: 'secondary' },
  ratioTop: { tol: 0.02, source: 'TIC-trans', confidence: 'secondary' },
  centreX: { tol: 60, source: 'TIC-trans (right of the driver) + REF-cutaway', confidence: 'estimated', note: DRAWING_ESTIMATE },
  centreZ: { tol: 60, source: 'REF-cutaway', confidence: 'estimated', note: DRAWING_ESTIMATE },
  length: { tol: 60, source: 'REF-cutaway', confidence: 'estimated', note: DRAWING_ESTIMATE },
  width: { tol: 50, source: 'REF-cutaway', confidence: 'estimated', note: DRAWING_ESTIMATE },
  height: { tol: 50, source: 'REF-cutaway', confidence: 'estimated', note: DRAWING_ESTIMATE },
};

export const STEERING_META: MetaOf<typeof STEERING> = {
  centreZ: { tol: 60, source: 'TIC-trans (transverse in the bow) + REF-cutaway', confidence: 'estimated', note: DRAWING_ESTIMATE },
  radiiPerGear: { tol: 0, source: 'TIC-trans', confidence: 'secondary' },
  neutralTurnDiameter: { tol: 20, source: 'TIC-trans', confidence: 'secondary' },
  brakeDiscDiameter: { tol: 10, source: 'TIC-trans (55 cm Argus)', confidence: 'secondary' },
  steeringWheelDiameter: { tol: 40, source: 'REF-cutaway', confidence: 'estimated', note: DRAWING_ESTIMATE },
};

export const FINAL_DRIVE_META: MetaOf<typeof FINAL_DRIVE> = {
  ratio: { tol: 0.05, source: 'TIC-trans', confidence: 'secondary' },
  oilCapacity: { tol: 0.5, source: 'TIC-trans', confidence: 'secondary' },
  housingDiameter: { tol: 40, source: 'REF-photo-2', confidence: 'estimated', note: DRAWING_ESTIMATE },
  housingProjection: { tol: 25, source: 'REF-photo-2', confidence: 'estimated', note: DRAWING_ESTIMATE },
};

export const FEIFEL_META: MetaOf<typeof FEIFEL> = {
  canisters: { tol: 0, source: 'T1I-feifel, REF-drawing rear view', confidence: 'secondary' },
  canisterDiameter: { tol: 30, source: 'REF-drawing rear view', confidence: 'estimated', note: DRAWING_ESTIMATE },
  canisterHeight: { tol: 40, source: 'REF-drawing rear view', confidence: 'estimated', note: DRAWING_ESTIMATE },
  cycloneTubes: { tol: 0, source: 'T1I-feifel (early type)', confidence: 'secondary' },
  mountingBoltsPerCanister: { tol: 0, source: 'T1I-feifel', confidence: 'secondary' },
  trunkDiameter: { tol: 20, source: 'T1I-feifel', confidence: 'estimated', note: DRAWING_ESTIMATE },
  centreX: { tol: 40, source: 'REF-drawing rear view', confidence: 'estimated', note: DRAWING_ESTIMATE },
  baseY: { tol: 60, source: 'REF-drawing rear view', confidence: 'estimated', note: DRAWING_ESTIMATE },
  profileRadius: { tol: 25, source: 'REF-drawing rear view', confidence: 'estimated', note: DRAWING_ESTIMATE },
  profileHeight: { tol: 40, source: 'REF-drawing rear view', confidence: 'estimated', note: DRAWING_ESTIMATE },
  boltCircleRadius: { tol: 25, source: 'T1I-feifel (four mounting points)', confidence: 'estimated', note: DRAWING_ESTIMATE },
  boltPlaneOffset: { tol: 25, source: 'T1I-feifel', confidence: 'estimated', note: DRAWING_ESTIMATE },
  trunkBendRun: { tol: 60, source: 'REF-photo rear deck', confidence: 'estimated', note: DRAWING_ESTIMATE },
  trunkRise: { tol: 40, source: 'T1I-feifel', confidence: 'estimated', note: DRAWING_ESTIMATE },
  trunkInboardX: { tol: 60, source: 'T1I-feifel', confidence: 'estimated', note: DRAWING_ESTIMATE },
  trunkApproach: { tol: 60, source: 'T1I-feifel', confidence: 'estimated', note: DRAWING_ESTIMATE },
};

export const PERFORMANCE_META: MetaOf<typeof PERFORMANCE> = {
  roadSpeed: { tol: 2, source: 'TIC-trans', confidence: 'secondary', note: 'TIC-tech gives 45.4 km/h ungoverned.' },
  crossCountrySpeed: { tol: 2, source: 'TIC-trans', confidence: 'secondary' },
  roadRange: { tol: 5, source: 'TIC-tech', confidence: 'secondary' },
};
