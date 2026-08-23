import { Vector3 } from 'three';
import { Region, WEAR } from '../../geom/attributes.js';
import { circle, rect, v2, type Poly2 } from '../../geom/poly2.js';
import { R, S, SIDES, mm, sideSign, type DEG, type MM } from '../../spec/units.js';
import { ARMOUR } from '../../spec/armour.js';
import {
  DRIVER_PLATE_FOOT_Y,
  DRIVER_PLATE_HEAD_Z,
  GLACIS_HEAD_Z,
  HULL,
  LOWER_HALF_WIDTH,
  SPONSON_HALF_WIDTH,
  driverPlateInnerZ,
  driverPlateOuterZ,
} from '../../spec/hull.js';
import { TURRET } from '../../spec/turret.js';
import { structuralPlate, weldJoint } from '../emit.js';
import type { BuildContext, PartResult } from '../types.js';
import {
  facingDown,
  facingOutboard,
  facingUp,
  facingUpForward,
  sideProfile as sideProfileFor,
} from './frames.js';

/**
 * The superstructure: the box above the lower hull whose sides run out past the
 * tracks to form the sponsons.
 *
 * This is where the Tiger stops being a plain box. The driver's front plate is
 * full width while the nose beneath it is only as wide as the lower hull, so
 * the plate is stepped; the sponsons it steps out to hold two thirds of the
 * ammunition; and the roof carries a 1,830 mm hole for the turret ring plus the
 * driver's and radio operator's hatches.
 *
 * It also carries the first vision devices. The driver's visor and the hull
 * machine gun's bore are hole polygons in the front plate outline, which is what
 * makes them apertures through the full 100 mm rather than dimples on the
 * outside — see docs/REQUIREMENTS.md R1.
 */

/** Height of the sponson floor's upper surface: what the side plates stand on. */
function sponsonFloorTop(): MM {
  return mm(HULL.sponsonFloorY + ARMOUR.hull.roof.thickness);
}

/** Inner face of the rear plate at a given height. */
function rearPlateInnerZ(y: MM): MM {
  const tilt = R(ARMOUR.hull.rear.angle);
  return mm(
    HULL.rearZ +
      (HULL.roofY - y) * Math.tan(tilt) +
      ARMOUR.hull.rear.thickness / Math.cos(tilt),
  );
}

/**
 * Segment counts for the circular apertures. A hatch rim the player can walk up
 * to needs more than a turret ring seen mostly from a distance.
 */
const TURRET_RING_SEGMENTS = 48;
const HATCH_SEGMENTS = 28;
const BORE_SEGMENTS = 24;

/** How far a grille's frame overlaps the plate around its opening. */
const GRILLE_LIP = 45;
/** Clear space left at each end of a grille slot, so the frame stays continuous. */
const GRILLE_MARGIN = 55;
/** How far a hatch lid overlaps the rim it seats on. */
const HATCH_OVERLAP = 40;

/**
 * Outward normal of a plate quoted at an angle from vertical. `upward` picks
 * between the two cases the Tiger's front needs: the nose leans back as it
 * descends so its normal points forward and DOWN, while the glacis and the
 * driver's plate lean back as they climb so theirs point forward and UP.
 */
function plateNormal(angleFromVertical: DEG, upward: boolean): Vector3 {
  const t = R(angleFromVertical);
  return new Vector3(0, (upward ? 1 : -1) * Math.sin(t), Math.cos(t));
}

