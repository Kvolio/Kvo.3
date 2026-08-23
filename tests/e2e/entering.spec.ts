import { expect, test } from '@playwright/test';

/**
 * Getting inside.
 *
 * The brief asks for a tank you can walk up to, open, and climb into, and every
 * piece of that is already supposed to be in place: the roof apertures are
 * genuine holes cut in the plate's outline, the lids are separate bodies whose
 * collision travels with them, and the hull is hollow because its plates are
 * real solids with real back faces.
 *
 * "Supposed to be" is the operative phrase. This drops a player through and
 * checks where they land.
 */
test.describe('entering the hull', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?quality=low');
    await page.waitForFunction(() => window.__TIGER__?.ready === true, undefined, {
      timeout: 90_000,
    });
  });

  test('a closed hatch holds the player up', async ({ page }) => {
    const y = await page.evaluate(() => {
      const api = window.__TIGER__!;
      const t = api.internals;
      const at = api.interactablePosition('driverHatch')!;
      api.articulation('driverHatch')!.setOpen(false);
      api.articulation('driverHatch')!.settle();
      t.player.teleport(new t.THREE.Vector3(at[0]!, at[1]! + 1.2, at[2]!), 0);
      api.step(240);
      return (t.player as unknown as { state: { position: { y: number } } }).state.position.y;
    });
    // Standing on the lid, which is proud of the roof.
    expect(y).toBeGreaterThan(1.7);
  });

  test('an open hatch lets the player drop inside', async ({ page }) => {
    const result = await page.evaluate(() => {
      const api = window.__TIGER__!;
      const t = api.internals;
      const at = api.interactablePosition('driverHatch')!;
      api.articulation('driverHatch')!.setOpen(true);
      api.articulation('driverHatch')!.settle();
      t.player.teleport(new t.THREE.Vector3(at[0]!, at[1]! + 1.2, at[2]!), 0);
      api.step(400);
      const s = (t.player as unknown as {
        state: { position: { x: number; y: number; z: number } };
      }).state;
      return { x: s.position.x, y: s.position.y, z: s.position.z };
    });

    // Through the roof and standing on something inside, not fallen through the
    // belly and not still up top.
    expect(result.y, 'the player did not get below the roof').toBeLessThan(1.6);
    expect(result.y, 'the player fell through the hull floor').toBeGreaterThan(0.2);
  });
});
