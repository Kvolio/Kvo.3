import type { Vector2} from 'three';
import { BufferAttribute, BufferGeometry, Vector3 } from 'three';
import type {
  Region} from './attributes.js';
import {
  ATTR,
  DEFAULT_VERTEX_STATE,
  type VertexState,
} from './attributes.js';

/**
 * Growable mesh assembly.
 *
 * Every piece of geometry in this reconstruction is emitted through here rather
 * than through three's parametric geometries, for two reasons: it carries the
 * four custom vertex attributes the material system depends on, and it can be
 * handed straight to a worker as transferable buffers.
 *
 * Positions are in SCENE UNITS (metres). Callers convert from the millimetre
 * spec with `S()` as they write, which is the project's one and only unit
 * boundary.
 */

// Re-exported so geometry code can name a material without reaching into the
// materials package. The type is derived from the preset table, so a misspelt
// name fails to compile rather than rendering magenta.
import type { MaterialId } from '../materials/presets.js';
export type { MaterialId };

export interface TransferableGeometry {
  readonly position: Float32Array;
  readonly normal: Float32Array;
  readonly uv: Float32Array;
  readonly edgeDist: Float32Array;
  readonly cavity: Float32Array;
  readonly wear: Float32Array;
  readonly region: Float32Array;
  readonly index: Uint32Array;
  readonly groups: readonly { start: number; count: number; materialId: MaterialId }[];
}

interface Group {
  start: number;
  count: number;
  materialId: MaterialId;
}

const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();
const _ab = new Vector3();
const _ac = new Vector3();
const _n = new Vector3();

export class MeshBuilder {
  private readonly pos: number[] = [];
  private readonly nrm: number[] = [];
  private readonly uvs: number[] = [];
  private readonly edgeDist: number[] = [];
  private readonly cavity: number[] = [];
  private readonly wear: number[] = [];
  private readonly region: number[] = [];
  private readonly idx: number[] = [];
  private readonly groups: Group[] = [];

  /** Attribute values inherited by every vertex emitted from now on. */
  readonly state: VertexState = { ...DEFAULT_VERTEX_STATE };

  private currentMaterial: MaterialId = 'default';

  constructor(hint?: { triangles?: number }) {
    if (hint?.triangles) {
      // Reserve, cheaply: V8 grows these geometrically anyway, but priming the
      // arrays avoids a few reallocations on the big hull plates.
      const v = hint.triangles * 3;
      this.pos.length = 0;
      this.idx.length = 0;
      void v;
    }
  }

  get vertexCount(): number {
    return this.pos.length / 3;
  }

  get triangleCount(): number {
    return this.idx.length / 3;
  }

  // ---------------------------------------------------------------------------
  // Attribute state
  // ---------------------------------------------------------------------------

  setRegion(r: Region): this {
    this.state.region = r;
    return this;
  }

  setWear(w: number): this {
    this.state.wear = w;
    return this;
  }

  setEdgeDist(d: number): this {
    this.state.edgeDist = d;
    return this;
  }

  setCavity(c: number): this {
    this.state.cavity = c;
    return this;
  }

  /** Run `fn` with a temporarily modified attribute state. */
  withState(patch: Partial<VertexState>, fn: () => void): this {
    const saved = { ...this.state };
    Object.assign(this.state, patch);
    try {
      fn();
    } finally {
      Object.assign(this.state, saved);
    }
    return this;
  }

  // ---------------------------------------------------------------------------
  // Material groups
  // ---------------------------------------------------------------------------

  /**
   * Emit subsequent triangles into `materialId`. Groups are contiguous, so a
   * builder that alternates materials wastefully will show up as an inflated
   * group count in `tests/geometry/budget.test.ts`.
   */
  useMaterial(materialId: MaterialId): this {
    if (materialId === this.currentMaterial) return this;
    this.closeGroup();
    this.currentMaterial = materialId;
    return this;
  }

  /** Run `fn` with `materialId` active, then restore the previous material. */
  group(materialId: MaterialId, fn: () => void): this {
    const previous = this.currentMaterial;
    this.useMaterial(materialId);
    try {
      fn();
    } finally {
      this.useMaterial(previous);
    }
    return this;
  }

  private closeGroup(): void {
    const start = this.groups.reduce((n, g) => n + g.count, 0);
    const count = this.idx.length - start;
    if (count > 0) {
      this.groups.push({ start, count, materialId: this.currentMaterial });
    }
  }

  // ---------------------------------------------------------------------------
  // Emission
  // ---------------------------------------------------------------------------

