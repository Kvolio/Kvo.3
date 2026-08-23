import { Vector2, ShapeUtils } from 'three';

/**
 * Two-dimensional polygon operations, in millimetres.
 *
 * Everything here runs on a plate's outline BEFORE it is given thickness, which
 * is what makes the expensive-sounding features cheap. An interlocking
 * Verzahnung joint is a sawtooth applied to a 2D edge; a hatch aperture is a
 * hole polygon. Both are exact and deterministic, where the CSG boolean people
 * normally reach for is neither.
 */

export type Poly2 = readonly Vector2[];

export const v2 = (x: number, y: number): Vector2 => new Vector2(x, y);

/** Signed area. Positive means counter-clockwise. */
export function signedArea(poly: Poly2): number {
  let a = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % n]!;
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

export function isCCW(poly: Poly2): boolean {
  return signedArea(poly) > 0;
}

/** Return the polygon wound counter-clockwise, copying only if needed. */
export function ensureCCW(poly: Poly2): Vector2[] {
  const out = poly.map((p) => p.clone());
  if (!isCCW(out)) out.reverse();
  return out;
}

/** Return the polygon wound clockwise. Hole loops must be clockwise. */
export function ensureCW(poly: Poly2): Vector2[] {
  const out = poly.map((p) => p.clone());
  if (isCCW(out)) out.reverse();
  return out;
}

export function perimeter(poly: Poly2): number {
  let L = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    L += poly[i]!.distanceTo(poly[(i + 1) % n]!);
  }
  return L;
}

/** Area enclosed by an outline minus its holes. Used to verify plate volume. */
export function netArea(outline: Poly2, holes: readonly Poly2[] = []): number {
  let a = Math.abs(signedArea(outline));
  for (const h of holes) a -= Math.abs(signedArea(h));
  return a;
}

/** Shortest distance from a point to a polygon's boundary. */
export function distanceToBoundary(p: Vector2, poly: Poly2): number {
  let best = Infinity;
  for (let i = 0, n = poly.length; i < n; i++) {
    best = Math.min(best, distanceToSegment(p, poly[i]!, poly[(i + 1) % n]!));
  }
  return best;
}

export function distanceToSegment(p: Vector2, a: Vector2, b: Vector2): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-12) return p.distanceTo(a);
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = p.x - (a.x + t * abx);
  const dy = p.y - (a.y + t * aby);
  return Math.hypot(dx, dy);
}

/**
 * Shortest distance to the boundary of an outline or any of its holes.
 * This is what feeds `aEdgeDist`: a vertex in the middle of a plate is far from
 * every edge, a vertex on the rim of a hatch aperture is on one.
 */
export function distanceToAnyBoundary(
  p: Vector2,
  outline: Poly2,
  holes: readonly Poly2[] = [],
): number {
  let best = distanceToBoundary(p, outline);
  for (const h of holes) best = Math.min(best, distanceToBoundary(p, h));
  return best;
}

/** Point-in-polygon by ray crossing. Boundary cases are not distinguished. */
export function containsPoint(poly: Poly2, p: Vector2): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1, n = poly.length; i < n; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Offset every edge inward by `d` and re-intersect. Used for chamfers, for
 * weld-bead setbacks and for insetting a face before a bevel band.
 * Miter joints are clamped to avoid spikes at sharp corners.
 */
export function offsetPolygon(poly: Poly2, d: number, miterLimit = 4): Vector2[] {
  const n = poly.length;
  const out: Vector2[] = [];
  const ccw = isCCW(poly);
  const sign = ccw ? 1 : -1;

  for (let i = 0; i < n; i++) {
    const prev = poly[(i - 1 + n) % n]!;
    const cur = poly[i]!;
    const next = poly[(i + 1) % n]!;

    const e0 = new Vector2(cur.x - prev.x, cur.y - prev.y).normalize();
    const e1 = new Vector2(next.x - cur.x, next.y - cur.y).normalize();

    // Inward normal of each adjacent edge.
    const n0 = new Vector2(-e0.y, e0.x).multiplyScalar(sign);
    const n1 = new Vector2(-e1.y, e1.x).multiplyScalar(sign);

    const bisector = new Vector2(n0.x + n1.x, n0.y + n1.y);
    const len = bisector.length();
    if (len < 1e-9) {
      // 180-degree reversal: fall back to a single edge normal.
      out.push(new Vector2(cur.x + n0.x * d, cur.y + n0.y * d));
      continue;
    }
    bisector.divideScalar(len);
    // Miter length grows as 1/cos(half-angle).
    const cosHalf = bisector.dot(n0);
    const scale = Math.min(1 / Math.max(cosHalf, 1e-6), miterLimit);
    out.push(new Vector2(cur.x + bisector.x * d * scale, cur.y + bisector.y * d * scale));
  }
  return out;
}

