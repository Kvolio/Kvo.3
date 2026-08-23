import { Matrix4, Vector2, Vector3 } from 'three';
import { Region, WEAR } from '../../geom/attributes.js';
import { emitRevolve } from '../../prims/lathe.js';
import { R, S, deg, mm, type DEG } from '../../spec/units.js';
import { ARMOUR } from '../../spec/armour.js';
import { GUN } from '../../spec/armament.js';
import { HULL } from '../../spec/hull.js';
import { TURRET } from '../../spec/turret.js';
import { structuralPlate } from '../emit.js';
import { circle, rect, translate, type Poly2 } from '../../geom/poly2.js';
import type { BuildContext, PartResult } from '../types.js';
import { facingForward } from '../hull/frames.js';

/**
 * The 8.8 cm KwK 36 L/56, its muzzle brake and the cast mantlet.
 *
 * L/56 is not decoration: the barrel is 56 bores long, so its length is derived
 * from the calibre rather than carried as its own figure, and a change to
 * either cannot leave the two disagreeing.
 *
 * The mantlet carries TWO sight apertures because the Ausf. H mounts the
 * BINOCULAR TZF 9b. The monocular TZF 9c and its single aperture arrive in
 * March 1944, so a Tiger with one hole in its mantlet is a later Tiger. It is
 * one of the clearest date markers on the vehicle and it costs one extra hole
 * to get right.
 */

/** Radial segments on the tube. It is long, close, and seen against the sky. */
const TUBE_SEGMENTS = 24;

/** Segments on a sight aperture. */
const SIGHT_SEGMENTS = 14;

/** Reported distance from a structural edge, for the chipping shader. */
const GUN_EDGE_DIST = 30;

/** Trunnion axis in vehicle space, at zero elevation and zero traverse. */
export function trunnion(): Vector3 {
  return new Vector3(0, S(GUN.elevation.trunnionY), S(mm(TURRET.ring.centreZ + GUN.elevation.trunnionZ)));
}

/**
 * The gun's frame at a given elevation: origin on the trunnion axis, +Z along
 * the bore.
 *
 * Elevation rotates about the trunnion, which is the whole point of a trunnion,
 * and building the tube in this frame means the muzzle goes where the geometry
 * says rather than where a second set of coordinates says.
 */
export function gunFrame(elevation: DEG = deg(0)): Matrix4 {
  const t = trunnion();
  const m = new Matrix4().makeRotationX(R(elevation));
  m.setPosition(t);
  return m;
}

