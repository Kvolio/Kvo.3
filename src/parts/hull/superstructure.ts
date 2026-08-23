import { Vector3 } from 'three';
import { Region, WEAR } from '../../geom/attributes.js';
import { circle, rect, v2, type Poly2 } from '../../geom/poly2.js';
import { R, S, fromHorizontal, mm, type MM } from '../../spec/units.js';
import { ARMOUR } from '../../spec/armour.js';
import { HULL, LOWER_HALF_WIDTH, SPONSON_HALF_WIDTH } from '../../spec/hull.js';
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

/** Inner face of the driver's front plate at a given height. */
function driverPlateInnerZ(y: MM): MM {
  const tilt = R(ARMOUR.hull.driverPlate.angle);
  return mm(
    HULL.frontZ -
      (y - HULL.noseTopY) * Math.tan(tilt) -
      ARMOUR.hull.driverPlate.thickness / Math.cos(tilt),
  );
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

/** Where the upper glacis meets the driver's front plate, on the outer face. */
function glacisOuterFoot(): { z: MM; y: MM } {
  const tilt = R(ARMOUR.hull.driverPlate.angle);
  return {
    z: mm(HULL.frontZ - (HULL.driverPlateTopY - HULL.noseTopY) * Math.tan(tilt)),
    y: HULL.driverPlateTopY,
  };
}

/** Where the upper glacis meets the roof, on the outer face. */
function glacisOuterHead(): { z: MM; y: MM } {
  const foot = glacisOuterFoot();
  const rise = HULL.roofY - HULL.driverPlateTopY;
  // Quoted from vertical, so the run is rise / tan(90 - angle).
  const run = rise / Math.tan(R(fromHorizontal(ARMOUR.hull.upperGlacis.angle)));
  return { z: mm(foot.z - run), y: HULL.roofY };
}

/**
 * The glacis inner face, offset from the outer face along the plate normal.
 * Returned as its two endpoints, which is all the side profile needs.
 */
function glacisInnerFace(): { foot: { z: MM; y: MM }; head: { z: MM; y: MM } } {
  const tilt = R(ARMOUR.hull.upperGlacis.angle);
  const t = ARMOUR.hull.upperGlacis.thickness;
  // Outward normal points forward and up: (sin tilt in y, cos tilt in z).
  const dz = -t * Math.cos(tilt);
  const dy = -t * Math.sin(tilt);
  const foot = glacisOuterFoot();
  const head = glacisOuterHead();
  return {
    foot: { z: mm(foot.z + dz), y: mm(foot.y + dy) },
    head: { z: mm(head.z + dz), y: mm(head.y + dy) },
  };
}

/**
 * Segment counts for the circular apertures. A hatch rim the player can walk up
 * to needs more than a turret ring seen mostly from a distance, and the turret
 * ring is the largest circle on the vehicle.
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

export function buildSuperstructure(ctx: BuildContext): PartResult {
  const start = ctx.render.triangleCount;
  const frames = new Map<string, ReturnType<typeof facingUp>>();

  const tilt9 = ARMOUR.hull.driverPlate.angle;
  const cos9 = Math.cos(R(tilt9));
  const floorTop = sponsonFloorTop();
  const roofInnerY = mm(HULL.roofY - ARMOUR.hull.roof.thickness);
  const glacisHead = glacisOuterHead();
  const glacisInner = glacisInnerFace();

  // ---------------------------------------------------------------------------
  // Driver's front plate
  //
  // Stepped: only as wide as the lower hull below the sponson floor, full
  // superstructure width above it. Carries the driver's visor and the hull MG
  // bore as holes cut clean through 100 mm of armour.
  // ---------------------------------------------------------------------------
  const dpCentreY = mm((HULL.noseTopY + HULL.driverPlateTopY) / 2);
  const dpCentreZ = mm(HULL.frontZ - (dpCentreY - HULL.noseTopY) * Math.tan(R(tilt9)));
  const localY = (worldY: MM): number => (worldY - dpCentreY) / cos9;

  const dpBottom = localY(HULL.noseTopY);
  const dpTop = localY(HULL.driverPlateTopY);
  const dpStep = localY(HULL.sponsonFloorY);
  const halfLower = LOWER_HALF_WIDTH;
  const halfUpper = SPONSON_HALF_WIDTH;

  const driverPlateOutline: Poly2 = [
    v2(-halfLower, dpBottom),
    v2(halfLower, dpBottom),
    v2(halfLower, dpStep),
    v2(halfUpper, dpStep),
    v2(halfUpper, dpTop),
    v2(-halfUpper, dpTop),
    v2(-halfUpper, dpStep),
    v2(-halfLower, dpStep),
  ];

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
  // Upper glacis
  // ---------------------------------------------------------------------------
  const glacisFoot = glacisOuterFoot();
  const glacisSlant = Math.hypot(glacisHead.z - glacisFoot.z, glacisHead.y - glacisFoot.y);

  structuralPlate(ctx, {
    outline: rect(HULL.superstructureWidth, mm(glacisSlant)),
    thickness: ARMOUR.hull.upperGlacis.thickness,
    frame: facingUpForward(
      mm((glacisFoot.z + glacisHead.z) / 2),
      mm((glacisFoot.y + glacisHead.y) / 2),
      ARMOUR.hull.upperGlacis.angle,
    ),
    chamfer: HULL.chamfer.structural,
    region: Region.Exterior,
    materials: { inner: 'interiorIvoryPaint' },
    // Crews walked on the front deck constantly.
    wear: WEAR.footTraffic,
  });

  // ---------------------------------------------------------------------------
  // Roof and engine deck
  //
  // One plate from the glacis to the tail, with the turret ring and the two
  // forward hatches cut through it. Local Y runs aft-negative, so world z maps
  // to -localY.
  // ---------------------------------------------------------------------------
  const roofFrontZ = glacisHead.z;
  const roofRearZ = HULL.rearZ;
  const roofLength = mm(roofFrontZ - roofRearZ);
  const roofCentreZ = mm((roofFrontZ + roofRearZ) / 2);

  const roofLocal = (worldZ: MM): number => -(worldZ - roofCentreZ);

  const roofOutline: Poly2 = rect(HULL.superstructureWidth, roofLength);
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
  const grilleApertures: Poly2[] = (['left', 'right'] as const).map((side) =>
    translate(
      rect(deck.grilleWidth, deck.grilleLength),
      (side === 'left' ? -1 : 1) * deck.grilleCentreX,
      roofLocal(deck.grilleCentreZ),
    ),
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
  const slotPitch = deck.grilleLength / deck.grilleSlats;
  const slotLength = mm(deck.grilleWidth - GRILLE_MARGIN * 2);

  for (const side of ['left', 'right'] as const) {
    const sign = side === 'left' ? -1 : 1;
    const centreX = mm(sign * deck.grilleCentreX);
    const slots: Poly2[] = [];
    for (let i = 0; i < deck.grilleSlats; i++) {
      const offset = (i - (deck.grilleSlats - 1) / 2) * slotPitch;
      slots.push(
        translate(
          rect(slotLength, deck.grilleSlotWidth),
          centreX,
          roofLocal(mm(deck.grilleCentreZ + offset)),
        ),
      );
    }

    structuralPlate(ctx, {
      outline: translate(
        rect(mm(deck.grilleWidth + GRILLE_LIP * 2), mm(deck.grilleLength + GRILLE_LIP * 2)),
        centreX,
        roofLocal(deck.grilleCentreZ),
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
    v2(driverPlateInnerZ(floorTop), floorTop),
    v2(driverPlateInnerZ(HULL.driverPlateTopY), HULL.driverPlateTopY),
    v2(glacisInner.foot.z, HULL.driverPlateTopY),
    v2(glacisInner.head.z, glacisInner.head.y),
    v2(glacisInner.head.z, roofInnerY),
    v2(rearPlateInnerZ(roofInnerY), roofInnerY),
    v2(rearPlateInnerZ(floorTop), floorTop),
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
  const up = new Vector3(0, 1, 0);
  const glacisNormal = new Vector3(
    0,
    Math.sin(R(ARMOUR.hull.upperGlacis.angle)),
    Math.cos(R(ARMOUR.hull.upperGlacis.angle)),
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

    // Glacis to superstructure side.
    weldJoint(
      ctx,
      [
        new Vector3(x, S(glacisFoot.y), S(glacisFoot.z)),
        new Vector3(x, S(glacisHead.y), S(glacisHead.z)),
      ],
      glacisNormal,
      outward,
      'fillet-8',
    );
  }

  // Glacis to roof, across the vehicle.
  weldJoint(
    ctx,
    [
      new Vector3(-half, S(HULL.roofY), S(roofFrontZ)),
      new Vector3(half, S(HULL.roofY), S(roofFrontZ)),
    ],
    glacisNormal,
    up,
    'fillet-8',
  );

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
