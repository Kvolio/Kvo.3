import { Matrix4, Vector2, Vector3 } from 'three';
import { Region, WEAR } from '../../geom/attributes.js';
import { emitRevolve } from '../../prims/lathe.js';
import { R, S, deg, mm, type DEG, type MM } from '../../spec/units.js';
import { ARMOUR } from '../../spec/armour.js';
import { GUN } from '../../spec/armament.js';
import { HULL } from '../../spec/hull.js';
import { TURRET } from '../../spec/turret.js';
import { structuralPlate } from '../emit.js';
import { circle, rect, roundedRect, translate, type Poly2 } from '../../geom/poly2.js';
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

  emitRevolve(ctx.render, {
    profile: [
      new Vector2(S(boreR), S(start)),
      new Vector2(S(breechR), S(start)),
      // Stops at the brake's rear face. `emitMuzzleBrake` builds the brake
      // itself, with its side apertures — drawing a solid cylinder here as well
      // simply buried them.
      new Vector2(S(muzzleR), S(brakeStart)),
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

}

/**
 * The double-baffle muzzle brake.
 *
 * Its two side apertures are GAPS, built the way the cupola's vision slits are:
 * the wall is emitted as the arcs that remain, and what is left over is the
 * opening. Adding rings on the outside instead — which is what this did — gives
 * bumps rather than baffles, and two critics independently called the result a
 * flat paddle rather than a brake.
 */
function emitMuzzleBrake(ctx: BuildContext, frame: Matrix4, brakeStart: MM): void {
  const b = GUN.muzzleBrake;
  const outer = mm(b.outerDiameter / 2);
  const inner = mm(GUN.bore / 2 + b.muzzleWall);
  const start = brakeStart;
  const end = mm(brakeStart + b.length);
  const apertureFrom = mm(brakeStart + b.length * b.baffleStartFraction);
  const apertureTo = mm(brakeStart + b.length * b.baffleEndFraction);

  const wall = (y0: MM, y1: MM): Vector2[] => [
    new Vector2(S(inner), S(y0)),
    new Vector2(S(outer), S(y0)),
    new Vector2(S(outer), S(y1)),
    new Vector2(S(inner), S(y1)),
    new Vector2(S(inner), S(y0)),
  ];

  const ring = (y0: MM, y1: MM, arcStart: number, arcLength: number): void => {
    emitRevolve(ctx.render, {
      profile: wall(y0, y1),
      segments: BRAKE_SEGMENTS,
      arcStart,
      arcLength,
      material: 'armourPaintedExterior',
      region: Region.Exterior,
      frame: laidForward(frame),
      edgeDist: GUN_EDGE_DIST,
    });
  };

  // Full collars fore and aft of the apertures.
  ring(start, apertureFrom, 0, Math.PI * 2);
  ring(apertureTo, end, 0, Math.PI * 2);

  // Between them, only the top and bottom webs remain: the two side openings
  // are the arcs NOT emitted, and blast leaves through them.
  const openArc = Math.PI * b.apertureArcFraction;
  const webArc = Math.PI - openArc;
  for (const centre of [Math.PI / 2, -Math.PI / 2]) {
    ring(apertureFrom, apertureTo, centre - webArc / 2, webArc);
  }
}

/** Radial segments on the muzzle brake. */
const BRAKE_SEGMENTS = 20;

/**
 * Lay a revolve's local +Y along the gun's +Z.
 *
 * Same trick as the running gear: the primitive turns about local Y, and a gun
 * barrel points forward, so the body is built upright and swung down.
 */
function laidForward(frame: Matrix4): Matrix4 {
  return frame.clone().multiply(new Matrix4().makeRotationX(Math.PI / 2));
}

/**
 * The cast mantlet.
 *
 * It is a CASTING, not a plate, and that difference is most of a Tiger's face:
 * a broad slab with heavily rounded ends carrying a raised circular boss around
 * the gun tube, the boss more than half the slab's own height. Built as a plain
 * extruded rectangle it reads as a panel bolted to the front, which is exactly
 * what it looked like.
 *
 * Three openings through it, and each is a date marker or a weapon:
 *   - the bore, with clearance round the tube;
 *   - TWO sight apertures to PORT, because the Ausf. H mounts the binocular
 *     TZF 9b; one hole would make this a March 1944 vehicle or later;
 *   - the coaxial MG 34 port to STARBOARD, which was missing entirely.
 */
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

  const coax: Poly2 = translate(
    circle(mm(m.coaxPortDiameter / 2), SIGHT_SEGMENTS),
    m.coaxOffsetX,
    0,
  );

  const slabFrame = facingForward(
    mm(frontZ + m.proud),
    mm(GUN.elevation.trunnionY),
    ARMOUR.turret.front.angle,
  );

  // The slab. Rounded ends rather than square corners, and a chamfer wide
  // enough to read as a cast fillet instead of a machined arris.
  structuralPlate(ctx, {
    outline: roundedRect(m.width, m.height, m.cornerRadius, MANTLET_CORNER_SEGMENTS),
    holes: [bore, ...sights, coax],
    thickness: mm(m.proud + ARMOUR.turret.front.thickness),
    frame: slabFrame,
    chamfer: m.bossFillet,
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

  // The raised boss around the tube, standing proud of the slab again, with a
  // filleted rim. This is the feature that makes the mantlet read as a casting.
  const bossFrame = slabFrame.clone().multiply(new Matrix4().makeRotationX(Math.PI / 2));
  const boreRadius = mm(GUN.breechEndDiameter / 2 + m.boreClearance);
  const bossRadius = mm(m.bossDiameter / 2);
  emitRevolve(ctx.render, {
    profile: [
      new Vector2(S(boreRadius), 0),
      new Vector2(S(mm(bossRadius - m.bossFillet)), 0),
      new Vector2(S(bossRadius), S(m.bossFillet)),
      new Vector2(S(bossRadius), S(mm(m.bossProud - m.bossFillet))),
      new Vector2(S(mm(bossRadius - m.bossFillet)), S(m.bossProud)),
      new Vector2(S(boreRadius), S(m.bossProud)),
      new Vector2(S(boreRadius), 0),
    ],
    segments: BOSS_SEGMENTS,
    material: 'armourPaintedExterior',
    region: Region.Exterior,
    frame: bossFrame,
    edgeDist: GUN_EDGE_DIST,
  });
}

/** Segments around one rounded corner of the mantlet slab. */
const MANTLET_CORNER_SEGMENTS = 7;

/** Radial segments on the mantlet's raised boss. */
const BOSS_SEGMENTS = 28;

/**
 * The breech end: the ring, the falling block, and the recoil guard.
 *
 * The guard is not decoration. The gun strokes 580 mm when it fires and the
 * loader stands exactly where the breech ends up; the guard is what makes that
 * survivable, and it is why the turret's usable floor is smaller than its ring.
 */
function emitBreech(ctx: BuildContext, frame: Matrix4): void {
  const b = GUN.breech;
  const behind = mm(-GUN.barrelLength * GUN.elevation.tubeBehindTrunnion);

  // The breech ring, on the tube's axis behind the trunnion.
  emitRevolve(ctx.render, {
    profile: [
      new Vector2(S(mm(GUN.bore / 2)), S(mm(behind - b.ringLength))),
      new Vector2(S(mm(b.ringDiameter / 2)), S(mm(behind - b.ringLength))),
      new Vector2(S(mm(b.ringDiameter / 2)), S(behind)),
      new Vector2(S(mm(GUN.bore / 2)), S(behind)),
      new Vector2(S(mm(GUN.bore / 2)), S(mm(behind - b.ringLength))),
    ],
    segments: TUBE_SEGMENTS,
    material: 'machinedSteel',
    region: Region.TurretInterior,
    frame: laidForward(frame),
    edgeDist: GUN_EDGE_DIST,
  });

  // The falling wedge block, hanging below the bore.
  const blockFrame = frame.clone();
  blockFrame.multiply(
    new Matrix4().makeTranslation(
      0,
      -S(mm(b.blockHeight / 2)),
      S(mm(behind - b.ringLength / 2)),
    ),
  );
  structuralPlate(ctx, {
    outline: rect(b.blockWidth, b.blockHeight),
    thickness: b.blockThickness,
    frame: blockFrame,
    chamfer: HULL.chamfer.side,
    region: Region.TurretInterior,
    materials: {
      inner: 'machinedSteel',
      outer: 'machinedSteel',
      edge: 'machinedSteel',
    },
    edgeBandWidth: HULL.interiorEdgeBand,
  });

  // The recoil guard: a cage of tube around the breech's travel.
  const guardZ = mm(behind - b.ringLength - b.guardLength / 2);
  for (const sign of [-1, 1] as const) {
    for (const height of [0, b.guardHeight] as const) {
      // Laid the same way as the tube. With the rotation negated, the guard's
      // local +Y mapped to world -Z, so the whole cage was built FORWARD of the
      // trunnion and floated over the barrel outside the turret — which is the
      // stray geometry two critics reported hanging in mid-air.
      const railFrame = laidForward(frame);
      railFrame.multiply(
        new Matrix4().makeTranslation(
          S(mm((sign * b.guardWidth) / 2)),
          0,
          -S(mm(b.guardHeight / 2 - height)),
        ),
      );
      emitRevolve(ctx.render, {
        profile: [
          new Vector2(0, S(mm(guardZ - b.guardLength / 2))),
          new Vector2(S(mm(b.guardTubeDiameter / 2)), S(mm(guardZ - b.guardLength / 2))),
          new Vector2(S(mm(b.guardTubeDiameter / 2)), S(mm(guardZ + b.guardLength / 2))),
          new Vector2(0, S(mm(guardZ + b.guardLength / 2))),
        ],
        segments: GUARD_SEGMENTS,
        material: 'handledSteel',
        region: Region.TurretInterior,
        frame: railFrame,
        wear: WEAR.handled,
        edgeDist: GUN_EDGE_DIST,
      });
    }
  }
}

/** Radial segments on a recoil guard rail. */
const GUARD_SEGMENTS = 10;

export function buildGun(ctx: BuildContext, elevation: DEG = deg(0)): PartResult {
  const start = ctx.render.triangleCount;
  const frame = gunFrame(elevation);
  emitMantlet(ctx);
  emitTube(ctx, frame);
  emitMuzzleBrake(ctx, frame, mm(-GUN.barrelLength * GUN.elevation.tubeBehindTrunnion + GUN.barrelLength));
  emitBreech(ctx, frame);
  return {
    name: 'gun',
    triangleCount: ctx.render.triangleCount - start,
    collision: [],
    frames: new Map([['trunnion', frame]]),
  };
}
