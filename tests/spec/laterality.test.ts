import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { buildAssembly, buildHull } from '../../src/parts/hull/index.js';
import { measureThicknessAlong } from '../../src/geom/analysis.js';
import { HULL, S, TURRET, mm } from '../../src/spec/index.js';

/**
 * Laterality.
 *
 * The model was mirrored for several stages: the frame documented +X as
 * starboard when a right-handed frame with +Y up and +Z forward puts starboard
 * on -X, so the driver, the hull machine gun and the cupola were all built on
 * the wrong side. It rendered perfectly plausibly and only showed up against a
 * head-on photograph.
 *
 * These tests do not trust the frame's comment. They re-derive starboard from
 * the axes themselves and then check that the geometry actually agrees.
 */

/** Starboard, from the frame's own definition rather than from a constant. */
const FORWARD = new Vector3(0, 0, 1);
const UP = new Vector3(0, 1, 0);
const STARBOARD = FORWARD.clone().cross(UP);

describe('laterality', () => {
  it('derives starboard as -X from the vehicle frame', () => {
    expect(STARBOARD.x).toBeLessThan(0);
    expect(STARBOARD.y).toBe(0);
    expect(STARBOARD.z).toBe(0);
  });

  it('puts the driver to port and the hull machine gun to starboard', () => {
    // The driver of a Tiger I sits front left, the radio operator front right
    // with the hull MG. Head-on photographs show the ball mount on the
    // viewer's left, which is the vehicle's starboard.
    expect(Math.sign(HULL.driverVisor.centreX)).not.toBe(Math.sign(STARBOARD.x));
    expect(Math.sign(HULL.hullMGMount.centreX)).toBe(Math.sign(STARBOARD.x));

    // And their hatches follow their crewmen.
    expect(Math.sign(HULL.driverHatch.centreX)).not.toBe(Math.sign(STARBOARD.x));
    expect(Math.sign(HULL.radioHatch.centreX)).toBe(Math.sign(STARBOARD.x));
  });

  it('puts the commander cupola to port and the loader hatch to starboard', () => {
    expect(Math.sign(TURRET.cupola.centreX)).not.toBe(Math.sign(STARBOARD.x));
    expect(Math.sign(TURRET.loaderHatch.centreX)).toBe(Math.sign(STARBOARD.x));
  });

  it('cuts the apertures on the sides the spec claims', () => {
    // Measured on the built hull, not read back off the spec: a builder that
    // negates X somewhere would satisfy the checks above and still produce a
    // mirrored tank.
    const geometry = buildAssembly(buildHull).context.render.toGeometry().geometry;
    const aft = new Vector3(0, 0, -1);

    /** True when a ray fired aft at this height and side passes through a hole. */
    const isOpen = (x: number, y: number): boolean => {
      const hit = measureThicknessAlong(
        geometry,
        new Vector3(S(mm(x)), S(mm(y)), S(mm(4600))),
        aft,
        S(mm(2400)),
      );
      if (hit === null) return true;
      const surface = new Vector3(S(mm(x)), S(mm(y)), S(mm(4600))).addScaledVector(
        aft,
        hit + 1e-5,
      );
      const through = measureThicknessAlong(geometry, surface, aft, S(mm(400)));
      // A bore reads as a few millimetres of shutter or nothing at all, where
      // solid plate reads as the better part of a hundred.
      return through === null || through < S(mm(40));
    };

    // Both sides are open at this height — the driver's visor sits within ten
    // millimetres of the MG's centreline — so the two are told apart by SHAPE.
    // Sixty millimetres above centre the round bore is still open, while the
    // visor's 95 mm slot has closed. Probing only the centres would pass on a
    // mirrored hull.
    const mgX = HULL.hullMGMount.centreX;
    const probeY = mm(HULL.hullMGMount.centreY + 60);
    expect(HULL.driverVisor.height / 2).toBeLessThan(60);

    expect(isOpen(mgX, HULL.hullMGMount.centreY), 'no bore on the starboard side').toBe(true);
    expect(isOpen(-mgX, HULL.driverVisor.centreY), 'no visor on the port side').toBe(true);

    expect(
      isOpen(mgX, probeY),
      'the starboard aperture closes 60 mm up, so it is a slot, not the MG bore',
    ).toBe(true);
    expect(
      isOpen(-mgX, probeY),
      'the port aperture is still open 60 mm up, so it is a bore, not the visor slot',
    ).toBe(false);
  });
});