/** Resample a closed polygon to evenly spaced points. */
export function resampleClosed(poly: Poly2, spacing: number): Vector2[] {
  const total = perimeter(poly);
  const count = Math.max(3, Math.round(total / spacing));
  const step = total / count;
  const out: Vector2[] = [];

  let segIndex = 0;
  let segStart = poly[0]!;
  let segEnd = poly[1 % poly.length]!;
  let segLen = segStart.distanceTo(segEnd);
  let walked = 0;

  for (let i = 0; i < count; i++) {
    const target = i * step;
    while (walked + segLen < target && segIndex < poly.length) {
      walked += segLen;
      segIndex++;
      segStart = poly[segIndex % poly.length]!;
      segEnd = poly[(segIndex + 1) % poly.length]!;
      segLen = segStart.distanceTo(segEnd);
    }
    const t = segLen < 1e-9 ? 0 : (target - walked) / segLen;
    out.push(new Vector2(segStart.x + (segEnd.x - segStart.x) * t, segStart.y + (segEnd.y - segStart.y) * t));
  }
  return out;
}

/** Do two segments properly cross? Shared endpoints do not count. */
function segmentsCross(
  a1: Vector2,
  a2: Vector2,
  b1: Vector2,
  b2: Vector2,
  eps: number,
): boolean {
  const d = (p: Vector2, q: Vector2, r: Vector2): number =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);

  const d1 = d(b1, b2, a1);
  const d2 = d(b1, b2, a2);
  const d3 = d(a1, a2, b1);
  const d4 = d(a1, a2, b2);

  if (Math.abs(d1) < eps && Math.abs(d2) < eps) return false; // collinear
  return ((d1 > eps && d2 < -eps) || (d1 < -eps && d2 > eps)) &&
    ((d3 > eps && d4 < -eps) || (d3 < -eps && d4 > eps));
}

/**
 * Does this polygon avoid crossing itself?
 *
 * Offsetting a polygon inward is only valid while the offset stays smaller than
 * the narrowest feature. Inset a plate by more than half the width of an
 * interlock tooth and the tooth turns inside out — which renders as a hole in
 * an armour plate and shows up in the manifold audit rather than on screen.
 * Checking directly is cheaper than reasoning about when it is safe.
 */
export function isSimplePolygon(poly: Poly2, eps = 1e-7): boolean {
  const n = poly.length;
  if (n < 3) return false;
  for (const p of poly) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
  }
  for (let i = 0; i < n; i++) {
    const a1 = poly[i]!;
    const a2 = poly[(i + 1) % n]!;
    for (let j = i + 1; j < n; j++) {
      // Skip the shared-endpoint neighbours, including the wrap-around pair.
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
      if (segmentsCross(a1, a2, poly[j]!, poly[(j + 1) % n]!, eps)) return false;
    }
  }
  return true;
}

/** Shortest edge of a polygon. A useful proxy for its narrowest feature. */
export function minEdgeLength(poly: Poly2): number {
  let best = Infinity;
  for (let i = 0, n = poly.length; i < n; i++) {
    best = Math.min(best, poly[i]!.distanceTo(poly[(i + 1) % n]!));
  }
  return best;
}

/** Mirror a polygon about the local Y axis. Winding flips; callers normalise. */
export function mirrorX(poly: Poly2): Vector2[] {
  return poly.map((p) => new Vector2(-p.x, p.y));
}

/** Translate a polygon. */
export function translate(poly: Poly2, dx: number, dy: number): Vector2[] {
  return poly.map((p) => new Vector2(p.x + dx, p.y + dy));
}

/** Do two polygons overlap? Vertex containment either way, which is enough for apertures. */
export function polygonsOverlap(a: Poly2, b: Poly2): boolean {
  for (const p of a) if (containsPoint(b, p)) return true;
  for (const p of b) if (containsPoint(a, p)) return true;
  return false;
}

export interface InterlockOptions {
  /** Full period of the waveform: one proud segment plus one flush segment. */
  pitch: number;
  /** How far each proud segment projects, perpendicular to the edge. */
  depth: number;
  /** Start proud rather than flush. The mating plate uses the opposite phase. */
  startProud?: boolean;
}

/**
 * Replace one straight edge of a polygon with a square-tooth waveform.
 *
 * Tiger hull plates were stepped and interlocked (verzahnt) before welding, not
 * butt-jointed — the teeth carry shear so the weld does not have to. Because
 * this runs on the 2D outline before the plate is given thickness, it costs
 * nothing; and because the mating plate makes the same call with `startProud`
 * flipped, the two halves mesh exactly rather than approximately.
 */
