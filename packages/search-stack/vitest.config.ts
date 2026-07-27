import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@commonplace/block-view-contracts/search-stack': path.resolve(
        __dirname,
        '../block-view-contracts/src/search-stack.ts',
      ),
      '@commonplace/block-view-contracts/search-stack-fixture': path.resolve(
        __dirname,
        '../block-view-contracts/src/search-stack-fixture.ts',
      ),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
