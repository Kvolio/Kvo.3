import { mm, deg, type DEG, type MM } from './units.js';
import type { MetaOf } from './meta.js';
import { OVERALL } from './overall.js';

const STATIONS_PER_SIDE = 8;
const WHEELS_PER_STATION = 3;

/** Lateral planes the interleaved wheels occupy. Two stations' worth. */
const WHEEL_PLANE_COUNT = 6;

/** Width of one road wheel across its tyre. */
const ROAD_WHEEL_WIDTH = 75;

/**
 * Clearance left between the outermost wheel rank and the track's edge.
 *
 * Enough for the rim bolt heads, which stand proud of the disc and were poking
 * through the track guards when the rank pitch was set by hand.
 */
const WHEEL_RANK_CLEARANCE = 55;

/** Shear modulus of spring steel, Pa. Used to derive the torsion bar rate. */
export const STEEL_SHEAR_MODULUS = 79.3e9;

// -----------------------------------------------------------------------------
// Track
// -----------------------------------------------------------------------------

/**
 * Kgs 63/725/130. The designation itself carries the width and pitch, which is
 * what resolves the 720 / 725 mm disagreement in the secondary literature
 * (UNCERTAINTY #6, closed).
 */
export const TRACK = {
  designation: 'Kgs 63/725/130',
  width: mm(725),
  pitch: mm(130),
  linksPerSide: 96,
  pinDiameter: mm(28),
  /** Height of the guide horn above the link's inner face. */
  guideHornHeight: mm(95),
  /** Total closed-loop length. Fixed: this is the constraint the sag solve absorbs slack against. */
  totalLength: mm(96 * 130),
  /** Transport track, Kgs 63/520/130. Fitted for rail movement only. */
  transportWidth: mm(520),

  /** Thickness of a link's ground-contact pad. */
  linkThickness: mm(26),
  /**
   * Gap left between consecutive links.
   *
   * Real links articulate on their pins with clearance; laid nose to tail at
   * the full pitch they fight for the same millimetre wherever the track
   * curves, and the sprocket wrap turns into a ring of interpenetrating steel.
   */
  linkGap: mm(14),
  /** Edge band width on a link, for the chipping shader. Links are small. */
  linkEdgeBand: mm(10),
} as const;

// -----------------------------------------------------------------------------
// Wheels, sprocket, idler
// -----------------------------------------------------------------------------

const SPROCKET_TEETH = 20;

export const SPROCKET = {
  teeth: SPROCKET_TEETH,
  /** Twin removable toothed rings, one either side of the guide horn channel. */
  rings: 2,
  spokes: 10,
  outerDiameter: mm(914.4),
  /**
   * Derived: the radius at which a 20-tooth wheel engages a 130 mm pitch chain.
   * Cross-checks against the independently sourced outer radius of 457.2 mm —
   * the 41.65 mm difference is tooth-tip plus guide-horn allowance. Asserted in
   * tests/spec/dimensions.test.ts.
   */
  pitchRadius: mm(130 / (2 * Math.sin(Math.PI / SPROCKET_TEETH))),
  /** Longitudinal position of the sprocket axis. Front-drive. */
  centreZ: mm(2470),
  /**
   * Height of the sprocket axis above ground.
   *
   * MEASURED off the 1:50 side elevation, where the sprocket is drawn as a
   * clear spoked wheel: its centre sits about 190 mm above the road wheel
   * axles, not the 400 mm this carried before. Getting this wrong lifts the
   * whole upper track run clear of the road wheels, and a Tiger's upper run
   * passes within a track's thickness of them.
   */
  centreY: mm(600),
  /** Hub barrel, spanning the guide-horn channel between the two toothed rings. */
  hubDiameter: mm(300),
  /** Inset of a toothed ring from the track's outer edge. */
  ringInset: mm(40),
} as const;

export const IDLER = {
  outerDiameter: mm(686),
  centreZ: mm(-2510),
  /** Measured off the side elevation, like the sprocket's. */
  centreY: mm(470),
  /** Track tension is set by draw bolts acting on the idler crank. */
  tensioningTravel: mm(120),
  hubDiameter: mm(260),
} as const;

