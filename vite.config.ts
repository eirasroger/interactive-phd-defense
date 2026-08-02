import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // Relative base keeps the build valid both on a GitHub Pages project
  // subpath and when opened directly from disk for an offline defense.
  base: './',

  assetsInclude: ['**/*.glb'],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1024,
  },
});
