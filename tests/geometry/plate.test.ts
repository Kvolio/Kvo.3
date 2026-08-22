import { describe, expect, it } from 'vitest';
import { Matrix4, Vector3 } from 'three';
import { buildPlate } from '../../src/prims/plate.js';
import { analyseManifold, measureThicknessAlong, signedVolume } from '../../src/geom/analysis.js';
import {
  circle,
  rect,
  roundedRect,
  interlockEdge,
  netArea,
  translate,
} from '../../src/geom/poly2.js';
import { mm, S, toMM } from '../../src/spec/units.js';
import { Region } from '../../src/geom/attributes.js';

/**
 * The plate primitive underpins every piece of armour in the reconstruction, so
 * it is worth proving rather than eyeballing. These assertions are the
 * mechanical form of the brief's requirement that the hull must not be "a single
 * hollow shell with fake thickness".
 */

describe('plate: solidity', () => {
  it('is a closed manifold with no boundary or non-manifold edges', () => {
    const { builder } = buildPlate({
      outline: rect(2000, 1200),
      thickness: mm(100),
    });
    const { geometry } = builder.toGeometry();
    const report = analyseManifold(geometry);

    expect(report.boundaryEdges).toBe(0);
    expect(report.nonManifoldEdges).toBe(0);
    expect(report.degenerateTriangles).toBe(0);
    expect(report.hasNaN).toBe(false);
    expect(report.manifold).toBe(true);
  });

  it('stays manifold with apertures cut through it', () => {
    const { builder } = buildPlate({
      outline: rect(2400, 1500),
      holes: [
        translate(circle(280, 24), -650, 0),
        translate(roundedRect(500, 380, 90), 650, 0),
      ],
      thickness: mm(25),
    });
    const { geometry } = builder.toGeometry();
    const report = analyseManifold(geometry);

    expect(report.boundaryEdges).toBe(0);
    expect(report.nonManifoldEdges).toBe(0);
    expect(report.manifold).toBe(true);
  });

  it('encloses a positive volume matching area x thickness', () => {
    const outline = rect(2000, 1200);
    const holes = [circle(300, 32)];
    const thickness = mm(80);

    const { builder, plate } = buildPlate({ outline, holes, thickness });
    const { geometry } = builder.toGeometry();

    // Scene units are metres, the spec is millimetres.
    const measuredMm3 = signedVolume(geometry) * 1e9;
    const expectedMm3 = netArea(outline, holes) * thickness;

    expect(plate.nominalVolume).toBeCloseTo(expectedMm3, 0);
    // Positive volume proves the solid is wound outward, not inside out.
    expect(measuredMm3).toBeGreaterThan(0);
    expect(measuredMm3 / expectedMm3).toBeGreaterThan(0.985);
    expect(measuredMm3 / expectedMm3).toBeLessThan(1.015);
  });
});

describe('plate: real thickness', () => {
  // The core anti-shell assertion: stand on the outer face, walk inwards along
  // the surface normal, and the back face must actually be there.
  it.each([25, 60, 80, 100, 120])('measures %i mm through from the outer face', (t) => {
    const { builder } = buildPlate({
      outline: rect(1800, 1400),
      thickness: mm(t),
    });
    const { geometry } = builder.toGeometry();

    const samples = [
      [0, 0],
      [400, 300],
      [-500, -200],
      [700, -450],
      [-650, 500],
    ] as const;

    for (const [x, y] of samples) {
      const origin = new Vector3(S(mm(x)), S(mm(y)), 0);
      const hit = measureThicknessAlong(geometry, origin, new Vector3(0, 0, -1), S(mm(500)));
      expect(hit).not.toBeNull();
      expect(toMM(hit!)).toBeCloseTo(t, 1);
    }
  });

  it('has a back face behind an aperture rim, not an open shell', () => {
    const thickness = mm(100);
    const { builder } = buildPlate({
      outline: rect(2000, 2000),
      holes: [circle(400, 32)],
      thickness,
    });
    const { geometry } = builder.toGeometry();

    // Just outside the aperture: solid, so full thickness.
    const nearRim = new Vector3(S(mm(460)), 0, 0);
    const hit = measureThicknessAlong(geometry, nearRim, new Vector3(0, 0, -1), S(mm(500)));
    expect(toMM(hit!)).toBeCloseTo(thickness, 1);

    // Down the middle of the aperture: nothing to hit at all.
    const throughHole = new Vector3(0, 0, S(mm(10)));
    const miss = measureThicknessAlong(geometry, throughHole, new Vector3(0, 0, -1), S(mm(500)));
    expect(miss).toBeNull();
  });
});

describe('plate: refuses impossible apertures', () => {
  it('rejects apertures that overlap each other', () => {
    expect(() =>
      buildPlate({
        outline: rect(2000, 2000),
        holes: [circle(300, 24), translate(circle(300, 24), 100, 0)],
        thickness: mm(40),
      }),
    ).toThrow(/overlap/);
  });

  it('rejects an aperture that runs off the edge of the plate', () => {
    expect(() =>
      buildPlate({
        outline: rect(1000, 1000),
        holes: [translate(circle(300, 24), 800, 0)],
        thickness: mm(40),
      }),
    ).toThrow(/outside the plate outline/);
  });
});

