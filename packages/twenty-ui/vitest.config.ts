// Upstream's vitest config drove Storybook browser tests through Argos. The
// fork keeps the unit tests only: the theme parity oracle plus the utility
// suites that survived the strip.
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@ui': path.resolve(__dirname, 'src'),
      '@assets': path.resolve(__dirname, 'src/assets'),
      '@styles': path.resolve(__dirname, 'src/styles'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./setupTests.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
