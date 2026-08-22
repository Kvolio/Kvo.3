import { describe, expect, it } from 'vitest';
import { Vector2, Vector3 } from 'three';
import { MeshBuilder } from '../../src/geom/MeshBuilder.js';
import { analyseManifold, signedVolume } from '../../src/geom/analysis.js';
import { cylinderProfile, emitRevolve, tubeProfile } from '../../src/prims/lathe.js';
import { emitSweep, transportFrames } from '../../src/prims/sweep.js';
import { emitWeld } from '../../src/prims/weld.js';
import { FastenerRegistry, buildFastenerGeometry } from '../../src/prims/fastener.js';
import { circle } from '../../src/geom/poly2.js';
import { Region } from '../../src/geom/attributes.js';
import { noise1, worley2, makeRandom } from '../../src/geom/noise.js';

const finish = (mb: MeshBuilder) => {
  mb.weldVertices();
  mb.recomputeNormals(40);
  return mb.toGeometry().geometry;
};

describe('revolve', () => {
  it('produces a closed cylinder of the right volume', () => {
    const mb = new MeshBuilder();
    const r = 0.4;
    const h = 0.075;
    emitRevolve(mb, { profile: cylinderProfile(r, h), segments: 64 });
    const g = finish(mb);

    expect(analyseManifold(g).manifold).toBe(true);
    // A 64-gon slightly under-fills the circle it approximates.
    const expected = Math.PI * r * r * h;
    expect(signedVolume(g) / expected).toBeGreaterThan(0.99);
    expect(signedVolume(g) / expected).toBeLessThanOrEqual(1.0);
  });

  it('produces a closed tube with a real bore', () => {
    const mb = new MeshBuilder();
    emitRevolve(mb, { profile: tubeProfile(0.2, 0.12, 0.5), segments: 48 });
    const g = finish(mb);

    expect(analyseManifold(g).manifold).toBe(true);
    const expected = Math.PI * (0.2 ** 2 - 0.12 ** 2) * 0.5;
    expect(signedVolume(g) / expected).toBeGreaterThan(0.98);
  });

  it('closes a partial revolution rather than leaving it open', () => {
    const mb = new MeshBuilder();
    emitRevolve(mb, {
      profile: cylinderProfile(0.3, 0.2),
      segments: 24,
      arcLength: Math.PI,
    });
    const g = finish(mb);
    expect(analyseManifold(g).boundaryEdges).toBe(0);
    expect(signedVolume(g)).toBeGreaterThan(0);
  });

  it('carries the authored region through to every vertex', () => {
    const mb = new MeshBuilder();
    emitRevolve(mb, {
      profile: cylinderProfile(0.1, 0.1),
      segments: 12,
      region: Region.EngineBay,
    });
    const attr = finish(mb).getAttribute('aRegion');
    for (let i = 0; i < attr.count; i++) expect(attr.getX(i)).toBe(Region.EngineBay);
  });
});

describe('sweep', () => {
  it('carries a profile along a path without flipping it', () => {
    // A path that turns through vertical is exactly where a fixed up-vector
    // would roll the section over; parallel transport must not.
    const path: Vector3[] = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      path.push(new Vector3(Math.sin(t * Math.PI) * 0.5, t * 1.2, Math.cos(t * Math.PI) * 0.5));
    }
    const frames = transportFrames(path);

    for (let i = 1; i < frames.length; i++) {
      // No sudden 180-degree flip between adjacent frames.
      expect(frames[i]!.normal.dot(frames[i - 1]!.normal)).toBeGreaterThan(0.5);
      // Frames stay orthonormal.
      expect(Math.abs(frames[i]!.normal.dot(frames[i]!.tangent))).toBeLessThan(1e-6);
      expect(frames[i]!.normal.length()).toBeCloseTo(1, 6);
    }
  });

  it('caps an open sweep into a closed solid', () => {
    const mb = new MeshBuilder();
    emitSweep(mb, {
      profile: circle(0.05, 12).map((p) => new Vector2(p.x, p.y)),
      path: [new Vector3(0, 0, 0), new Vector3(0, 0, 1), new Vector3(0.5, 0, 2)],
      cap: true,
    });
    const g = finish(mb);
    expect(analyseManifold(g).boundaryEdges).toBe(0);
    expect(signedVolume(g)).toBeGreaterThan(0);
  });
});

