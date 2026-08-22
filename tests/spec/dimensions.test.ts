import { describe, expect, it } from 'vitest';
import { SPEC, SPEC_META } from '../../src/spec/index.js';
import {
  SUSPENSION,
  TORSION_RATE,
  TRACK_CENTRE_X,
  stationZ,
  wheelPlanesForStation,
  armSign,
  SHOCK_STATIONS,
} from '../../src/spec/runningGear.js';
import {
  AusfH_Feb1943,
  AusfE_Apr1944,
  mantletSightApertures,
  wheelsPerSide,
  variantHash,
} from '../../src/spec/variants.js';

/**
 * The sourced figures, asserted against docs/RESEARCH.md.
 *
 * These guard the spec itself. `tests/geometry/*` separately asserts that the
 * geometry actually built matches these numbers — a spec can be right while the
 * model drifts away from it.
 */

const within = (actual: number, expected: number, tol: number): void => {
  expect(Math.abs(actual - expected), `${actual} vs ${expected} +/- ${tol}`).toBeLessThanOrEqual(tol);
};

describe('overall envelope', () => {
  it('matches the sourced figures within their stated tolerances', () => {
    within(SPEC.overall.length, 6316, SPEC_META.overall.length.tol);
    within(SPEC.overall.lengthGunForward, 8450, SPEC_META.overall.lengthGunForward.tol);
    within(SPEC.overall.heightToHullRoof, 1780, SPEC_META.overall.heightToHullRoof.tol);
    within(SPEC.overall.heightToCupola, 3000, SPEC_META.overall.heightToCupola.tol);
    within(SPEC.overall.groundClearance, 470, SPEC_META.overall.groundClearance.tol);
    within(SPEC.overall.trackContactLength, 3605, SPEC_META.overall.trackContactLength.tol);
    within(SPEC.overall.combatWeight, 57250, SPEC_META.overall.combatWeight.tol);
  });

  it('keeps the hull shorter than the gun-forward length by a plausible overhang', () => {
    const overhang = SPEC.overall.lengthGunForward - SPEC.overall.length;
    // The barrel plus muzzle brake projects past the nose; it cannot project
    // more than its own length.
    expect(overhang).toBeGreaterThan(1500);
    expect(overhang).toBeLessThan(SPEC.gun.barrelLength + SPEC.gun.muzzleBrake.length);
  });
});

describe('armament', () => {
  it('derives the barrel length from the L/56 designation', () => {
    // 56 calibres of 88 mm.
    expect(SPEC.gun.barrelLength).toBe(4928);
    within(SPEC.gun.bore, 88, SPEC_META.gun.bore.tol);
  });

  it('carries 92 rounds distributed as the stowage sources describe', () => {
    const sponsonRounds =
      SPEC.gun.ammunition.roundsPerAmmoBin * 2 * 2; // two bins per sponson, two sponsons
    expect(sponsonRounds).toBe(64);
    const accounted = sponsonRounds + SPEC.gun.ammunition.roundsBesideDriver;
    expect(accounted).toBe(70);
    // The balance is stowed at floor level.
    expect(SPEC.gun.ammunition.rounds - accounted).toBe(22);
  });

  it('keeps the elevation range the right way round', () => {
    expect(SPEC.gun.elevation.min).toBeLessThan(0);
    expect(SPEC.gun.elevation.max).toBeGreaterThan(0);
    expect(SPEC.gun.elevation.max).toBeGreaterThan(SPEC.gun.elevation.min);
  });
});