describe('plate: chamfer and interlock', () => {
  it('remains a closed solid when chamfered', () => {
    const { builder } = buildPlate({
      outline: rect(1600, 1000),
      holes: [circle(200, 24)],
      thickness: mm(80),
      chamfer: mm(6),
    });
    const { geometry } = builder.toGeometry();
    const report = analyseManifold(geometry);
    expect(report.manifold).toBe(true);
    expect(signedVolume(geometry)).toBeGreaterThan(0);
  });

  it('drops chamfer bands at the coarsest LOD but stays solid', () => {
    const detailed = buildPlate({
      outline: rect(1600, 1000),
      thickness: mm(80),
      chamfer: mm(6),
      detail: 0,
    });
    const coarse = buildPlate({
      outline: rect(1600, 1000),
      thickness: mm(80),
      chamfer: mm(6),
      detail: 2,
    });

    expect(coarse.plate.triangleCount).toBeLessThan(detailed.plate.triangleCount);
    expect(analyseManifold(coarse.builder.toGeometry().geometry).manifold).toBe(true);
  });

  it('interlocked joints add teeth without breaking the solid', () => {
    // Tiger hull plates were stepped and interlocked before welding rather than
    // butt-jointed, so the teeth carry shear instead of the weld.
    const plain = rect(2000, 1200);
    const toothed = interlockEdge(plain, 0, { pitch: 160, depth: 60 });

    expect(toothed.length).toBeGreaterThan(plain.length);

    const { builder } = buildPlate({ outline: toothed, thickness: mm(100) });
    const report = analyseManifold(builder.toGeometry().geometry);
    expect(report.manifold).toBe(true);
  });

  it('mating plates mesh: proud teeth on one side, recessed on the other', () => {
    const base = rect(2000, 1200);
    const edgeLength = 2000;
    const depth = 60;
    const a = interlockEdge(base, 0, { pitch: 160, depth, startProud: true });
    const b = interlockEdge(base, 0, { pitch: 160, depth, startProud: false });

    // Opposite phase, equal material: each carries half the teeth.
    expect(a.length).toBe(b.length);
    expect(netArea(a)).toBeCloseTo(netArea(b), 0);

    // Together the two sets of teeth tile the joint band exactly once — no
    // overlap where they would foul, no gap the weld would have to fill.
    const jointBand = edgeLength * depth;
    expect(netArea(a) + netArea(b)).toBeCloseTo(2 * netArea(base) + jointBand, 0);
  });
});

describe('plate: vertex attributes', () => {
  it('writes edge distance that falls to zero at the boundary', () => {
    const { builder } = buildPlate({
      outline: rect(2000, 2000),
      thickness: mm(50),
    });
    const { geometry } = builder.toGeometry();
    const edgeDist = geometry.getAttribute('aEdgeDist');

    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < edgeDist.count; i++) {
      const v = edgeDist.getX(i);
      if (v < min) min = v;
      if (v > max) max = v;
    }
    // Zero on the rim, rising to the inset band width away from it. The band is
    // what makes the chipping falloff resolvable at all: a bare quad has only
    // corner vertices, every one of them on an edge.
    expect(min).toBeCloseTo(0, 3);
    expect(max).toBeCloseTo(45, 0);
  });

  it('resolves the chip falloff with real geometry, not just corner values', () => {
    const withBand = buildPlate({ outline: rect(2000, 2000), thickness: mm(50) });
    const withoutBand = buildPlate({
      outline: rect(2000, 2000),
      thickness: mm(50),
      edgeBandWidth: mm(0),
    });

    const distinct = (b: ReturnType<typeof buildPlate>): number => {
      const attr = b.builder.toGeometry().geometry.getAttribute('aEdgeDist');
      const seen = new Set<number>();
      for (let i = 0; i < attr.count; i++) seen.add(Math.round(attr.getX(i)));
      return seen.size;
    };

    // Without the band every vertex sits on an edge, so the shader would chip
    // the entire plate. With it there is an actual gradient to sample.
    expect(distinct(withoutBand)).toBe(1);
    expect(distinct(withBand)).toBeGreaterThan(1);
  });

  it('carries the authored region and wear onto every vertex', () => {
    const { builder } = buildPlate({
      outline: rect(800, 800),
      thickness: mm(25),
      region: Region.TurretInterior,
      wear: 0.8,
    });
    const { geometry } = builder.toGeometry();
    const region = geometry.getAttribute('aRegion');
    const wear = geometry.getAttribute('aWear');

    for (let i = 0; i < region.count; i++) {
      expect(region.getX(i)).toBe(Region.TurretInterior);
      expect(wear.getX(i)).toBeCloseTo(0.8, 5);
    }
  });
});

describe('plate: placement', () => {
  it('honours a placement frame for both geometry and edge loops', () => {
    const frame = new Matrix4().makeTranslation(S(mm(1000)), S(mm(2000)), S(mm(-500)));
    const { plate, builder } = buildPlate({
      outline: rect(1000, 1000),
      thickness: mm(40),
      frame,
      namedEdges: [{ name: 'bottom', from: 0, to: 1 }],
    });

    const { geometry } = builder.toGeometry();
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;

    expect(toMM(box.min.x)).toBeCloseTo(500, 3);
    expect(toMM(box.max.x)).toBeCloseTo(1500, 3);
    expect(toMM(box.max.y)).toBeCloseTo(2500, 3);
    // Outer face at the frame origin, inner face a thickness behind it.
    expect(toMM(box.max.z)).toBeCloseTo(-500, 3);
    expect(toMM(box.min.z)).toBeCloseTo(-540, 3);

    expect(plate.edgeLoops.get('bottom')).toBeDefined();
    expect(plate.edgeLoops.get('bottom')!.length).toBe(2);
  });
});
