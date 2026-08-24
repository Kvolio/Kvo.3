import { CatmullRomCurve3, Vector2, Vector3 } from 'three';
import { Region, WEAR } from '../../geom/attributes.js';
import { circle, roundedRect, translate } from '../../geom/poly2.js';
import { R, S, SIDES, mm, sideSign, type MM } from '../../spec/units.js';
import { ARMOUR } from '../../spec/armour.js';
import { HULL } from '../../spec/hull.js';
import { FEIFEL } from '../../spec/powertrain.js';
import { emitRevolve } from '../../prims/lathe.js';
import { emitSweep } from '../../prims/sweep.js';
import { structuralPlate } from '../emit.js';
import type { BuildContext, PartResult } from '../types.js';
import { facingAft } from './frames.js';

/**
 * Rear plate fittings: the Feifel air pre-cleaners and the exhaust stacks.
 *
 * The Feifel system is one of the tightest markers this vehicle has. It was
 * fitted from November 1942, redesigned to a flatter oval canister in March
 * 1943, and deleted in October 1943 — so the tall round canisters put the
 * vehicle inside a five-month window, and they are what dates the supplied
 * orthographic drawing to the same period.
 *
 * Both are excluded by variant rather than by comment: a later configuration
 * returns null here and the parts simply do not exist.
 */

/** Radial segments for the canister body and the flexible trunk. */
const CANISTER_SEGMENTS = 28;
const TRUNK_SEGMENTS = 12;
/** Samples along the trunk's curve. Enough that the bends read as flexible. */
const TRUNK_PATH_SAMPLES = 28;
/**
 * Catmull-Rom tension for the trunk's bends. A shape parameter rather than a
 * measurement, so it stays here: putting it in the spec would mean inventing a
 * source and a tolerance for it, which would weaken what provenance means for
 * everything that genuinely has one.
 */
const TRUNK_CURVE_TENSION = 0.4;

/** Radial segments on the intake drum. */
const INTAKE_SEGMENTS = 28;


/** Reported distance from a structural edge, for the chipping shader. */
const INTAKE_EDGE_DIST = 45;
const STACK_SEGMENTS = 20;
/** Millimetres from the nearest edge, for the chipping shader on a rolled body. */
const CANISTER_EDGE_DISTANCE = 30;

/** Outer face of the rear plate at a given height. */
function rearPlateOuterZ(y: MM): MM {
  return mm(HULL.rearZ + (HULL.roofY - y) * Math.tan(R(ARMOUR.hull.rear.angle)));
}

export function buildRearFittings(ctx: BuildContext): PartResult | null {
  const hasFeifel = ctx.variant.airCleaner !== 'none';
  const start = ctx.render.triangleCount;

  buildExhausts(ctx);
  if (hasFeifel) buildFeifel(ctx);

  return {
    name: 'rearFittings',
    triangleCount: ctx.render.triangleCount - start,
    collision: [],
    frames: new Map(),
    // Canister proportions are scaled from the drawing's rear view rather than
    // dimensioned anywhere, so this assembly is declared as reconstruction.
    reconstructed: true,
  };
}

/** Exhaust stacks, with the armoured guards added in January 1943. */
function buildExhausts(ctx: BuildContext): void {
  const { exhaust } = HULL;
  const baseY = exhaust.baseY;
  const pipeRadius = mm(exhaust.diameter / 2);
  const guardRadius = mm(exhaust.guardDiameter / 2);

  for (const side of [-1, 1] as const) {
    const axisZ = mm(rearPlateOuterZ(mm(baseY + exhaust.height / 2)) - guardRadius);
    const origin = new Vector3(S(mm(side * exhaust.centreX)), S(baseY), S(axisZ));

    // The stack itself: a tube, because an exhaust is open at the top and the
    // player can walk up and look down it.
    emitRevolve(ctx.render, {
      profile: [
        new Vector2(S(mm(pipeRadius - exhaust.wallThickness)), 0),
        new Vector2(S(pipeRadius), 0),
        new Vector2(S(pipeRadius), S(exhaust.height)),
        new Vector2(S(mm(pipeRadius - exhaust.wallThickness)), S(exhaust.height)),
        new Vector2(S(mm(pipeRadius - exhaust.wallThickness)), 0),
      ],
      segments: STACK_SEGMENTS,
      material: 'exhaustSteel',
      region: Region.Exterior,
      origin,
      edgeDist: 0,
    });

    // Armoured guard around the base.
    emitRevolve(ctx.render, {
      profile: [
        new Vector2(S(mm(guardRadius - exhaust.guardWallThickness)), 0),
        new Vector2(S(guardRadius), 0),
        new Vector2(S(guardRadius), S(exhaust.guardHeight)),
        new Vector2(S(mm(guardRadius - exhaust.guardWallThickness)), S(exhaust.guardHeight)),
        new Vector2(S(mm(guardRadius - exhaust.guardWallThickness)), 0),
      ],
      segments: STACK_SEGMENTS,
      material: 'exhaustSteel',
      region: Region.Exterior,
      origin,
      edgeDist: 0,
    });

    ctx.fasteners.addRing(
      'hexBolt',
      new Vector3(
        origin.x,
        S(mm(baseY + exhaust.guardBoltHeight)),
        S(mm(axisZ + exhaust.guardBoltPlaneOffset)),
      ),
      new Vector3(0, 0, -1),
      S(exhaust.guardBoltCircleRadius),
      exhaust.guardBoltCount,
      { region: Region.Exterior },
    );
  }
}

