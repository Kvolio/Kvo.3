import { Vector2, Vector3 } from 'three';
import { Region, WEAR } from '../../geom/attributes.js';
import { circle, v2, type Poly2 } from '../../geom/poly2.js';
import { emitRevolve } from '../../prims/lathe.js';
import { R, S, mm, type MM } from '../../spec/units.js';
import { ARMOUR } from '../../spec/armour.js';
import {
  HULL,
  LOWER_HALF_WIDTH,
  SPONSON_HALF_WIDTH,
  driverPlateOuterZ,
  glacisOuterY,
} from '../../spec/hull.js';
import { structuralPlate } from '../emit.js';
import type { BuildContext, PartResult } from '../types.js';
import { facingForward, facingUp } from './frames.js';

/**
 * Everything bolted to the outside of the hull: track guards, tow shackles,
 * headlights and the S-mine dischargers.
 *
 * None of it is armour, and that is the point — a Tiger with none of it reads
 * as a shape rather than as a vehicle. The track guards in particular change
 * the silhouette: they are what the 1:50 drawing shows projecting ahead of the
 * nose, and reading that edge as armour is what makes the front look like a
 * vertical slab six hundred millimetres tall.
 */

/** Radial segments on the small cylindrical fittings. */
const FITTING_SEGMENTS = 20;

/** Segments on a headlight body, which is looked at closely. */
const LAMP_SEGMENTS = 24;

/** Both sides, as the builders iterate them. */
const SIDES = ['left', 'right'] as const;

/**
 * The plan-view outline of one track guard, on the PORT side.
 *
 * Stepped, because the guard has different work to do along its length. Beside
 * the superstructure the sponson already overhangs most of the track, so only a
 * narrow strip is left to cover; ahead of the sponson the guard has to span the
 * full track width on its own.
 */
function guardOutline(): Poly2 {
  const g = HULL.trackGuard;
  const sponsonFrontZ = driverPlateOuterZ(HULL.sponsonFloorY);

  return [
    // Forward tip: swept back from the outboard corner, which is the January
    // 1943 triangular front section.
    v2(LOWER_HALF_WIDTH, g.frontZ),
    v2(g.outerX, mm(g.frontZ - g.frontTriangleRun)),
    v2(g.outerX, mm(g.rearZ + g.rearTriangleRun)),
    v2(SPONSON_HALF_WIDTH, g.rearZ),
    // Inboard edge runs against the sponson side for as long as there is one.
    v2(SPONSON_HALF_WIDTH, sponsonFrontZ),
    v2(LOWER_HALF_WIDTH, sponsonFrontZ),
  ];
}

/**
 * Put a port-side plan outline onto the given side.
 *
 * A horizontal plate's local Y runs aft-negative, so a plan outline written as
 * (x, worldZ) has to be flipped in Y as well as mirrored in X. Getting only the
 * first of those right produces a guard that is the correct shape and points
 * the wrong way, which is exactly the fault that reversed a side plate earlier.
 */
function planOutline(side: (typeof SIDES)[number], poly: Poly2): Poly2 {
  const sign = side === 'left' ? 1 : -1;
  const mapped = poly.map((p) => new Vector2(sign * p.x, -p.y));
  return sign === 1 ? mapped : mapped.reverse();
}

function buildTrackGuards(ctx: BuildContext): void {
  const g = HULL.trackGuard;
  // Top surface flush with the sponson floor's, so a crewman steps from guard
  // to sponson without a lip in the way. Hanging the guard's UNDERSIDE at that
  // height instead leaves a six-millimetre kerb the whole length of the tank.
  const walkingSurfaceY = mm(g.height + ARMOUR.hull.roof.thickness);
  for (const side of SIDES) {
    structuralPlate(ctx, {
      outline: planOutline(side, guardOutline()),
      thickness: g.thickness,
      frame: facingUp(walkingSurfaceY),
      chamfer: HULL.chamfer.side,
      region: Region.Exterior,
      materials: { inner: 'armourPaintedExterior', outer: 'armourPaintedExterior' },
      // Crews walked these constantly and they took the worst of the mud.
      wear: WEAR.footTraffic,
    });
  }
}

/**
 * Tow shackle lugs, a pair at each end.
 *
 * Built on the plates they belong to rather than floating at a remembered
 * height: the nose lugs follow the nose's rake, so moving the nose moves them.
 */
