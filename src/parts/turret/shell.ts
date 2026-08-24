import { Vector2, Vector3 } from 'three';
import { Region, WEAR } from '../../geom/attributes.js';
import { circle, rect, roundedRect, translate, v2, type Poly2 } from '../../geom/poly2.js';
import { emitRevolve } from '../../prims/lathe.js';
import { R, S, mm, type DEG, type MM } from '../../spec/units.js';
import { ARMOUR } from '../../spec/armour.js';
import { HULL } from '../../spec/hull.js';
import {
  TURRET,
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

/** Stations along the swelling front section of the turret's side. */
const FRONT_SEGMENTS = 14;

/** Stations around the blunt tail. */
const REAR_SEGMENTS = 18;

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
  const shell = TURRET.shell;
  // Both ends move INWARD by the outset, so the inner outline is shorter at the
  // front AND at the tail. Shrinking a single length from the front alone left
  // the two outlines sharing a tail and the wall had no thickness there.
  const frontZ = mm(FRONT_Z + outset);
  const rearZ = mm(FRONT_Z - shell.length - outset);
  const frontHalf = shell.frontPlateWidth / 2 + outset;
  const maxHalf = shell.width / 2 + outset;
  const widestZ = mm(frontZ - (frontZ - rearZ) * shell.widestAtFraction);

  const side: Vector2[] = [];

  // Front section: the sides swell from the front plate's corners out to the
  // widest point. Eased at both ends — a plain ellipse quadrant has zero slope
  // at one end and maximum slope at the other, which puts a visible crease
  // either where it leaves the front plate or where it reaches full width.
  for (let i = 0; i <= FRONT_SEGMENTS; i++) {
    const t = i / FRONT_SEGMENTS;
    const eased = t * t * (3 - 2 * t);
    const z = frontZ - (frontZ - widestZ) * t;
    side.push(v2(mm(frontHalf + (maxHalf - frontHalf) * eased), mm(z)));
  }

  // Rear section: parameterised by ANGLE, not by station, so the tail is BLUNT.
  // Sampling the width as a function of z instead makes the curve meet the
  // centreline at a finite angle and the turret comes to a point — it rendered
  // as an arrowhead.
  const rearRun = widestZ - rearZ;
  for (let i = 1; i <= REAR_SEGMENTS; i++) {
    const theta = (i / REAR_SEGMENTS) * (Math.PI / 2);
    side.push(
      v2(mm(maxHalf * Math.cos(theta)), mm(widestZ - rearRun * Math.sin(theta))),
    );
  }

  // Port front corner, down the starboard side and round the tail, then back up
  // the port side. The tail point is shared, so it is not mirrored.
  const pts: Vector2[] = [v2(mm(-frontHalf), frontZ), ...side];
  for (let i = side.length - 2; i >= 1; i--) {
    const q = side[i]!;
    pts.push(v2(mm(-q.x), mm(q.y)));
  }
  return pts;
}

/**
 * A point on the turret's rear arc, with the wall's outward normal there.
 *
 * `bearing` is measured from dead astern: positive to starboard, negative to
 * port, so 0 is the tail and 90 is abeam. Fittings on the curved wall — the
 * escape hatch, the pistol port — need both the point and the direction the
 * wall faces, and deriving them from the same parameterisation the wall itself
 * uses is what stops a fitting sinking into the armour or floating off it.
 */
export function rearArcPoint(bearing: DEG): {
  position: Vector3;
  outward: Vector3;
} {
  const shell = TURRET.shell;
  const frontZ = FRONT_Z;
  const rearZ = mm(FRONT_Z - shell.length);
  const widestZ = mm(frontZ - (frontZ - rearZ) * shell.widestAtFraction);
  const a = shell.width / 2;
  const b = widestZ - rearZ;

  const side = Math.sign(R(bearing)) || 1;
  const theta = Math.PI / 2 - Math.abs(R(bearing));

  const x = side * a * Math.cos(theta);
  const z = widestZ - b * Math.sin(theta);

  // Outward normal of the ellipse at this parameter.
  const outward = new Vector3(side * b * Math.cos(theta), 0, -a * Math.sin(theta)).normalize();

  return { position: new Vector3(S(mm(x)), 0, S(mm(z))), outward };
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

/**
 * Lids on the two turret hatches.
 *
 * Both were open holes, and the cupola in particular read as a hollow ring you
 * could see the inside of — which no photograph of a buttoned-up Tiger shows.
 * They are built closed, seated on their rims the way the hull lids are, and
 * carry their hinges so the mechanism is visible even before it moves.
 */
function buildHatchLids(ctx: BuildContext): void {
  const roofTop = mm(WALL_TOP_Y + ARMOUR.turret.roof.thickness);
  const c = TURRET.cupola;
  const cupolaTop = mm(roofTop + c.height + ARMOUR.turret.roof.thickness);

  // Commander's lid, on top of the drum.
  structuralPlate(ctx, {
    outline: translate(
      circle(mm(c.hatchDiameter / 2 + TURRET.lidOverlap), APERTURE_SEGMENTS),
      c.centreX,
      -(TURRET.ring.centreZ + c.centreZ),
    ),
    thickness: c.hatchThickness,
    frame: facingUp(mm(cupolaTop + c.hatchThickness)),
    chamfer: HULL.chamfer.structural,
    region: Region.Exterior,
    materials: { inner: 'interiorIvoryPaint' },
    wear: WEAR.footTraffic,
    edgeBandWidth: HULL.interiorEdgeBand,
  });

  // Loader's lid: the same rounded oblong as the aperture it closes, oversized
  // so it seats on the rim rather than dropping through.
  const l = TURRET.loaderHatch;
  structuralPlate(ctx, {
    outline: translate(
      roundedRect(
        mm(l.width + TURRET.lidOverlap * 2),
        mm(l.length + TURRET.lidOverlap * 2),
        l.cornerRadius,
        HATCH_CORNER_SEGMENTS,
      ),
      l.centreX,
      -(TURRET.ring.centreZ + l.centreZ),
    ),
    thickness: l.thickness,
    frame: facingUp(mm(roofTop + l.thickness)),
    chamfer: HULL.chamfer.structural,
    region: Region.Exterior,
    materials: { inner: 'interiorIvoryPaint' },
    wear: WEAR.footTraffic,
    edgeBandWidth: HULL.interiorEdgeBand,
  });
}

export function buildTurret(ctx: BuildContext): PartResult {
  const start = ctx.render.triangleCount;

  buildShellWall(ctx);
  buildFrontPlate(ctx);
  buildRoof(ctx);
  buildCupola(ctx);
  buildHatchLids(ctx);

  return {
    name: 'turret',
    triangleCount: ctx.render.triangleCount - start,
    collision: [],
    frames: new Map(),
  };
}