/**
 * Feifel pre-cleaners: the early round type, with eighteen cyclone tubes inside
 * and a flexible trunk running forward to the engine deck.
 */
function buildFeifel(ctx: BuildContext): void {
  const radius = mm(FEIFEL.canisterDiameter / 2);
  const baseY = FEIFEL.baseY;
  const midY = mm(baseY + FEIFEL.canisterHeight / 2);
  const topY = mm(baseY + FEIFEL.canisterHeight);

  for (const side of [-1, 1] as const) {
    const axisZ = mm(rearPlateOuterZ(midY) - radius);
    const x = mm(side * FEIFEL.centreX);
    const origin = new Vector3(S(x), S(baseY), S(axisZ));

    // Body: a rolled rim at the base, a straight middle, and a domed cap. The
    // dust bins are beneath, the clean-air outlet on top.
    emitRevolve(ctx.render, {
      profile: FEIFEL.profileRadius.map(
        (r, i) => new Vector2(S(mm(r)), S(mm(FEIFEL.profileHeight[i] ?? 0))),
      ),
      segments: CANISTER_SEGMENTS,
      material: 'armourPaintedExterior',
      region: Region.Exterior,
      origin,
      edgeDist: CANISTER_EDGE_DISTANCE,
      wear: WEAR.incidental,
    });

    // Four mounting bolts to the rear plate, as the fitting instructions call for.
    ctx.fasteners.addRing(
      'hexBolt',
      new Vector3(S(x), S(midY), S(mm(axisZ + FEIFEL.boltPlaneOffset))),
      new Vector3(0, 0, -1),
      S(FEIFEL.boltCircleRadius),
      FEIFEL.mountingBoltsPerCanister,
      { region: Region.Exterior },
    );

    // Trunk from the canister's outlet forward onto the engine deck, where the
    // V-duct replaces the standard cover over the hatch's front slot.
    // Flexible metal trunk, so it is drawn as a curve rather than as straight
    // runs meeting at a corner. A right angle here reads as rigid pipe, which
    // is exactly what this is not.
    //
    // The trunk's axis rests `trunkRise` above the roof once it is on the deck.
    // The bend that gets it there must not climb ABOVE that resting height: the
    // trunking in the photographs is a low hump over the rear of the deck, not
    // an arch. The intermediate control point therefore sits at the resting
    // height and only carries the curve forward over the rear plate's top edge.
    const deckY = mm(HULL.roofY + FEIFEL.trunkRise);
    // The trunk ends ON the intake manifold, not in mid-deck. It used to stop
    // short with an open cap, which was Gauntlet finding 2.4; the plan view
    // shows both trunks converging on a drum on the centreline, and that drum
    // now exists for them to reach.
    const intake = HULL.engineDeck;
    const trunkCurve = new CatmullRomCurve3(
      [
        new Vector3(S(x), S(topY), S(axisZ)),
        new Vector3(S(x), S(deckY), S(mm(axisZ + FEIFEL.trunkBendRun))),
        new Vector3(S(x), S(deckY), S(mm(HULL.rearZ + FEIFEL.trunkApproach))),
        new Vector3(
          S(mm(side * FEIFEL.trunkInboardX)),
          S(deckY),
          S(mm(intake.intakeCentreZ - FEIFEL.trunkApproach)),
        ),
        // Into the drum's flank, far enough in that the joint is buried.
        new Vector3(
          S(mm((side * intake.intakeDiameter) / 3)),
          S(deckY),
          S(intake.intakeCentreZ),
        ),
      ],
      false,
      'catmullrom',
      TRUNK_CURVE_TENSION,
    );

    emitSweep(ctx.render, {
      profile: circle(S(mm(FEIFEL.trunkDiameter / 2)), TRUNK_SEGMENTS).map(
        (p) => new Vector2(p.x, p.y),
      ),
      path: trunkCurve.getPoints(TRUNK_PATH_SAMPLES),
      material: 'exhaustSteel',
      region: Region.Exterior,
      cap: true,
    });
  }

  buildIntakeManifold(ctx);
  buildRearPlateFittings(ctx);
}

/**
 * The crank port, the towing coupling and the corner shackles.
 *
 * The rear plate was a featureless slab. A Tiger's is not: the inertia starter
 * is cranked through an oval port on the centreline, there is a heavy towing
 * coupling below it, and a shackle lug at each lower corner.
 */
