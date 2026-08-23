import { Vector2, Vector3 } from 'three';
import { Region } from '../../geom/attributes.js';
import { emitRevolve } from '../../prims/lathe.js';
import { R, S, SIDES, deg, mm, sideSign, toMM, type Side } from '../../spec/units.js';
import {
  SHOCK_STATIONS,
  STATIC_ARM_DROOP,
  SUSPENSION,
  TRACK_CENTRE_X,
  armSign,
  stationZ,
  wheelPlanesForStation,
} from '../../spec/runningGear.js';
import { HULL, LOWER_HALF_WIDTH } from '../../spec/hull.js';
import type { BuildContext, PartResult } from '../types.js';
import { emitIdler, emitRoadWheel, emitSprocket } from './wheels.js';
import { rollingFrame } from './frames.js';

/**
 * The suspension: eight transverse torsion bars a side, each with a swing arm
 * carrying three road wheels.
 *
 * Two things here are Tiger-specific and are encoded rather than assumed.
 *
 * The arms LEAD on one side and TRAIL on the other. Sixteen bars have to pass
 * each other inside a hull only so wide, so each side's bars are anchored to
 * the opposite wall and the arms point in opposite directions. Mirroring this
 * away is the classic reconstruction error, and it is visible in any side-on
 * photograph as the wheels sitting slightly forward of their bars on one side.
 *
 * The wheels INTERLEAVE across three rows. On axes 515 mm apart, 800 mm wheels
 * simply cannot share a plane; the three rows are what make the arrangement
 * possible, and they are why the running gear reads as a Tiger's rather than
 * as any other tank's.
 */

/**
 * Arm angle below horizontal for a given deflection.
 *
 * At rest the arm droops by the derived `STATIC_ARM_DROOP`, which is what puts
 * the wheel on the ground rather than through it; compression lifts it back
 * toward horizontal.
 */
function armAngle(deflectionDeg: number): number {
  return R(deg(STATIC_ARM_DROOP - deflectionDeg));
}

/** Radial segments on an arm boss or a torsion bar. Small and numerous. */
const BOSS_SEGMENTS = 16;

/** Reported distance from a structural edge, for the chipping shader. */
const ARM_EDGE_DIST = 25;

export interface SuspensionState {
  /** Arm rotation from neutral, in DEGREES, per side and station. */
  readonly deflection?: (side: Side, station: number) => number;
}

/**
 * Axle centre for one station, given the arm's current rotation.
 *
 * Exported because the track path solver needs the same answer the geometry
 * used: a track computed against nominal wheel positions while the wheels sit
 * somewhere else is a track that floats.
 */
export function axleCentre(side: Side, station: number, deflectionDeg = 0): Vector3 {
  const pivotZ = stationZ(station);
  const lead = armSign(side);
  const theta = armAngle(deflectionDeg);
  const armLength = SUSPENSION.armLength;
  return new Vector3(
    S(mm(sideSign(side) * TRACK_CENTRE_X)),
    S(mm(SUSPENSION.pivotY - armLength * Math.sin(theta))),
    S(mm(pivotZ + lead * armLength * Math.cos(theta))),
  );
}

