import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    // three.js alone is ~600 kB minified; the app code is small.
    chunkSizeWarningLimit: 650,
    rolldownOptions: {
      output: {
        // three.js in its own long-lived chunk, so app changes don't re-download it.
        // (Vite 8 / Rolldown's replacement for rollupOptions.output.manualChunks.)
        codeSplitting: {
          groups: [{ name: 'three', test: /[\\/]node_modules[\\/]three[\\/]/ }],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
