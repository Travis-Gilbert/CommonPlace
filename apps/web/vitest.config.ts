import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/**/__tests__/**/*.test.ts',
      'src/**/*.test.ts',
      // Component tests opt into a DOM with a `@vitest-environment jsdom` docblock.
      // Scoped to the find surface: the other `*.test.tsx` files in the tree carry
      // no docblock, so widening this glob would run them under the node default.
      'src/components/commonplace/find/__tests__/*.test.tsx',
      'src/components/commonplace/scene-host/__tests__/*.test.tsx',
      'src/components/commonplace/serp/__tests__/*.test.tsx',
    ],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
