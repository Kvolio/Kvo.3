import { CatmullRomCurve3, Vector2, Vector3 } from 'three';
import { Region, WEAR } from '../../geom/attributes.js';
import { circle } from '../../geom/poly2.js';
import { R, S, mm, type MM } from '../../spec/units.js';
import { ARMOUR } from '../../spec/armour.js';
import { HULL } from '../../spec/hull.js';
import { FEIFEL } from '../../spec/powertrain.js';
import { emitRevolve } from '../../prims/lathe.js';
import { emitSweep } from '../../prims/sweep.js';
import type { BuildContext, PartResult } from '../types.js';

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
    const deckY = mm(HULL.roofY + FEIFEL.trunkRise);
    const trunkCurve = new CatmullRomCurve3(
      [
        new Vector3(S(x), S(topY), S(axisZ)),
        new Vector3(S(x), S(mm(deckY + FEIFEL.trunkRise)), S(mm(axisZ + FEIFEL.trunkRise / 2))),
        new Vector3(S(x), S(deckY), S(mm(HULL.rearZ + FEIFEL.trunkApproach))),
        new Vector3(
          S(mm(side * FEIFEL.trunkInboardX)),
          S(deckY),
          S(mm(HULL.engineDeck.hatchCentreZ - FEIFEL.trunkApproach)),
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
}