/** The swing arm itself: a boss on the bar, a beam, and a stub axle. */
function emitSwingArm(
  ctx: BuildContext,
  side: Side,
  station: number,
  deflectionDeg: number,
): void {
  const lead = armSign(side);
  const pivotZ = stationZ(station);
  const theta = armAngle(deflectionDeg);

  const armX = mm(LOWER_HALF_WIDTH + SUSPENSION.armStandoff);
  const bossFrame = rollingFrame(side, armX, SUSPENSION.pivotY, pivotZ);

  // Boss around the torsion bar's splined end.
  emitRevolve(ctx.render, {
    profile: [
      new Vector2(0, 0),
      new Vector2(S(SUSPENSION.bossRadius), 0),
      new Vector2(S(SUSPENSION.bossRadius), S(SUSPENSION.armWidth)),
      new Vector2(0, S(SUSPENSION.armWidth)),
    ],
    segments: BOSS_SEGMENTS,
    material: 'machinedSteel',
    region: Region.Exterior,
    frame: bossFrame,
    edgeDist: ARM_EDGE_DIST,
  });

  // The beam, from the boss out to the axle. Built as a flattened cylinder
  // swept along the arm rather than as a box, because a Tiger's arms are
  // forgings with a round section, not plate.
  const dz = lead * SUSPENSION.armLength * Math.cos(theta);
  const dy = -SUSPENSION.armLength * Math.sin(theta);
  const midFrame = rollingFrame(
    side,
    armX,
    mm(SUSPENSION.pivotY + dy / 2),
    mm(pivotZ + dz / 2),
  );
  const half = SUSPENSION.armLength / 2;
  emitRevolve(ctx.render, {
    profile: [
      new Vector2(0, 0),
      new Vector2(S(mm(half)), 0),
      new Vector2(S(mm(half)), S(SUSPENSION.armWidth)),
      new Vector2(0, S(SUSPENSION.armWidth)),
    ],
    segments: 4,
    arcStart: Math.atan2(dy, dz) - ARM_BEAM_ARC / 2,
    arcLength: ARM_BEAM_ARC,
    material: 'machinedSteel',
    region: Region.Exterior,
    frame: midFrame,
    edgeDist: ARM_EDGE_DIST,
  });
}

/** Angular width of the arm beam's sweep, radians. A shape parameter. */
const ARM_BEAM_ARC = 0.55;

/**
 * The torsion bars themselves, running the full width of the hull under the
 * floor. Sixteen of them, and they are why the Tiger's floor is where it is.
 */
function emitTorsionBars(ctx: BuildContext): void {
  const barY = mm(HULL.floorY + SUSPENSION.pivotY - TORSION_BELOW_PIVOT);
  for (let station = 0; station < SUSPENSION.stationsPerSide; station++) {
    const z = stationZ(station);
    emitRevolve(ctx.render, {
      profile: [
        new Vector2(0, S(mm(-SUSPENSION.torsionBar.length / 2))),
        new Vector2(S(mm(SUSPENSION.torsionBar.diameter / 2)), S(mm(-SUSPENSION.torsionBar.length / 2))),
        new Vector2(S(mm(SUSPENSION.torsionBar.diameter / 2)), S(mm(SUSPENSION.torsionBar.length / 2))),
        new Vector2(0, S(mm(SUSPENSION.torsionBar.length / 2))),
      ],
      segments: BOSS_SEGMENTS,
      material: 'machinedSteel',
      region: Region.Internal,
      frame: rollingFrame('left', mm(0), barY, z),
      edgeDist: ARM_EDGE_DIST,
    });
  }
}

/** How far the bar axis sits below the arm pivot. They are not coaxial. */
const TORSION_BELOW_PIVOT = mm(0);

export function buildRunningGear(ctx: BuildContext, state: SuspensionState = {}): PartResult {
  const start = ctx.render.triangleCount;
  const deflect = state.deflection ?? ((): number => 0);

  emitTorsionBars(ctx);

  for (const side of SIDES) {
    emitSprocket(ctx, side);
    emitIdler(ctx, side);

    for (let station = 0; station < SUSPENSION.stationsPerSide; station++) {
      const d = deflect(side, station);
      emitSwingArm(ctx, side, station, d);

      const axle = axleCentre(side, station, d);
      // Three wheels per axle, in the interleave rows this station occupies.
      for (const plane of wheelPlanesForStation(station)) {
        const x = mm(sideSign(side) * (TRACK_CENTRE_X + plane));
        emitRoadWheel(ctx, side, mm(Math.abs(x)), toMM(axle.y), toMM(axle.z));
      }
    }
  }

  return {
    name: 'runningGear',
    triangleCount: ctx.render.triangleCount - start,
    collision: [],
    frames: new Map(),
    reconstructed: true,
  };
}

/** Stations that carry a hydraulic shock absorber, re-exported for the report. */
export { SHOCK_STATIONS };
