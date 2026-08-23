/**
 * Gauntlet render capture.
 *
 * Loads the built page in headless Chromium, drives it to a set of fixed poses
 * through the same debug API the visual suite uses, and writes PNGs for the
 * reference-comparison and close-range critics to look at. Deterministic: the
 * quality tier is pinned and the camera is snapped rather than eased.
 */
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { mkdirSync } from 'node:fs';

const DIST = 'dist';
const OUT = process.argv[3] ?? 'docs/gauntlet/renders';
const PORT = 4319;

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.map': 'application/json',
};

const server = createServer(async (req, res) => {
  try {
    const url = (req.url ?? '/').split('?')[0];
    const path = join(DIST, normalize(url === '/' ? '/index.html' : url));
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

/**
 * The nine views a silhouette is judged from, plus close-range detail poses.
 *
 * The five elevations are ORTHOGRAPHIC and framed to an exact height, so each
 * render has a known millimetres-per-pixel scale and can be measured against
 * the drawing rather than compared by eye. A perspective view of a 6.3 m hull
 * from any practical distance foreshortens the far end, which is precisely the
 * direction in which proportions become unarguable.
 */
const FRUSTUM_MM = 4400;
const PLAN_FRUSTUM_MM = 8200;

const ORTHO_VIEWS = [
  { id: 'ortho-front', eye: [0, 1500, 20000], target: [0, 1500, 0], height: FRUSTUM_MM },
  { id: 'ortho-rear', eye: [0, 1500, -20000], target: [0, 1500, 0], height: FRUSTUM_MM },
  { id: 'ortho-left', eye: [-20000, 1500, 0], target: [0, 1500, 0], height: FRUSTUM_MM },
  { id: 'ortho-right', eye: [20000, 1500, 0], target: [0, 1500, 0], height: FRUSTUM_MM },
  { id: 'ortho-plan', eye: [0, 20000, 0], target: [0, 0, 0], height: PLAN_FRUSTUM_MM },
];

/** The four three-quarters, in perspective, at a crewman's eye height. */
const QUARTER_VIEWS = [
  { id: 'quarter-front-left', eye: [-4600, 2000, 4600], target: [0, 1150, 200] },
  { id: 'quarter-front-right', eye: [4600, 2000, 4600], target: [0, 1150, 200] },
  { id: 'quarter-rear-left', eye: [-4600, 2000, -4600], target: [0, 1150, -200] },
  { id: 'quarter-rear-right', eye: [4600, 2000, -4600], target: [0, 1150, -200] },
];

const DETAIL_VIEWS = [
  { id: 'detail-front-step', eye: [-2600, 1250, 4600], target: [0, 1050, 3000] },
  { id: 'detail-hatches-open', eye: [-2400, 3000, 3600], target: [0, 1800, 1700], hatches: true },
  { id: 'detail-hatches-shut', eye: [-2400, 3000, 3600], target: [0, 1800, 1700] },
  { id: 'detail-hull-side', eye: [-3200, 1200, 1000], target: [-1850, 1000, 600] },
  { id: 'detail-rear', eye: [-2200, 1900, -5200], target: [-1080, 1400, -3158] },
  { id: 'detail-cupola', eye: [2600, 3100, 1400], target: [500, 2500, -985] },
  { id: 'detail-turret-rear', eye: [-1400, 3000, -4200], target: [0, 2200, -1455] },
];

mkdirSync(OUT, { recursive: true });

await new Promise((resolve) => server.listen(PORT, resolve));
const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--disable-gpu-sandbox',
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

page.on('console', (m) => {
  if (m.type() === 'error') console.error('  page error:', m.text());
});

await page.goto(`http://localhost:${PORT}/?quality=mid`);
await page.waitForFunction(() => window.__TIGER__?.ready === true, undefined, { timeout: 90_000 });
await page.waitForTimeout(1500);

// Every captured view is evidence, so the on-screen chrome comes off for all of
// them. The info bar sits squarely across the driver's plate.
await page.evaluate(() => window.__TIGER__.hideChrome(true));

for (const view of ORTHO_VIEWS) {
  await page.evaluate((v) => {
    window.__TIGER__.orthoView(v.eye, v.target, v.height);
  }, view);
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(OUT, `${view.id}.png`) });
  const scale = await page.evaluate(() => window.__TIGER__.orthoScale());
  console.log(`  captured ${view.id}  (${scale?.toFixed(2)} mm/px)`);
}

// Silhouette pass: the same elevations stripped to a black mask on white, which
// is what the measurement suite works from and what a reference comparison
// should be laid over.
for (const view of ORTHO_VIEWS) {
  await page.evaluate((v) => {
    window.__TIGER__.silhouetteMode(true);
    window.__TIGER__.orthoView(v.eye, v.target, v.height);
  }, view);
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(OUT, `${view.id}-silhouette.png`) });
  console.log(`  captured ${view.id}-silhouette`);
}
// silhouetteMode restores the envelope lines on its way out, so the chrome has
// to come off again before the perspective views.
await page.evaluate(() => {
  window.__TIGER__.silhouetteMode(false);
  window.__TIGER__.hideChrome(true);
});

await page.evaluate(() => window.__TIGER__.clearOrthoView());

for (const view of [...QUARTER_VIEWS, ...DETAIL_VIEWS]) {
  await page.evaluate((v) => {
    window.__TIGER__.teleport(v.eye[0] / 1000, v.eye[1] / 1000, v.eye[2] / 1000);
    window.__TIGER__.lookAt(v.target[0] / 1000, v.target[1] / 1000, v.target[2] / 1000);
    // Moving parts are posed explicitly, and settled rather than animated, so
    // a capture never catches a lid halfway.
    for (const a of window.__TIGER__.internals.articulations) {
      a.setOpen(v.hatches === true);
      a.settle();
    }
  }, view);
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(OUT, `${view.id}.png`) });
  console.log(`  captured ${view.id}`);
}

await browser.close();
server.close();
console.log(`\nWrote ${ORTHO_VIEWS.length + QUARTER_VIEWS.length + DETAIL_VIEWS.length} renders to ${OUT}`);
