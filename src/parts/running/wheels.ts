import { Vector2, Vector3 } from 'three';
import { Region, WEAR } from '../../geom/attributes.js';
import { emitRevolve } from '../../prims/lathe.js';
import { S, mm, type MM, type Side } from '../../spec/units.js';
import {
  IDLER,
  ROAD_WHEEL,
  SPROCKET,
  TRACK,
  TRACK_CENTRE_X,
} from '../../spec/runningGear.js';
import type { BuildContext } from '../types.js';
import { rollingFrame } from './frames.js';

/**
 * Road wheels, the drive sprocket and the idler.
 *
 * The Tiger carries 24 road wheels a side in three interleaved rows, which is
 * the single most recognisable thing about it and the reason the running gear
 * has to be built as real bodies rather than suggested. At 800 mm across on
 * axes 515 mm apart they physically cannot sit in one plane; the interleave is
 * not styling, it is what lets that many wheels carry 57 tonnes.
 */

/** Radial segments on a road wheel. They are seen close and there are 48. */
const WHEEL_SEGMENTS = 28;

/** Radial segments on the sprocket and idler bodies. */
const HUB_SEGMENTS = 24;

/** Reported distance from a structural edge, for the chipping shader. */
const RUNNING_EDGE_DIST = 30;

/**
 * One road wheel, built upright and laid over by `rollingFrame`.
 *
 * The profile runs from the hub face out to the tyre and back, so the wheel is
 * a closed solid: a dished steel disc with a solid rubber tyre on its rim and a
 * raised hub cap. Steel-rimmed wheels arrive in February 1944 and are a
 * different part; this is the rubber-tyred Ausf. H wheel.
 */
export function emitRoadWheel(ctx: BuildContext, side: Side, x: MM, y: MM, z: MM): void {
  const w = ROAD_WHEEL;
  const halfWidth = mm(w.width / 2);
  const tyreOuter = mm(w.diameter / 2);
  const tyreInner = mm(tyreOuter - w.tyreThickness);
  const hubRadius = mm(w.hubDiameter / 2);

  const frame = rollingFrame(side, x, y, z);

  // The rubber tyre: a band around the rim, slightly proud of the disc so it
  // reads as a separate part rather than as paint.
  emitRevolve(ctx.render, {
    profile: [
      new Vector2(S(tyreInner), S(mm(-halfWidth))),
      new Vector2(S(tyreOuter), S(mm(-halfWidth))),
      new Vector2(S(tyreOuter), S(halfWidth)),
      new Vector2(S(tyreInner), S(halfWidth)),
      new Vector2(S(tyreInner), S(mm(-halfWidth))),
    ],
    segments: WHEEL_SEGMENTS,
    material: 'wheelRubber',
    region: Region.Exterior,
    frame,
    edgeDist: RUNNING_EDGE_DIST,
  });

  // The steel disc behind it, dished so the hub stands proud of the rim.
  const discHalf = mm(halfWidth - w.discInset);
  emitRevolve(ctx.render, {
    profile: [
      new Vector2(0, S(mm(-discHalf))),
      new Vector2(S(tyreInner), S(mm(-discHalf))),
      new Vector2(S(tyreInner), S(discHalf)),
      new Vector2(S(hubRadius), S(discHalf)),
      new Vector2(S(hubRadius), S(mm(discHalf + w.hubProud))),
      new Vector2(0, S(mm(discHalf + w.hubProud))),
    ],
    segments: WHEEL_SEGMENTS,
    material: 'armourPaintedExterior',
    region: Region.Exterior,
    frame,
    // Rims are scuffed by thrown track and by every kerb the tank ever hit.
    wear: WEAR.footTraffic,
    edgeDist: RUNNING_EDGE_DIST,
  });

  // Rim bolts: 18 from February 1943, up from 20 — an Ausf. H discriminator, so
  // they are counted rather than suggested. Placed in the wheel's own frame and
  // carried into vehicle space with it, so they cannot drift off the rim.
  const boltRadius = mm((tyreInner + hubRadius) / 2);
  const boltNormal = new Vector3(0, 1, 0).transformDirection(frame);
  for (let i = 0; i < w.rimBolts; i++) {
    const a = (i / w.rimBolts) * Math.PI * 2;
    const local = new Vector3(
      Math.cos(a) * S(boltRadius),
      S(discHalf),
      Math.sin(a) * S(boltRadius),
    ).applyMatrix4(frame);
    ctx.fasteners.add('hexBolt', local, boltNormal, { region: Region.Exterior });
  }
}

/**
 * The front drive sprocket: twin toothed rings either side of a channel the
 * track's guide horns run in, on a spoked hub.
 *
 * The teeth are cut as a partial revolve per tooth rather than modelled as a
 * gear profile — at 20 teeth on a 914 mm wheel that reads correctly and keeps
 * the sprocket to a few hundred triangles.
 */
