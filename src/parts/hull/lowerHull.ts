import { Vector3 } from 'three';
import { Region, WEAR } from '../../geom/attributes.js';
import { rect, v2, type Poly2 } from '../../geom/poly2.js';
import { R, S, mm, deg, type MM } from '../../spec/units.js';
import { ARMOUR } from '../../spec/armour.js';
import { HULL, LOWER_HALF_WIDTH } from '../../spec/hull.js';
import { structuralPlate, weldJoint } from '../emit.js';
import type { BuildContext, PartResult } from '../types.js';
import { facingAft, facingDown, facingForward, facingOutboard, runFor, slantFor } from './frames.js';

/**
 * The lower hull — the Wanne.
 *
 * A plain welded box: belly, two side walls, a sloped nose and a sloped tail.
 * It carries the running gear and the torsion bars, and everything else on the
 * vehicle is built off it.
 *
 * NOT YET INTERLOCKED. Tiger hull plates were stepped and interlocked
 * (verzahnt) rather than butt-jointed, and `interlockEdge` exists and is tested
 * for exactly that. It is deliberately not applied here yet.
 *
 * An interlock is a matched pair: the teeth of one plate fill notches cut in
 * the other, and the combined envelope is unchanged. Cutting teeth into one
 * side only — which is what a naive application does — leaves them projecting
 * into thin air, and on the nose plate that put 50 mm of steel below the belly.
 * Applying it properly needs both mating plates authored together against a
 * shared joint line, which is a Stage 1 detail pass, not a structural one.
 *
 * Declared here and in the Gauntlet report rather than quietly dropped.
 */