  /** Append a vertex, returning its index. */
  vert(p: Vector3, n: Vector3, uv?: Vector2, overrides?: Partial<VertexState>): number {
    const i = this.pos.length / 3;
    this.pos.push(p.x, p.y, p.z);
    this.nrm.push(n.x, n.y, n.z);
    this.uvs.push(uv?.x ?? 0, uv?.y ?? 0);
    this.edgeDist.push(overrides?.edgeDist ?? this.state.edgeDist);
    this.cavity.push(overrides?.cavity ?? this.state.cavity);
    this.wear.push(overrides?.wear ?? this.state.wear);
    this.region.push(overrides?.region ?? this.state.region);
    return i;
  }

  tri(a: number, b: number, c: number): this {
    this.idx.push(a, b, c);
    return this;
  }

  quad(a: number, b: number, c: number, d: number): this {
    this.idx.push(a, b, c, a, c, d);
    return this;
  }

  /**
   * Bridge two equal-length index loops with a quad strip. This is how every
   * lofted surface in the project is built: plate side walls, barrel sections,
   * weld beads, tube runs.
   */
  ring(lower: readonly number[], upper: readonly number[], closed = true): this {
    const n = Math.min(lower.length, upper.length);
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const j = (i + 1) % n;
      this.quad(lower[i]!, lower[j]!, upper[j]!, upper[i]!);
    }
    return this;
  }

  /** Triangle fan from `centre` around `loop`. */
  fan(centre: number, loop: readonly number[], closed = true): this {
    const n = loop.length;
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      this.tri(centre, loop[i]!, loop[(i + 1) % n]!);
    }
    return this;
  }

  // ---------------------------------------------------------------------------
  // Post-processing
  // ---------------------------------------------------------------------------

  /**
   * Merge vertices closer than `epsilon` scene units.
   *
   * Necessary before manifold checks and before normal smoothing, because
   * lofted surfaces emit their shared edges twice by construction.
   */
  weldVertices(epsilon = 1e-5): this {
    const inv = 1 / epsilon;
    const map = new Map<string, number>();
    const remap = new Int32Array(this.vertexCount);
    const keep: number[] = [];

    for (let i = 0; i < this.vertexCount; i++) {
      const x = Math.round(this.pos[i * 3]! * inv);
      const y = Math.round(this.pos[i * 3 + 1]! * inv);
      const z = Math.round(this.pos[i * 3 + 2]! * inv);
      // Region is part of the key: an interior and an exterior surface may share
      // a position at a plate edge but must not share a vertex, or the wear
      // profile bleeds across the boundary.
      const key = `${x},${y},${z},${this.region[i]}`;
      const existing = map.get(key);
      if (existing === undefined) {
        map.set(key, keep.length);
        remap[i] = keep.length;
        keep.push(i);
      } else {
        remap[i] = existing;
      }
    }

    if (keep.length === this.vertexCount) return this;

    const gather = (src: number[], stride: number): number[] => {
      const out: number[] = new Array(keep.length * stride);
      for (let k = 0; k < keep.length; k++) {
        const s = keep[k]!;
        for (let c = 0; c < stride; c++) out[k * stride + c] = src[s * stride + c]!;
      }
      return out;
    };

    const p = gather(this.pos, 3);
    const n = gather(this.nrm, 3);
    const u = gather(this.uvs, 2);
    const e = gather(this.edgeDist, 1);
    const cav = gather(this.cavity, 1);
    const w = gather(this.wear, 1);
    const r = gather(this.region, 1);

    this.replace(this.pos, p);
    this.replace(this.nrm, n);
    this.replace(this.uvs, u);
    this.replace(this.edgeDist, e);
    this.replace(this.cavity, cav);
    this.replace(this.wear, w);
    this.replace(this.region, r);

    for (let i = 0; i < this.idx.length; i++) this.idx[i] = remap[this.idx[i]!]!;
    return this;
  }

  private replace(target: number[], source: number[]): void {
    target.length = 0;
    for (let i = 0; i < source.length; i++) target.push(source[i]!);
  }

  /**
   * Recompute normals, preserving hard edges above `smoothAngleDeg`, and derive
   * `aCavity` from local concavity while we already have the adjacency.
   *
   * Concavity is estimated as the mean of `dot(normalize(neighbour - vertex),
   * vertexNormal)` — positive when neighbours sit above the tangent plane, which
   * is exactly the inside of a corner where dirt and grease collect.
   */
  recomputeNormals(smoothAngleDeg = 40, deriveCavity = true): this {
    const vCount = this.vertexCount;
    const faceNormals = new Float32Array(this.triangleCount * 3);
    const accum = new Float32Array(vCount * 3);

    for (let t = 0; t < this.triangleCount; t++) {
      const ia = this.idx[t * 3]!;
      const ib = this.idx[t * 3 + 1]!;
      const ic = this.idx[t * 3 + 2]!;
      _a.fromArray(this.pos, ia * 3);
      _b.fromArray(this.pos, ib * 3);
      _c.fromArray(this.pos, ic * 3);
      _ab.subVectors(_b, _a);
      _ac.subVectors(_c, _a);
      _n.crossVectors(_ab, _ac);
      // Leave the cross product unnormalised so larger faces weigh more.
      faceNormals[t * 3] = _n.x;
      faceNormals[t * 3 + 1] = _n.y;
      faceNormals[t * 3 + 2] = _n.z;
      for (const i of [ia, ib, ic]) {
        const o = i * 3;
        accum[o] = accum[o]! + _n.x;
        accum[o + 1] = accum[o + 1]! + _n.y;
        accum[o + 2] = accum[o + 2]! + _n.z;
      }
    }

    const cosLimit = Math.cos((smoothAngleDeg * Math.PI) / 180);

    for (let t = 0; t < this.triangleCount; t++) {
      _n.fromArray(faceNormals, t * 3).normalize();
      for (let k = 0; k < 3; k++) {
        const i = this.idx[t * 3 + k]!;
        _a.fromArray(accum, i * 3).normalize();
        // If the averaged normal has swung too far from this face's own normal,
        // the vertex straddles a hard edge; keep the face normal instead.
        const use = _a.dot(_n) >= cosLimit ? _a : _n;
        this.nrm[i * 3] = use.x;
        this.nrm[i * 3 + 1] = use.y;
        this.nrm[i * 3 + 2] = use.z;
      }
    }

    if (deriveCavity) this.deriveCavity();
    return this;
  }

  private deriveCavity(): void {
    const vCount = this.vertexCount;
    const sum = new Float32Array(vCount);
    const count = new Uint32Array(vCount);

    const consider = (i: number, j: number): void => {
      _a.fromArray(this.pos, i * 3);
      _b.fromArray(this.pos, j * 3);
      _ab.subVectors(_b, _a);
      const len = _ab.length();
      if (len < 1e-9) return;
      _ab.divideScalar(len);
      _n.fromArray(this.nrm, i * 3);
      sum[i] = sum[i]! + _ab.dot(_n);
      count[i] = count[i]! + 1;
    };

    for (let t = 0; t < this.triangleCount; t++) {
      const ia = this.idx[t * 3]!;
      const ib = this.idx[t * 3 + 1]!;
      const ic = this.idx[t * 3 + 2]!;
      consider(ia, ib);
      consider(ia, ic);
      consider(ib, ia);
      consider(ib, ic);
      consider(ic, ia);
      consider(ic, ib);
    }

    for (let i = 0; i < vCount; i++) {
      if (count[i] === 0) continue;
      const mean = sum[i]! / count[i]!;
      // Positive mean means neighbours sit above the tangent plane: a concavity.
      // The 0.06 knee keeps flat surfaces genuinely at zero rather than dusty.
      const c = Math.min(1, Math.max(0, (mean - 0.06) / 0.35));
      // Never lower an explicitly authored value: a builder that knows a
      // crevice is deeper than it looks should win.
      this.cavity[i] = Math.max(this.cavity[i]!, c);
    }
  }

  // ---------------------------------------------------------------------------
  // Output
  // ---------------------------------------------------------------------------

  toTransferable(): TransferableGeometry {
    this.closeGroup();
    return {
      position: new Float32Array(this.pos),
      normal: new Float32Array(this.nrm),
      uv: new Float32Array(this.uvs),
      edgeDist: new Float32Array(this.edgeDist),
      cavity: new Float32Array(this.cavity),
      wear: new Float32Array(this.wear),
      region: new Float32Array(this.region),
      index: new Uint32Array(this.idx),
      groups: this.groups.map((g) => ({ ...g })),
    };
  }

  toGeometry(): { geometry: BufferGeometry; materials: MaterialId[] } {
    return fromTransferable(this.toTransferable());
  }
}

/** Rebuild a `BufferGeometry` from transferred buffers, without copying. */
export function fromTransferable(t: TransferableGeometry): {
  geometry: BufferGeometry;
  materials: MaterialId[];
} {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(t.position, 3));
  g.setAttribute('normal', new BufferAttribute(t.normal, 3));
  g.setAttribute('uv', new BufferAttribute(t.uv, 2));
  g.setAttribute(ATTR.edgeDist, new BufferAttribute(t.edgeDist, 1));
  g.setAttribute(ATTR.cavity, new BufferAttribute(t.cavity, 1));
  g.setAttribute(ATTR.wear, new BufferAttribute(t.wear, 1));
  g.setAttribute(ATTR.region, new BufferAttribute(t.region, 1));
  g.setIndex(new BufferAttribute(t.index, 1));

  const materials: MaterialId[] = [];
  for (const grp of t.groups) {
    let mi = materials.indexOf(grp.materialId);
    if (mi < 0) {
      mi = materials.length;
      materials.push(grp.materialId);
    }
    g.addGroup(grp.start, grp.count, mi);
  }
  if (materials.length === 0) materials.push('default');

  g.computeBoundingBox();
  g.computeBoundingSphere();
  return { geometry: g, materials };
}
