import { defineConfig } from 'vite';
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
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Keep the three.js core and the BVH library in their own chunks so a
        // change to model code does not invalidate ~700 kB of vendor bundle.
        manualChunks(id: string) {
          if (id.includes('node_modules/three-mesh-bvh')) return 'vendor-bvh';
          if (id.includes('node_modules/three')) return 'vendor-three';
          return undefined;
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
