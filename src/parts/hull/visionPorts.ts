import { Matrix4, Vector2 } from 'three';
import { Region, WEAR } from '../../geom/attributes.js';
import { roundedRect, translate, type Poly2 } from '../../geom/poly2.js';
import { emitRevolve } from '../../prims/lathe.js';
import { R, S, mm, type MM } from '../../spec/units.js';
import { ARMOUR } from '../../spec/armour.js';
import { HULL, driverPlateOuterZ } from '../../spec/hull.js';
import { structuralPlate } from '../emit.js';
import type { BuildContext, PartResult } from '../types.js';
import { facingForward } from './frames.js';

/**
 * The driver's visor and the hull machine gun's ball mount.
 *
 * Both were bare holes in the driver's plate. Neither is a hole on the real
 * vehicle: the Fahrersehklappe is a raised armoured housing with a shutter
 * running in guides, and the Kugelblende is a spherical casting turning in a
 * collar. In both supplied photographs they are the strongest shadows on the
 * front of the tank, and as apertures alone they read as a letterbox and a
 * drainpipe cut into a wall.
 *
 * The apertures themselves stay genuinely open — the R1 vision tests fire rays
 * from each crew station through them and are the check that adding detail has
 * not sealed either port.
 */

/** Segments on the ball and its collar. Both are looked at closely. */
const BALL_SEGMENTS = 28;

/** Segments around one rounded corner of the visor housing. */
const HOUSING_CORNER_SEGMENTS = 5;

/** Reported distance from a structural edge, for the chipping shader. */
const PORT_EDGE_DIST = 30;

/** A plate frame on the driver's front plate at a given height. */
function onDriverPlate(y: MM, standoff: MM): ReturnType<typeof facingForward> {
  return facingForward(
    mm(driverPlateOuterZ(y) + standoff * Math.cos(R(ARMOUR.hull.driverPlate.angle))),
    y,
    ARMOUR.hull.driverPlate.angle,
  );
}

/**
 * The Fahrersehklappe: a raised housing around the slot, with the sliding
 * shutter above it in the open position.
 */
function buildDriverVisor(ctx: BuildContext): void {
  const v = HULL.driverVisor;

  // The housing, with the vision slot cut through it so the slot stays open.
  const slot: Poly2 = roundedRect(v.width, v.height, mm(v.height / 3), 3);
  structuralPlate(ctx, {
    outline: translate(
      roundedRect(v.housingWidth, v.housingHeight, v.housingCornerRadius, HOUSING_CORNER_SEGMENTS),
      v.centreX,
      0,
    ),
    holes: [translate(slot, v.centreX, 0)],
    thickness: v.housingProud,
    frame: onDriverPlate(v.centreY, v.housingProud),
    chamfer: HULL.chamfer.structural,
    region: Region.Exterior,
    materials: {
      inner: 'armourPaintedExterior',
      outer: 'armourPaintedExterior',
      edge: 'armourPaintedExterior',
    },
    edgeBandWidth: HULL.interiorEdgeBand,
  });

  // The shutter, raised clear of the slot — which is what "the visor is open"
  // looks like, and the reason the slot below it is a hole and not a window.
  structuralPlate(ctx, {
    outline: translate(
      roundedRect(v.shutterWidth, v.shutterHeight, mm(v.shutterHeight / 5), 3),
      v.centreX,
      0,
    ),
    thickness: v.shutterProud,
    frame: onDriverPlate(
      mm(v.centreY + v.shutterRaise),
      mm(v.housingProud + v.shutterProud),
    ),
    chamfer: HULL.chamfer.structural,
    region: Region.Exterior,
    materials: {
      inner: 'handledSteel',
      outer: 'armourPaintedExterior',
      edge: 'armourPaintedExterior',
    },
    // The driver worked this every time he wanted to see out.
    wear: WEAR.handled,
    edgeBandWidth: HULL.interiorEdgeBand,
  });
}

/**
 * The Kugelblende: a ball turning in a collar, with the MG's barrel sleeve
 * through it.
 *
 * Built as a revolve about the bore's own axis, which is normal to the driver's
 * plate — so the ball leans back with the plate rather than standing square to
 * the world, which a hand-placed sphere would.
 */