function buildRearPlateFittings(ctx: BuildContext): void {
  const r = HULL.rearPlate;
  const tilt = ARMOUR.hull.rear.angle;

  /** A fitting standing proud of the rear plate at a given height. */
  const onRearPlate = (y: MM, proud: MM): ReturnType<typeof facingAft> =>
    facingAft(
      mm(rearPlateOuterZ(y) - proud * Math.cos(R(tilt))),
      y,
      tilt,
    );

  // The oval crank port: a raised bezel with the opening through it.
  structuralPlate(ctx, {
    outline: roundedRect(
      r.crankPortWidth,
      r.crankPortHeight,
      mm(r.crankPortHeight / 2),
      REAR_CORNER_SEGMENTS,
    ),
    holes: [
      roundedRect(
        mm(r.crankPortWidth - r.crankPortBezel * 2),
        mm(r.crankPortHeight - r.crankPortBezel * 2),
        mm(r.crankPortHeight / 2 - r.crankPortBezel),
        REAR_CORNER_SEGMENTS,
      ),
    ],
    thickness: r.crankPortProud,
    frame: onRearPlate(r.crankPortCentreY, r.crankPortProud),
    chamfer: HULL.chamfer.side,
    region: Region.Exterior,
    materials: {
      inner: 'armourPaintedExterior',
      outer: 'armourPaintedExterior',
      edge: 'armourPaintedExterior',
    },
    edgeBandWidth: HULL.interiorEdgeBand,
  });

  // The cover over it. Without one the port is an open hole looking straight
  // into the engine bay's ivory paint, which reads as a bright white panel on
  // the back of the tank.
  structuralPlate(ctx, {
    outline: roundedRect(
      mm(r.crankPortWidth - r.crankPortBezel),
      mm(r.crankPortHeight - r.crankPortBezel),
      mm(r.crankPortHeight / 2 - r.crankPortBezel / 2),
      REAR_CORNER_SEGMENTS,
    ),
    thickness: r.crankPortProud,
    frame: onRearPlate(r.crankPortCentreY, mm(r.crankPortProud * 2)),
    chamfer: HULL.chamfer.side,
    region: Region.Exterior,
    materials: {
      inner: 'armourPaintedExterior',
      outer: 'armourPaintedExterior',
      edge: 'armourPaintedExterior',
    },
    wear: WEAR.handled,
    edgeBandWidth: HULL.interiorEdgeBand,
  });

  // The towing coupling.
  structuralPlate(ctx, {
    outline: roundedRect(r.hitchWidth, r.hitchHeight, mm(r.hitchHeight / 3), REAR_CORNER_SEGMENTS),
    holes: [circle(mm(r.hitchHeight / 4), REAR_CORNER_SEGMENTS * 2)],
    thickness: r.hitchProud,
    frame: onRearPlate(r.hitchCentreY, r.hitchProud),
    chamfer: HULL.chamfer.structural,
    region: Region.Exterior,
    materials: {
      inner: 'machinedSteel',
      outer: 'machinedSteel',
      edge: 'machinedSteel',
    },
    wear: WEAR.handled,
    edgeBandWidth: HULL.interiorEdgeBand,
  });

  // A shackle lug at each lower corner, the same forging as the nose lugs.
  const t = HULL.towPoint;
  for (const side of SIDES) {
    const x = mm(sideSign(side) * r.shackleCentreX);
    structuralPlate(ctx, {
      outline: translate(
        roundedRect(t.width, t.height, mm(t.height / 3), REAR_CORNER_SEGMENTS),
        x,
        0,
      ),
      holes: [translate(circle(mm(t.eyeDiameter / 2), REAR_CORNER_SEGMENTS * 2), x, 0)],
      thickness: t.thickness,
      frame: onRearPlate(r.shackleCentreY, t.thickness),
      chamfer: HULL.chamfer.structural,
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

/** Segments around one rounded corner of a rear-plate fitting. */
const REAR_CORNER_SEGMENTS = 5;


/**
 * The Feifel intake manifold: the drum on the centreline that both trunks feed.
 *
 * Filtered air arrives here from the two pre-cleaners and goes down into the
 * engine bay, so the drum sits over an opening rather than on solid roof.
 */
function buildIntakeManifold(ctx: BuildContext): void {
  const deck = HULL.engineDeck;
  const roofTop = mm(HULL.roofY);
  const radius = mm(deck.intakeDiameter / 2);

  emitRevolve(ctx.render, {
    profile: [
      new Vector2(0, S(roofTop)),
      new Vector2(S(radius), S(roofTop)),
      new Vector2(S(radius), S(mm(roofTop + deck.intakeHeight - deck.intakeCrown))),
      // Crowned rather than flat-topped, so rain runs off it the way it does
      // in the photographs.
      new Vector2(S(mm(radius - deck.intakeCrown)), S(mm(roofTop + deck.intakeHeight))),
      new Vector2(0, S(mm(roofTop + deck.intakeHeight))),
    ],
    segments: INTAKE_SEGMENTS,
    material: 'exhaustSteel',
    region: Region.Exterior,
    origin: new Vector3(0, 0, S(deck.intakeCentreZ)),
    edgeDist: INTAKE_EDGE_DIST,
  });
}