describe('weld bead', () => {
  const cornerPath = [new Vector3(-1, 0, 0), new Vector3(1, 0, 0)];

  it('lays a closed bead into the corner between two plates', () => {
    const mb = new MeshBuilder();
    const result = emitWeld(mb, {
      path: cornerPath,
      normalA: new Vector3(0, 1, 0),
      normalB: new Vector3(0, 0, 1),
      profile: 'fillet-8',
    });
    expect(result.triangleCount).toBeGreaterThan(0);

    const g = finish(mb);
    expect(analyseManifold(g).boundaryEdges).toBe(0);
    expect(signedVolume(g)).toBeGreaterThan(0);
  });

  it('refuses a fillet between coplanar surfaces', () => {
    // Two plates in the same plane meet at a butt joint, not a fillet. Sweeping
    // one anyway would emit a degenerate ribbon along the seam.
    const mb = new MeshBuilder();
    const result = emitWeld(mb, {
      path: cornerPath,
      normalA: new Vector3(0, 1, 0),
      normalB: new Vector3(0, 1, 0),
    });
    expect(result.triangleCount).toBe(0);
  });

  it('varies the bead radius along the seam', () => {
    // The stacked-dimes cadence is the whole reason this is geometry rather
    // than a normal map, so a bead of constant radius is a failure.
    const mb = new MeshBuilder();
    emitWeld(mb, {
      path: [new Vector3(-1, 0, 0), new Vector3(1, 0, 0)],
      normalA: new Vector3(0, 1, 0),
      normalB: new Vector3(0, 0, 1),
      profile: 'fillet-12',
    });
    const g = mb.toGeometry().geometry;
    const pos = g.getAttribute('position');

    // Distance from the joint line (the x axis) should oscillate along it.
    const radii: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      radii.push(Math.hypot(pos.getY(i), pos.getZ(i)));
    }
    const max = Math.max(...radii);
    const min = Math.min(...radii.filter((r) => r > 1e-6));
    expect(max - min).toBeGreaterThan(0.0005);
  });

  it('scales the bead with the specified fillet size', () => {
    const measure = (profile: 'fillet-6' | 'convex-16'): number => {
      const mb = new MeshBuilder();
      emitWeld(mb, {
        path: cornerPath,
        normalA: new Vector3(0, 1, 0),
        normalB: new Vector3(0, 0, 1),
        profile,
      });
      const g = mb.toGeometry().geometry;
      g.computeBoundingBox();
      return g.boundingBox!.max.y;
    };
    expect(measure('convex-16')).toBeGreaterThan(measure('fillet-6') * 2);
  });
});

describe('fasteners', () => {
  it('builds each kind as a closed solid', () => {
    for (const kind of ['hexBolt', 'domedRivet', 'countersunk', 'castleNut'] as const) {
      const g = buildFastenerGeometry(kind);
      const report = analyseManifold(g);
      expect(report.boundaryEdges, `${kind} boundary edges`).toBe(0);
      expect(signedVolume(g), `${kind} volume`).toBeGreaterThan(0);
    }
  });

  it('sizes a hex head by its across-flats, not its corners', () => {
    // A 30 mm wrench size means 30 mm across the flats and ~34.6 across the
    // corners. Modelling the corner radius as 15 mm makes every bolt undersized.
    const g = buildFastenerGeometry('hexBolt');
    g.computeBoundingBox();
    const acrossCorners = (g.boundingBox!.max.x - g.boundingBox!.min.x) * 1000;
    expect(acrossCorners).toBeGreaterThan(33);
    expect(acrossCorners).toBeLessThan(36);
  });

  it('groups placements into one batch per kind and region', () => {
    const reg = new FastenerRegistry();
    const up = new Vector3(0, 1, 0);
    reg.add('hexBolt', new Vector3(0, 0, 0), up);
    reg.add('hexBolt', new Vector3(1, 0, 0), up);
    reg.add('domedRivet', new Vector3(2, 0, 0), up);
    reg.add('hexBolt', new Vector3(3, 0, 0), up, { region: Region.EngineBay });

    expect(reg.count()).toBe(4);
    expect(reg.count('hexBolt')).toBe(3);

    const batches = reg.materialize();
    // Exterior hex, exterior rivet, engine-bay hex.
    expect(batches).toHaveLength(3);
    const exteriorHex = batches.find(
      (b) => b.kind === 'hexBolt' && b.region === Region.Exterior,
    )!;
    expect(exteriorHex.matrices).toHaveLength(2);
    // One geometry shared by every instance of a kind.
    expect(batches.filter((b) => b.kind === 'hexBolt').map((b) => b.geometry)).toSatisfy(
      (gs: unknown[]) => new Set(gs).size === 1,
    );
  });

  it('lays a bolt circle at the requested radius', () => {
    const reg = new FastenerRegistry();
    const centre = new Vector3(0, 0.5, 0);
    reg.addRing('hexBolt', centre, new Vector3(0, 0, 1), 0.28, 18);

    expect(reg.count('hexBolt')).toBe(18);
    const batch = reg.materialize()[0]!;
    for (const m of batch.matrices) {
      const p = new Vector3().setFromMatrixPosition(m);
      expect(p.distanceTo(centre)).toBeCloseTo(0.28, 6);
      // The ring lies in the plane whose normal was given.
      expect(p.z).toBeCloseTo(0, 6);
    }
  });
});

describe('noise', () => {
  it('is deterministic, so screenshot baselines stay stable', () => {
    expect(noise1(12.34, 7)).toBe(noise1(12.34, 7));
    expect(worley2(3.3, 9.1, 2)).toBe(worley2(3.3, 9.1, 2));
    const a = makeRandom(42);
    const b = makeRandom(42);
    for (let i = 0; i < 10; i++) expect(a()).toBe(b());
  });

  it('stays inside the unit range it promises', () => {
    for (let i = 0; i < 500; i++) {
      const x = i * 0.37;
      expect(noise1(x, 3)).toBeGreaterThanOrEqual(0);
      expect(noise1(x, 3)).toBeLessThanOrEqual(1);
      const w = worley2(x, x * 0.6, 5);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(1);
    }
  });
});
