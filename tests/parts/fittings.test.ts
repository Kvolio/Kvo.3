import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { buildAssembly, buildHull } from '../../src/parts/hull/index.js';
import { buildFittings } from '../../src/parts/hull/fittings.js';
import { measureThicknessAlong } from '../../src/geom/analysis.js';
import { ARMOUR, HULL, S, SPEC, mm, toMM } from '../../src/spec/index.js';
import { AusfE_Aug1943 } from '../../src/spec/variants.js';

/**
 * The bolted-on parts. None of it is armour, and all of it changes the
 * silhouette — the track guards in particular are what the 1:50 drawing shows
 * projecting ahead of the nose.
 */
describe('hull fittings', () => {
  const geometry = buildAssembly(buildHull).context.render.toGeometry().geometry;

  it('fits five S-mine dischargers', () => {
    // Two a side plus one at the tail. UNCERTAINTY #13: the count is attested,
    // the stations are not.
    const perSide = HULL.sMineDischarger.stationsZ.length;
    expect(perSide * 2 + 1).toBe(5);
  });

  it('sets the vehicle width by the track guards, not the hull', () => {
    expect(HULL.trackGuard.outerX * 2).toBe(SPEC.overall.widthOverCombatTracks);
    expect(HULL.trackGuard.outerX).toBeGreaterThan(HULL.superstructureWidth / 2);
  });

  it('carries the guards past both ends of the armour', () => {
    expect(HULL.trackGuard.frontZ).toBeGreaterThan(HULL.frontZ);
    expect(HULL.trackGuard.rearZ).toBeLessThan(HULL.rearZ);
  });

  it('hangs the guards level with the sponson floor', () => {
    // Both supplied photographs show the guard running level with the lower
    // edge of the superstructure side, which is where the sponson floor is.
    expect(HULL.trackGuard.height).toBe(HULL.sponsonFloorY);
  });

  it('puts solid guard over the track at mid-length', () => {
    // Straight down onto the guard, outboard of the superstructure side.
    const x = mm((HULL.superstructureWidth / 2 + HULL.trackGuard.outerX) / 2);
    const from = mm(HULL.trackGuard.height + 400);
    const hit = measureThicknessAlong(
      geometry,
      new Vector3(S(x), S(from), 0),
      new Vector3(0, -1, 0),
      S(mm(600)),
    );
    expect(hit, 'no guard above the track').not.toBeNull();
    // The walking surface, level with the sponson floor's own top.
    expect(from - toMM(hit!)).toBeCloseTo(
      HULL.trackGuard.height + ARMOUR.hull.roof.thickness,
      0,
    );
  });

  it('drops the second headlight on the later variant', () => {
    const dual = buildAssembly(buildFittings).part.triangleCount;
    const single = buildAssembly(buildFittings, { variant: AusfE_Aug1943 }).part.triangleCount;
    expect(single).toBeLessThan(dual);
  });
});
