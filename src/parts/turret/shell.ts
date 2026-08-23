import { Vector2, Vector3 } from 'three';
import { Region, WEAR } from '../../geom/attributes.js';
import { circle, rect, roundedRect, translate, v2, type Poly2 } from '../../geom/poly2.js';
import { emitRevolve } from '../../prims/lathe.js';
import { S, mm, type MM } from '../../spec/units.js';
import { ARMOUR } from '../../spec/armour.js';
import { HULL } from '../../spec/hull.js';
import {
  TURRET,
  TURRET_BUSTLE_START_Z,
  TURRET_FRONT_PLATE_WIDTH,
} from '../../spec/turret.js';
import { structuralPlate } from '../emit.js';
import type { BuildContext, PartResult } from '../types.js';
import { facingForward, facingUp } from '../hull/frames.js';

/**
 * The turret: a horseshoe of 80 mm plate, a 100 mm front plate, a 25 mm roof,
 * and the drum cupola with its five vision slits.
 *
 * Built in HULL coordinates at zero traverse rather than in a turret-local
 * frame, because it is mounted as a moving body and the mount supplies the
 * rotation. Authoring it where it actually sits lets the fit tests compare it
 * against the deck directly.
 *
 * Almost everything about the Ausf. H turret is a date marker: the drum cupola
 * (replaced by the cast type in July 1943), the 25 mm roof (40 mm from March
 * 1944), and one pistol port where there were once two — the right-hand one
 * became the escape hatch in December 1942.
 */

/** Segments around the bustle's curve. */
const BUSTLE_SEGMENTS = 26;

/** Segments on a circular aperture in the roof. */
const APERTURE_SEGMENTS = 28;

/** Segments around one rounded corner of the loader's hatch. */
const HATCH_CORNER_SEGMENTS = 6;

/** Turret-local Z of the front plate's outer face, in hull coordinates. */
const FRONT_Z: MM = mm(TURRET.ring.centreZ + TURRET.shell.frontOverhang);

/** The ring plane, and the top of the side walls where the roof sits. */
const RING_Y: MM = TURRET.ring.planeY;
const WALL_TOP_Y: MM = mm(RING_Y + TURRET.shell.interiorHeight);

/**
 * The horseshoe outline in plan, as a closed polygon in (x, worldZ).
 *
 * `outset` grows or shrinks it, which is how the inner face is generated from
 * the same definition as the outer one: one shape, one place to change it, and
 * no chance of the two disagreeing about where the turret is.
 */
function horseshoe(outset: number): Poly2 {
  const halfWidth = TURRET.shell.width / 2 + outset;
  const run = TURRET.shell.bustleRun + outset;
  const bustleZ = TURRET.ring.centreZ + TURRET_BUSTLE_START_Z;

  const pts: Vector2[] = [
    v2(mm(-halfWidth), mm(FRONT_Z + outset)),
    v2(mm(halfWidth), mm(FRONT_Z + outset)),
    v2(mm(halfWidth), mm(bustleZ)),
  ];
  // An ELLIPTICAL quarter each side, not a semicircle: the bustle closes in
  // 573 mm where a half-round of this width would take 1,085. Full width at
  // t = 0, meeting on the centreline at t = 90 degrees.
  for (let i = 1; i < BUSTLE_SEGMENTS; i++) {
    const t = (i / BUSTLE_SEGMENTS) * Math.PI;
    pts.push(v2(mm(halfWidth * Math.cos(t)), mm(bustleZ - run * Math.sin(t))));
  }
  pts.push(v2(mm(-halfWidth), mm(bustleZ)));
  return pts;
}

/** A plan outline in (x, worldZ) as a horizontal plate's local (x, y). */
function planLocal(poly: Poly2): Poly2 {
  return poly.map((p) => new Vector2(p.x, -p.y));
}

