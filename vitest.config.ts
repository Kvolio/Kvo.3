import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@spec': r('./src/spec'),
      '@geom': r('./src/geom'),
      '@prims': r('./src/prims'),
      '@core': r('./src/core'),
      '@materials': r('./src/materials'),
      '@input': r('./src/input'),
      '@collision': r('./src/collision'),
      '@player': r('./src/player'),
    },
  },
  test: {
    // Geometry, spec and sim tests run headless in Node — no GPU, no DOM.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Playwright specs live in tests/e2e and are driven by `npm run test:visual`.
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
});
