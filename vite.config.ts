import { defineConfig } from 'vitest/config';

export default defineConfig({
  // relative asset paths so the build works under GitHub Pages' /Cyberslide/ sub-path
  base: './',
  test: {
    environment: 'node',
    exclude: ['**/node_modules/**', 'dist/**'],
  },
});
