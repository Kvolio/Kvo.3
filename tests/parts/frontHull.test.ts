import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { buildAssembly, buildHull } from '../../src/parts/hull/index.js';
import { measureThicknessAlong } from '../../src/geom/analysis.js';
import { R, S, fromHorizontal, mm, toMM } from '../../src/spec/units.js';
import {
  ARMOUR,
  DRIVER_PLATE_FOOT_Y,
  GLACIS_HEAD_Z,
  HULL,
  driverPlateOuterZ,
  glacisOuterY,
  hullProfile,
} from '../../src/spec/index.js';

/**
 * The frontal armour arrangement, guarded.
 *
 * The first version of this model ran the 100 mm nose plate straight into the
 * 100 mm driver's plate as a single continuous wedge, with the 60 mm glacis put
 * somewhere else entirely — above the driver's plate, as a long front deck. It
 * looked plausible from every angle and no test could see it.
 *
 * The Tiger's front is four planes: nose, short glacis, driver's plate, roof.
 * These tests measure that from the geometry rather than trusting the code that
 * produced it.
 */

const geometry = buildAssembly(buildHull).context.render.toGeometry().geometry;

/** The glacis's slope measured from horizontal, in radians. */
const GLACIS_RISE = R(fromHorizontal(ARMOUR.hull.shortGlacis.angle));

/** Where the hull's front surface sits at a given height, on the centreline. */
function frontSurfaceZ(y: number): number | null {
  const origin = new Vector3(0, S(mm(y)), S(mm(4200)));
  const hit = measureThicknessAlong(geometry, origin, new Vector3(0, 0, -1), S(mm(2200)));
  return hit === null ? null : 4200 - toMM(hit);
}

describe('the front is three distinct plates, not one wedge', () => {
  it('retreats sharply across the glacis and gently up the driver plate', () => {
    // Sampled as a profile and differentiated. A wedge has one slope; the real
    // front has three, and the glacis's is an order of magnitude steeper than
    // its neighbours'.
    const samples: { y: number; z: number }[] = [];
    for (let y = 560; y <= 1740; y += 10) {
      const z = frontSurfaceZ(y);
      if (z !== null) samples.push({ y, z });
    }
    expect(samples.length).toBeGreaterThan(100);

    let steepestRetreat = 0;
    for (let i = 1; i < samples.length; i++) {
      const dz = samples[i]!.z - samples[i - 1]!.z;
      const dy = samples[i]!.y - samples[i - 1]!.y;
      steepestRetreat = Math.max(steepestRetreat, -dz / dy);
    }

    // Up the nose the surface moves FORWARD; up the driver's plate it retreats
    // at tan(9 deg) = 0.16 per mm. Neither can produce a steep retreat. Only a
    // near-horizontal plate between them can.
    expect(
      steepestRetreat,
      `steepest retreat ${steepestRetreat.toFixed(2)} mm per mm — a wedge cannot exceed tan(25 deg)`,
    ).toBeGreaterThan(2);
  });

  it('steps back by the full glacis run between nose top and driver plate foot', () => {
    const atNoseTop = frontSurfaceZ(HULL.noseTopY - 20);
    const atDriverFoot = frontSurfaceZ(DRIVER_PLATE_FOOT_Y + 20);
    expect(atNoseTop).not.toBeNull();
    expect(atDriverFoot).not.toBeNull();

    const step = atNoseTop! - atDriverFoot!;
    expect(step, `front step ${step.toFixed(0)} mm`).toBeGreaterThan(HULL.glacisRun * 0.8);
    expect(step).toBeLessThan(HULL.glacisRun * 1.25);
  });

  it('puts the hull foremost point at the top of the nose plate', () => {
    // The nose leans back as it descends and the glacis leans back as it climbs,
    // so their shared edge is the furthest-forward point on the vehicle.
    let foremost = -Infinity;
    let foremostY = 0;
    for (let y = 500; y <= 1760; y += 10) {
      const z = frontSurfaceZ(y);
      if (z !== null && z > foremost) {
        foremost = z;
        foremostY = y;
      }
    }
    expect(Math.abs(foremostY - HULL.noseTopY)).toBeLessThan(40);
    expect(Math.abs(foremost - HULL.frontZ)).toBeLessThan(25);
  });
});