/**
 * The side and rear armour, which on a Tiger is ONE bent plate, so it is built
 * as one solid: the horseshoe outline with a smaller horseshoe as its hole.
 * Extruded down from the roof line, which makes its inner surface a genuine
 * back face rather than a second plate pretending to be one.
 */
function buildShellWall(ctx: BuildContext): void {
  structuralPlate(ctx, {
    outline: planLocal(horseshoe(0)),
    holes: [planLocal(horseshoe(-ARMOUR.turret.side.thickness))],
    thickness: mm(WALL_TOP_Y - RING_Y),
    frame: facingUp(WALL_TOP_Y),
    chamfer: HULL.chamfer.structural,
    region: Region.Exterior,
    materials: {
      inner: 'interiorIvoryPaint',
      outer: 'armourPaintedExterior',
      edge: 'armourPaintedExterior',
    },
    edgeBandWidth: HULL.edgeBand,
  });
}

/** The 100 mm front plate, with the mantlet's trunnion opening cut through. */
function buildFrontPlate(ctx: BuildContext): void {
  const height = mm(WALL_TOP_Y - RING_Y);
  const aperture: Poly2 = rect(TURRET.mantlet.apertureWidth, TURRET.mantlet.apertureHeight);

  structuralPlate(ctx, {
    outline: rect(TURRET_FRONT_PLATE_WIDTH, height),
    holes: [aperture],
    thickness: ARMOUR.turret.front.thickness,
    frame: facingForward(FRONT_Z, mm((RING_Y + WALL_TOP_Y) / 2), ARMOUR.turret.front.angle),
    chamfer: HULL.chamfer.structural,
    region: Region.Exterior,
    materials: { inner: 'interiorIvoryPaint' },
    edgeBandWidth: HULL.edgeBand,
  });
}

/** The 25 mm roof, with the cupola and loader's hatch cut through it. */
function buildRoof(ctx: BuildContext): void {
  const roofTop = mm(WALL_TOP_Y + ARMOUR.turret.roof.thickness);
  const aperture = (centreX: MM, centreZ: MM, diameter: MM): Poly2 =>
    translate(
      circle(mm(diameter / 2), APERTURE_SEGMENTS),
      centreX,
      -(TURRET.ring.centreZ + centreZ),
    );

  structuralPlate(ctx, {
    outline: planLocal(horseshoe(0)),
    holes: [
      aperture(
        TURRET.cupola.centreX,
        TURRET.cupola.centreZ,
        mm(TURRET.cupola.outerDiameter - TURRET.cupola.wallThickness * 2),
      ),
      // Rounded oblong, not a circle. The plan view draws the loader's hatch
      // with its hinge on one long edge; it was built round for two iterations.
      translate(
        roundedRect(
          TURRET.loaderHatch.width,
          TURRET.loaderHatch.length,
          TURRET.loaderHatch.cornerRadius,
          HATCH_CORNER_SEGMENTS,
        ),
        TURRET.loaderHatch.centreX,
        -(TURRET.ring.centreZ + TURRET.loaderHatch.centreZ),
      ),
    ],
    thickness: ARMOUR.turret.roof.thickness,
    frame: facingUp(roofTop),
    chamfer: HULL.chamfer.side,
    region: Region.Exterior,
    materials: { inner: 'interiorIvoryPaint' },
    // The commander stood on this to get in and out.
    wear: WEAR.footTraffic,
    edgeBandWidth: HULL.edgeBand,
  });
}

/**
 * The drum cupola, with its five vision slits as GENUINE APERTURES.
 *
 * This is the R1 requirement — "make sure that vision slits and viewholes
 * actually are to scale and work inside the tank" — and it is why the drum is
 * built as arc segments rather than as one revolve. A revolve cannot cut a hole
 * in its own wall, so a slit modelled that way is a dark rectangle painted on
 * steel: it looks right from outside and is solid from within.
 *
 * Instead the wall is emitted as five full-height panels between the slits,
 * plus a band below and a band above each slit. What is left over IS the slit,
 * open all the way through the 80 mm wall, and `tests/parts/vision.test.ts`
 * fires a ray through it from the commander's eye.
 */
