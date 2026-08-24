import { Matrix4, Vector2, Vector3 } from 'three';
import { Region, WEAR } from '../../geom/attributes.js';
import { circle, rect, roundedRect, v2, type Poly2 } from '../../geom/poly2.js';
import { emitRevolve } from '../../prims/lathe.js';
import { R, S, mm, sideSign, type MM } from '../../spec/units.js';
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
import { facingForward, facingOutboard, facingUp } from './frames.js';

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
    // The flat run ends square at the hinge line; the angled flap beyond it is
    // built separately. The January 1943 triangular treatment is on the TAIL.
    v2(LOWER_HALF_WIDTH, g.frontZ),
    v2(g.outerX, g.frontZ),
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
  buildGuardLipAndBrackets(ctx);
  buildGuardFrontFlap(ctx);
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
 * The hinged front section, angling DOWN over the drive sprocket.
 *
 * A Tiger's front fender is not the flat run carried straight on: it hinges
 * just ahead of the sprocket and drops. Extending the flat plate instead left a
 * wing projecting past the nose at guard height with nothing under it, which is
 * what the critics kept reporting as stray or drooping geometry.
 */
function buildGuardFrontFlap(ctx: BuildContext): void {
  const g = HULL.trackGuard;
  const topY = mm(g.height + ARMOUR.hull.roof.thickness);
  const drop = Math.atan2(g.frontFlapDrop, g.frontFlapRun);
  const slant = Math.hypot(g.frontFlapRun, g.frontFlapDrop);

  for (const side of SIDES) {
    const sign = sideSign(side);
    const frame = facingUp(mm(0)).makeRotationX(-Math.PI / 2 + drop);
    frame.setPosition(
      S(mm((sign * (LOWER_HALF_WIDTH + g.outerX)) / 2)),
      S(mm(topY - g.frontFlapDrop / 2)),
      S(mm(g.frontZ + g.frontFlapRun / 2)),
    );
    structuralPlate(ctx, {
      outline: rect(mm(g.outerX - LOWER_HALF_WIDTH), mm(slant)),
      thickness: g.thickness,
      frame,
      chamfer: HULL.chamfer.side,
      region: Region.Exterior,
      materials: {
        inner: 'armourPaintedExterior',
        outer: 'armourPaintedExterior',
        edge: 'armourPaintedExterior',
      },
      wear: WEAR.footTraffic,
      edgeBandWidth: HULL.interiorEdgeBand,
    });
  }
}

/**
 * The guard's downturned outer lip, and the brackets carrying it.
 *
 * A 6 mm sheet seen edge-on is a sliver of foil with nothing holding it up,
 * which is what the guards looked like. The real fender has a folded lip along
 * its outer edge and hangs off the sponson on brackets.
 */
function buildGuardLipAndBrackets(ctx: BuildContext): void {
  const g = HULL.trackGuard;
  const topY = mm(g.height + ARMOUR.hull.roof.thickness);
  const sponsonFrontZ = driverPlateOuterZ(HULL.sponsonFloorY);

  for (const side of SIDES) {
    const sign = sideSign(side);

    // The lip: a vertical strip hanging off the guard's outer edge, running the
    // length of the straight section.
    const lip = facingOutboard(side, g.outerX);
    lip.setPosition(
      S(mm(sign * g.outerX)),
      S(mm(topY - g.lipDepth / 2)),
      S(mm((g.frontZ - g.frontTriangleRun + g.rearZ + g.rearTriangleRun) / 2)),
    );
    structuralPlate(ctx, {
      outline: rect(
        mm(g.frontZ - g.frontTriangleRun - (g.rearZ + g.rearTriangleRun)),
        g.lipDepth,
      ),
      thickness: g.lipThickness,
      frame: lip,
      chamfer: HULL.chamfer.side,
      region: Region.Exterior,
      materials: {
        inner: 'armourPaintedExterior',
        outer: 'armourPaintedExterior',
        edge: 'armourPaintedExterior',
      },
      wear: WEAR.footTraffic,
      edgeBandWidth: HULL.interiorEdgeBand,
    });

    // Brackets, evenly spaced along the sponson.
    for (let i = 0; i < g.brackets; i++) {
      const t = (i + 0.5) / g.brackets;
      const z = mm(sponsonFrontZ - (sponsonFrontZ - g.rearZ) * t);
      const bracket = facingOutboard(side, mm(HULL.superstructureWidth / 2));
      bracket.setPosition(
        S(mm((sign * (HULL.superstructureWidth / 2 + g.outerX)) / 2)),
        S(mm(topY - g.lipDepth / 2)),
        S(z),
      );
      structuralPlate(ctx, {
        outline: rect(g.bracketWidth, g.lipDepth),
        thickness: mm(g.outerX - HULL.superstructureWidth / 2),
        frame: bracket,
        chamfer: HULL.chamfer.side,
        region: Region.Exterior,
        materials: {
          inner: 'machinedSteel',
          outer: 'machinedSteel',
          edge: 'machinedSteel',
        },
        edgeBandWidth: HULL.interiorEdgeBand,
      });
    }
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
  const lug: Poly2 = roundedRect(t.width, t.height, mm(t.height / 3), 4);
  const eye: Poly2 = circle(mm(t.eyeDiameter / 2), FITTING_SEGMENTS);

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
  const baseY = glacisOuterY(h.standZ);

  for (const side of SIDES) {
    const sign = sideSign(side);
    const x = mm(sign * h.centreX);

    // The pedestal, standing up off the glacis.
    emitRevolve(ctx.render, {
      profile: [
        new Vector2(0, S(baseY)),
        new Vector2(S(mm(h.pedestalDiameter / 2)), S(baseY)),
        new Vector2(S(mm(h.pedestalDiameter / 2)), S(mm(baseY + h.pedestalHeight))),
        new Vector2(0, S(mm(baseY + h.pedestalHeight))),
      ],
      segments: LAMP_SEGMENTS,
      material: 'machinedSteel',
      region: Region.Exterior,
      origin: new Vector3(S(x), 0, S(h.standZ)),
      edgeDist: FITTING_EDGE_DIST,
    });

    // The lamp itself, LENS FORWARD.
    //
    // This was revolved about the world vertical, which pointed the lens at the
    // sky — visible in the plan view as two bright discs and invisible from the
    // front, where a headlight is the one place it needs to be seen. The drum is
    // built upright and laid over, the same way a road wheel is.
    const lampY = mm(baseY + h.pedestalHeight + h.diameter / 2);
    const frame = new Matrix4().makeRotationX(-Math.PI / 2);
    frame.setPosition(S(x), S(lampY), S(h.standZ));

    emitRevolve(ctx.render, {
      profile: [
        // Back of the housing, then out to the rim and back into the bowl, so
        // the reflector is a real recess rather than a flat disc.
        new Vector2(0, S(mm(-h.depth / 2))),
        new Vector2(S(mm(h.diameter / 2)), S(mm(-h.depth / 2))),
        new Vector2(S(mm(h.diameter / 2)), S(mm(h.depth / 2))),
        new Vector2(S(mm(h.diameter / 2 - h.rimWidth)), S(mm(h.depth / 2))),
        new Vector2(S(mm(h.diameter / 2 - h.rimWidth)), S(mm(h.depth / 2 - h.bowlDepth))),
        new Vector2(0, S(mm(h.depth / 2 - h.bowlDepth))),
      ],
      segments: LAMP_SEGMENTS,
      material: 'machinedSteel',
      region: Region.Exterior,
      frame,
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
