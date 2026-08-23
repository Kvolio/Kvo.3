import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { buildAssembly, buildHull } from '../../src/parts/hull/index.js';
import { measureThicknessAlong } from '../../src/geom/analysis.js';
import {
  HULL,
  S,
  TURRET,
  driverPlateOuterZ,
  mm,
  toMM,
  type MM,
} from '../../src/spec/index.js';

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

/** How much a curved casting must drop between the two probe offsets. */
const FALL_AWAY = 10;

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

  it('stands the right casting proud on each side', () => {
    // Measured on the built hull, not read back off the spec: a builder that
    // negates X somewhere would satisfy the checks above and still produce a
    // mirrored tank.
    //
    // The discriminator is the CASTINGS rather than the aperture shapes. The
    // machine gun's ball mount stands 120 mm off the plate and the driver's
    // visor housing 70 mm, so how far each station juts out says which is
    // which — and unlike "is this hole open", it keeps working now that the
    // bore has a barrel down it.
    const geometry = buildAssembly(buildHull).context.render.toGeometry().geometry;
    const aft = new Vector3(0, 0, -1);

    /** How far the frontal fitting at this station stands off the plate. */
    const standoff = (x: MM, y: MM): number => {
      const from = 4600;
      const hit = measureThicknessAlong(
        geometry,
        new Vector3(S(x), S(y), S(mm(from))),
        aft,
        S(mm(2600)),
      );
      if (hit === null) return NaN;
      return from - toMM(hit) - driverPlateOuterZ(y);
    };

    // Told apart by SHAPE, not height. The machine gun's mount is a sphere, so
    // its standoff falls away as you move off its axis; the driver's visor
    // housing is a flat slab, so its standoff does not change at all. Comparing
    // heights instead is unfair to the ball — at any useful offset a sphere is
    // already well below its own crown — and comparing shapes cannot be fooled
    // by either casting being resized later.
    const profileAt = (centre: MM, y: MM, apertureHalf: number, castingHalf: number) => {
      const near = apertureHalf + (castingHalf - apertureHalf) * 0.25;
      const far = apertureHalf + (castingHalf - apertureHalf) * 0.75;
      const at = (r: number): number =>
        standoff(mm(centre + Math.sign(centre) * r), y);
      return { near: at(near), far: at(far) };
    };

    const gun = profileAt(
      HULL.hullMGMount.centreX,
      HULL.hullMGMount.centreY,
      HULL.hullMGMount.apertureDiameter / 2,
      HULL.hullMGMount.ballDiameter / 2,
    );
    const visor = profileAt(
      HULL.driverVisor.centreX,
      HULL.driverVisor.centreY,
      HULL.driverVisor.width / 2,
      HULL.driverVisor.housingWidth / 2,
    );

    expect(gun.near, 'no ball mount on the starboard side').toBeGreaterThan(0);
    expect(visor.near, 'no visor housing on the port side').toBeGreaterThan(0);

    // The sphere falls away; the slab does not.
    expect(gun.far, 'the starboard casting is flat, so it is not a ball mount')
      .toBeLessThan(gun.near - FALL_AWAY);
    expect(
      Math.abs(visor.far - visor.near),
      'the port casting is curved, so it is not a visor housing',
    ).toBeLessThan(FALL_AWAY);
  });
});