describe('each frontal plate is its own thickness', () => {
  it('crosses 60 mm through the short glacis', () => {
    // Fired straight down onto the middle of the glacis. A vertical ray through
    // a plate lying 10 degrees off horizontal travels very slightly further than
    // the plate is thick.
    const midZ = mm((HULL.frontZ + GLACIS_HEAD_Z) / 2);
    const above = new Vector3(0, S(mm(glacisOuterY(midZ) + 200)), S(midZ));
    const down = new Vector3(0, -1, 0);

    const toSurface = measureThicknessAlong(geometry, above, down, S(mm(600)));
    expect(toSurface, 'nothing above the glacis line — the plate is missing').not.toBeNull();

    const onSurface = above.clone().addScaledVector(down, toSurface! + 1e-5);
    const through = measureThicknessAlong(geometry, onSurface, down, S(mm(400)));
    expect(through).not.toBeNull();

    expect(toMM(through!)).toBeGreaterThan(ARMOUR.hull.shortGlacis.thickness * 0.95);
    expect(toMM(through!)).toBeLessThan(ARMOUR.hull.shortGlacis.thickness * 1.15);
  });

  it('crosses 100 mm through the driver plate and 100 mm through the nose', () => {
    const crossAt = (y: number, dir: Vector3, from: Vector3): number => {
      const first = measureThicknessAlong(geometry, from, dir, S(mm(2500)));
      expect(first, `no surface found at y=${y}`).not.toBeNull();
      const on = from.clone().addScaledVector(dir, first! + 1e-5);
      const second = measureThicknessAlong(geometry, on, dir, S(mm(600)));
      expect(second, `no far face at y=${y}`).not.toBeNull();
      return toMM(second!);
    };

    const aft = new Vector3(0, 0, -1);
    // Sampled well inside each plate rather than near a transition, where a ray
    // grazes the corner and measures a few millimetres of nothing.
    const driver = crossAt(1500, aft, new Vector3(0, S(mm(1500)), S(mm(4200))));
    const nose = crossAt(800, aft, new Vector3(0, S(mm(800)), S(mm(4200))));

    // Crossed along Z through plates tilted 9 and 25 degrees from vertical, so
    // both paths are longer than the plate is thick — the nose markedly so.
    expect(driver).toBeGreaterThan(ARMOUR.hull.driverPlate.thickness * 0.95);
    expect(driver).toBeLessThan(ARMOUR.hull.driverPlate.thickness * 1.2);
    expect(nose).toBeGreaterThan(ARMOUR.hull.nose.thickness * 0.95);
    expect(nose).toBeLessThan(ARMOUR.hull.nose.thickness * 1.3);
  });
});

describe('the hull profile agrees with the geometry', () => {
  it('describes four frontal planes', () => {
    const profile = hullProfile();
    // Nose top, glacis head, driver plate head, then the roof runs aft.
    expect(profile[0]![0]).toBeCloseTo(HULL.frontZ, 0);
    expect(profile[0]![1]).toBeCloseTo(HULL.noseTopY, 0);
    expect(profile[1]![0]).toBeCloseTo(GLACIS_HEAD_Z, 0);
    expect(profile[1]![1]).toBeCloseTo(DRIVER_PLATE_FOOT_Y, 0);
    expect(profile[2]![1]).toBeCloseTo(HULL.roofY, 0);
  });

  it('agrees with the built surface at every frontal landmark', () => {
    for (const y of [700, 900, 1200, 1500, 1700]) {
      const measured = frontSurfaceZ(y);
      const predicted =
        y <= HULL.noseTopY
          ? HULL.frontZ - (HULL.noseTopY - y) * Math.tan(R(ARMOUR.hull.nose.angle))
          : y <= DRIVER_PLATE_FOOT_Y
            ? HULL.frontZ - (y - HULL.noseTopY) / Math.tan(GLACIS_RISE)
            : driverPlateOuterZ(mm(y));
      expect(measured, `at y=${y}`).not.toBeNull();
      expect(Math.abs(measured! - predicted), `at y=${y}`).toBeLessThan(25);
    }
  });
});