export function buildSuperstructure(ctx: BuildContext): PartResult {
  const start = ctx.render.triangleCount;
  const frames = new Map<string, ReturnType<typeof facingUp>>();

  const tilt9 = ARMOUR.hull.driverPlate.angle;
  const cos9 = Math.cos(R(tilt9));
  const floorTop = sponsonFloorTop();
  const roofInnerY = mm(HULL.roofY - ARMOUR.hull.roof.thickness);

  // ---------------------------------------------------------------------------
  // Short glacis
  //
  // The step between the nose plate and the driver's front plate, and the plate
  // whose absence made the whole front read as one wedge. At 80 degrees from
  // vertical it lies 10 degrees above horizontal: shallow, but a distinct plane
  // with its own thickness and its own two weld seams.
  //
  // It runs the full superstructure width while the nose beneath it is only as
  // wide as the lower hull, so it also forms the forward overhang of the
  // sponsons — which is what the track guards hang from.
  // ---------------------------------------------------------------------------
  const glacisSlant = Math.hypot(HULL.glacisRun, DRIVER_PLATE_FOOT_Y - HULL.noseTopY);

  structuralPlate(ctx, {
    outline: rect(HULL.superstructureWidth, mm(glacisSlant)),
    thickness: ARMOUR.hull.shortGlacis.thickness,
    frame: facingUpForward(
      mm((HULL.frontZ + GLACIS_HEAD_Z) / 2),
      mm((HULL.noseTopY + DRIVER_PLATE_FOOT_Y) / 2),
      ARMOUR.hull.shortGlacis.angle,
    ),
    chamfer: HULL.chamfer.structural,
    region: Region.Exterior,
    materials: { inner: 'interiorIvoryPaint' },
    // Crews stood on the front step to reach the driver's hatch.
    wear: WEAR.footTraffic,
  });

  // ---------------------------------------------------------------------------
  // Driver's front plate
  //
  // Full superstructure width for its whole height, because the glacis beneath
  // it is already full width. Carries the driver's visor and the hull MG bore as
  // holes cut clean through 100 mm of armour.
  // ---------------------------------------------------------------------------
  const dpCentreY = mm((DRIVER_PLATE_FOOT_Y + HULL.roofY) / 2);
  const dpCentreZ = driverPlateOuterZ(dpCentreY);
  const localY = (worldY: MM): number => (worldY - dpCentreY) / cos9;

  const driverPlateOutline: Poly2 = rect(
    HULL.superstructureWidth,
    mm((HULL.roofY - DRIVER_PLATE_FOOT_Y) / cos9),
  );

  const visorHole: Poly2 = translate(
    rect(HULL.driverVisor.width, mm(HULL.driverVisor.height / cos9)),
    HULL.driverVisor.centreX,
    localY(HULL.driverVisor.centreY),
  );
  const mgHole: Poly2 = translate(
    circle(HULL.hullMGMount.apertureDiameter / 2, BORE_SEGMENTS),
    HULL.hullMGMount.centreX,
    localY(HULL.hullMGMount.centreY),
  );

  structuralPlate(ctx, {
    outline: driverPlateOutline,
    holes: [visorHole, mgHole],
    thickness: ARMOUR.hull.driverPlate.thickness,
    frame: facingUpForward(dpCentreZ, dpCentreY, tilt9),
    chamfer: HULL.chamfer.structural,
    region: Region.Exterior,
    materials: { inner: 'interiorIvoryPaint' },
  });

  // ---------------------------------------------------------------------------
  // Roof and engine deck
  //
  // One plate from the glacis to the tail, with the turret ring and the two
  // forward hatches cut through it. Local Y runs aft-negative, so world z maps
  // to -localY.
  // ---------------------------------------------------------------------------
  const roofFrontZ = DRIVER_PLATE_HEAD_Z;
  const roofRearZ = HULL.rearZ;
  const roofLength = mm(roofFrontZ - roofRearZ);
  const roofCentreZ = mm((roofFrontZ + roofRearZ) / 2);

  // Local Y runs aft-negative, so world z is -localY and the outline has to be
  // moved onto the hull the way the belly's is. Leaving it centred on the plate
  // frame's own origin put the roof — and, consistently, every aperture in it —
  // 317 mm too far forward: a third of a metre of roof overhanging the driver's
  // plate into thin air, and the same gap left open at the tail. Because the
  // holes were displaced with the plate they still lined up with each other,
  // which is why it looked right and why only measuring the built geometry
  // against the spec's own front and rear found it.
  const roofLocal = (worldZ: MM): number => -worldZ;

  const roofOutline: Poly2 = translate(
    rect(HULL.superstructureWidth, roofLength),
    0,
    -roofCentreZ,
  );
  const turretAperture: Poly2 = translate(
    circle(TURRET.ring.clearOpeningDiameter / 2, TURRET_RING_SEGMENTS),
    0,
    roofLocal(TURRET.ring.centreZ),
  );
  const driverHatchAperture: Poly2 = translate(
    circle(HULL.driverHatch.diameter / 2, HATCH_SEGMENTS),
    HULL.driverHatch.centreX,
    roofLocal(HULL.driverHatch.centreZ),
  );
  const radioHatchAperture: Poly2 = translate(
    circle(HULL.radioHatch.diameter / 2, HATCH_SEGMENTS),
    HULL.radioHatch.centreX,
    roofLocal(HULL.radioHatch.centreZ),
  );

  // Engine deck openings. The two radiator grilles and the central engine
  // access hatch are cut through the same roof plate as everything else.
  const deck = HULL.engineDeck;
  const engineHatchAperture: Poly2 = translate(
    rect(deck.hatchWidth, deck.hatchLength),
    0,
    roofLocal(deck.hatchCentreZ),
  );
  // Four grilles: a long forward one and a shorter aft one on each side. They
  // share a lateral band, so the band is written once and each station only
  // says where along the hull it sits and how long it is.
  const grilleWidth = mm(deck.grilleOuterX - deck.grilleInnerX);
  const grilleCentreX = mm((deck.grilleOuterX + deck.grilleInnerX) / 2);
  const grilles = SIDES.flatMap((side) =>
    Object.values(deck.grilleStations).map((station) => ({
      centreX: mm(sideSign(side) * grilleCentreX),
      centreZ: station.centreZ,
      run: station.run,
    })),
  );
  const grilleApertures: Poly2[] = grilles.map((g) =>
    translate(rect(grilleWidth, g.run), g.centreX, roofLocal(g.centreZ)),
  );

  structuralPlate(ctx, {
    outline: roofOutline,
    holes: [
      turretAperture,
      driverHatchAperture,
      radioHatchAperture,
      engineHatchAperture,
      ...grilleApertures,
    ],
    thickness: ARMOUR.hull.roof.thickness,
    frame: facingUp(HULL.roofY),
    chamfer: HULL.chamfer.side,
    region: Region.Exterior,
    materials: { inner: 'interiorIvoryPaint' },
    wear: WEAR.footTraffic,
  });

  // ---------------------------------------------------------------------------
  // Radiator grilles.
  //
  // Built as a plate with slots cut through it rather than as a stack of
  // separate bars: it is one solid, it is genuinely open to the engine bay, and
  // it is the same primitive and the same guarantees as every other piece of
  // armour on the vehicle.
  // ---------------------------------------------------------------------------
  const slotLength = mm(grilleWidth - GRILLE_MARGIN * 2);

  for (const g of grilles) {
    // Slat count follows the grille's length, so the short aft grille does not
    // get the same nine slats squeezed into half the run.
    const slats = Math.max(
      3,
      Math.round((deck.grilleSlats * g.run) / deck.grilleStations.forward.run),
    );
    const slotPitch = g.run / slats;
    const slots: Poly2[] = [];
    for (let i = 0; i < slats; i++) {
      const offset = (i - (slats - 1) / 2) * slotPitch;
      slots.push(
        translate(
          rect(slotLength, deck.grilleSlotWidth),
          g.centreX,
          roofLocal(mm(g.centreZ + offset)),
        ),
      );
    }

    structuralPlate(ctx, {
      outline: translate(
        rect(mm(grilleWidth + GRILLE_LIP * 2), mm(g.run + GRILLE_LIP * 2)),
        g.centreX,
        roofLocal(g.centreZ),
      ),
      holes: slots,
      thickness: deck.grilleThickness,
      frame: facingUp(HULL.roofY),
      chamfer: HULL.chamfer.side,
      region: Region.Exterior,
      materials: { inner: 'machinedSteel', edge: 'machinedSteel' },
      wear: WEAR.footTraffic,
    });
  }

  // ---------------------------------------------------------------------------
  // Engine access hatch lid, sitting closed on its aperture. The hinge and the
  // opening arc arrive with the rest of the hatches.
  // ---------------------------------------------------------------------------
  structuralPlate(ctx, {
    outline: translate(
      rect(mm(deck.hatchWidth + HATCH_OVERLAP * 2), mm(deck.hatchLength + HATCH_OVERLAP * 2)),
      0,
      roofLocal(deck.hatchCentreZ),
    ),
    thickness: deck.hatchThickness,
    frame: facingUp(HULL.roofY),
    chamfer: HULL.chamfer.structural,
    region: Region.Exterior,
    materials: { inner: 'interiorIvoryPaint' },
    wear: WEAR.footTraffic,
  });

  // ---------------------------------------------------------------------------
  // Sponson floors: the roof of each track run, and the shelf the ammunition
  // bins stand on.
  // ---------------------------------------------------------------------------
  const sponsonFrontZ = driverPlateInnerZ(HULL.sponsonFloorY);
  const sponsonRearZ = rearPlateInnerZ(HULL.sponsonFloorY);
  const sponsonLength = mm(sponsonFrontZ - sponsonRearZ);
  const sponsonCentreZ = mm((sponsonFrontZ + sponsonRearZ) / 2);
  const sponsonWidth = mm(SPONSON_HALF_WIDTH - LOWER_HALF_WIDTH);
  const sponsonCentreX = mm((SPONSON_HALF_WIDTH + LOWER_HALF_WIDTH) / 2);

  for (const side of ['left', 'right'] as const) {
    const sign = side === 'left' ? -1 : 1;
    structuralPlate(ctx, {
      outline: translate(rect(sponsonWidth, sponsonLength), sign * sponsonCentreX, sponsonCentreZ),
      thickness: ARMOUR.hull.roof.thickness,
      frame: facingDown(HULL.sponsonFloorY),
      chamfer: HULL.chamfer.side,
      region: Region.Exterior,
      materials: { inner: 'interiorIvoryPaint' },
    });
  }

  // ---------------------------------------------------------------------------
  // Superstructure sides
  //
  // The front edge follows the inner faces of the driver's plate and then the
  // glacis, so the plate closes the sponson without pushing into either.
  // ---------------------------------------------------------------------------
  const superSideProfile: Poly2 = [
    // Front edge, bottom to top: the driver's plate is now a single straight
    // run, so this no longer has to pick its way around a glacis overhead.
    v2(driverPlateInnerZ(DRIVER_PLATE_FOOT_Y), DRIVER_PLATE_FOOT_Y),
    v2(driverPlateInnerZ(roofInnerY), roofInnerY),
    v2(rearPlateInnerZ(roofInnerY), roofInnerY),
    v2(rearPlateInnerZ(floorTop), floorTop),
    // Forward along the underside of the sponson floor, then down the short lip
    // that carries the sponson's forward overhang onto the glacis.
    v2(driverPlateInnerZ(floorTop), floorTop),
  ];

  for (const side of ['left', 'right'] as const) {
    structuralPlate(ctx, {
      outline: sideProfileFor(side, superSideProfile),
      thickness: ARMOUR.hull.sideUpper.thickness,
      frame: facingOutboard(side, SPONSON_HALF_WIDTH),
      chamfer: HULL.chamfer.side,
      region: Region.Exterior,
      materials: { inner: 'interiorIvoryPaint' },
    });
  }

  // ---------------------------------------------------------------------------
  // Welds along the superstructure's long joints
  // ---------------------------------------------------------------------------
  const half = S(SPONSON_HALF_WIDTH);
  const halfNose = S(LOWER_HALF_WIDTH);
  const up = new Vector3(0, 1, 0);

  const noseNormal = plateNormal(ARMOUR.hull.nose.angle, false);
  const glacisNormal = plateNormal(ARMOUR.hull.shortGlacis.angle, true);
  const driverNormal = plateNormal(ARMOUR.hull.driverPlate.angle, true);

  // The three seams that make the front three planes rather than one. If any of
  // these disappears, so has the plate it joins.
  weldJoint(
    ctx,
    [
      new Vector3(-halfNose, S(HULL.noseTopY), S(HULL.frontZ)),
      new Vector3(halfNose, S(HULL.noseTopY), S(HULL.frontZ)),
    ],
    noseNormal,
    glacisNormal,
    'fillet-12',
  );
  weldJoint(
    ctx,
    [
      new Vector3(-half, S(DRIVER_PLATE_FOOT_Y), S(GLACIS_HEAD_Z)),
      new Vector3(half, S(DRIVER_PLATE_FOOT_Y), S(GLACIS_HEAD_Z)),
    ],
    glacisNormal,
    driverNormal,
    'fillet-12',
  );
  weldJoint(
    ctx,
    [
      new Vector3(-half, S(HULL.roofY), S(roofFrontZ)),
      new Vector3(half, S(HULL.roofY), S(roofFrontZ)),
    ],
    driverNormal,
    up,
    'fillet-8',
  );

  for (const side of ['left', 'right'] as const) {
    const x = side === 'left' ? -half : half;
    const outward = new Vector3(side === 'left' ? -1 : 1, 0, 0);

    // Roof to superstructure side, the full length of the vehicle.
    weldJoint(
      ctx,
      [new Vector3(x, S(HULL.roofY), S(roofRearZ)), new Vector3(x, S(HULL.roofY), S(roofFrontZ))],
      up,
      outward,
      'fillet-8',
    );

    // Driver's plate to superstructure side.
    weldJoint(
      ctx,
      [
        new Vector3(x, S(DRIVER_PLATE_FOOT_Y), S(GLACIS_HEAD_Z)),
        new Vector3(x, S(HULL.roofY), S(roofFrontZ)),
      ],
      driverNormal,
      outward,
      'fillet-8',
    );

    // Glacis to superstructure side, along the forward sponson overhang.
    weldJoint(
      ctx,
      [
        new Vector3(x, S(HULL.noseTopY), S(HULL.frontZ)),
        new Vector3(x, S(DRIVER_PLATE_FOOT_Y), S(GLACIS_HEAD_Z)),
      ],
      glacisNormal,
      outward,
      'fillet-8',
    );
  }

  frames.set('turretRing', facingUp(HULL.roofY));

  return {
    name: 'superstructure',
    triangleCount: ctx.render.triangleCount - start,
    collision: [],
    frames,
  };
}

/** Shift a polygon; outlines are authored centred but placed absolutely. */
function translate(poly: Poly2, dx: number, dy: number): Poly2 {
  return poly.map((p) => v2(p.x + dx, p.y + dy));
}
