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
  glacisRun: mm(650),

  /** Longitudinal extent of the sponson floor, which is also the roof of the track run. */
  sponsonFloorY: mm(1120),

  /** Engine bay bulkhead position: the firewall between fighting compartment and engine. */
  firewallZ: mm(-1180),
  /** Sheet, not armour: it separates two spaces, it does not stop anything. */
  firewallThickness: mm(12),

  /**
   * The crew floor: plates over the torsion bars, which is what the crew
   * actually stood on. Taking the belly plate as the floor puts them 200 mm too
   * low and leaves sixteen bars running through their feet.
   */
  crewFloorHeight: mm(200),
  crewFloorThickness: mm(10),
  /** How far back from the nose the driver's own floor pan runs. */
  driverFloorRun: mm(1350),

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
    centreX: port(mm(890)),
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
    centreX: starboard(mm(890)),
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
  /**
   * Driver's visor — the Fahrersehklappe — with its sliding shutter.
   *
   * Not a bare slot in the plate. It is a RAISED ARMOURED HOUSING standing
   * proud of the driver's front plate, with the shutter running in guides
   * either side of it and dropping to close. The front elevation draws it as a
   * distinct rectangular block; built as a plain aperture it reads as a letter
   * box cut in a wall.
   */
  driverVisor: {
    centreX: port(mm(560)),
    centreY: mm(1440),
    width: mm(280),
    height: mm(95),
    shutterThickness: mm(90),
    /** The housing around the slot, and how far it stands off the plate. */
    housingWidth: mm(460),
    housingHeight: mm(300),
    housingProud: mm(70),
    housingCornerRadius: mm(35),
    /** The shutter itself, sitting in its guides above the open slot. */
    shutterWidth: mm(360),
    shutterHeight: mm(150),
    shutterProud: mm(45),
    /** How far above the slot the shutter sits when the visor is open. */
    shutterRaise: mm(130),
  },

  /** Hull machine gun ball mount, starboard side of the front plate. */
  /**
   * Hull machine gun — the Kugelblende ball mount.
   *
   * A SPHERICAL CASTING seated in the plate, not a round hole. The ball turns
   * inside its collar to traverse and elevate the MG 34, and it stands well
   * proud of the armour; both supplied photographs show it as the strongest
   * shadow on the front of the tank.
   */
  hullMGMount: {
    centreX: starboard(mm(560)),
    centreY: mm(1430),
    /** The ball's own diameter, and how far its crown stands off the plate. */
    ballDiameter: mm(340),
    ballProud: mm(120),
    /** The collar the ball seats in, standing proud of the plate around it. */
    collarDiameter: mm(430),
    collarProud: mm(45),
    /** The MG barrel and its protective sleeve, through the ball. */
    barrelDiameter: mm(60),
    barrelLength: mm(320),
    sleeveDiameter: mm(105),
    sleeveLength: mm(150),
    /** Wall of the MG barrel, so its bore is a hole and not a peg. */
    barrelWall: mm(12),
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
     * Where along the glacis they stand. The glacis is only a 650 mm run, so
     * this is most of the way back along it, clear of the nose seam.
     */
    standZ: mm(2780),
    /** The pedestal the lamp sits on, and how far it lifts it off the glacis. */
    pedestalDiameter: mm(80),
    pedestalHeight: mm(110),
    /** Depth of the reflector bowl behind the lens. */
    bowlDepth: mm(70),
    /** Width of the rim around the lens. */
    rimWidth: mm(18),
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
    /**
     * Radiator grilles: FOUR of them, two a side, fore and aft of a small
     * access panel — not one a side, which is what was here.
     *
     * Measured off the 1:50 plan view, which shows each side's pair clearly:
     * a long forward grille and a shorter aft one sharing a lateral band that
     * runs from just outboard of the engine hatch nearly to the sponson edge.
     * Held as a band plus two named stations so the pair cannot drift apart.
     * Named rather than indexed: `MetaOf` maps over every key of a tuple,
     * including its own `length`, so an array of objects with a `length` field
     * cannot carry provenance at all.
     */
    grilleInnerX: mm(632),
    grilleOuterX: mm(1555),
    grilleStations: {
      forward: { centreZ: mm(-1657), run: mm(812) },
      aft: { centreZ: mm(-2707), run: mm(495) },
    },

    /**
     * The Feifel intake manifold: the round drum on the centreline that both
     * trunks run to.
     *
     * Without it the trunking ended in mid-deck with an open cap, which was
     * Gauntlet finding 2.4. The plan view shows it plainly, with the two trunks
     * converging on it from the rear corners.
     */
    intakeDiameter: mm(554),
    intakeHeight: mm(150),
    /** Radius taken off the rim to crown the top, so rain runs off it. */
    intakeCrown: mm(28),
    intakeCentreZ: mm(-2102),
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
    /**
     * The armoured guard is a FLARED CASTING, not a plain sleeve, and the stack
     * rises close to the deck line. At 700 mm tall with a 260 mm collar the
     * stacks sat well below the deck and the guards did not read at all.
     */
    guardFlare: mm(70),
    diameter: mm(150),
    height: mm(980),
    /** Armoured guard around the base, added January 1943. */
    guardDiameter: mm(330),
    guardHeight: mm(430),
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
    /**
     * Where the flat run of the guard ends. Forward of this the guard is a
     * separate HINGED SECTION angling down over the drive sprocket — carried
     * straight on as a flat plate it projected past the nose as a wing, which
     * every critic that looked at the front reported.
     */
    frontZ: mm(3120),
    /** The hinged front flap: how far it reaches and how far it drops. */
    frontFlapRun: mm(360),
    frontFlapDrop: mm(260),
    rearZ: mm(-3330),
    /**
     * Sweep-back of the forward tip, outboard corner to inboard. From January
     * 1943 the front sections were cut as triangles rather than left square.
     */
    frontTriangleRun: mm(420),
    /** Matching sweep at the tail, so the guard does not end in a square edge. */
    rearTriangleRun: mm(210),
    /**
     * The downturned lip along the outer edge, and the brackets under it.
     *
     * Without them the guard is a 6 mm sheet seen edge-on — a foil sliver with
     * nothing holding it up. A Tiger's fender has a folded lip and is carried
     * on brackets off the sponson.
     */
    lipDepth: mm(85),
    lipThickness: mm(6),
    brackets: 5,
    bracketWidth: mm(90),
    bracketThickness: mm(10),
  },

  /**
   * The tool and stowage array carried on the hull.
   *
   * Every critic reported the hull as a bare shell, and they were right: a
   * Tiger's sponsons and rear deck are covered in kit. Positions are laid out
   * from the photographs rather than sourced individually — they varied between
   * vehicles and between crews, so the arrangement is declared as
   * reconstruction and only the presence of each item is asserted.
   *
   * `lengthZ` is along the hull, `depth` off the sponson side.
   */
  stowage: {
    /** Sponson-side items, given as centre-Z and the size of each. */
    towCable: { centreZ: mm(-600), lengthZ: mm(2600), diameter: mm(38) },
    jack: { centreZ: mm(-2050), lengthZ: mm(760), height: mm(180), depth: mm(150) },
    jackBlock: { centreZ: mm(-2760), lengthZ: mm(420), height: mm(230), depth: mm(200) },
    crowbar: { centreZ: mm(1200), lengthZ: mm(1180), diameter: mm(42) },
    axe: { centreZ: mm(300), lengthZ: mm(760), width: mm(120), depth: mm(50) },
    shovel: { centreZ: mm(-1350), lengthZ: mm(980), width: mm(150), depth: mm(50) },
    fireExtinguisher: { centreZ: mm(1900), height: mm(380), diameter: mm(115) },
    /** How far above the sponson floor the rack sits. */
    railY: mm(1420),
    /** How far the rack stands off the sponson side. */
    standoff: mm(60),
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

  /**
   * Width of the tessellated band inset from a large plate's boundary.
   *
   * Paint chipping keys off distance-to-edge, and a flat quad has no interior
   * vertices at all, so without this band a whole plate interpolates to zero
   * and chips uniformly across its face.
   */
  edgeBand: mm(60),
  /** The same, for interior sheet and floor plates, which are smaller. */
  interiorEdgeBand: mm(50),

  /**
   * What the rear plate carries besides the exhausts.
   *
   * It was a featureless trapezoidal slab. The blueprint's rear elevation shows
   * an oval inertia-starter crank port on the centreline, a towing coupling
   * below it, and a shackle lug at each lower corner.
   */
  rearPlate: {
    crankPortWidth: mm(230),
    crankPortHeight: mm(170),
    crankPortCentreY: mm(1180),
    crankPortProud: mm(45),
    /** Bezel around the crank port's opening. */
    crankPortBezel: mm(35),
    hitchWidth: mm(260),
    hitchHeight: mm(180),
    hitchCentreY: mm(760),
    hitchProud: mm(130),
    shackleCentreX: mm(1180),
    shackleCentreY: mm(830),
  },

  /**
   * Tow shackle lugs at each corner.
   *
   * Forged blocks, not tabs. At 120 x 45 they read as scratches scribed on the
   * nose rather than as something you could shackle a 57-tonne recovery cable
   * to — which is what they are for and what the photographs show.
   */
  towPoint: {
    centreX: mm(760),
    frontY: mm(700),
    rearY: mm(760),
    width: mm(230),
    height: mm(190),
    thickness: mm(110),
    /** The eye through the lug. */
    eyeDiameter: mm(95),
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
const MEASURED_PLAN =
  'REF-drawing plan view, measured: the engine deck read pixel by pixel and ' +
  'calibrated on the superstructure half-width, which the plan shows as a pair ' +
  'of straight lines and is therefore the crispest scale reference in the view.';

const REAR_ELEV =
  'REF-drawing rear elevation: the crank port, towing coupling and corner ' +
  'shackles are drawn plainly; the plate was modelled as a bare slab.';

const MEASURED_FRONT_ELEV =
  'REF-drawing front elevation, enlarged nine times before reading: the visor ' +
  'housing and the ball mount resolve as distinct raised castings rather than ' +
  'as holes, which is what they are and what the model lacked.';

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
  firewallThickness: { tol: 5, source: 'REF-cutaway', confidence: 'estimated', note: DRAWING },
  crewFloorHeight: { tol: 50, source: 'REF-cutaway: floor above the torsion bars', confidence: 'estimated', note: DRAWING },
  crewFloorThickness: { tol: 4, source: 'REF-cutaway', confidence: 'estimated', note: DRAWING },
  driverFloorRun: { tol: 150, source: 'REF-cutaway', confidence: 'estimated', note: DRAWING },
  firewallZ: { tol: 80, source: 'REF-cutaway', confidence: 'estimated', note: DRAWING },
  hatchSeat: {
    clearance: { tol: 3, source: 'fitting practice for a dropped-in lid', confidence: 'estimated', note: DRAWING },
    flange: { tol: 20, source: 'REF-photo-1: the lid rim stands proud of the roof', confidence: 'estimated', note: DRAWING },
    proud: { tol: 15, source: 'REF-photo-1: the lid shows a low step', confidence: 'estimated', note: DRAWING },
    armInset: { tol: 15, source: 'REF-photo-1: the arm is flush, not proud', confidence: 'estimated', note: DRAWING },
  },
  driverHatch: {
    centreX: { tol: 60, source: MEASURED_PLAN, confidence: 'estimated', note: DRAWING },
    centreZ: { tol: 90, source: MEASURED_PLAN, confidence: 'estimated', note: DRAWING },
    diameter: { tol: 30, source: MEASURED_PLAN, confidence: 'estimated', note: DRAWING },
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
    centreX: { tol: 60, source: MEASURED_PLAN, confidence: 'estimated', note: DRAWING },
    centreZ: { tol: 90, source: MEASURED_PLAN, confidence: 'estimated', note: DRAWING },
    diameter: { tol: 30, source: MEASURED_PLAN, confidence: 'estimated', note: DRAWING },
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
    housingWidth: { tol: 60, source: MEASURED_FRONT_ELEV, confidence: 'estimated', note: DRAWING },
    housingHeight: { tol: 50, source: MEASURED_FRONT_ELEV, confidence: 'estimated', note: DRAWING },
    housingProud: { tol: 30, source: MEASURED_FRONT_ELEV, confidence: 'estimated', note: DRAWING },
    housingCornerRadius: { tol: 20, source: MEASURED_FRONT_ELEV, confidence: 'estimated', note: DRAWING },
    shutterWidth: { tol: 50, source: MEASURED_FRONT_ELEV, confidence: 'estimated', note: DRAWING },
    shutterHeight: { tol: 40, source: MEASURED_FRONT_ELEV, confidence: 'estimated', note: DRAWING },
    shutterProud: { tol: 20, source: MEASURED_FRONT_ELEV, confidence: 'estimated', note: DRAWING },
    shutterRaise: { tol: 40, source: MEASURED_FRONT_ELEV, confidence: 'estimated', note: DRAWING },
  },
  hullMGMount: {
    centreX: { tol: 40, source: 'REF-photo-2', confidence: 'estimated', note: DRAWING },
    centreY: { tol: 40, source: 'REF-photo-2', confidence: 'estimated', note: DRAWING },
    ballDiameter: { tol: 40, source: MEASURED_FRONT_ELEV, confidence: 'estimated', note: DRAWING },
    ballProud: { tol: 30, source: MEASURED_FRONT_ELEV, confidence: 'estimated', note: DRAWING },
    collarDiameter: { tol: 40, source: MEASURED_FRONT_ELEV, confidence: 'estimated', note: DRAWING },
    collarProud: { tol: 20, source: MEASURED_FRONT_ELEV, confidence: 'estimated', note: DRAWING },
    barrelDiameter: { tol: 15, source: 'MG 34 barrel sleeve', confidence: 'estimated', note: DRAWING },
    barrelLength: { tol: 60, source: MEASURED_FRONT_ELEV, confidence: 'estimated', note: DRAWING },
    sleeveDiameter: { tol: 20, source: MEASURED_FRONT_ELEV, confidence: 'estimated', note: DRAWING },
    sleeveLength: { tol: 40, source: MEASURED_FRONT_ELEV, confidence: 'estimated', note: DRAWING },
    barrelWall: { tol: 4, source: 'MG 34 barrel', confidence: 'estimated', note: DRAWING },
    apertureDiameter: { tol: 25, source: 'REF-photo-2', confidence: 'estimated', note: DRAWING },
  },
  headlight: {
    pedestalDiameter: { tol: 25, source: 'Bosch pattern headlight', confidence: 'estimated', note: DRAWING },
    pedestalHeight: { tol: 40, source: 'REF-photo-2', confidence: 'estimated', note: DRAWING },
    rimWidth: { tol: 8, source: 'Bosch pattern headlight', confidence: 'estimated', note: DRAWING },
    bowlDepth: { tol: 25, source: 'Bosch pattern headlight', confidence: 'estimated', note: DRAWING },
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
    grilleInnerX: { tol: 60, source: MEASURED_PLAN, confidence: 'estimated', note: DRAWING },
    grilleOuterX: { tol: 60, source: MEASURED_PLAN, confidence: 'estimated', note: DRAWING },
    grilleStations: {
      forward: {
        centreZ: { tol: 90, source: MEASURED_PLAN, confidence: 'estimated', note: DRAWING },
        run: { tol: 90, source: MEASURED_PLAN, confidence: 'estimated', note: DRAWING },
      },
      aft: {
        centreZ: { tol: 90, source: MEASURED_PLAN, confidence: 'estimated', note: DRAWING },
        run: { tol: 70, source: MEASURED_PLAN, confidence: 'estimated', note: DRAWING },
      },
    },
    intakeDiameter: { tol: 60, source: MEASURED_PLAN, confidence: 'estimated', note: DRAWING },
    intakeCrown: { tol: 12, source: 'REF-photo rear deck', confidence: 'estimated', note: DRAWING },
    intakeHeight: { tol: 50, source: 'REF-drawing side view', confidence: 'estimated', note: DRAWING },
    intakeCentreZ: { tol: 90, source: MEASURED_PLAN, confidence: 'estimated', note: DRAWING },
    grilleThickness: { tol: 8, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING },
    grilleSlats: { tol: 2, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING },
    grilleSlotWidth: { tol: 8, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING },
  },
  exhaust: {
    guardFlare: { tol: 30, source: 'REF-drawing rear view', confidence: 'estimated', note: DRAWING },
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
    frontFlapRun: { tol: 90, source: 'REF-photo-2: hinged front section angles down', confidence: 'estimated', note: DRAWING },
    frontFlapDrop: { tol: 80, source: 'REF-photo-2', confidence: 'estimated', note: DRAWING },
    rearZ: { tol: 90, source: 'REF-drawing side view', confidence: 'estimated', note: DRAWING },
    frontTriangleRun: { tol: 90, source: 'TIC-changes: triangular front sections from Jan 1943', confidence: 'estimated', note: DRAWING },
    lipDepth: { tol: 30, source: 'REF-photo-1: folded outer lip', confidence: 'estimated', note: DRAWING },
    lipThickness: { tol: 2, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING },
    brackets: { tol: 2, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING },
    bracketWidth: { tol: 30, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING },
    bracketThickness: { tol: 4, source: 'REF-photo-1', confidence: 'estimated', note: DRAWING },
    rearTriangleRun: { tol: 70, source: 'REF-drawing side view', confidence: 'estimated', note: DRAWING },
  },
  stowage: {
    towCable: {
      centreZ: { tol: 400, source: 'REF-photo-2 and REF-photo-3: hull sides and rear covered in kit. Arrangement varied between vehicles; declared as reconstruction.', confidence: 'estimated', note: DRAWING },
      lengthZ: { tol: 400, source: 'REF-photo-2 and REF-photo-3: hull sides and rear covered in kit. Arrangement varied between vehicles; declared as reconstruction.', confidence: 'estimated', note: DRAWING },
      diameter: { tol: 12, source: 'REF-photo-2 and REF-photo-3: hull sides and rear covered in kit. Arrangement varied between vehicles; declared as reconstruction.', confidence: 'estimated', note: DRAWING },
    },
    jack: {
      centreZ: { tol: 400, source: 'REF-photo-2 and REF-photo-3: hull sides and rear covered in kit. Arrangement varied between vehicles; declared as reconstruction.', confidence: 'estimated', note: DRAWING },
      lengthZ: { tol: 120, source: 'REF-photo-2 and REF-photo-3: hull sides and rear covered in kit. Arrangement varied between vehicles; declared as reconstruction.', confidence: 'estimated', note: DRAWING },
      height: { tol: 60, source: 'REF-photo-2 and REF-photo-3: hull sides and rear covered in kit. Arrangement varied between vehicles; declared as reconstruction.', confidence: 'estimated', note: DRAWING },
      depth: { tol: 50, source: 'REF-photo-2 and REF-photo-3: hull sides and rear covered in kit. Arrangement varied between vehicles; declared as reconstruction.', confidence: 'estimated', note: DRAWING },
    },
    jackBlock: {
      centreZ: { tol: 400, source: 'REF-photo-2 and REF-photo-3: hull sides and rear covered in kit. Arrangement varied between vehicles; declared as reconstruction.', confidence: 'estimated', note: DRAWING },
      lengthZ: { tol: 90, source: 'REF-photo-2 and REF-photo-3: hull sides and rear covered in kit. Arrangement varied between vehicles; declared as reconstruction.', confidence: 'estimated', note: DRAWING },
      height: { tol: 60, source: 'REF-photo-2 and REF-photo-3: hull sides and rear covered in kit. Arrangement varied between vehicles; declared as reconstruction.', confidence: 'estimated', note: DRAWING },
      depth: { tol: 50, source: 'REF-photo-2 and REF-photo-3: hull sides and rear covered in kit. Arrangement varied between vehicles; declared as reconstruction.', confidence: 'estimated', note: DRAWING },
    },
    crowbar: {
      centreZ: { tol: 400, source: 'REF-photo-2 and REF-photo-3: hull sides and rear covered in kit. Arrangement varied between vehicles; declared as reconstruction.', confidence: 'estimated', note: DRAWING },
      lengthZ: { tol: 200, source: 'REF-photo-2 and REF-photo-3: hull sides and rear covered in kit. Arrangement varied between vehicles; declared as reconstruction.', confidence: 'estimated', note: DRAWING },
      diameter: { tol: 12, source: 'REF-photo-2 and REF-photo-3: hull sides and rear covered in kit. Arrangement varied between vehicles; declared as reconstruction.', confidence: 'estimated', note: DRAWING },
    },
    axe: {
      centreZ: { tol: 400, source: 'REF-photo-2 and REF-photo-3: hull sides and rear covered in kit. Arrangement varied between vehicles; declared as reconstruction.', confidence: 'estimated', note: DRAWING },
      lengthZ: { tol: 120, source: 'REF-photo-2 and REF-photo-3: hull sides and rear covered in kit. Arrangement varied between vehicles; declared as reconstruction.', confidence: 'estimated', note: DRAWING },
      width: { tol: 40, source: 'REF-photo-2 and REF-photo-3: hull sides and rear covered in kit. Arrangement varied between vehicles; declared as reconstruction.', confidence: 'estimated', note: DRAWING },
      depth: { tol: 20, source: 'REF-photo-2 and REF-photo-3: hull sides and rear covered in kit. Arrangement varied between vehicles; declared as reconstruction.', confidence: 'estimated', note: DRAWING },
    },
    shovel: {
      centreZ: { tol: 400, source: 'REF-photo-2 and REF-photo-3: hull sides and rear covered in kit. Arrangement varied between vehicles; declared as reconstruction.', confidence: 'estimated', note: DRAWING },
      lengthZ: { tol: 150, source: 'REF-photo-2 and REF-photo-3: hull sides and rear covered in kit. Arrangement varied between vehicles; declared as reconstruction.', confidence: 'estimated', note: DRAWING },
      width: { tol: 40, source: 'REF-photo-2 and REF-photo-3: hull sides and rear covered in kit. Arrangement varied between vehicles; declared as reconstruction.', confidence: 'estimated', note: DRAWING },
      depth: { tol: 20, source: 'REF-photo-2 and REF-photo-3: hull sides and rear covered in kit. Arrangement varied between vehicles; declared as reconstruction.', confidence: 'estimated', note: DRAWING },
    },
    fireExtinguisher: {
      centreZ: { tol: 400, source: 'REF-photo-2 and REF-photo-3: hull sides and rear covered in kit. Arrangement varied between vehicles; declared as reconstruction.', confidence: 'estimated', note: DRAWING },
      height: { tol: 60, source: 'REF-photo-2 and REF-photo-3: hull sides and rear covered in kit. Arrangement varied between vehicles; declared as reconstruction.', confidence: 'estimated', note: DRAWING },
      diameter: { tol: 25, source: 'REF-photo-2 and REF-photo-3: hull sides and rear covered in kit. Arrangement varied between vehicles; declared as reconstruction.', confidence: 'estimated', note: DRAWING },
    },
    railY: { tol: 120, source: 'REF-photo-2 and REF-photo-3: hull sides and rear covered in kit. Arrangement varied between vehicles; declared as reconstruction.', confidence: 'estimated', note: DRAWING },
    standoff: { tol: 25, source: 'REF-photo-2 and REF-photo-3: hull sides and rear covered in kit. Arrangement varied between vehicles; declared as reconstruction.', confidence: 'estimated', note: DRAWING },
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
  interiorEdgeBand: { tol: 15, source: 'shader band, not a measured dimension', confidence: 'estimated', note: DRAWING },
  edgeBand: { tol: 20, source: 'shader band, not a measured dimension', confidence: 'estimated', note: DRAWING },
  rearPlate: {
    crankPortWidth: { tol: 50, source: REAR_ELEV, confidence: 'estimated', note: DRAWING },
    crankPortHeight: { tol: 40, source: REAR_ELEV, confidence: 'estimated', note: DRAWING },
    crankPortCentreY: { tol: 90, source: REAR_ELEV, confidence: 'estimated', note: DRAWING },
    crankPortBezel: { tol: 15, source: REAR_ELEV, confidence: 'estimated', note: DRAWING },
    crankPortProud: { tol: 20, source: REAR_ELEV, confidence: 'estimated', note: DRAWING },
    hitchWidth: { tol: 60, source: REAR_ELEV, confidence: 'estimated', note: DRAWING },
    hitchHeight: { tol: 50, source: REAR_ELEV, confidence: 'estimated', note: DRAWING },
    hitchCentreY: { tol: 90, source: REAR_ELEV, confidence: 'estimated', note: DRAWING },
    hitchProud: { tol: 40, source: REAR_ELEV, confidence: 'estimated', note: DRAWING },
    shackleCentreX: { tol: 90, source: REAR_ELEV, confidence: 'estimated', note: DRAWING },
    shackleCentreY: { tol: 90, source: REAR_ELEV, confidence: 'estimated', note: DRAWING },
  },
  towPoint: {
    height: { tol: 50, source: 'REF-photo-2: forged lugs on the nose', confidence: 'estimated', note: DRAWING },
    eyeDiameter: { tol: 25, source: 'REF-photo-2', confidence: 'estimated', note: DRAWING },
    centreX: { tol: 40, source: 'REF-photo-2', confidence: 'estimated', note: DRAWING },
    frontY: { tol: 40, source: 'REF-photo-2', confidence: 'estimated', note: DRAWING },
    rearY: { tol: 40, source: 'REF-drawing rear view', confidence: 'estimated', note: DRAWING },
    width: { tol: 20, source: 'REF-photo-2', confidence: 'estimated', note: DRAWING },
    thickness: { tol: 10, source: 'REF-photo-2', confidence: 'estimated', note: DRAWING },
  },
};

/** Re-exported so hull builders do not have to reach for the running gear spec. */
export { TRACK_CENTRE_X };
