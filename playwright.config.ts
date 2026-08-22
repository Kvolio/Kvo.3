import { defineConfig, devices } from '@playwright/test';

/**
 * Headless WebGL2 runs through ANGLE/SwiftShader (libvk_swiftshader.so is present
 * in this environment). Expect 1-4 s per rendered frame — these specs are kept off
 * the save loop and run via `npm run test:visual`.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  timeout: 120_000,
  expect: {
    toHaveScreenshot: {
      // three-bvh-csg triangulation is not byte-stable across FP environments,
      // so an exact-pixel baseline would be permanently red. Drift beyond this
      // threshold is caught here; silent drift is caught by the CSG triangle-count
      // assertion in the unit suite.
      maxDiffPixelRatio: 0.01,
    },
  },
  use: {
    baseURL: 'http://localhost:4173',
    launchOptions: {
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--disable-gpu-sandbox',
        '--force-device-scale-factor=1',
      ],
    },
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
      // The touch-control specs assert on an interface that is deliberately
      // absent without a touchscreen, so they belong to the mobile project.
      testIgnore: /mobile\.spec\.ts/,
    },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
