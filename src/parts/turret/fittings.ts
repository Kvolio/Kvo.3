import { Vector2, Vector3 } from 'three';
import { Region, WEAR } from '../../geom/attributes.js';
import { rect, type Poly2 } from '../../geom/poly2.js';
import { emitRevolve } from '../../prims/lathe.js';
import { R, S, SIDES, mm, sideSign, type MM, type Side } from '../../spec/units.js';
import { ARMOUR } from '../../spec/armour.js';
import { HULL } from '../../spec/hull.js';
import { TRACK } from '../../spec/runningGear.js';
import { TURRET } from '../../spec/turret.js';
import { structuralPlate } from '../emit.js';
import type { BuildContext, PartResult } from '../types.js';
import { facingOutboard, facingUp } from '../hull/frames.js';

/**
 * What hangs off the turret: the rear stowage bin, the smoke dischargers, and
 * the spare track links racked on its sides.
 *
 * All three are dated. The Rommelkiste arrives in January 1943 and the NbK 39
 * dischargers are deleted in June, so a turret carrying both is a turret from a
 * narrow window — which is exactly the window this vehicle is from. The spare
 * links are not regulation at all; crews hung them there for the extra plate and
 * both supplied photographs show them.
 */

/** Radial segments on a discharger tube. */
const TUBE_SEGMENTS = 14;

/** Reported distance from a structural edge, for the chipping shader. */
const FITTING_EDGE_DIST = 25;

/** The ring plane and the turret roof, which everything here hangs off. */
const RING_Y: MM = TURRET.ring.planeY;
const ROOF_Y: MM = mm(RING_Y + TURRET.shell.interiorHeight + ARMOUR.turret.roof.thickness);

/** Aftmost point of the turret, on the centreline. */
const REAR_Z: MM = mm(
  TURRET.ring.centreZ + TURRET.shell.frontOverhang - TURRET.shell.length,
);

/**
 * The Rommelkiste: the sheet-steel stowage bin bolted across the turret rear.
 *
 * Not armour — it is a box for the crew's kit, and it reads as sheet rather
 * than plate because it is thin and its edges are folded rather than cut.
 */
function buildStowageBin(ctx: BuildContext): void {
  if (!ctx.variant.turretStowageBin) return;

  const b = TURRET.stowageBin;
  const centreY = mm(ROOF_Y - b.height / 2 - b.dropBelowRoof);

  // Front, back, and the wrap around them. Built as one plate extruded aft, so
  // the bin is a genuine box rather than five sheets that happen to meet.
  structuralPlate(ctx, {
    outline: rect(b.width, b.height),
    thickness: b.depth,
    frame: binFrame(centreY),
    chamfer: HULL.chamfer.side,
    region: Region.Exterior,
    // Painted with the rest of the vehicle. `handledSteel` is a bare, rusted
    // finish and made the bin read as a lump of scrap bolted to the turret.
    materials: {
      inner: 'armourPaintedExterior',
      outer: 'armourPaintedExterior',
      edge: 'armourPaintedExterior',
    },
    // Everything the crew could not fit inside went in here.
    wear: WEAR.handled,
    edgeBandWidth: b.edgeBand,
  });
}

/** A rear-facing plate on the turret's aft face. */
function binFrame(centreY: MM): ReturnType<typeof facingUp> {
  const b = TURRET.stowageBin;
  const m = facingUp(mm(0)).makeRotationY(Math.PI);
  m.setPosition(0, S(centreY), S(mm(REAR_Z - b.depth)));
  return m;
}

/**
 * NbK 39 smoke candle dischargers, three a side on the turret's forward
 * flanks, pointing up and outboard.
 *
 * Deleted in June 1943 after the candles proved liable to be set off by small
 * arms fire and blind the vehicle they were meant to screen.
 */
