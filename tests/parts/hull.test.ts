import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { buildAssembly, buildLowerHull } from '../../src/parts/hull/index.js';
import { analyseManifold, measureThicknessAlong, signedVolume } from '../../src/geom/analysis.js';
import { SPEC, HULL, LOWER_HALF_WIDTH, hullProfile } from '../../src/spec/index.js';
import { S, mm, toMM } from '../../src/spec/units.js';

const built = buildAssembly(buildLowerHull);
const geometry = built.context.render.toGeometry().geometry;
const collision = built.context.collision.toGeometry().geometry;
geometry.computeBoundingBox();
const box = geometry.boundingBox!;

describe('lower hull: dimensions', () => {
  it('is as long as the sourced hull length', () => {
    const length = toMM(box.max.z - box.min.z);
    expect(Math.abs(length - SPEC.overall.length)).toBeLessThanOrEqual(
      // Weld beads stand proud of the plates they join.
      30,
    );
  });

  it('is as wide as the lower hull amidships', () => {
    // Measured rather than taken from the bounding box, because the rear plate
    // is stepped: it runs out to the full superstructure width above the
    // sponson floor so that the sponsons are closed off at the tail.
    const hit = measureThicknessAlong(
      geometry,
      new Vector3(S(mm(2000)), S(mm(800)), 0),
      new Vector3(-1, 0, 0),
      S(mm(1500)),
    );
    expect(hit).not.toBeNull();
    const sideAt = 2000 - toMM(hit!);
    expect(Math.abs(sideAt * 2 - HULL.lowerWidth)).toBeLessThanOrEqual(30);
  });

  it('runs the rear plate out to the superstructure width above the sponsons', () => {
    const width = toMM(box.max.x - box.min.x);
    expect(Math.abs(width - HULL.superstructureWidth)).toBeLessThanOrEqual(30);
  });

  it('sits at the sourced ground clearance', () => {
    expect(toMM(box.min.y)).toBeGreaterThanOrEqual(SPEC.overall.groundClearance - 30);
    expect(toMM(box.min.y)).toBeLessThanOrEqual(SPEC.overall.groundClearance + 30);
  });

  it('reaches the hull roof height at the tail', () => {
    // The rear plate runs the full height of the hull.
    expect(toMM(box.max.y)).toBeGreaterThanOrEqual(SPEC.overall.heightToHullRoof - 30);
  });

  it('closes its longitudinal profile on the sourced envelope', () => {
    const profile = hullProfile();
    const zs = profile.map((p) => p[0]);
    const ys = profile.map((p) => p[1]);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(SPEC.overall.length, 0);
    expect(Math.max(...ys)).toBeCloseTo(SPEC.overall.heightToHullRoof, 0);
    expect(Math.min(...ys)).toBeCloseTo(SPEC.overall.groundClearance, 0);
  });
});

describe('lower hull: armour is solid', () => {
  it('encloses a positive volume', () => {
    expect(signedVolume(geometry)).toBeGreaterThan(0);
  });

  it('measures a full 60 mm through a lower side wall', () => {
    // The anti-shell check, on real hull armour rather than a test plate.
    // The origin sits exactly on the outer face; the measurement skips the
    // surface it starts from and reports the next one, which is the inside.
    const origin = new Vector3(S(LOWER_HALF_WIDTH), S(mm(800)), 0);
    const hit = measureThicknessAlong(geometry, origin, new Vector3(-1, 0, 0), S(mm(600)));
    expect(hit).not.toBeNull();
    expect(toMM(hit!)).toBeCloseTo(SPEC.armour.hull.sideLower.thickness, 0);
  });

  it('measures a full 25 mm through the belly', () => {
    const outerFaceY = HULL.floorY + SPEC.armour.hull.sideWallProudOfBelly;
    const origin = new Vector3(0, S(mm(outerFaceY)), 0);
    const hit = measureThicknessAlong(geometry, origin, new Vector3(0, 1, 0), S(mm(400)));
    expect(hit).not.toBeNull();
    expect(toMM(hit!)).toBeCloseTo(SPEC.armour.hull.floor.thickness, 0);
  });

  it('has an interior: a ray dropped inside the hull lands on the floor', () => {
    const inside = new Vector3(0, S(mm(900)), 0);
    const down = measureThicknessAlong(geometry, inside, new Vector3(0, -1, 0), S(mm(1000)));
    expect(down).not.toBeNull();
    // The inner face of the belly, a plate thickness above its outer face.
    const floorInnerY =
      HULL.floorY + SPEC.armour.hull.sideWallProudOfBelly + SPEC.armour.hull.floor.thickness;
    expect(toMM(down!)).toBeCloseTo(900 - floorInnerY, 0);
  });
});

describe('lower hull: level of detail', () => {
  it('drops chamfers, edge bands and weld beads at the coarsest LOD', () => {
    const full = built.context.render.vertexCount;
    const coarse = buildAssembly(buildLowerHull, { detail: 2 }).context.render.vertexCount;
    expect(coarse).toBeLessThan(full / 2);
  });

  it('keeps the same envelope at every LOD', () => {
    // A coarser hull that is also a smaller hull would break the silhouette.
    const coarse = buildAssembly(buildLowerHull, { detail: 2 }).context.render.toGeometry().geometry;
    coarse.computeBoundingBox();
    const cb = coarse.boundingBox!;
    expect(Math.abs(toMM(cb.max.z - cb.min.z) - toMM(box.max.z - box.min.z))).toBeLessThan(40);
    expect(Math.abs(toMM(cb.max.y) - toMM(box.max.y))).toBeLessThan(40);
  });
});

describe('lower hull: collision', () => {
  it('generates a coarse collision surface from the same outlines', () => {
    expect(collision.getIndex()!.count / 3).toBeGreaterThan(0);
    // Far cheaper than the render mesh, because it is the same plates at LOD 2.
    const renderTris = geometry.getIndex()!.count / 3;
    const collisionTris = collision.getIndex()!.count / 3;
    expect(collisionTris).toBeLessThan(renderTris / 3);
  });

  it('covers the same volume as the render mesh', () => {
    collision.computeBoundingBox();
    const cbox = collision.boundingBox!;
    // Within a weld bead's thickness of the visible hull, in every axis.
    expect(Math.abs(toMM(cbox.max.z - cbox.min.z) - toMM(box.max.z - box.min.z))).toBeLessThan(40);
    expect(Math.abs(toMM(cbox.max.x - cbox.min.x) - toMM(box.max.x - box.min.x))).toBeLessThan(40);
  });

  it('has no gaps for the player to be pushed into', () => {
    const report = analyseManifold(collision);
    // No boundary edges is the assertion that matters: every edge has a face on
    // both sides, so there is no hole in the surface.
    expect(report.boundaryEdges).toBe(0);
    expect(report.degenerateTriangles).toBe(0);
    expect(signedVolume(collision)).toBeGreaterThan(0);

    // Non-manifold edges ARE expected here, unlike on the render mesh. Welding
    // fuses the plates into one buffer, and where two plates meet exactly flush
    // — the side wall's outer face against the nose plate's side edge, as on the
    // real hull — that shared edge ends up with four faces. Harmless for a BVH,
    // and the render mesh is checked strictly.
    expect(analyseManifold(geometry).nonManifoldEdges).toBe(0);
    expect(analyseManifold(geometry).boundaryEdges).toBe(0);
  });
});