function buildBallMount(ctx: BuildContext): void {
  const g = HULL.hullMGMount;
  const plateNormalTilt = R(ARMOUR.hull.driverPlate.angle);
  const faceZ = driverPlateOuterZ(g.centreY);

  // Axis frame: local +Y along the bore, leaning back with the plate. Built by
  // laying a forward-facing frame over, the same way the running gear lays a
  // wheel over — a hand-placed sphere would stand square to the world instead
  // of leaning with the armour it is seated in.
  const frame = facingForward(faceZ, g.centreY, ARMOUR.hull.driverPlate.angle);
  // Slide it out to the radio operator's station. `facingForward` puts its
  // origin on the CENTRELINE, and a revolve builds about that origin — so
  // without this the ball mount sits in the middle of the driver's plate,
  // where every frontal probe in the suite fires. They all found it at once.
  frame.multiply(new Matrix4().makeTranslation(S(g.centreX), 0, 0));
  frame.multiply(new Matrix4().makeRotationX(Math.PI / 2));

  const ballRadius = mm(g.ballDiameter / 2);
  const boreRadius = mm(g.apertureDiameter / 2);

  // The collar, seated on the plate.
  emitRevolve(ctx.render, {
    profile: [
      new Vector2(S(boreRadius), 0),
      new Vector2(S(mm(g.collarDiameter / 2)), 0),
      new Vector2(S(mm(g.collarDiameter / 2)), S(g.collarProud)),
      new Vector2(S(boreRadius), S(g.collarProud)),
      new Vector2(S(boreRadius), 0),
    ],
    segments: BALL_SEGMENTS,
    material: 'armourPaintedExterior',
    region: Region.Exterior,
    frame,
    edgeDist: PORT_EDGE_DIST,
  });

  // The ball itself: a spherical cap standing proud, bored through for the gun.
  const cap: Vector2[] = [];
  const capAngle = Math.acos(Math.min(1, Math.max(-1, 1 - g.ballProud / ballRadius)));
  for (let i = 0; i <= BALL_RINGS; i++) {
    const t = (i / BALL_RINGS) * capAngle;
    const r = ballRadius * Math.sin(t);
    const h = g.ballProud - ballRadius * (1 - Math.cos(t));
    if (r < boreRadius) continue;
    cap.push(new Vector2(S(mm(r)), S(mm(h))));
  }
  // Close the profile back down the bore, so the cap is a genuine ring of
  // material rather than an open surface.
  const lastY = cap[cap.length - 1]?.y ?? 0;
  const firstY = cap[0]?.y ?? 0;
  cap.push(new Vector2(S(boreRadius), lastY));
  cap.unshift(new Vector2(S(boreRadius), firstY));
  emitRevolve(ctx.render, {
    profile: cap,
    segments: BALL_SEGMENTS,
    material: 'castSteelBare',
    region: Region.Exterior,
    frame,
    wear: WEAR.handled,
    edgeDist: PORT_EDGE_DIST,
  });

  // The barrel sleeve and the barrel through it.
  emitRevolve(ctx.render, {
    profile: [
      new Vector2(S(mm(g.barrelDiameter / 2)), S(g.ballProud)),
      new Vector2(S(mm(g.sleeveDiameter / 2)), S(g.ballProud)),
      new Vector2(S(mm(g.sleeveDiameter / 2)), S(mm(g.ballProud + g.sleeveLength))),
      new Vector2(S(mm(g.barrelDiameter / 2)), S(mm(g.ballProud + g.sleeveLength))),
      new Vector2(S(mm(g.barrelDiameter / 2)), S(mm(g.ballProud + g.barrelLength))),
      // Open at the muzzle, like the main gun's.
      new Vector2(S(mm(g.barrelDiameter / 2 - g.barrelWall)), S(mm(g.ballProud + g.barrelLength))),
      new Vector2(S(mm(g.barrelDiameter / 2 - g.barrelWall)), S(g.ballProud)),
      new Vector2(S(mm(g.barrelDiameter / 2)), S(g.ballProud)),
    ],
    segments: BALL_SEGMENTS,
    material: 'exhaustSteel',
    region: Region.Exterior,
    frame,
    edgeDist: PORT_EDGE_DIST,
  });

  void plateNormalTilt;
}

/** Rings sampled across the ball's spherical cap. */
const BALL_RINGS = 8;

export function buildVisionPorts(ctx: BuildContext): PartResult {
  const start = ctx.render.triangleCount;
  buildDriverVisor(ctx);
  buildBallMount(ctx);
  return {
    name: 'visionPorts',
    triangleCount: ctx.render.triangleCount - start,
    collision: [],
    frames: new Map(),
  };
}