function buildCupola(ctx: BuildContext): void {
  const c = TURRET.cupola;
  const roofTop = mm(WALL_TOP_Y + ARMOUR.turret.roof.thickness);
  const outer = mm(c.outerDiameter / 2);
  const inner = mm(outer - c.wallThickness);
  const top = mm(roofTop + c.height);

  // Slits are centred on the drum's height, and sit in the forward-facing
  // three-fifths of it: a commander needs to see where he is going more than
  // where he has been, and the rear of the drum carries the hatch hinge.
  const slitCentreY = mm(roofTop + c.height / 2);
  const slitHalfHeight = mm(c.slitHeight / 2);
  const slitArc = c.slitWidth / outer;
  const spacing = (Math.PI * 2) / c.visionSlits;

  const wallProfile = (y0: MM, y1: MM): Vector2[] => [
    new Vector2(S(inner), S(y0)),
    new Vector2(S(outer), S(y0)),
    new Vector2(S(outer), S(y1)),
    new Vector2(S(inner), S(y1)),
    new Vector2(S(inner), S(y0)),
  ];

  for (let i = 0; i < c.visionSlits; i++) {
    const slitStart = i * spacing - slitArc / 2;

    // Full-height panel from the end of this slit to the start of the next.
    emitPanel(ctx, wallProfile(mm(roofTop), top), slitStart + slitArc, spacing - slitArc);

    // Below and above the slit itself, so the opening goes all the way through.
    emitPanel(ctx, wallProfile(mm(roofTop), mm(slitCentreY - slitHalfHeight)), slitStart, slitArc);
    emitPanel(ctx, wallProfile(mm(slitCentreY + slitHalfHeight), top), slitStart, slitArc);
  }

  // The roof of the drum, with the commander's hatch cut through it.
  structuralPlate(ctx, {
    outline: translate(
      circle(outer, APERTURE_SEGMENTS),
      c.centreX,
      -(TURRET.ring.centreZ + c.centreZ),
    ),
    holes: [
      translate(
        circle(mm(c.hatchDiameter / 2), APERTURE_SEGMENTS),
        c.centreX,
        -(TURRET.ring.centreZ + c.centreZ),
      ),
    ],
    thickness: ARMOUR.turret.roof.thickness,
    frame: facingUp(mm(top + ARMOUR.turret.roof.thickness)),
    chamfer: HULL.chamfer.side,
    region: Region.Exterior,
    materials: { inner: 'interiorIvoryPaint' },
    wear: WEAR.footTraffic,
  });
}

/** One arc of the cupola wall, on the cupola's own axis. */
function emitPanel(
  ctx: BuildContext,
  profile: Vector2[],
  arcStart: number,
  arcLength: number,
): void {
  const c = TURRET.cupola;
  emitRevolve(ctx.render, {
    profile,
    segments: CUPOLA_ARC_SEGMENTS,
    arcStart,
    arcLength,
    material: 'armourPaintedExterior',
    region: Region.Exterior,
    origin: new Vector3(S(c.centreX), 0, S(mm(TURRET.ring.centreZ + c.centreZ))),
    edgeDist: CUPOLA_EDGE_DIST,
  });
}

/** Segments across one cupola wall panel. */
const CUPOLA_ARC_SEGMENTS = 5;

/** Reported distance from a structural edge, for the chipping shader. */
const CUPOLA_EDGE_DIST = 25;

export function buildTurret(ctx: BuildContext): PartResult {
  const start = ctx.render.triangleCount;

  buildShellWall(ctx);
  buildFrontPlate(ctx);
  buildRoof(ctx);
  buildCupola(ctx);

  return {
    name: 'turret',
    triangleCount: ctx.render.triangleCount - start,
    collision: [],
    frames: new Map(),
  };
}
