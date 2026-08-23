import { Matrix4, Vector3, type Vector2 } from 'three';
import { Region, WEAR } from '../../geom/attributes.js';
import { rect, type Poly2 } from '../../geom/poly2.js';
import { structuralPlate } from '../emit.js';
import { S, SIDES, mm, sideSign, type Side } from '../../spec/units.js';
import { TRACK, TRACK_CENTRE_X } from '../../spec/runningGear.js';
import type { BuildContext, PartResult } from '../types.js';
import { linkPlacements, trackPath } from './trackPath.js';

/**
 * The tracks: 96 individual links a side, laid along the belt path.
 *
 * Individual links rather than a textured band, because the brief asks for
 * them and because a Tiger's track is one of the few places where the
 * difference is obvious at any distance: the pads catch light separately, the
 * gaps between them show ground, and the guide horns break the top edge.
 *
 * Each link is a plate with a guide horn, built by the same primitive as the
 * armour, so a link is a genuine closed solid and the whole track passes the
 * manifold audit along with everything else.
 */

/** How wide the pad is left of the horn channel, as a fraction of track width. */
const HORN_CHANNEL_FRACTION = 0.18;

/**
 * Frames for one link.
 *
 * The belt path is the track's INNER surface — the face the road wheels roll
 * on — so the pad lies OUTBOARD of it and the guide horn stands inboard. Laying
 * the pad centred on the path instead drops half its thickness through the
 * ground plane, all the way round.
 *
 * `plate()` puts its outer face at local z = 0 with the material behind, so
 * each frame's +Z is the direction that piece faces: outward for the pad, and
 * inward for the horn.
 */
function linkFrames(
  side: Side,
  position: Vector2,
  angle: number,
): { pad: Matrix4; horn: Matrix4 } {
  const dz = Math.cos(angle);
  const dy = Math.sin(angle);
  // Outward normal of a counter-clockwise hull: rotate the heading by -90°.
  const outward = new Vector3(0, -dz, dy);
  const heading = new Vector3(0, dy, dz);
  const lateral = new Vector3(1, 0, 0);

  const x = S(mm(sideSign(side) * TRACK_CENTRE_X));
  const onPath = new Vector3(x, S(mm(position.y)), S(mm(position.x)));

  const pad = new Matrix4().makeBasis(lateral, heading, outward);
  pad.setPosition(onPath.clone().addScaledVector(outward, S(TRACK.linkThickness)));

  const horn = new Matrix4().makeBasis(
    lateral,
    heading.clone().negate(),
    outward.clone().negate(),
  );
  horn.setPosition(onPath.clone().addScaledVector(outward, -S(TRACK.guideHornHeight)));

  return { pad, horn };
}

export function buildTracks(ctx: BuildContext): PartResult {
  const start = ctx.render.triangleCount;

  // The pad: one link's ground-contact plate, a little shorter than the pitch
  // so consecutive links do not fight for the same millimetre when the track
  // curves round the sprocket.
  const padLength = mm(TRACK.pitch - TRACK.linkGap);
  const padOutline: Poly2 = rect(TRACK.width, padLength);

  // The horn channel: the gap the road wheels' flanges run in. Cut as a hole
  // rather than left as two separate pads, so a link stays one solid.
  const channelWidth = mm(TRACK.width * HORN_CHANNEL_FRACTION);

  for (const side of SIDES) {
    const path = trackPath(side);
    for (const placement of linkPlacements(path)) {
      const { pad: padFrame, horn: hornFrame } = linkFrames(
        side,
        placement.position,
        placement.angle,
      );

      structuralPlate(ctx, {
        outline: padOutline,
        thickness: TRACK.linkThickness,
        frame: padFrame,
        chamfer: LINK_CHAMFER,
        region: Region.Exterior,
        materials: { inner: 'trackSteelWorn', outer: 'trackSteelWorn', edge: 'trackSteelWorn' },
        // Track spends its life in mud and shed paint within a week.
        wear: WEAR.constant,
        edgeBandWidth: TRACK.linkEdgeBand,
      });

      // The guide horn, standing inboard between the wheel rows. It is the
      // single most numerous piece of geometry on the vehicle — 192 of them —
      // and at distance it is a few pixels tucked under the track guards, so it
      // is the first thing to go when detail drops.
      if (ctx.detail >= 2) continue;
      structuralPlate(ctx, {
        outline: rect(channelWidth, mm(padLength * HORN_LENGTH_FRACTION)),
        thickness: TRACK.guideHornHeight,
        frame: hornFrame,
        chamfer: LINK_CHAMFER,
        region: Region.Exterior,
        materials: { inner: 'trackSteelWorn', outer: 'trackSteelWorn', edge: 'trackSteelWorn' },
        wear: WEAR.constant,
        edgeBandWidth: TRACK.linkEdgeBand,
      });
    }
  }

  return {
    name: 'tracks',
    triangleCount: ctx.render.triangleCount - start,
    collision: [],
    frames: new Map(),
  };
}

/** Edge break on a link. Track steel is cast and its arrises are soft. */
const LINK_CHAMFER = mm(3);

/** How much of the pitch the guide horn occupies. */
const HORN_LENGTH_FRACTION = 0.55;