/** The tube, from the mantlet face to the muzzle, with the brake on the end. */
function emitTube(ctx: BuildContext, frame: Matrix4): void {
  const breechR = mm(GUN.breechEndDiameter / 2);
  const muzzleR = mm(GUN.muzzleDiameter / 2);
  const boreR = mm(GUN.bore / 2);

  // Measured from the trunnion forward. The tube tapers along its length, which
  // is what makes a Tiger's barrel read as a gun rather than as a pipe.
  const start = mm(-GUN.barrelLength * GUN.elevation.tubeBehindTrunnion);
  const brakeStart = mm(start + GUN.barrelLength);
  const brakeEnd = mm(brakeStart + GUN.muzzleBrake.length);
  const brakeR = mm(GUN.muzzleBrake.outerDiameter / 2);

  emitRevolve(ctx.render, {
    profile: [
      new Vector2(S(boreR), S(start)),
      new Vector2(S(breechR), S(start)),
      new Vector2(S(muzzleR), S(brakeStart)),
      new Vector2(S(brakeR), S(brakeStart)),
      new Vector2(S(brakeR), S(brakeEnd)),
      // Open at the muzzle: the bore is a hole you can look down.
      new Vector2(S(mm(boreR + GUN.muzzleBrake.muzzleWall)), S(brakeEnd)),
      new Vector2(S(mm(boreR + GUN.muzzleBrake.muzzleWall)), S(brakeStart)),
      new Vector2(S(boreR), S(brakeStart)),
      new Vector2(S(boreR), S(start)),
    ],
    segments: TUBE_SEGMENTS,
    material: 'armourPaintedExterior',
    region: Region.Exterior,
    frame: laidForward(frame),
    wear: WEAR.incidental,
    edgeDist: GUN_EDGE_DIST,
  });

  // The brake's two baffle slots, cut as gaps in a separate ring rather than
  // suggested by shading.
  const slotArc = Math.PI / 3;
  for (let i = 0; i < GUN.muzzleBrake.baffles * 2; i++) {
    const a = (i / (GUN.muzzleBrake.baffles * 2)) * Math.PI * 2 + slotArc / 2;
    emitRevolve(ctx.render, {
      profile: [
        new Vector2(S(mm(boreR + GUN.muzzleBrake.muzzleWall)), S(mm(brakeStart + GUN.muzzleBrake.length * GUN.muzzleBrake.baffleStartFraction))),
        new Vector2(S(brakeR), S(mm(brakeStart + GUN.muzzleBrake.length * GUN.muzzleBrake.baffleStartFraction))),
        new Vector2(S(brakeR), S(mm(brakeStart + GUN.muzzleBrake.length * GUN.muzzleBrake.baffleEndFraction))),
        new Vector2(S(mm(boreR + GUN.muzzleBrake.muzzleWall)), S(mm(brakeStart + GUN.muzzleBrake.length * GUN.muzzleBrake.baffleEndFraction))),
        new Vector2(S(mm(boreR + GUN.muzzleBrake.muzzleWall)), S(mm(brakeStart + GUN.muzzleBrake.length * GUN.muzzleBrake.baffleStartFraction))),
      ],
      segments: 4,
      arcStart: a,
      arcLength: Math.PI - slotArc,
      material: 'armourPaintedExterior',
      region: Region.Exterior,
      frame: laidForward(frame),
      edgeDist: GUN_EDGE_DIST,
    });
  }
}

/**
 * Lay a revolve's local +Y along the gun's +Z.
 *
 * Same trick as the running gear: the primitive turns about local Y, and a gun
 * barrel points forward, so the body is built upright and swung down.
 */
function laidForward(frame: Matrix4): Matrix4 {
  return frame.clone().multiply(new Matrix4().makeRotationX(Math.PI / 2));
}

/** The cast mantlet, with the gun's bore and the two TZF 9b sight apertures. */
function emitMantlet(ctx: BuildContext): void {
  const m = TURRET.mantlet;
  const frontZ = mm(TURRET.ring.centreZ + TURRET.shell.frontOverhang);
  const bore: Poly2 = circle(mm(GUN.breechEndDiameter / 2 + m.boreClearance), SIGHT_SEGMENTS);

  const sights: Poly2[] = Array.from({ length: m.sightApertures }, (_, i) => {
    const offset = (i - (m.sightApertures - 1) / 2) * m.sightApertureSpacing;
    return translate(
      circle(mm(m.sightApertureDiameter / 2), SIGHT_SEGMENTS),
      mm(m.sightOffsetX + offset),
      0,
    );
  });

  structuralPlate(ctx, {
    outline: rect(m.width, m.height),
    holes: [bore, ...sights],
    thickness: mm(m.proud + ARMOUR.turret.front.thickness),
    frame: facingForward(
      mm(frontZ + m.proud),
      mm(GUN.elevation.trunnionY),
      ARMOUR.turret.front.angle,
    ),
    chamfer: HULL.chamfer.structural,
    region: Region.Exterior,
    // Painted, like everything else: the February 1943 order put dunkelgelb on
    // the whole vehicle, mantlet and barrel included. Bare cast steel is what a
    // museum piece looks like after restoration, not what left Henschel.
    materials: {
      inner: 'armourPaintedExterior',
      outer: 'armourPaintedExterior',
      edge: 'armourPaintedExterior',
    },
    edgeBandWidth: m.edgeBand,
  });
}

export function buildGun(ctx: BuildContext): PartResult {
  const start = ctx.render.triangleCount;
  const frame = gunFrame();
  emitMantlet(ctx);
  emitTube(ctx, frame);
  return {
    name: 'gun',
    triangleCount: ctx.render.triangleCount - start,
    collision: [],
    frames: new Map([['trunnion', frame]]),
  };
}
