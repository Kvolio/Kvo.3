import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';

/**
 * Silhouette measurement.
 *
 * The frontal hull was wrong for six commits — a continuous wedge where the
 * Tiger has a nose plate, a short glacis and a driver's plate — and nothing
 * caught it, because every check was either a number in the spec or a human
 * glancing at a render. This measures the rendered outline itself.
 *
 * Each elevation is drawn orthographically at a known millimetres-per-pixel
 * scale, the vehicle is stripped to a black mask on white, and the mask is
 * measured. That turns "the silhouette looks right" into a number with a
 * tolerance, and it is independent of the geometry tests: those ask the mesh,
 * this asks the picture.
 */

interface Mask {
  readonly width: number;
  readonly height: number;
  readonly mmPerPixel: number;
  readonly rows: Uint8Array[];
}

const SPEC = {
  hullLength: 6316,
  superstructureWidth: 3240,
  roofHeight: 1780,
  groundClearance: 470,
};

async function captureMask(
  page: Page,
  eye: [number, number, number],
  target: [number, number, number],
  frustumHeightMM: number,
): Promise<Mask> {
  await page.evaluate(
    (v) => {
      const api = window.__TIGER__!;
      (api.silhouetteMode as (on: boolean) => void)(true);
      (api.orthoView as (e: number[], t: number[], h: number) => void)(v.eye, v.target, v.height);
    },
    { eye, target, height: frustumHeightMM },
  );
  await page.waitForTimeout(700);

  const mmPerPixel = (await page.evaluate(() =>
    (window.__TIGER__!.orthoScale as () => number | null)(),
  ))!;

  const png = PNG.sync.read(await page.screenshot());
  const rows: Uint8Array[] = [];
  for (let y = 0; y < png.height; y++) {
    const row = new Uint8Array(png.width);
    for (let x = 0; x < png.width; x++) {
      const i = (png.width * y + x) * 4;
      // Anything appreciably darker than the white field is vehicle.
      row[x] = png.data[i]! < 200 ? 1 : 0;
    }
    rows.push(row);
  }
  return { width: png.width, height: png.height, mmPerPixel, rows };
}

function bounds(mask: Mask): { minX: number; maxX: number; minY: number; maxY: number } | null {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let y = 0; y < mask.height; y++) {
    const row = mask.rows[y]!;
    for (let x = 0; x < mask.width; x++) {
      if (!row[x]) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return minX === Infinity ? null : { minX, maxX, minY, maxY };
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => {
    throw new Error(`uncaught page error: ${error.message}`);
  });
  await page.goto('/');
  await page.waitForFunction(() => window.__TIGER__?.ready === true, undefined, {
    timeout: 60_000,
  });
});

test('the left elevation is as long as the hull', async ({ page }) => {
  const mask = await captureMask(page, [-20000, 1500, 0], [0, 1500, 0], 4400);
  const box = bounds(mask);
  expect(box, 'nothing rendered in the silhouette pass').not.toBeNull();

  const lengthMM = (box!.maxX - box!.minX) * mask.mmPerPixel;
  // The hull itself, plus the Feifel canisters and their trunking, which
  // genuinely project past the tail.
  expect(lengthMM).toBeGreaterThan(SPEC.hullLength * 0.98);
  expect(lengthMM).toBeLessThan(SPEC.hullLength + 700);
});

test('the front elevation is as wide as the superstructure', async ({ page }) => {
  const mask = await captureMask(page, [0, 1500, 20000], [0, 1500, 0], 4400);
  const box = bounds(mask)!;
  const widthMM = (box.maxX - box.minX) * mask.mmPerPixel;
  expect(Math.abs(widthMM - SPEC.superstructureWidth)).toBeLessThan(120);
});

test('the front elevation puts the roof line at its sourced height', async ({ page }) => {
  /*
   * Measured as the roof line rather than as the bounding box, because the
   * bounding box is not the hull: the Feifel trunking genuinely arcs above the
   * engine deck, and a test that cannot tell the two apart would force the
   * trunk to be modelled wrongly to keep itself green.
   *
   * The roof is found as the highest row carrying most of the vehicle's width.
   */
  const mask = await captureMask(page, [0, 1500, 20000], [0, 1500, 0], 4400);
  const box = bounds(mask)!;

  const rowWidth = (y: number): number => {
    const row = mask.rows[y]!;
    let first = -1;
    let last = -1;
    for (let x = 0; x < mask.width; x++) {
      if (!row[x]) continue;
      if (first < 0) first = x;
      last = x;
    }
    return first < 0 ? 0 : last - first;
  };

  let widest = 0;
  for (let y = box.minY; y <= box.maxY; y++) widest = Math.max(widest, rowWidth(y));

  let roofRow = box.maxY;
  for (let y = box.minY; y <= box.maxY; y++) {
    if (rowWidth(y) > widest * 0.8) {
      roofRow = y;
      break;
    }
  }

  // The camera is centred on y = 1500 mm with a 4400 mm frustum, so the top of
  // frame is 3700 mm above the ground.
  const topOfFrameMM = 1500 + 4400 / 2;
  const roofMM = topOfFrameMM - roofRow * mask.mmPerPixel;
  expect(Math.abs(roofMM - SPEC.roofHeight), `roof measured at ${roofMM.toFixed(0)} mm`)
    .toBeLessThan(90);

  // And the hull's underside sits at the sourced ground clearance.
  const bellyMM = topOfFrameMM - box.maxY * mask.mmPerPixel;
  expect(Math.abs(bellyMM - SPEC.groundClearance), `belly measured at ${bellyMM.toFixed(0)} mm`)
    .toBeLessThan(90);
});

test('the left elevation shows a stepped front, not a wedge', async ({ page }) => {
  /*
   * The measurement that would have caught the original fault.
   *
   * Walk up the silhouette row by row and record where its forward edge sits.
   * A wedge retreats at a constant, gentle rate. The real front retreats
   * sharply across the short glacis and then barely at all up the driver's
   * plate, so the profile has a distinct knee.
   */
  const mask = await captureMask(page, [-20000, 1500, 0], [0, 1500, 0], 4400);
  const box = bounds(mask)!;

  // Camera at -X looking toward +X puts the nose on the right of frame.
  const forwardEdge: { row: number; x: number }[] = [];
  for (let y = box.minY; y <= box.maxY; y++) {
    const row = mask.rows[y]!;
    for (let x = mask.width - 1; x >= 0; x--) {
      if (row[x]) {
        forwardEdge.push({ row: y, x });
        break;
      }
    }
  }
  expect(forwardEdge.length).toBeGreaterThan(50);

  // Screen Y grows downward, so walking the list backwards walks UP the hull.
  let steepestRetreat = 0;
  for (let i = forwardEdge.length - 1; i > 0; i--) {
    const dx = forwardEdge[i - 1]!.x - forwardEdge[i]!.x;
    const dy = forwardEdge[i]!.row - forwardEdge[i - 1]!.row;
    if (dy > 0) steepestRetreat = Math.max(steepestRetreat, -dx / dy);
  }

  // Up the nose the edge advances; up the driver's plate it retreats at
  // tan(9 deg) = 0.16 per unit of height. Only a near-horizontal plate between
  // them can retreat faster than one-for-one.
  expect(
    steepestRetreat,
    `steepest retreat ${steepestRetreat.toFixed(2)} px per px — a wedge cannot exceed tan(25 deg)`,
  ).toBeGreaterThan(1);
});
