import { describe, expect, it } from 'vitest';
import { HULL, TURRET } from '../../src/spec/index.js';

/**
 * Physical constraints on the turret, checked as constraints rather than as
 * remembered numbers.
 *
 * The shell width was 1,860 mm — narrower than the 2,100 mm ring bearing the
 * turret sits on. Nothing caught it because both figures were individually
 * plausible and nothing compared them. A turret cannot be narrower than its own
 * race, and now it cannot be authored that way either.
 */
describe('turret fit', () => {
  it('is wider than the bearing it turns on', () => {
    expect(
      TURRET.shell.width,
      'the turret shell is narrower than its own ring bearing',
    ).toBeGreaterThan(TURRET.ring.bearingOuterDiameter);
  });

  it('has a clear opening inside its ball circle', () => {
    // The clear opening is cut inside the race, so it must be smaller than the
    // circle the balls run on, which is smaller than the bearing's outer edge.
    expect(TURRET.ring.clearOpeningDiameter).toBeLessThan(TURRET.ring.ballCircleDiameter);
    expect(TURRET.ring.ballCircleDiameter).toBeLessThan(TURRET.ring.bearingOuterDiameter);
  });

  it('fits on the hull roof with the bearing clear of the sponson sides', () => {
    expect(TURRET.ring.bearingOuterDiameter).toBeLessThan(HULL.superstructureWidth);
  });

  it('turns without the shell striking anything on the deck', () => {
    // The turret sweeps a circle of its own half-diagonal about the ring
    // centre. Anything on the roof inside that circle is in its way.
    const sweep = Math.hypot(TURRET.shell.width / 2, TURRET.shell.length / 2);
    const toIntake = Math.abs(HULL.engineDeck.intakeCentreZ - TURRET.ring.centreZ);
    expect(toIntake, 'the turret sweeps through the Feifel intake drum').toBeGreaterThan(
      sweep,
    );
  });

  it('leaves the crew hatches outside the turret sweep', () => {
    const sweep = Math.hypot(TURRET.shell.width / 2, TURRET.shell.length / 2);
    for (const id of ['driverHatch', 'radioHatch'] as const) {
      const h = HULL[id];
      const d = Math.hypot(h.centreX, h.centreZ - TURRET.ring.centreZ);
      expect(d, `${id} is inside the turret's sweep`).toBeGreaterThan(
        sweep - h.diameter / 2,
      );
    }
  });
});
