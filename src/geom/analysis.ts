import { Vector3, type BufferGeometry } from 'three';

/**
 * Mesh analysis used by the Gauntlet's mechanical tier.
 *
 * The brief's requirement that armour must not be "a single hollow shell with
 * fake thickness" is only meaningful if it can be checked. These functions are
 * what turn that from a claim into an assertion: a closed manifold with a
 * positive signed volume that matches area x thickness is, demonstrably, a solid.
 */

export interface ManifoldReport {
  readonly manifold: boolean;
  /** Edges shared by exactly two triangles. A closed solid has only these. */
  readonly sharedEdges: number;
  /** Edges on an open boundary. Non-zero means the surface has a hole in it. */
  readonly boundaryEdges: number;
  /** Edges shared by three or more triangles. Always a modelling error. */
  readonly nonManifoldEdges: number;
  readonly degenerateTriangles: number;
  readonly hasNaN: boolean;
}

/**
 * Signed volume by the divergence theorem: sum of a.(b x c)/6 over all
 * triangles. Positive for a closed, outward-wound solid; near zero for a
 * surface; negative for an inside-out one.
 */
export function signedVolume(geometry: BufferGeometry): number {
  const pos = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const cross = new Vector3();

  let total = 0;
  const count = index ? index.count : pos.count;
  for (let i = 0; i < count; i += 3) {
    const ia = index ? index.getX(i) : i;
    const ib = index ? index.getX(i + 1) : i + 1;
    const ic = index ? index.getX(i + 2) : i + 2;
    a.fromBufferAttribute(pos, ia);
    b.fromBufferAttribute(pos, ib);
    c.fromBufferAttribute(pos, ic);
    cross.crossVectors(b, c);
    total += a.dot(cross);
  }
  return total / 6;
}

/** Total surface area, in scene units squared. */
export function surfaceArea(geometry: BufferGeometry): number {
  const pos = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const ab = new Vector3();
  const ac = new Vector3();
  const n = new Vector3();

  let total = 0;
  const count = index ? index.count : pos.count;
  for (let i = 0; i < count; i += 3) {
    const ia = index ? index.getX(i) : i;
    const ib = index ? index.getX(i + 1) : i + 1;
    const ic = index ? index.getX(i + 2) : i + 2;
    a.fromBufferAttribute(pos, ia);
    b.fromBufferAttribute(pos, ib);
    c.fromBufferAttribute(pos, ic);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    n.crossVectors(ab, ac);
    total += n.length() / 2;
  }
  return total;
}

/**
 * Half-edge audit.
 *
 * Every directed edge of a closed solid must have exactly one opposite. An
 * unmatched edge is a hole; a triple-shared edge is two surfaces fused along a
 * seam. Both are silent in a render and obvious here.
 */
export function analyseManifold(
  geometry: BufferGeometry,
  // Area threshold in scene units squared. Scene units are metres, so this is
  // one square micrometre: small enough not to discard the genuinely tiny
  // triangles in a weld bead or a bolt head, which would otherwise be dropped
  // here and then reported as holes in the surface they came from.
  epsilon = 1e-12,
): ManifoldReport {
  const pos = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const count = index ? index.count : pos.count;

  const edgeUse = new Map<string, number>();
  let degenerate = 0;
  let hasNaN = false;

  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const ab = new Vector3();
  const ac = new Vector3();
  const n = new Vector3();

  for (let i = 0; i < pos.count; i++) {
    if (
      !Number.isFinite(pos.getX(i)) ||
      !Number.isFinite(pos.getY(i)) ||
      !Number.isFinite(pos.getZ(i))
    ) {
      hasNaN = true;
      break;
    }
  }

  for (let i = 0; i < count; i += 3) {
    const ia = index ? index.getX(i) : i;
    const ib = index ? index.getX(i + 1) : i + 1;
    const ic = index ? index.getX(i + 2) : i + 2;

    a.fromBufferAttribute(pos, ia);
    b.fromBufferAttribute(pos, ib);
    c.fromBufferAttribute(pos, ic);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    n.crossVectors(ab, ac);
    if (n.length() / 2 < epsilon) {
      degenerate++;
      continue;
    }

    for (const [u, v] of [
      [ia, ib],
      [ib, ic],
      [ic, ia],
    ] as const) {
      const key = u < v ? `${u}_${v}` : `${v}_${u}`;
      edgeUse.set(key, (edgeUse.get(key) ?? 0) + 1);
    }
  }

  let shared = 0;
  let boundary = 0;
  let nonManifold = 0;
  for (const uses of edgeUse.values()) {
    if (uses === 2) shared++;
    else if (uses === 1) boundary++;
    else nonManifold++;
  }

  return {
    manifold: boundary === 0 && nonManifold === 0 && !hasNaN,
    sharedEdges: shared,
    boundaryEdges: boundary,
    nonManifoldEdges: nonManifold,
    degenerateTriangles: degenerate,
    hasNaN,
  };
}

/**
 * March along -normal from a point on a surface and report where the geometry
 * is next crossed.
 *
 * This is the mechanism behind the "not a hollow shell" test: sample the outer
 * face of an armour plate, walk inwards, and the far surface must be exactly a
 * plate thickness away. A shell with a fake-thickness shader has nothing there.
 */
export function measureThicknessAlong(
  geometry: BufferGeometry,
  origin: Vector3,
  direction: Vector3,
  maxDistance: number,
): number | null {
  const pos = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const count = index ? index.count : pos.count;

  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const edge1 = new Vector3();
  const edge2 = new Vector3();
  const h = new Vector3();
  const s = new Vector3();
  const q = new Vector3();
  const dir = direction.clone().normalize();

  let nearest: number | null = null;
  // Step off the surface so the originating triangle is not re-hit.
  const bias = 1e-4;

  for (let i = 0; i < count; i += 3) {
    const ia = index ? index.getX(i) : i;
    const ib = index ? index.getX(i + 1) : i + 1;
    const ic = index ? index.getX(i + 2) : i + 2;
    a.fromBufferAttribute(pos, ia);
    b.fromBufferAttribute(pos, ib);
    c.fromBufferAttribute(pos, ic);

    // Moller-Trumbore, accepting hits from either face so a back wall counts.
    edge1.subVectors(b, a);
    edge2.subVectors(c, a);
    h.crossVectors(dir, edge2);
    const det = edge1.dot(h);
    if (Math.abs(det) < 1e-12) continue;
    const invDet = 1 / det;
    s.subVectors(origin, a);
    const u = s.dot(h) * invDet;
    if (u < 0 || u > 1) continue;
    q.crossVectors(s, edge1);
    const v = dir.dot(q) * invDet;
    if (v < 0 || u + v > 1) continue;
    const t = edge2.dot(q) * invDet;
    if (t <= bias || t > maxDistance) continue;
    if (nearest === null || t < nearest) nearest = t;
  }

  return nearest;
}