describe('running gear', () => {
  it('matches the Kgs 63/725/130 designation', () => {
    expect(SPEC.track.width).toBe(725);
    expect(SPEC.track.pitch).toBe(130);
    expect(SPEC.track.linksPerSide).toBe(96);
    // The constraint the whole track solver is built around.
    expect(SPEC.track.totalLength).toBe(12480);
  });

  it('derives a sprocket pitch radius that corroborates the sourced outer diameter', () => {
    // 130 mm pitch on 20 teeth.
    within(SPEC.sprocket.pitchRadius, 415.55, 0.5);

    const outerRadius = SPEC.sprocket.outerDiameter / 2;
    const allowance = outerRadius - SPEC.sprocket.pitchRadius;
    // The difference is tooth tip plus guide-horn clearance. Two independently
    // sourced numbers agreeing to a plausible margin is cheap corroboration.
    expect(allowance).toBeGreaterThan(20);
    expect(allowance).toBeLessThan(80);
  });

  it('has 8 stations and 24 rubber-tyred wheels per side', () => {
    expect(SUSPENSION.stationsPerSide).toBe(8);
    expect(SUSPENSION.wheelsPerStation).toBe(3);
    expect(SUSPENSION.wheelsPerSide).toBe(24);
    within(SPEC.roadWheel.diameter, 800, SPEC_META.roadWheel.diameter.tol);
    // 18-bolt rims arrive in February 1943 — an Ausf. H discriminator.
    expect(SPEC.roadWheel.rimBolts).toBe(18);
  });

  it('spaces the stations so the wheels genuinely interleave', () => {
    // Eight stations spanning the sourced contact length.
    within(SUSPENSION.stationPitch, 3605 / 7, 1);
    const overlap = SPEC.roadWheel.diameter - SUSPENSION.stationPitch;
    // Without overlap it is not Schachtellaufwerk, it is a road wheel train.
    expect(overlap).toBeGreaterThan(200);
  });

  it('orders the stations front to back and centres them on the hull', () => {
    const zs = Array.from({ length: 8 }, (_, i) => stationZ(i));
    for (let i = 1; i < zs.length; i++) expect(zs[i]!).toBeLessThan(zs[i - 1]!);
    within(zs[0]! + zs[7]!, 0, 1e-6);
  });

  it('gives adjacent stations different lateral planes, or the wheels would collide', () => {
    const even = wheelPlanesForStation(0);
    const odd = wheelPlanesForStation(1);
    expect(even).toHaveLength(3);
    expect(odd).toHaveLength(3);
    for (const a of even) {
      for (const b of odd) {
        // Wheels 75 mm wide need at least that much lateral separation.
        expect(Math.abs(a - b)).toBeGreaterThanOrEqual(SPEC.roadWheel.width - 1);
      }
    }
  });

  it('keeps every wheel plane inside the track width', () => {
    for (let station = 0; station < 8; station++) {
      for (const plane of wheelPlanesForStation(station)) {
        expect(Math.abs(plane) + SPEC.roadWheel.width / 2).toBeLessThanOrEqual(SPEC.track.width / 2);
      }
    }
  });

  it('leads the arms on one side and trails them on the other', () => {
    // The two sides' transverse torsion bars have to pass each other inside the
    // hull, so this asymmetry is structural. Mirroring it away is a classic
    // reconstruction error.
    expect(armSign('left')).toBe(1);
    expect(armSign('right')).toBe(-1);
    expect(armSign('left')).not.toBe(armSign('right'));
  });

  it('fits the tracks inside the sourced overall width', () => {
    const outerEdge = TRACK_CENTRE_X + SPEC.track.width / 2;
    within(outerEdge * 2, SPEC.overall.widthOverCombatTracks, 1e-6);
  });

  it('damps only the front and rear stations', () => {
    expect([...SHOCK_STATIONS]).toEqual([0, 7]);
  });

  it('derives a torsion rate from bar geometry rather than a tuned constant', () => {
    // k = G.J/L with J = pi.d^4/32, for a 56.5 mm bar 1644.6 mm long.
    expect(TORSION_RATE).toBeGreaterThan(3.5e4);
    expect(TORSION_RATE).toBeLessThan(6.0e4);

    // Sixteen stations must together hold 57 t at a sane arm angle. Check the
    // static torque each station has to resist is within the bar's capability.
    const weightPerStationN = (SPEC.overall.combatWeight / 16) * 9.81;
    const armM = SUSPENSION.armLength / 1000;
    const staticTorque = weightPerStationN * armM;
    const angleRad = staticTorque / TORSION_RATE;
    const angleDeg = (angleRad * 180) / Math.PI;
    // A suspension that deflects less than a degree is a solid axle; one that
    // deflects past its bump stop is on its bump stop.
    expect(angleDeg).toBeGreaterThan(1);
    expect(angleDeg).toBeLessThan(SUSPENSION.travelBump);
  });
});

