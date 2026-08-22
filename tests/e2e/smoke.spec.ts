import { expect, test } from '@playwright/test';

/**
 * Does it actually run?
 *
 * Unit tests prove the geometry is solid and the resolver keeps the player out
 * of the armour, but neither of them touches a GPU. This is the first check
 * that the shaders compile, the scene renders and nothing throws on startup —
 * the failure mode that a Node suite cannot see at all.
 */

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => {
    throw new Error(`uncaught page error: ${error.message}`);
  });
});

test('boots, compiles shaders and renders a frame', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('/');
  await page.waitForFunction(() => window.__TIGER__?.ready === true, undefined, {
    timeout: 60_000,
  });

  // A WebGL context that failed to create, or a shader that failed to compile,
  // surfaces as a console error rather than a thrown exception.
  expect(consoleErrors).toEqual([]);

  const stats = await page.evaluate(() =>
    (window.__TIGER__!.stats as () => Record<string, number>)(),
  );
  expect(stats.calls).toBeGreaterThan(0);
  expect(stats.triangles).toBeGreaterThan(0);
});

test('reports the Ausf. H configuration it was built to', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__TIGER__?.ready === true, undefined, {
    timeout: 60_000,
  });

  const variant = await page.evaluate(() => window.__TIGER__!.variant as Record<string, unknown>);
  expect(variant.designation).toContain('Ausf. H');
  expect(variant.engine).toBe('HL210P45');
  expect(variant.cupola).toBe('drum');
  expect(variant.paint).toBe('dunkelgelb-7028');
});

test('the player stands on the ground and stays there', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__TIGER__?.ready === true, undefined, {
    timeout: 60_000,
  });

  // Step the simulation rather than waiting: SwiftShader manages one or two
  // frames a second, so a wall-clock wait would assert almost nothing.
  const spawnY = await page.evaluate(() => {
    const api = window.__TIGER__!;
    (api.teleport as (x: number, y: number, z: number) => void)(-6, 3, 6.5);
    const before = (api.playerPosition as () => number[])()[1]!;
    (api.step as (n: number) => void)(180);
    return before;
  });
  expect(spawnY).toBeCloseTo(3, 1);

  const position = await page.evaluate(() =>
    (window.__TIGER__!.playerPosition as () => number[])(),
  );
  // Dropped from 3 m and came to rest on the terrain, rather than falling
  // through it or hanging in the air.
  expect(Number.isFinite(position[1]!)).toBe(true);
  expect(position[1]!).toBeGreaterThan(-0.3);
  expect(position[1]!).toBeLessThan(0.3);

  const recoveries = await page.evaluate(() =>
    (window.__TIGER__!.recoveries as () => number)(),
  );
  expect(recoveries).toBe(0);
});

test('renders the dimensional envelope from a fixed pose', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__TIGER__?.ready === true, undefined, {
    timeout: 60_000,
  });

  await page.evaluate(() => {
    const api = window.__TIGER__!;
    (api.teleport as (x: number, y: number, z: number) => void)(-7, 1.6, 7);
    (api.lookAt as (x: number, y: number, z: number) => void)(0, 1.4, 0);
  });
  await page.waitForTimeout(1200);

  // Attached rather than asserted against a baseline: at Stage 0 there is a
  // measuring stick in the scene, not a vehicle, so a pixel baseline would only
  // lock in a placeholder.
  await testInfo.attach('stage0-envelope.png', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
});

test('the scene is actually lit', async ({ page }) => {
  /*
   * The guard for an entire class of silent rendering failure.
   *
   * A NaN anywhere in the lighting path - and an environment probe generated
   * from an unbounded source is an easy way to get one - turns every physical
   * material pure black while swallowing emissive and ignoring both exposure
   * and light intensity. Nothing throws, no console error appears, the draw
   * call counts look healthy, and the unit suite cannot see it because it never
   * touches a GPU. Only a pixel can tell you.
   */
  await page.goto('/');
  await page.waitForFunction(() => window.__TIGER__?.ready === true, undefined, {
    timeout: 60_000,
  });

  await page.evaluate(() => {
    const api = window.__TIGER__!;
    (api.teleport as (x: number, y: number, z: number) => void)(-7, 1.6, 7);
    (api.lookAt as (x: number, y: number, z: number) => void)(0, 1.2, 0);
  });
  await page.waitForTimeout(900);

  const samples = await page.evaluate(() => {
    const internals = window.__TIGER__!.internals as {
      engine: {
        renderer: { render: (s: unknown, c: unknown) => void; getContext: () => WebGL2RenderingContext };
        scene: unknown;
        camera: unknown;
        canvas: HTMLCanvasElement;
      };
    };
    const { renderer, scene, camera, canvas } = internals.engine;
    renderer.render(scene, camera);
    const gl = renderer.getContext();
    const read = (x: number, yFromTop: number): number[] => {
      const px = new Uint8Array(4);
      gl.readPixels(x, canvas.height - yFromTop, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return [px[0]!, px[1]!, px[2]!];
    };
    return {
      sky: read(Math.round(canvas.width * 0.5), Math.round(canvas.height * 0.15)),
      ground: read(Math.round(canvas.width * 0.2), Math.round(canvas.height * 0.85)),
      vehicle: read(Math.round(canvas.width * 0.5), Math.round(canvas.height * 0.5)),
    };
  });

  const luminance = (rgb: number[]): number =>
    0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;

  // The sky is unlit geometry and would survive a lighting failure, so it only
  // proves the frame rendered at all.
  expect(luminance(samples.sky), `sky ${samples.sky}`).toBeGreaterThan(40);

  // These two are lit surfaces. If the lighting path is producing NaN, they are
  // exactly zero.
  expect(luminance(samples.ground), `ground ${samples.ground}`).toBeGreaterThan(20);
  expect(luminance(samples.vehicle), `vehicle ${samples.vehicle}`).toBeGreaterThan(8);

  // And they must not be blown out either, which would mean the tone mapping or
  // the exposure has come adrift.
  expect(luminance(samples.ground), `ground ${samples.ground}`).toBeLessThan(250);
});

test('keyboard and touch drive the same controller', async ({ page }) => {
  /*
   * The other half of the mobile suite's stick test. Both platforms move the
   * player the same distance through the same PlayerController; only the
   * provider differs. If these two ever diverge, the abstraction has leaked.
   */
  await page.goto('/');
  await page.waitForFunction(() => window.__TIGER__?.ready === true, undefined, {
    timeout: 60_000,
  });

  const travelled = await page.evaluate(() => {
    const api = window.__TIGER__!;
    (api.teleport as (x: number, y: number, z: number) => void)(-6, 0.2, 6.5);
    (api.step as (n: number) => void)(60);
    const before = (api.playerPosition as () => number[])();

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    (api.step as (n: number) => void)(120);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));

    const after = (api.playerPosition as () => number[])();
    return Math.hypot(after[0]! - before[0]!, after[2]! - before[2]!);
  });

  // Two seconds of simulated walking at 1.5 m/s, less acceleration ramp.
  expect(travelled).toBeGreaterThan(1.5);
  expect(travelled).toBeLessThan(4);
});
