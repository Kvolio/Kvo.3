import type { Matrix4} from 'three';
import { Matrix3, Vector2, Vector3 } from 'three';
import { MeshBuilder, type MaterialId } from '../geom/MeshBuilder.js';
import { Region } from '../geom/attributes.js';
import {
  bounds2,
  containsPoint,
  distanceToAnyBoundary,
  isSimplePolygon,
  minEdgeLength,
  polygonsOverlap,
  loopsOf,
  netArea,
  offsetPolygon,
  triangulate,
  type Poly2,
} from '../geom/poly2.js';
import { S, type MM } from '../spec/units.js';

/**
 * A solid armour plate.
 *
 * This is the single most important primitive in the project, and the reason
 * the hard requirements in the brief are cheap rather than expensive.
 *
 * A plate is built as a genuine closed solid: an outer face, an inner face a
 * real thickness behind it, and lofted walls around every loop. That means the
 * interior surfaces the player sees from inside the tank ARE the back faces of
 * the armour, not a separate shell pretending to be one.
 *
 * Crucially, an opening in a plate — a hatch aperture, a vision port, a pistol
 * port, a bolt clearance hole — is expressed as a HOLE POLYGON in the outline,
 * not as a CSG subtraction. That is exact, deterministic, fast, produces correct
 * bore walls, and produces correct collision geometry for free. It is also what
 * makes "an open hatch is a hole you can walk through" fall out of the model
 * instead of needing runtime collision surgery: the roof plate's collision mesh
 * already has the hole in it, and the hatch lid is simply a separate body that
 * plugs it when closed.
 *
 * Local frame convention: the outline lies in plate-local XY, in millimetres.
 * The OUTER face sits at z = 0 and the inner face at z = -thickness, so a
 * placement matrix only ever has to position the visible surface.
 */

export interface NamedEdge {
  readonly name: string;
  /** Index of the first outline vertex of this edge run. */
  readonly from: number;
  /** Index of the last outline vertex of this edge run, inclusive. */
  readonly to: number;
}

export interface PlateMaterials {
  readonly outer?: MaterialId;
  readonly inner?: MaterialId;
  readonly edge?: MaterialId;
}

export interface PlateSpec {
  /** Outline in plate-local XY, millimetres. Winding is normalised internally. */
  readonly outline: Poly2;
  /** Openings. Winding is normalised internally. */
  readonly holes?: readonly Poly2[];
  readonly thickness: MM;
  /** Placement of the plate-local frame in vehicle space. Identity if omitted. */
  readonly frame?: Matrix4;
  /**
   * Edge break applied to both faces, in millimetres. Real rolled plate is
   * flame-cut and the arris knocked off; a perfectly sharp edge reads as CG.
   * Also gives the paint-chipping shader an actual bevel to catch light on.
   */
  readonly chamfer?: MM;
  /**
   * Width of the tessellated band inset from every boundary, in millimetres.
   * Paint chipping keys off `aEdgeDist`, and a flat quad has no interior
   * vertices at all — without this band the whole face would interpolate to
   * edgeDist 0 and chip uniformly. Defaults to 45 mm, comfortably wider than
   * the chip falloff it has to resolve.
   */
  readonly edgeBandWidth?: MM;
  readonly materials?: PlateMaterials;
  readonly region?: Region;
  readonly wear?: number;
  /** LOD. At detail 2 the chamfer bands are dropped. */
  readonly detail?: 0 | 1 | 2;
  /** Names for edge runs, so weld beads and fittings can attach to them by name. */
  readonly namedEdges?: readonly NamedEdge[];
}

export interface PlateResult {
  /** Outer face boundary in vehicle space. Feeds weld beads. */
  readonly outerLoop: Vector3[];
  /** Inner face boundary in vehicle space. */
  readonly innerLoop: Vector3[];
  /** Named edge runs, on the outer face, in vehicle space. */
  readonly edgeLoops: Map<string, Vector3[]>;
  /** Hole boundaries on the outer face, in vehicle space. */
  readonly holeLoops: Vector3[][];
  /** Outline area minus hole areas, mm^2. */
  readonly area: number;
  readonly thickness: MM;
  /** area x thickness, mm^3. The mesh's measured volume is checked against this. */
  readonly nominalVolume: number;
  readonly triangleCount: number;
}

const DEFAULT_MATERIALS: Required<PlateMaterials> = {
  outer: 'armourPaintedExterior',
  inner: 'interiorIvoryPaint',
  edge: 'machinedSteel',
};