describe('armour', () => {
  it('matches the sourced plate thicknesses', () => {
    expect(SPEC.armour.hull.nose.thickness).toBe(100);
    expect(SPEC.armour.hull.nose.angle).toBe(24);
    expect(SPEC.armour.hull.sideUpper.thickness).toBe(80);
    expect(SPEC.armour.hull.sideLower.thickness).toBe(60);
    expect(SPEC.armour.turret.front.thickness).toBe(100);
    expect(SPEC.armour.turret.mantlet.thickness).toBe(120);
    // 25 mm on the Ausf. H; 40 mm only from March 1944.
    expect(SPEC.armour.turret.roof.thickness).toBe(25);
  });

  it('keeps every plate angle within a physically meaningful range', () => {
    // Angles are from vertical: 0 upright, 90 horizontal.
    const walk = (node: Record<string, { thickness: number; angle: number }>): void => {
      for (const [name, plate] of Object.entries(node)) {
        expect(plate.thickness, `${name} thickness`).toBeGreaterThan(0);
        expect(plate.angle, `${name} angle`).toBeGreaterThanOrEqual(0);
        expect(plate.angle, `${name} angle`).toBeLessThanOrEqual(90);
      }
    };
    walk(SPEC.armour.hull);
    walk(SPEC.armour.turret);
  });
});

describe('turret ring', () => {
  it('nests the ring diameters in the physically necessary order', () => {
    const { clearOpeningDiameter, ballCircleDiameter, bearingOuterDiameter } = SPEC.turret.ring;
    expect(clearOpeningDiameter).toBeLessThan(ballCircleDiameter);
    expect(ballCircleDiameter).toBeLessThan(bearingOuterDiameter);
  });

  it('uses the original 158-ball bearing, not a later one', () => {
    expect(SPEC.turret.ring.ballCount).toBe(158);
    expect(SPEC.turret.ring.loadBearingBallDiameter).toBeGreaterThan(
      SPEC.turret.ring.spacerBallDiameter,
    );
  });

  it('fits the turret ring inside the hull roof', () => {
    expect(SPEC.turret.ring.bearingOuterDiameter).toBeLessThan(
      SPEC.overall.widthOverCombatTracks,
    );
  });
});

describe('variant configuration', () => {
  it('describes a February 1943 Ausf. H', () => {
    expect(AusfH_Feb1943.designation).toContain('Ausf. H');
    expect(AusfH_Feb1943.engine).toBe('HL210P45');
    expect(AusfH_Feb1943.cupola).toBe('drum');
    expect(AusfH_Feb1943.roadWheels).toBe('rubber-tyred-24');
    expect(AusfH_Feb1943.airCleaner).toBe('feifel-round');
    expect(AusfH_Feb1943.smokeDischargers).toBe(true);
    expect(AusfH_Feb1943.zimmerit).toBe(false);
    expect(AusfH_Feb1943.loaderPeriscope).toBe(false);
    expect(AusfH_Feb1943.turretRoofThickness).toBe(25);
    // The 18 February 1943 order put the factory finish in Dunkelgelb.
    expect(AusfH_Feb1943.paint).toBe('dunkelgelb-7028');
  });

  it('gives the binocular TZF 9b two mantlet apertures and the monocular one', () => {
    // The single most reliable visual discriminator between an Ausf. H and a
    // 1944 vehicle.
    expect(mantletSightApertures(AusfH_Feb1943)).toBe(2);
    expect(mantletSightApertures(AusfE_Apr1944)).toBe(1);
  });

  it('drops the outer wheel row when steel-rimmed wheels arrive', () => {
    expect(wheelsPerSide(AusfH_Feb1943)).toBe(24);
    expect(wheelsPerSide(AusfE_Apr1944)).toBe(16);
  });

  it('hashes variants stably and distinctly', () => {
    expect(variantHash(AusfH_Feb1943)).toBe(variantHash({ ...AusfH_Feb1943 }));
    expect(variantHash(AusfH_Feb1943)).not.toBe(variantHash(AusfE_Apr1944));
    expect(variantHash(AusfH_Feb1943)).toMatch(/^[0-9a-f]{8}$/);
  });
});
