import { Vector2 } from 'three';
import { mm, type MM, type Side } from '../../spec/units.js';
import {
  IDLER,
  ROAD_WHEEL,
  SPROCKET,
  SUSPENSION,
  TRACK,
  stationZ,
} from '../../spec/runningGear.js';
import { axleCentre } from './suspension.js';
import { toMM } from '../../spec/units.js';

/**
 * Where the track actually lies.
 *
 * A Tiger's track is a belt around three kinds of pulley: the drive sprocket at
 * the front, the idler at the back, and the road wheels in between. It has no
 * return rollers — the top run rests directly on the road wheels, which is why
 * a Tiger's upper track line is straight and low rather than lifted clear.
 *
 * The path is computed as the convex hull of those circles, which is exactly
 * what a taut belt is. Sampling each circle and hulling the points is not the
 * most elegant formulation, but it handles three different radii without
 * special cases and it cannot produce a path that cuts through a wheel — which
 * a hand-authored spline absolutely can, and which looks wrong from the one
 * angle nobody checked.
 */

/** Points sampled per circle before hulling. */
const CIRCLE_SAMPLES = 72;

/** Guard against dividing by a zero-length hull segment. Not a dimension. */
const MIN_SEGMENT = 1e-6;

export interface TrackCircle {
  readonly centre: Vector2;
  readonly radius: number;
}

/** The pulleys the track wraps, in millimetres, in the (z, y) plane. */
export function trackCircles(
  side: Side,
  deflection: (station: number) => number = () => 0,
): TrackCircle[] {
  const circles: TrackCircle[] = [
    {
      centre: new Vector2(SPROCKET.centreZ, SPROCKET.centreY),
      radius: SPROCKET.outerDiameter / 2,
    },
    {
      centre: new Vector2(IDLER.centreZ, IDLER.centreY),
      radius: IDLER.outerDiameter / 2,
    },
  ];

  for (let station = 0; station < SUSPENSION.stationsPerSide; station++) {
    const axle = axleCentre(side, station, deflection(station));
    circles.push({
      centre: new Vector2(toMM(axle.z), toMM(axle.y)),
      radius: ROAD_WHEEL.diameter / 2,
    });
    void stationZ;
  }
  return circles;
}

/** Andrew's monotone chain. Returns the hull counter-clockwise. */
function convexHull(points: Vector2[]): Vector2[] {
  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const cross = (o: Vector2, a: Vector2, b: Vector2): number =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const build = (pts: Vector2[]): Vector2[] => {
    const out: Vector2[] = [];
    for (const p of pts) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, p) <= 0) {
        out.pop();
      }
      out.push(p);
    }
    out.pop();
    return out;
  };

  const lower = build(sorted);
  const upper = build([...sorted].reverse());
  return [...lower, ...upper];
}

export interface TrackPath {
  /** Closed polyline in the (z, y) plane, millimetres, counter-clockwise. */
  readonly points: Vector2[];
  /** Perimeter, millimetres. */
  readonly length: MM;
  /** Perimeter minus the track's own fixed length. Positive means slack. */
  readonly slack: MM;
}

/**
 * The belt path for one side.
 *
 * The track's length is FIXED at 96 links of 130 mm pitch, so the geometry has
 * to agree with it rather than the other way round. `slack` reports the
 * disagreement in millimetres instead of hiding it: a large positive number
 * means the run needs sag, a negative one means the track physically will not
 * go on, and either is a fact about the suspension geometry worth knowing.
 */
export function trackPath(
  side: Side,
  deflection: (station: number) => number = () => 0,
): TrackPath {
  const cloud: Vector2[] = [];
  for (const c of trackCircles(side, deflection)) {
    for (let i = 0; i < CIRCLE_SAMPLES; i++) {
      const a = (i / CIRCLE_SAMPLES) * Math.PI * 2;
      cloud.push(new Vector2(c.centre.x + Math.cos(a) * c.radius, c.centre.y + Math.sin(a) * c.radius));
    }
  }

  const points = convexHull(cloud);
  let length = 0;
  for (let i = 0; i < points.length; i++) {
    length += points[i]!.distanceTo(points[(i + 1) % points.length]!);
  }

  return {
    points,
    length: mm(length),
    slack: mm(TRACK.totalLength - length),
  };
}

/**
 * Positions and headings for every link, walked at the track's own pitch.
 *
 * The links are laid at 130 mm intervals along the path, and the last one meets
 * the first because the path is closed. Where the perimeter is not an exact
 * multiple of the pitch the difference is spread across every link rather than
 * dumped into the final gap, which is what a real track does when its pins wear.
 */
export function linkPlacements(path: TrackPath): { position: Vector2; angle: number }[] {
  const n = TRACK.linksPerSide;
  const step = path.length / n;
  const out: { position: Vector2; angle: number }[] = [];

  let segment = 0;
  let along = 0;
  let travelled = 0;

  for (let i = 0; i < n; i++) {
    const target = i * step;
    while (travelled < target && segment < path.points.length) {
      const a = path.points[segment]!;
      const b = path.points[(segment + 1) % path.points.length]!;
      const segLength = a.distanceTo(b);
      if (travelled + segLength - along >= target) {
        along += target - travelled;
        travelled = target;
        break;
      }
      travelled += segLength - along;
      along = 0;
      segment += 1;
    }

    const a = path.points[Math.min(segment, path.points.length - 1)]!;
    const b = path.points[(segment + 1) % path.points.length]!;
    const dir = new Vector2(b.x - a.x, b.y - a.y);
    const segLength = Math.max(MIN_SEGMENT, dir.length());
    dir.divideScalar(segLength);
    out.push({
      position: new Vector2(a.x + dir.x * along, a.y + dir.y * along),
      angle: Math.atan2(dir.y, dir.x),
    });
  }

  return out;
}