/** Emit a plate into an existing builder, so a whole assembly is one geometry. */
export function emitPlate(mb: MeshBuilder, spec: PlateSpec): PlateResult {
  const {
    outline,
    holes = [],
    thickness,
    frame,
    chamfer = 0 as MM,
    region = Region.Exterior,
    wear = 0,
    detail = 0,
    namedEdges = [],
  } = spec;

  const mats = { ...DEFAULT_MATERIALS, ...spec.materials };

  // At the coarsest LOD the chamfer bands are not worth their triangles.
  const c = detail >= 2 ? 0 : Math.min(chamfer, thickness / 3);
  const beveled = c > 1e-6;

  // Normalise winding once: CCW outline, CW holes.
  const tri = triangulate(outline, holes);
  const loops = loopsOf(tri);
  const fullOutline = loops[0]!;
  const fullHoles = loops.slice(1);

  // The chamfered face insets the outline and EXPANDS the holes, which is what
  // a real edge break does at an aperture.
  const faceOutline = beveled ? offsetPolygon(fullOutline, c) : fullOutline;
  const faceHoles = beveled ? fullHoles.map((h) => offsetPolygon(h, -c)) : fullHoles;

  const normalMatrix = frame ? new Matrix3().getNormalMatrix(frame) : null;
  const place = (x: number, y: number, z: number): Vector3 => {
    const v = new Vector3(S(x as MM), S(y as MM), S(z as MM));
    if (frame) v.applyMatrix4(frame);
    return v;
  };
  const placeNormal = (n: Vector3): Vector3 => {
    const v = n.clone();
    if (normalMatrix) v.applyMatrix3(normalMatrix).normalize();
    return v;
  };

  const OUT = placeNormal(new Vector3(0, 0, 1));
  const IN = placeNormal(new Vector3(0, 0, -1));

  const startTris = mb.triangleCount;

  // Apertures that overlap each other, or that fall outside the plate, produce
  // a mesh that renders plausibly and is quietly not a solid. Better to refuse.
  for (let i = 0; i < fullHoles.length; i++) {
    const hole = fullHoles[i]!;
    for (const pt of hole) {
      if (!containsPoint(fullOutline, pt)) {
        throw new Error(`plate: aperture ${i} extends outside the plate outline`);
      }
    }
    for (let j = i + 1; j < fullHoles.length; j++) {
      if (polygonsOverlap(hole, fullHoles[j]!)) {
        throw new Error(`plate: apertures ${i} and ${j} overlap`);
      }
    }
  }

  // A flat plate triangulated straight from its outline has NO interior
  // vertices, which would leave `aEdgeDist` at zero across the whole face and
  // chip the paint uniformly instead of along the edges. Each face therefore
  // carries a narrow tessellated band inset from every boundary: the band
  // resolves the chipping falloff exactly where it occurs, and the interior
  // beyond it stays as coarse as the silhouette allows.
  const [ox0, oy0, ox1, oy1] = bounds2(fullOutline);
  const requested = detail >= 2 ? 0 : (spec.edgeBandWidth ?? 45);

  let band = Math.min(
    requested,
    Math.min(ox1 - ox0, oy1 - oy0) / 4,
    // The band must stay well inside the narrowest feature, or an interlock
    // tooth inverts and punches a hole through the armour.
    minEdgeLength(fullOutline) / 2.5,
  );

  let innerOutline = faceOutline;
  let innerHoles = faceHoles;

  // Halve the band until the offset is provably valid, rather than trusting a
  // heuristic to have been conservative enough.
  for (let attempt = 0; attempt < 5; attempt++) {
    if (band <= 1e-6) break;
    const candidateOutline = offsetPolygon(faceOutline, band);
    const candidateHoles = faceHoles.map((h) => offsetPolygon(h, -band));
    const area = netArea(candidateOutline, candidateHoles);

    const valid =
      Number.isFinite(area) &&
      area > netArea(faceOutline, faceHoles) * 0.05 &&
      isSimplePolygon(candidateOutline) &&
      candidateHoles.every((h) => isSimplePolygon(h)) &&
      candidateHoles.every((h) => h.every((pt) => containsPoint(candidateOutline, pt)));

    if (valid) {
      innerOutline = candidateOutline;
      innerHoles = candidateHoles;
      break;
    }
    band /= 2;
    if (attempt === 4) band = 0;
  }
  if (band <= 1e-6) {
    innerOutline = faceOutline;
    innerHoles = faceHoles;
  }

  const interiorTri =
    band > 1e-6 ? triangulate(innerOutline, innerHoles) : beveled ? triangulate(faceOutline, faceHoles) : tri;

  const emitFace = (z: number, normal: Vector3, material: MaterialId, flip: boolean): void => {
    mb.group(material, () => {
      const vertsFor = (loop: readonly Vector2[]): number[] =>
        loop.map((p) =>
          mb.vert(place(p.x, p.y, z), normal, new Vector2(p.x / 1000, p.y / 1000), {
            edgeDist: distanceToAnyBoundary(p, faceOutline, faceHoles),
            region,
            wear,
          }),
        );

      if (band > 1e-6) {
        const rim = vertsFor(faceOutline);
        const inner = vertsFor(innerOutline);
        if (flip) mb.ring(inner, rim);
        else mb.ring(rim, inner);

        for (let i = 0; i < faceHoles.length; i++) {
          const holeRim = vertsFor(faceHoles[i]!);
          const holeInner = vertsFor(innerHoles[i]!);
          if (flip) mb.ring(holeInner, holeRim);
          else mb.ring(holeRim, holeInner);
        }
      }

      const idx = vertsFor(interiorTri.points);
      for (const t of interiorTri.triangles) {
        const a = idx[t[0]]!;
        const b = idx[t[1]]!;
        const cc = idx[t[2]]!;
        if (flip) mb.tri(a, cc, b);
        else mb.tri(a, b, cc);
      }
    });
  };

  emitFace(0, OUT, mats.outer, false);
  emitFace(-thickness, IN, mats.inner, true);

  // ---------------------------------------------------------------------------
  // Walls
  //
  // z decreases into the plate, so ring(lowerZ, higherZ) yields outward normals
  // for the CCW outline and hole-facing normals for the CW holes — the same call
  // works for both because their winding already differs.
  // ---------------------------------------------------------------------------

  const emitLoopVerts = (loop: readonly Vector2[], z: number): number[] =>
    loop.map((p) =>
      mb.vert(place(p.x, p.y, z), OUT, new Vector2(p.x / 1000, p.y / 1000), {
        edgeDist: 0,
        region,
        wear,
      }),
    );

  const emitWalls = (faceLoop: readonly Vector2[], fullLoop: readonly Vector2[]): void => {
    if (beveled) {
      const atFace = emitLoopVerts(faceLoop, 0);
      const atOuterBevel = emitLoopVerts(fullLoop, -c);
      const atInnerBevel = emitLoopVerts(fullLoop, -(thickness - c));
      const atInnerFace = emitLoopVerts(faceLoop, -thickness);
      mb.ring(atOuterBevel, atFace);
      mb.ring(atInnerBevel, atOuterBevel);
      mb.ring(atInnerFace, atInnerBevel);
    } else {
      const atFace = emitLoopVerts(fullLoop, 0);
      const atBack = emitLoopVerts(fullLoop, -thickness);
      mb.ring(atBack, atFace);
    }
  };

  mb.group(mats.edge, () => {
    emitWalls(faceOutline, fullOutline);
    for (let i = 0; i < fullHoles.length; i++) {
      emitWalls(faceHoles[i]!, fullHoles[i]!);
    }
  });

  // ---------------------------------------------------------------------------
  // Result
  // ---------------------------------------------------------------------------

  const toWorld = (loop: readonly Vector2[], z: number): Vector3[] =>
    loop.map((p) => place(p.x, p.y, z));

  const edgeLoops = new Map<string, Vector3[]>();
  for (const e of namedEdges) {
    const pts: Vector3[] = [];
    for (let i = e.from; i <= e.to && i < fullOutline.length; i++) {
      const p = fullOutline[i]!;
      pts.push(place(p.x, p.y, 0));
    }
    if (pts.length >= 2) edgeLoops.set(e.name, pts);
  }

  const area = netArea(fullOutline, fullHoles);

  return {
    outerLoop: toWorld(fullOutline, 0),
    innerLoop: toWorld(fullOutline, -thickness),
    edgeLoops,
    holeLoops: fullHoles.map((h) => toWorld(h, 0)),
    area,
    thickness,
    nominalVolume: area * thickness,
    triangleCount: mb.triangleCount - startTris,
  };
}

/** Build a standalone plate. Used by the geometry tests and for one-off parts. */
export function buildPlate(spec: PlateSpec): {
  plate: PlateResult;
  builder: MeshBuilder;
} {
  const mb = new MeshBuilder();
  const plate = emitPlate(mb, spec);
  mb.weldVertices();
  mb.recomputeNormals(40);
  return { plate, builder: mb };
}