export function emitSprocket(ctx: BuildContext, side: Side): void {
  const s = SPROCKET;
  const frame = rollingFrame(side, TRACK_CENTRE_X, s.centreY, s.centreZ);
  const ringHalfWidth = mm(TRACK.width / 2 - SPROCKET.ringInset);
  const channelHalf = mm(TRACK.guideHornHeight / 2 + SPROCKET.ringInset);
  const rootRadius = mm(s.pitchRadius - TRACK.pitch / 3);

  for (const sign of [-1, 1] as const) {
    const outer = mm(sign * ringHalfWidth);
    const inner = mm(sign * channelHalf);
    // The ring body: a disc from the hub out to the tooth roots.
    emitRevolve(ctx.render, {
      profile: [
        new Vector2(S(mm(s.hubDiameter / 2)), S(inner)),
        new Vector2(S(rootRadius), S(inner)),
        new Vector2(S(rootRadius), S(outer)),
        new Vector2(S(mm(s.hubDiameter / 2)), S(outer)),
        new Vector2(S(mm(s.hubDiameter / 2)), S(inner)),
      ],
      segments: HUB_SEGMENTS,
      material: 'machinedSteel',
      region: Region.Exterior,
      frame,
      wear: WEAR.footTraffic,
      edgeDist: RUNNING_EDGE_DIST,
    });

    // The teeth, one partial revolve each.
    const toothArc = (Math.PI * 2) / s.teeth;
    for (let i = 0; i < s.teeth; i++) {
      emitRevolve(ctx.render, {
        profile: [
          new Vector2(S(rootRadius), S(inner)),
          new Vector2(S(mm(s.outerDiameter / 2)), S(inner)),
          new Vector2(S(mm(s.outerDiameter / 2)), S(outer)),
          new Vector2(S(rootRadius), S(outer)),
          new Vector2(S(rootRadius), S(inner)),
        ],
        segments: 3,
        arcStart: i * toothArc,
        arcLength: toothArc * TOOTH_DUTY,
        material: 'trackSteelWorn',
        region: Region.Exterior,
        frame,
        edgeDist: RUNNING_EDGE_DIST,
      });
    }
  }

  // Hub and spokes, spanning the channel.
  emitRevolve(ctx.render, {
    profile: [
      new Vector2(0, S(mm(-ringHalfWidth))),
      new Vector2(S(mm(s.hubDiameter / 2)), S(mm(-ringHalfWidth))),
      new Vector2(S(mm(s.hubDiameter / 2)), S(ringHalfWidth)),
      new Vector2(0, S(ringHalfWidth)),
    ],
    segments: HUB_SEGMENTS,
    material: 'machinedSteel',
    region: Region.Exterior,
    frame,
    edgeDist: RUNNING_EDGE_DIST,
  });
}

/** How much of each tooth pitch the tooth itself occupies. */
const TOOTH_DUTY = 0.45;

/** The rear idler, on which track tension is set by draw bolts. */
export function emitIdler(ctx: BuildContext, side: Side): void {
  const frame = rollingFrame(side, TRACK_CENTRE_X, IDLER.centreY, IDLER.centreZ);
  const halfWidth = mm(TRACK.width / 2 - SPROCKET.ringInset);
  const outer = mm(IDLER.outerDiameter / 2);

  for (const sign of [-1, 1] as const) {
    const face = mm(sign * halfWidth);
    const inner = mm(sign * (TRACK.guideHornHeight / 2 + SPROCKET.ringInset));
    emitRevolve(ctx.render, {
      profile: [
        new Vector2(S(mm(IDLER.hubDiameter / 2)), S(inner)),
        new Vector2(S(outer), S(inner)),
        new Vector2(S(outer), S(face)),
        new Vector2(S(mm(IDLER.hubDiameter / 2)), S(face)),
        new Vector2(S(mm(IDLER.hubDiameter / 2)), S(inner)),
      ],
      segments: HUB_SEGMENTS,
      material: 'armourPaintedExterior',
      region: Region.Exterior,
      frame,
      wear: WEAR.footTraffic,
      edgeDist: RUNNING_EDGE_DIST,
    });
  }

  emitRevolve(ctx.render, {
    profile: [
      new Vector2(0, S(mm(-halfWidth))),
      new Vector2(S(mm(IDLER.hubDiameter / 2)), S(mm(-halfWidth))),
      new Vector2(S(mm(IDLER.hubDiameter / 2)), S(halfWidth)),
      new Vector2(0, S(halfWidth)),
    ],
    segments: HUB_SEGMENTS,
    material: 'machinedSteel',
    region: Region.Exterior,
    frame,
    edgeDist: RUNNING_EDGE_DIST,
  });
}
