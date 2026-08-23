import { expect, test } from '@playwright/test';

/**
 * The lids have to work in the browser, not only in a geometry test: the
 * articulation, the dynamic collision body and the interaction prompt are three
 * separate pieces and any one of them can be wired up wrong while the others
 * look fine.
 */
test.describe('crew hatches', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?quality=low');
    await page.waitForFunction(() => window.__TIGER__?.ready === true, undefined, {
      timeout: 90_000,
    });
  });

  test('a lid opens, travels, and settles', async ({ page }) => {
    const before = await page.evaluate(() => {
      const a = window.__TIGER__!.articulation('driverHatch')!;
      return { open: a.isOpen, fraction: a.openFraction };
    });
    expect(before.open).toBe(false);
    expect(before.fraction).toBe(0);

    await page.evaluate(() => window.__TIGER__!.articulation('driverHatch')!.toggle());
    // Enough fixed steps to complete the cycle, advanced deterministically
    // rather than waited on — this renderer runs at a few frames a second under
    // SwiftShader and a wall-clock wait proves nothing.
    await page.evaluate(() => window.__TIGER__!.step(240));

    const after = await page.evaluate(() => {
      const a = window.__TIGER__!.articulation('driverHatch')!;
      return { open: a.isOpen, fraction: a.openFraction, moving: a.isMoving };
    });
    expect(after.open).toBe(true);
    expect(after.fraction).toBeCloseTo(1, 2);
    expect(after.moving).toBe(false);
  });

  test('the lid actually moves in the world when it opens', async ({ page }) => {
    const closed = await page.evaluate(() => {
      const m = window.__TIGER__!.articulation('driverHatch')!.mesh;
      m.updateMatrixWorld(true);
      return m.matrixWorld.elements.slice(12, 15);
    });

    await page.evaluate(() => {
      window.__TIGER__!.articulation('driverHatch')!.setOpen(true);
      window.__TIGER__!.articulation('driverHatch')!.settle();
    });

    const open = await page.evaluate(() => {
      const m = window.__TIGER__!.articulation('driverHatch')!.mesh;
      m.updateMatrixWorld(true);
      return m.matrixWorld.elements.slice(12, 15);
    });

    const moved = Math.hypot(
      open[0]! - closed[0]!,
      open[1]! - closed[1]!,
      open[2]! - closed[2]!,
    );
    // It lifts 120 mm and swings 95 degrees about a post 430 mm away, so the
    // lid's own origin has to travel the better part of a metre.
    expect(moved).toBeGreaterThan(0.4);
  });

  test('the player is offered the hatch when they stand on the roof', async ({ page }) => {
    const prompt = await page.evaluate(() => {
      const api = window.__TIGER__!;
      const t = api.internals;
      // Derived from where the hatch actually is, so moving it — which happened
      // once already, 330 mm outboard — does not silently retarget the test at
      // whatever else is nearby.
      const at = api.interactablePosition('driverHatch')!;
      // Feet on the roof, standing just outboard of the hatch. `teleport` sets
      // the feet, and a crewman's eye is a metre and a half above them — placing
      // the FEET at eye height put the eye 2.6 m from the hatch and out of reach.
      t.player.teleport(new t.THREE.Vector3(at[0]! + 0.8, at[1]!, at[2]!), 0);
      t.player.state.pitch = -0.7;
      api.step(2);
      return api.interactionPrompt();
    });
    expect(prompt).toMatch(/driver's hatch/);
  });
});
