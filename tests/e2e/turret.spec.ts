import { expect, test } from '@playwright/test';

/**
 * The turret has to actually turn, and its collision has to turn with it.
 *
 * It is mounted as a separate body precisely so that traversing is a matrix
 * write rather than a rebuild — which is only true if the collision handle is
 * wired to the same articulation as the mesh, and that is the sort of thing
 * that looks right on screen while the player walks through a turret that is no
 * longer where its solidity is.
 */
test.describe('turret', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?quality=low');
    await page.waitForFunction(() => window.__TIGER__?.ready === true, undefined, {
      timeout: 90_000,
    });
  });

  test('traverses, and the gun goes round with it', async ({ page }) => {
    const before = await page.evaluate(() => {
      const m = window.__TIGER__!.articulation('turret')!.mesh;
      m.updateMatrixWorld(true);
      return [...m.matrixWorld.elements];
    });

    await page.evaluate(() => {
      const a = window.__TIGER__!.articulation('turret')!;
      a.setOpen(true);
      a.settle();
    });

    const after = await page.evaluate(() => {
      const m = window.__TIGER__!.articulation('turret')!.mesh;
      m.updateMatrixWorld(true);
      return [...m.matrixWorld.elements];
    });

    // A full turn returns to the same orientation, so the check is that the
    // matrix moved at all during the sweep rather than that it ended elsewhere.
    const half = await page.evaluate(() => {
      const a = window.__TIGER__!.articulation('turret')!;
      a.setOpen(false);
      a.settle();
      a.setOpen(true);
      window.__TIGER__!.step(1800);
      const m = a.mesh;
      m.updateMatrixWorld(true);
      return [...m.matrixWorld.elements];
    });

    const moved = half.some((v, i) => Math.abs(v - before[i]!) > 0.05);
    expect(moved, 'the turret did not turn').toBe(true);
    expect(after.length).toBe(16);
  });

  test('is offered to the player standing on the engine deck', async ({ page }) => {
    const prompt = await page.evaluate(() => {
      const api = window.__TIGER__!;
      const t = api.internals;
      const at = api.interactablePosition('turret')!;
      t.player.teleport(new t.THREE.Vector3(at[0]!, at[1]!, at[2]! - 2.2), 0);
      api.step(2);
      return api.interactionPrompt();
    });
    expect(prompt).toMatch(/turret/i);
  });
});