export function buildLowerHull(ctx: BuildContext): PartResult {
  const start = ctx.render.triangleCount;
  const frames = new Map<string, ReturnType<typeof facingDown>>();

  const floorY = HULL.floorY;
  const noseTopY = HULL.noseTopY;
  const roofY = HULL.roofY;
  const sideThickness = ARMOUR.hull.sideLower.thickness;

  const noseRun = runFor(mm(noseTopY - floorY), ARMOUR.hull.nose.angle);
  const noseSlant = slantFor(mm(noseTopY - floorY), ARMOUR.hull.nose.angle);
  const noseBottomZ = mm(HULL.frontZ - noseRun);

  const rearRun = runFor(mm(roofY - floorY), ARMOUR.hull.rear.angle);
  const rearSlant = slantFor(mm(roofY - floorY), ARMOUR.hull.rear.angle);
  const rearBottomZ = mm(HULL.rearZ + rearRun);

  // ---------------------------------------------------------------------------
  // Belly
  //
  // The side walls run 5 mm past it, so the floor sits in a shallow tray rather
  // than flush — one of the small details that separates a hull that reads as
  // fabricated from one that reads as extruded.
  // ---------------------------------------------------------------------------
  const bellyWidth = mm(HULL.lowerWidth - sideThickness * 2);
  const bellyLength = mm(noseBottomZ - rearBottomZ);
  const bellyCentreZ = mm((noseBottomZ + rearBottomZ) / 2);

  const belly = structuralPlate(ctx, {
    outline: translateOutline(rect(bellyWidth, bellyLength), 0, -bellyCentreZ),
    thickness: ARMOUR.hull.floor.thickness,
    frame: facingDown(mm(floorY + ARMOUR.hull.sideWallProudOfBelly)),
    chamfer: HULL.chamfer.belly,
    region: Region.Exterior,
    materials: { inner: 'oiledFloorSteel' },
    // The crew's boots are on the other side of this plate all day.
    wear: WEAR.footTraffic,
  });

  // ---------------------------------------------------------------------------
  // Lower side walls
  //
  // Authored as a side profile in (aft-forward, up) and placed outboard. Both
  // sides use the same outline; `facingOutboard` handles the handedness.
  // ---------------------------------------------------------------------------
  const sideProfile: Poly2 = [
    v2(rearBottomZ, floorY),
    v2(noseBottomZ, floorY),
    v2(HULL.frontZ, noseTopY),
    v2(HULL.frontZ, HULL.sponsonFloorY),
    v2(HULL.rearZ, HULL.sponsonFloorY),
    v2(HULL.rearZ, floorY),
  ];
  for (const side of ['left', 'right'] as const) {
    structuralPlate(ctx, {
      outline: sideProfile,
      thickness: sideThickness,
      frame: facingOutboard(side, LOWER_HALF_WIDTH),
      chamfer: HULL.chamfer.side,
      region: Region.Exterior,
      materials: { inner: 'interiorIvoryPaint' },
    });
  }

  // ---------------------------------------------------------------------------
  // Nose and tail
  // ---------------------------------------------------------------------------
  const nosePlate = structuralPlate(ctx, {
    outline: rect(HULL.lowerWidth, mm(noseSlant)),
    thickness: ARMOUR.hull.nose.thickness,
    frame: facingForward(
      mm((HULL.frontZ + noseBottomZ) / 2),
      mm((floorY + noseTopY) / 2),
      ARMOUR.hull.nose.angle,
    ),
    chamfer: HULL.chamfer.structural,
    region: Region.Exterior,
    materials: { inner: 'interiorIvoryPaint' },
    namedEdges: [{ name: 'top', from: 2, to: 3 }],
  });

  const rearPlate = structuralPlate(ctx, {
    outline: rect(HULL.lowerWidth, mm(rearSlant)),
    thickness: ARMOUR.hull.rear.thickness,
    frame: facingAft(
      mm((HULL.rearZ + rearBottomZ) / 2),
      mm((floorY + roofY) / 2),
      ARMOUR.hull.rear.angle,
    ),
    chamfer: HULL.chamfer.structural,
    region: Region.Exterior,
    materials: { inner: 'interiorIvoryPaint' },
    namedEdges: [{ name: 'top', from: 2, to: 3 }],
  });

  // ---------------------------------------------------------------------------
  // Welds along the long structural joints
  // ---------------------------------------------------------------------------
  const halfW = S(LOWER_HALF_WIDTH);
  const outward = (side: 'left' | 'right'): Vector3 =>
    new Vector3(side === 'left' ? -1 : 1, 0, 0);

  for (const side of ['left', 'right'] as const) {
    const x = side === 'left' ? -halfW : halfW;
    const y = S(mm(floorY + ARMOUR.hull.sideWallProudOfBelly));

    // Belly to side wall, the full length of the hull.
    weldJoint(
      ctx,
      [new Vector3(x, y, S(rearBottomZ)), new Vector3(x, y, S(noseBottomZ))],
      new Vector3(0, -1, 0),
      outward(side),
      'fillet-12',
    );

    // Nose to side wall, up the slope.
    weldJoint(
      ctx,
      [
        new Vector3(x, S(floorY), S(noseBottomZ)),
        new Vector3(x, S(noseTopY), S(HULL.frontZ)),
      ],
      noseNormal(),
      outward(side),
      'fillet-12',
    );

    // Rear plate to side wall.
    weldJoint(
      ctx,
      [
        new Vector3(x, S(floorY), S(rearBottomZ)),
        new Vector3(x, S(roofY), S(HULL.rearZ)),
      ],
      rearNormal(),
      outward(side),
      'fillet-12',
    );
  }

  // Belly to nose, across the front.
  weldJoint(
    ctx,
    [
      new Vector3(-halfW, S(floorY), S(noseBottomZ)),
      new Vector3(halfW, S(floorY), S(noseBottomZ)),
    ],
    new Vector3(0, -1, 0),
    noseNormal(),
    'fillet-12',
  );

  // Belly to rear plate.
  weldJoint(
    ctx,
    [
      new Vector3(-halfW, S(floorY), S(rearBottomZ)),
      new Vector3(halfW, S(floorY), S(rearBottomZ)),
    ],
    new Vector3(0, -1, 0),
    rearNormal(),
    'fillet-12',
  );

  frames.set('noseTop', facingForward(HULL.frontZ, noseTopY, ARMOUR.hull.nose.angle));
  frames.set('rearTop', facingAft(HULL.rearZ, roofY, ARMOUR.hull.rear.angle));

  void belly;
  void nosePlate;
  void rearPlate;
  void rearRun;

  return {
    name: 'lowerHull',
    triangleCount: ctx.render.triangleCount - start,
    collision: [],
    frames,
  };
}

/** Outward normal of the nose plate: forward and down. */
function noseNormal(): Vector3 {
  const t = R(ARMOUR.hull.nose.angle);
  return new Vector3(0, -Math.sin(t), Math.cos(t));
}

/** Outward normal of the rear plate: aft and down. */
function rearNormal(): Vector3 {
  const t = R(ARMOUR.hull.rear.angle);
  return new Vector3(0, -Math.sin(t), -Math.cos(t));
}

/** Shift a polygon, since outlines are authored centred but placed absolutely. */
function translateOutline(poly: Poly2, dx: number, dy: number): Poly2 {
  return poly.map((p) => v2(p.x + dx, p.y + dy));
}

export const LOWER_HULL_ANGLES = {
  nose: ARMOUR.hull.nose.angle,
  rear: ARMOUR.hull.rear.angle,
  glacis: deg(ARMOUR.hull.upperGlacis.angle),
} as const;

export type { MM };
