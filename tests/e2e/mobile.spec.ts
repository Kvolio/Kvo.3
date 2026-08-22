import { expect, test } from '@playwright/test';

/**
 * Touch controls, exercised rather than assumed.
 *
 * The brief is explicit that mobile must not be an afterthought. The strongest
 * guarantee of that is structural — every device writes into the same
 * `InputState`, enforced by lint and by a source scan in the unit suite — but
 * structure does not prove the touch surface is wired up. These drive the real
 * page through real pointer events and check the player actually moves.
 */

test.describe('mobile controls', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'chromium only');

  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (error) => {
      throw new Error(`uncaught page error: ${error.message}`);
    });
    await page.goto('/');
    await page.waitForFunction(() => window.__TIGER__?.ready === true, undefined, {
      timeout: 60_000,
    });
    await page.waitForTimeout(1200);
  });

  test('shows the on-screen controls on a touch device', async ({ page }) => {
    const controls = page.locator('.mobile-controls');
    await expect(controls).toBeVisible();
    // Four action buttons plus three utility buttons.
    await expect(page.locator('.mobile-controls .touch-button')).toHaveCount(7);
  });

  test('drops to the low quality tier on a phone', async ({ page }) => {
    // Shadows off, coarser LODs, smaller atlas. A phone misdetected as desktop
    // drops frames for the whole session.
    const quality = await page.evaluate(() => window.__TIGER__!.quality);
    expect(quality).toBe('low');
  });

  test('the left-hand stick moves the player', async ({ page }) => {
    const before = await page.evaluate(() =>
      (window.__TIGER__!.playerPosition as () => number[])(),
    );

    // Drag from the lower-left, where a thumb naturally sits. The stick has no
    // fixed position — it materialises wherever the touch lands.
    await page.evaluate(() => {
      const app = document.getElementById('app')!;
      const send = (type: string, x: number, y: number): void => {
        app.dispatchEvent(
          new PointerEvent(type, {
            pointerId: 1,
            pointerType: 'touch',
            clientX: x,
            clientY: y,
            bubbles: true,
          }),
        );
      };
      const rect = app.getBoundingClientRect();
      const originX = rect.width * 0.15;
      const originY = rect.height * 0.75;

      send('pointerdown', originX, originY);
      // Full deflection forward, held for two seconds of simulated time.
      send('pointermove', originX, originY - 70);
      (window.__TIGER__!.step as (n: number) => void)(120);
      send('pointerup', originX, originY - 70);
    });

    const after = await page.evaluate(() =>
      (window.__TIGER__!.playerPosition as () => number[])(),
    );
    const travelled = Math.hypot(after[0]! - before[0]!, after[2]! - before[2]!);
    expect(travelled).toBeGreaterThan(0.5);
  });

  test('the right-hand region turns the view without moving the player', async ({ page }) => {
    const before = await page.evaluate(() =>
      (window.__TIGER__!.playerPosition as () => number[])(),
    );

    await page.evaluate(() => {
      const app = document.getElementById('app')!;
      const send = (type: string, x: number, y: number): void => {
        app.dispatchEvent(
          new PointerEvent(type, {
            pointerId: 2,
            pointerType: 'touch',
            clientX: x,
            clientY: y,
            bubbles: true,
          }),
        );
      };
      const rect = app.getBoundingClientRect();
      const startX = rect.width * 0.7;
      const y = rect.height * 0.5;
      send('pointerdown', startX, y);
      for (let i = 1; i <= 20; i++) {
        send('pointermove', startX - i * 8, y);
        (window.__TIGER__!.step as (n: number) => void)(2);
      }
      send('pointerup', startX - 160, y);
    });

    const after = await page.evaluate(() =>
      (window.__TIGER__!.playerPosition as () => number[])(),
    );
    const travelled = Math.hypot(after[0]! - before[0]!, after[2]! - before[2]!);
    // Looking around is not walking around.
    expect(travelled).toBeLessThan(0.15);
  });

  test('leaves the middle of the screen clear for looking at the vehicle', async ({ page }) => {
    // Controls belong in the corners a thumb reaches, not over the subject.
    const viewport = page.viewportSize()!;
    const buttons = await page.locator('.mobile-controls .touch-button').all();
    for (const button of buttons) {
      const box = (await button.boundingBox())!;
      const centreX = box.x + box.width / 2;
      const centreY = box.y + box.height / 2;
      const nearCentre =
        Math.abs(centreX - viewport.width / 2) < viewport.width * 0.25 &&
        Math.abs(centreY - viewport.height / 2) < viewport.height * 0.25;
      expect(nearCentre, `button at ${centreX},${centreY} sits over the subject`).toBe(false);
    }
  });
});