function buildSmokeDischargers(ctx: BuildContext): void {
  if (!ctx.variant.smokeDischargers) return;

  const d = TURRET.smokeDischargers;
  const halfWidth = mm(TURRET.shell.width / 2);
  const centreY = mm(RING_Y + TURRET.shell.interiorHeight * DISCHARGER_HEIGHT_FRACTION);

  for (const side of SIDES) {
    const sign = sideSign(side);
    for (let i = 0; i < d.perSide; i++) {
      const z = mm(
        TURRET.ring.centreZ + d.clusterZ + (i - (d.perSide - 1) / 2) * d.spacing,
      );
      // Splayed up and outboard: the frame tilts the tube out of vertical by
      // the cluster's elevation, away from the turret it is bolted to.
      // Standing PROUD of the turret side on their bracket, not sunk into it.
      const frame = facingUp(mm(0)).makeRotationZ(R(d.elevation) * -sign);
      frame.setPosition(
        S(mm(sign * (halfWidth + d.standoff))),
        S(centreY),
        S(z),
      );

      emitRevolve(ctx.render, {
        profile: [
          new Vector2(0, 0),
          new Vector2(S(mm(d.tubeDiameter / 2)), 0),
          new Vector2(S(mm(d.tubeDiameter / 2)), S(d.tubeLength)),
          // Open at the mouth: it is a mortar, not a bollard.
          new Vector2(S(mm(d.tubeDiameter / 2 - d.wallThickness)), S(d.tubeLength)),
          new Vector2(S(mm(d.tubeDiameter / 2 - d.wallThickness)), 0),
          new Vector2(0, 0),
        ],
        segments: TUBE_SEGMENTS,
        material: 'exhaustSteel',
        region: Region.Exterior,
        frame,
        edgeDist: FITTING_EDGE_DIST,
      });

    }

    // The bracket that holds the cluster there, once per side.
    //
    // Without it the tubes stand 60 mm off the turret attached to nothing, and
    // in an orthographic view they read as loose geometry floating beside the
    // tank — which is exactly what two critics reported, independently.
    const bracketFrame = facingOutboard(side, halfWidth);
    bracketFrame.setPosition(
      S(mm(sign * halfWidth)),
      S(centreY),
      S(mm(TURRET.ring.centreZ + d.clusterZ)),
    );
    structuralPlate(ctx, {
      outline: rect(mm(d.spacing * d.perSide), d.bracketWidth),
      thickness: d.standoff,
      frame: bracketFrame,
      chamfer: HULL.chamfer.side,
      region: Region.Exterior,
      materials: {
        inner: 'machinedSteel',
        outer: 'machinedSteel',
        edge: 'machinedSteel',
      },
      edgeBandWidth: d.bracketEdgeBand,
    });
  }
}

/** Where up the turret side the discharger cluster sits. */
const DISCHARGER_HEIGHT_FRACTION = 0.62;

/**
 * Spare track links racked on the turret sides.
 *
 * Crew practice rather than regulation — they are there for the extra hundred
 * millimetres of steel, and both supplied photographs show them. Built from the
 * real link's dimensions, because they ARE real links.
 */
function buildSpareTrackLinks(ctx: BuildContext): void {
  const halfWidth = mm(TURRET.shell.width / 2);
  const centreY = mm(RING_Y + TURRET.shell.interiorHeight * SPARE_LINK_HEIGHT_FRACTION);

  for (const side of SIDES) {
    for (let i = 0; i < TURRET.spareTrackLinks.perSide; i++) {
      const z = mm(
        TURRET.ring.centreZ +
          TURRET.spareTrackLinks.centreZ +
          (i - (TURRET.spareTrackLinks.perSide - 1) / 2) * TRACK.pitch,
      );
      const outline: Poly2 = rect(TRACK.pitch, TRACK.width * SPARE_LINK_VISIBLE);
      structuralPlate(ctx, {
        outline,
        thickness: TRACK.linkThickness,
        frame: spareLinkFrame(side, halfWidth, centreY, z),
        chamfer: HULL.chamfer.side,
        region: Region.Exterior,
        materials: {
          inner: 'trackSteelWorn',
          outer: 'trackSteelWorn',
          edge: 'trackSteelWorn',
        },
        wear: WEAR.constant,
        edgeBandWidth: TRACK.linkEdgeBand,
      });
    }
  }
}

/** A link lying flat against the turret side, long axis vertical. */
function spareLinkFrame(side: Side, x: MM, y: MM, z: MM): ReturnType<typeof facingUp> {
  const m = facingOutboard(side, x);
  m.setPosition(new Vector3(S(mm(sideSign(side) * x)), S(y), S(z)));
  return m;
}

/** How much of a link's width shows when it is racked edge-on to the turret. */
const SPARE_LINK_VISIBLE = 0.55;

/** Where up the turret side the spare links are racked. */
const SPARE_LINK_HEIGHT_FRACTION = 0.45;

export function buildTurretFittings(ctx: BuildContext): PartResult {
  const start = ctx.render.triangleCount;
  buildStowageBin(ctx);
  buildSmokeDischargers(ctx);
  buildSpareTrackLinks(ctx);
  return {
    name: 'turretFittings',
    triangleCount: ctx.render.triangleCount - start,
    collision: [],
    frames: new Map(),
  };
}