export const ROAD_WHEEL = {
  diameter: mm(800),
  /** Width of one wheel across its rubber tyre. */
  width: mm(ROAD_WHEEL_WIDTH),
  /** Solid rubber tyre thickness on the Ausf. H wheel. Steel-rimmed wheels arrive Feb 1944. */
  tyreThickness: mm(65),
  /** How far the steel disc is set in from the tyre's outer face, each side. */
  discInset: mm(6),
  /** Rim bolt count. Changed from 20 to 18 in February 1943 — an Ausf. H discriminator. */
  rimBolts: 18,
  hubDiameter: mm(230),
  /** How far the hub cap stands proud of the disc's outer face. */
  hubProud: mm(45),
} as const;

// -----------------------------------------------------------------------------
// Suspension stations
// -----------------------------------------------------------------------------

export const SUSPENSION = {
  stationsPerSide: STATIONS_PER_SIDE,
  wheelsPerStation: WHEELS_PER_STATION,
  wheelsPerSide: STATIONS_PER_SIDE * WHEELS_PER_STATION,

  /**
   * Longitudinal spacing between adjacent torsion bar axes.
   * Derived: the eight stations span the sourced 3605 mm track contact length,
   * giving 3605 / 7. The resulting 515 mm pitch against 800 mm wheels produces
   * the 285 mm overlap that makes the running gear interleave at all.
   */
  stationPitch: mm(OVERALL.trackContactLength / (STATIONS_PER_SIDE - 1)),

  /** Height of the torsion bar axis above ground at nominal ride height. */
  pivotY: mm(600),

  /** Pivot-to-axle distance of the swing arm. */
  armLength: mm(300),

  torsionBar: {
    length: mm(1644.6),
    /** Sources give a 55-58 mm range; nominal taken at the midpoint. */
    diameter: mm(56.5),
  },

  /** Arm rotation limits from neutral. Positive is compression (wheel rising). */
  travelBump: deg(22),
  travelRebound: deg(14),

  /**
   * Lateral wheel planes, as offsets from the track centreline.
   *
   * Six planes at 78 mm pitch; odd-numbered stations occupy planes 0/2/4 and
   * even-numbered stations planes 1/3/5, which is what allows wheels 800 mm in
   * diameter to sit on axes only 515 mm apart without intersecting.
   *
   * NOT SOURCED — see UNCERTAINTY #9. This arrangement is geometrically valid
   * and reproduces the interleave, but tiger1.info's note that the outermost
   * wheel of each axle was removable (16 per vehicle) implies a different
   * grouping. Held as data so a drawing corrects it without touching code.
   */
  /**
   * Widened so the six planes span the TRACK, not just the middle of it.
   *
   * At 78 mm the planes were packed nose to tail — six 75 mm wheels touching,
   * 468 mm across a 725 mm track, leaving 130 mm of bare track outboard of the
   * outermost rank. That is not how a Tiger looks: its wheels reach very nearly
   * the full width of the track, which is most of why the running gear reads as
   * a solid wall of steel rather than as a row of discs.
   *
   * At 130 mm each axle's three wheels sit 260 mm apart with 185 mm gaps, and
   * the neighbouring axle's three drop into those gaps. Six planes then span
   * 5 x 130 + 75 = 725 mm exactly, which is the track's width.
   *
   * DERIVED from the track's width rather than chosen, so the outermost rank
   * cannot grow past the track it runs on — set by hand at 130 mm it did, and
   * the rim bolts stood proud of the track guards.
   *
   * Still UNCERTAINTY #9 — the rank assignment is geometry, not a source.
   */
  wheelPlanePitch: mm(
    (TRACK.width - ROAD_WHEEL_WIDTH - WHEEL_RANK_CLEARANCE * 2) / (WHEEL_PLANE_COUNT - 1),
  ),
  wheelPlaneCount: WHEEL_PLANE_COUNT,

  /** Standoff of the swing arms' plane from the lower hull side. */
  armStandoff: mm(40),
  /** Width of an arm boss along the axle. */
  armWidth: mm(110),
  /** Radius of the boss around the torsion bar's splined end. */
  bossRadius: mm(95),
} as const;

/** Lateral offsets, relative to the track centreline, for a given station index. */
export function wheelPlanesForStation(stationIndex: number): readonly MM[] {
  const { wheelPlanePitch, wheelPlaneCount } = SUSPENSION;
  const first = -((wheelPlaneCount - 1) / 2) * wheelPlanePitch;
  const parity = stationIndex % 2;
  const planes: MM[] = [];
  for (let p = parity; p < wheelPlaneCount; p += 2) {
    planes.push(mm(first + p * wheelPlanePitch));
  }
  return planes;
}