export function interlockEdge(
  poly: Poly2,
  edgeIndex: number,
  opts: InterlockOptions,
): Vector2[] {
  const { pitch, depth, startProud = true } = opts;
  const n = poly.length;
  const a = poly[edgeIndex % n]!;
  const b = poly[(edgeIndex + 1) % n]!;

  const edge = new Vector2(b.x - a.x, b.y - a.y);
  const length = edge.length();
  if (length < pitch || depth <= 0) return poly.map((p) => p.clone());

  const dir = edge.clone().divideScalar(length);
  // Outward normal, so proud segments project away from the material.
  const nrm = new Vector2(dir.y, -dir.x).multiplyScalar(isCCW(poly) ? 1 : -1);

  // One period is a proud segment plus a flush one, so segments are half-pitch.
  // An even count keeps the two mating phases balanced.
  let segments = Math.max(2, Math.round(length / (pitch / 2)));
  if (segments % 2 !== 0) segments += 1;
  const segLength = length / segments;

  const at = (s: number, off: number): Vector2 =>
    new Vector2(a.x + dir.x * s + nrm.x * off, a.y + dir.y * s + nrm.y * off);

  const inserted: Vector2[] = [];
  for (let sIdx = 0; sIdx < segments; sIdx++) {
    const proud = startProud ? sIdx % 2 === 0 : sIdx % 2 === 1;
    const off = proud ? depth : 0;
    inserted.push(at(sIdx * segLength, off));
    inserted.push(at((sIdx + 1) * segLength, off));
  }

  // A flush run at either end lands exactly on the polygon's own vertex; keeping
  // both would emit a zero-length edge and quietly break the manifold.
  const EPS = 1e-6;
  while (inserted.length > 0 && inserted[0]!.distanceTo(a) < EPS) inserted.shift();
  while (inserted.length > 0 && inserted[inserted.length - 1]!.distanceTo(b) < EPS) {
    inserted.pop();
  }

  const out: Vector2[] = [];
  for (let i = 0; i < n; i++) {
    out.push(poly[i]!.clone());
    if (i === edgeIndex % n) out.push(...inserted);
  }
  return out;
}

/** One triangle of a triangulation, as indices into the combined vertex list. */
export type Tri = readonly [number, number, number];

export interface Triangulation {
  /** Outline points followed by each hole's points, in order. */
  readonly points: Vector2[];
  readonly triangles: Tri[];
  /** Index at which each loop begins in `points`. Loop 0 is the outline. */
  readonly loopStarts: number[];
}

/**
 * Triangulate a polygon with holes.
 *
 * Winding is normalised first — three's triangulator expects a CCW contour and
 * CW holes, and getting that wrong produces a silently inside-out plate rather
 * than an error.
 */
export function triangulate(outline: Poly2, holes: readonly Poly2[] = []): Triangulation {
  const contour = ensureCCW(outline);
  const holeLoops = holes.map((h) => ensureCW(h));

  const points: Vector2[] = [...contour];
  const loopStarts: number[] = [0];
  for (const h of holeLoops) {
    loopStarts.push(points.length);
    points.push(...h);
  }

  const faces = ShapeUtils.triangulateShape(contour, holeLoops);
  const triangles: Tri[] = faces.map((f) => [f[0]!, f[1]!, f[2]!] as const);

  return { points, triangles, loopStarts };
}

/** Extract the closed loops of a triangulation as separate polygons. */
export function loopsOf(t: Triangulation): Vector2[][] {
  const loops: Vector2[][] = [];
  for (let i = 0; i < t.loopStarts.length; i++) {
    const start = t.loopStarts[i]!;
    const end = i + 1 < t.loopStarts.length ? t.loopStarts[i + 1]! : t.points.length;
    loops.push(t.points.slice(start, end));
  }
  return loops;
}

/** Axis-aligned bounds of a polygon, as [minX, minY, maxX, maxY]. */
export function bounds2(poly: Poly2): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return [minX, minY, maxX, maxY];
}

/** Build a rectangle, centred on the origin, wound counter-clockwise. */
export function rect(width: number, height: number): Vector2[] {
  const w = width / 2;
  const h = height / 2;
  return [v2(-w, -h), v2(w, -h), v2(w, h), v2(-w, h)];
}

/** Build a regular circle, wound counter-clockwise. */
export function circle(radius: number, segments = 32): Vector2[] {
  const out: Vector2[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    out.push(v2(Math.cos(a) * radius, Math.sin(a) * radius));
  }
  return out;
}

/** Build a rounded rectangle, wound counter-clockwise. Used for most hatch apertures. */
export function roundedRect(
  width: number,
  height: number,
  radius: number,
  cornerSegments = 6,
): Vector2[] {
  const w = width / 2;
  const h = height / 2;
  const r = Math.min(radius, w, h);
  const out: Vector2[] = [];
  const corners: [number, number, number][] = [
    [w - r, -h + r, -Math.PI / 2],
    [w - r, h - r, 0],
    [-w + r, h - r, Math.PI / 2],
    [-w + r, -h + r, Math.PI],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= cornerSegments; i++) {
      const a = a0 + (i / cornerSegments) * (Math.PI / 2);
      out.push(v2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
    }
  }
  return out;
}