function buildTowPoints(ctx: BuildContext): void {
  const t = HULL.towPoint;
  const lug: Poly2 = [
    v2(mm(-t.width / 2), mm(-t.width / 2)),
    v2(mm(t.width / 2), mm(-t.width / 2)),
    v2(mm(t.width / 2), mm(t.width / 2)),
    v2(mm(-t.width / 2), mm(t.width / 2)),
  ];
  const eye: Poly2 = circle(mm(t.width / 4), FITTING_SEGMENTS);

  for (const side of SIDES) {
    const sign = side === 'left' ? 1 : -1;
    // Nose lugs, standing proud of the nose plate along its own normal.
    structuralPlate(ctx, {
      outline: lug.map((p) => new Vector2(p.x + sign * t.centreX, p.y)),
      holes: [eye.map((p) => new Vector2(p.x + sign * t.centreX, p.y))],
      thickness: t.thickness,
      frame: facingForward(
        mm(HULL.frontZ - (HULL.noseTopY - t.frontY) * Math.tan(R(ARMOUR.hull.nose.angle))),
        t.frontY,
        ARMOUR.hull.nose.angle,
      ),
      chamfer: HULL.chamfer.structural,
      region: Region.Exterior,
      materials: { inner: 'machinedSteel', outer: 'machinedSteel' },
    });
  }
}

/**
 * The two Bosch headlights on the glacis.
 *
 * Two of them only until August 1943, when a single centreline lamp replaced
 * the pair; the variant flag carries that, so a later Tiger built from this
 * same code gets one.
 */
function buildHeadlights(ctx: BuildContext): void {
  if (ctx.variant.headlights !== 'dual-bosch') return;

  const h = HULL.headlight;
  for (const side of SIDES) {
    const sign = side === 'left' ? 1 : -1;
    const x = mm(sign * h.centreX);
    // Standing on the glacis, at the height the glacis actually is beneath it.
    const baseY = glacisOuterY(HULL.headlight.standZ);
    emitRevolve(ctx.render, {
      profile: [
        new Vector2(0, S(baseY)),
        new Vector2(S(mm(h.diameter / 3)), S(baseY)),
        new Vector2(S(mm(h.diameter / 3)), S(mm(baseY + h.depth / 2))),
        new Vector2(S(mm(h.diameter / 2)), S(mm(baseY + h.depth / 2))),
        new Vector2(S(mm(h.diameter / 2)), S(mm(baseY + h.depth))),
        new Vector2(0, S(mm(baseY + h.depth))),
      ],
      segments: LAMP_SEGMENTS,
      material: 'machinedSteel',
      region: Region.Exterior,
      origin: new Vector3(S(x), 0, S(HULL.headlight.standZ)),
      edgeDist: FITTING_EDGE_DIST,
    });
  }
}

/** S-mine dischargers on the superstructure roof edge. */
function buildSMineDischargers(ctx: BuildContext): void {
  if (!ctx.variant.sMineDischargers) return;

  const d = HULL.sMineDischarger;
  const roofTop = mm(HULL.roofY);

  const emitOne = (x: MM, z: MM): void => {
    emitRevolve(ctx.render, {
      profile: [
        new Vector2(0, S(roofTop)),
        new Vector2(S(mm(d.baseDiameter / 2)), S(roofTop)),
        new Vector2(S(mm(d.baseDiameter / 2)), S(mm(roofTop + d.baseHeight))),
        new Vector2(S(mm(d.tubeDiameter / 2)), S(mm(roofTop + d.baseHeight))),
        new Vector2(S(mm(d.tubeDiameter / 2)), S(mm(roofTop + d.baseHeight + d.tubeHeight))),
        // Open at the top: it is a mortar tube, and one that reads as a solid
        // peg is a peg.
        new Vector2(
          S(mm(d.tubeDiameter / 2 - d.wallThickness)),
          S(mm(roofTop + d.baseHeight + d.tubeHeight)),
        ),
        new Vector2(S(mm(d.tubeDiameter / 2 - d.wallThickness)), S(mm(roofTop + d.baseHeight))),
        new Vector2(0, S(mm(roofTop + d.baseHeight))),
      ],
      segments: FITTING_SEGMENTS,
      material: 'exhaustSteel',
      region: Region.Exterior,
      origin: new Vector3(S(x), 0, S(z)),
      edgeDist: FITTING_EDGE_DIST,
    });
  };

  for (const side of SIDES) {
    const sign = side === 'left' ? 1 : -1;
    const x = mm(sign * (SPONSON_HALF_WIDTH - d.inset));
    for (const z of d.stationsZ) emitOne(x, z);
  }
  emitOne(mm(0), d.rearStationZ);
}

/** Reported distance from a structural edge, for the chipping shader. */
const FITTING_EDGE_DIST = 40;


export function buildFittings(ctx: BuildContext): PartResult {
  const start = ctx.render.triangleCount;

  buildTrackGuards(ctx);
  buildTowPoints(ctx);
  buildHeadlights(ctx);
  buildSMineDischargers(ctx);

  return {
    name: 'fittings',
    triangleCount: ctx.render.triangleCount - start,
    collision: [],
    frames: new Map(),
  };
}
