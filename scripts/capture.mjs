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

const POSES = [
  { id: 'front', eye: [0, 1.65, 9.5], target: [0, 1.4, 0] },
  { id: 'left', eye: [-8.5, 1.65, 0], target: [0, 1.4, 0] },
  { id: 'rear', eye: [0, 1.65, -9], target: [0, 1.4, 0] },
  { id: 'three-quarter', eye: [-7, 1.65, 7], target: [0, 1.3, 0] },
  { id: 'close-hull-side', eye: [-3.2, 1.2, 1.0], target: [-1.85, 1.0, 0.6] },
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

for (const pose of POSES) {
  await page.evaluate((p) => {
    const api = window.__TIGER__;
    api.teleport(p.eye[0], p.eye[1], p.eye[2]);
    api.lookAt(p.target[0], p.target[1], p.target[2]);
  }, pose);
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(OUT, `${pose.id}.png`) });
  console.log(`  captured ${pose.id}`);
}

await browser.close();
server.close();
console.log(`\nWrote ${POSES.length} renders to ${OUT}`);