/** Longitudinal position of a station's torsion bar axis. Station 0 is the foremost. */
export function stationZ(stationIndex: number): MM {
  const span = SUSPENSION.stationPitch * (SUSPENSION.stationsPerSide - 1);
  return mm(span / 2 - stationIndex * SUSPENSION.stationPitch);
}

/**
 * Swing arm direction. The Tiger's arms trail on one side and lead on the other
 * because the transverse torsion bars of the two sides must pass each other
 * inside the hull. Mirroring this away is a classic reconstruction error, so it
 * is encoded rather than assumed.
 */
export function armSign(side: 'left' | 'right'): 1 | -1 {
  return side === 'left' ? 1 : -1;
}

/** Stations carrying a hydraulic shock absorber. Front and rear only. */
export const SHOCK_STATIONS: readonly number[] = [0, STATIONS_PER_SIDE - 1];

/**
 * How far the swing arm hangs below horizontal at nominal ride height.
 *
 * DERIVED, not chosen. The torsion bar axis is 600 mm up, the arm is 300 mm
 * long and the wheel is 800 mm across, so the arm has to droop far enough to
 * put the axle exactly one wheel radius off the ground. Taking the arm as
 * horizontal instead — which is the obvious thing to do and what this did at
 * first — buries the bottom of every wheel 200 mm underground.
 *
 * The wheels rest on the TRACK, not on the ground, so the axle sits one wheel
 * radius plus one link thickness up. Twenty-six millimetres sounds like
 * pedantry until the links are laid on the belt path and the whole track hangs
 * through the ground plane, which is exactly what happened.
 *
 * Positive suspension deflection is compression, which reduces this droop.
 */
export const STATIC_ARM_DROOP: DEG = deg(
  (Math.asin(
    (SUSPENSION.pivotY - ROAD_WHEEL.diameter / 2 - TRACK.linkThickness) / SUSPENSION.armLength,
  ) *
    180) /
    Math.PI,
);

/** Lateral distance from the vehicle centreline to a track's centreline. */
export const TRACK_CENTRE_X: MM = mm((OVERALL.widthOverCombatTracks - TRACK.width) / 2);

/**
 * Torsion bar spring rate, N·m/rad, derived from bar geometry rather than tuned
 * to look right: k = G·J/L with J = pi·d^4/32. Change the bar diameter or length
 * in the spec and the vehicle's ride height changes correctly.
 */
export const TORSION_RATE = (() => {
  const d = SUSPENSION.torsionBar.diameter / 1000;
  const L = SUSPENSION.torsionBar.length / 1000;
  const J = (Math.PI * d ** 4) / 32;
  return (STEEL_SHEAR_MODULUS * J) / L;
})();

// -----------------------------------------------------------------------------
// Provenance
// -----------------------------------------------------------------------------

const MEASURED_SIDE =
  'REF-drawing side elevation, measured: the sprocket and idler are drawn as ' +
  'clear spoked wheels and their centres read directly against the road wheel ' +
  'axles, which are a known 400 mm off the ground and serve as the scale.';

const DRAWING_ESTIMATE =
  'Scaled from REF-drawing against the 6316 mm hull length. Not a dimensioned figure.';

export const TRACK_META: MetaOf<typeof TRACK> = {
  width: { tol: 0, source: 'Kgs 63/725/130 designation', confidence: 'primary', uncertainty: 6 },
  pitch: { tol: 0, source: 'Kgs 63/725/130 designation', confidence: 'primary' },
  linksPerSide: { tol: 0, source: 'TIC-tech, TIC-susp', confidence: 'secondary' },
  pinDiameter: { tol: 1, source: 'TIC-susp', confidence: 'secondary' },
  guideHornHeight: { tol: 10, source: 'REF-drawing', confidence: 'estimated', note: DRAWING_ESTIMATE },
  totalLength: { tol: 0, source: 'derived: 96 links x 130 mm pitch', confidence: 'derived' },
  transportWidth: { tol: 5, source: 'TIC-susp', confidence: 'secondary' },
  linkThickness: { tol: 6, source: 'REF-drawing side view', confidence: 'estimated', note: DRAWING_ESTIMATE },
  linkGap: { tol: 6, source: 'articulation clearance', confidence: 'estimated', note: DRAWING_ESTIMATE },
  linkEdgeBand: { tol: 5, source: 'shader band, not a measured dimension', confidence: 'estimated', note: DRAWING_ESTIMATE },
};

