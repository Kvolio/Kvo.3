import { describe, expect, it } from 'vitest';
import { FEIFEL, HULL } from '../../src/spec/index.js';

/**
 * The rear plate carries the exhaust stacks and the Feifel canisters, and those
 * two were authored in separate sittings against separate references. They
 * overlapped by 145 mm and nothing noticed, because each was individually
 * plausible and neither test knew about the other.
 *
 * Fittings that share a plate get checked against each other.
 */
describe('rear plate fittings', () => {
  it('keeps the exhaust guards clear of the Feifel canisters', () => {
    const guardOuter = HULL.exhaust.centreX + HULL.exhaust.guardDiameter / 2;
    const canisterInner = FEIFEL.centreX - FEIFEL.canisterDiameter / 2;
    const clearance = canisterInner - guardOuter;

    expect(
      clearance,
      `exhaust guard reaches ${guardOuter} mm, canister starts at ${canisterInner} mm`,
    ).toBeGreaterThan(25);
  });

  it('keeps both inboard of the superstructure side', () => {
    const half = HULL.superstructureWidth / 2;
    expect(FEIFEL.centreX + FEIFEL.canisterDiameter / 2).toBeLessThan(half);
    expect(HULL.exhaust.centreX + HULL.exhaust.guardDiameter / 2).toBeLessThan(half);
  });

  it('stands the exhaust stacks clear of the hull roof', () => {
    // They vent below the deck line; a stack poking through the roof would mean
    // the rear plate and the roof disagree about where the hull ends.
    expect(HULL.exhaust.baseY + HULL.exhaust.height).toBeLessThan(HULL.roofY);
  });
});
