import { describe, expect, it } from 'vitest';
import type { Box3} from 'three';
import { Vector3 } from 'three';
import { buildAssembly, buildHull } from '../../src/parts/hull/index.js';
import { buildHatchLid, type HatchId } from '../../src/parts/hull/hatches.js';
import { measureThicknessAlong } from '../../src/geom/analysis.js';
import { HULL, S, TURRET, mm, toMM } from '../../src/spec/index.js';
import { ARMOUR } from '../../src/spec/armour.js';

/**
 * The lids exist to be operated, so what matters is that they seat in the holes
 * the roof actually has and clear them when they lift. A lid built against a
 * remembered aperture position rather than the real one looks right in a render
 * and drops the player through the roof.
 */

function lidGeometry(id: HatchId) {
  const built = buildAssembly((ctx) => buildHatchLid(ctx, id).part);
  const geometry = built.context.render.toGeometry().geometry;
  geometry.computeBoundingBox();
  return { geometry, box: geometry.boundingBox as Box3 };
}

const hull = buildAssembly(buildHull).context.render.toGeometry().geometry;

describe('crew hatch lids', () => {
  for (const id of ['driverHatch', 'radioHatch'] as const) {
    const spec = HULL[id];

    describe(id, () => {
      it('covers the aperture it seats in', () => {
        const { box } = lidGeometry(id);
        // The flange has to overhang the hole, or the lid falls through it.
        const halfWidth = Math.max(
          Math.abs(toMM(box.max.x) - spec.centreX),
          Math.abs(spec.centreX - toMM(box.min.x)),
        );
        expect(halfWidth).toBeGreaterThan(spec.diameter / 2);
      });

      it('leaves a real hole in the roof beneath it', () => {
        // Fired down the hatch centreline, through the roof plate. The lid is a
        // separate body, so the hull on its own must be open here.
        const hit = measureThicknessAlong(
          hull,
          new Vector3(S(spec.centreX), S(mm(HULL.roofY + 500)), S(spec.centreZ)),
          new Vector3(0, -1, 0),
          S(mm(3000)),
        );
        // Something below — a sponson floor or the belly — but not the roof.
        const depth = hit === null ? Infinity : toMM(hit) - 500;
        expect(depth, 'the roof is solid where the hatch should be').toBeGreaterThan(
          ARMOUR.hull.roof.thickness * 2,
        );
      });

      it('rises clear of its seat before it can swing', () => {
        // The spigot hangs the balance of the lid's thickness down inside the
        // ring, and all of that has to come back out before the lid can turn or
        // it sweeps through the roof plate.
        const spigot = spec.thickness - HULL.hatchSeat.proud;
        expect(spec.liftHeight).toBeGreaterThan(spigot);
      });

      it('seats into its ring rather than resting on the roof', () => {
        // A lid showing its full thickness above the roof reads as a disc laid
        // over a hole. The step is low and the rest is inside the ring.
        expect(HULL.hatchSeat.proud).toBeLessThan(spec.thickness / 2);
        expect(HULL.hatchSeat.proud).toBeGreaterThan(ARMOUR.hull.roof.thickness / 2);
      });

      it('puts its pivot post off the lid, not through it', () => {
        // The post stands outboard of the lid's own flange, so the lid can
        // swing round it rather than through it.
        expect(Math.abs(spec.pivotOffsetX)).toBeGreaterThan(spec.diameter / 2);
      });
    });
  }

  it('keeps each lid clear of the turret ring and the sponson side', () => {
    // Moving the hatches outboard to match the plan view is exactly the kind of
    // change that quietly overlaps something else.
    const flange = HULL.hatchSeat.flange;
    for (const id of ['driverHatch', 'radioHatch'] as const) {
      const spec = HULL[id];
      const reach = spec.diameter / 2 + flange;

      const toRing = Math.hypot(spec.centreX, spec.centreZ - TURRET.ring.centreZ);
      expect(
        toRing,
        `${id} overlaps the turret ring`,
      ).toBeGreaterThan(TURRET.ring.clearOpeningDiameter / 2 + reach);

      expect(
        Math.abs(spec.centreX) + reach,
        `${id} overhangs the sponson side`,
      ).toBeLessThan(HULL.superstructureWidth / 2);
    }
  });

  it('puts the two lids on opposite sides of the centreline', () => {
    expect(Math.sign(HULL.driverHatch.centreX)).not.toBe(Math.sign(HULL.radioHatch.centreX));
  });
});