export const SPROCKET_META: MetaOf<typeof SPROCKET> = {
  teeth: { tol: 0, source: 'TIC-susp', confidence: 'secondary' },
  rings: { tol: 0, source: 'TIC-susp', confidence: 'secondary' },
  spokes: { tol: 0, source: 'TIC-susp', confidence: 'secondary' },
  outerDiameter: { tol: 2, source: 'TIC-susp', confidence: 'secondary' },
  ringInset: { tol: 20, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING_ESTIMATE },
  pitchRadius: {
    tol: 0.5,
    source: 'derived: pitch / (2 sin(pi/teeth))',
    confidence: 'derived',
    note: 'Corroborated by the sourced outer radius; difference is tooth-tip plus horn allowance.',
  },
  centreZ: { tol: 40, source: 'REF-drawing', confidence: 'estimated', note: DRAWING_ESTIMATE },
  centreY: { tol: 60, source: MEASURED_SIDE, confidence: 'estimated', note: DRAWING_ESTIMATE },
  hubDiameter: { tol: 30, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING_ESTIMATE },
};

export const IDLER_META: MetaOf<typeof IDLER> = {
  outerDiameter: { tol: 5, source: 'TIC-susp (27 in)', confidence: 'secondary' },
  centreZ: { tol: 40, source: 'REF-drawing', confidence: 'estimated', note: DRAWING_ESTIMATE },
  centreY: { tol: 60, source: MEASURED_SIDE, confidence: 'estimated', note: DRAWING_ESTIMATE },
  tensioningTravel: { tol: 30, source: 'REF-drawing', confidence: 'estimated', note: DRAWING_ESTIMATE },
  hubDiameter: { tol: 30, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING_ESTIMATE },
};

export const ROAD_WHEEL_META: MetaOf<typeof ROAD_WHEEL> = {
  diameter: { tol: 2, source: 'TIC-tech, TM-wheels', confidence: 'secondary' },
  width: { tol: 2, source: 'TIC-tech', confidence: 'secondary' },
  discInset: { tol: 3, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING_ESTIMATE },
  tyreThickness: { tol: 10, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING_ESTIMATE },
  rimBolts: { tol: 0, source: 'TIC-changes (Feb 1943)', confidence: 'secondary' },
  hubDiameter: { tol: 20, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING_ESTIMATE },
  hubProud: { tol: 20, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING_ESTIMATE },
};

export const SUSPENSION_META: MetaOf<typeof SUSPENSION> = {
  stationsPerSide: { tol: 0, source: 'TIC-susp', confidence: 'secondary' },
  wheelsPerStation: {
    tol: 0,
    source: 'TM-wheels, TIC-susp',
    confidence: 'secondary',
    uncertainty: 1,
    note: 'TIC-tech states "4 double and 4 triple" (20/side). Two sources give 3/axle; adopted.',
  },
  wheelsPerSide: { tol: 0, source: 'derived: stations x wheels per station', confidence: 'derived' },
  stationPitch: {
    tol: 15,
    source: 'derived from the sourced 3605 mm track contact length',
    confidence: 'derived',
  },
  pivotY: { tol: 40, source: 'REF-drawing, REF-cutaway', confidence: 'estimated', note: DRAWING_ESTIMATE },
  armLength: { tol: 40, source: 'REF-drawing', confidence: 'estimated', note: DRAWING_ESTIMATE },
  armStandoff: { tol: 20, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING_ESTIMATE },
  armWidth: { tol: 25, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING_ESTIMATE },
  bossRadius: { tol: 20, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING_ESTIMATE },
  torsionBar: {
    length: { tol: 1, source: 'TIC-susp', confidence: 'secondary' },
    diameter: { tol: 1.5, source: 'TIC-susp (55-58 mm range)', confidence: 'secondary' },
  },
  travelBump: { tol: 4, source: 'REF-drawing', confidence: 'estimated', note: DRAWING_ESTIMATE },
  travelRebound: { tol: 4, source: 'REF-drawing', confidence: 'estimated', note: DRAWING_ESTIMATE },
  wheelPlanePitch: {
    tol: 10,
    source: 'reconstructed',
    confidence: 'estimated',
    uncertainty: 9,
    note: 'Geometrically valid interleave; the true per-station row assignment needs a drawing.',
  },
  wheelPlaneCount: {
    tol: 0,
    source: 'reconstructed',
    confidence: 'estimated',
    uncertainty: 9,
    note: 'Six planes is the minimum that lets 800 mm wheels sit on 515 mm centres.',
  },
};
