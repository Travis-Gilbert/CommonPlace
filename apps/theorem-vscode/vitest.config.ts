// SOURCING: vitest, already this repo's test runner (packages/theorem-acp,
// packages/block-view use it). No new runner introduced.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // The extension host injects `vscode` at runtime; nothing resolves it on
      // disk. The stub is the only way to exercise providers without booting
      // Electron.
      { find: /^vscode$/, replacement: here('./test/vscode-stub.ts') },
      {
        find: /^@commonplace\/block-view-contracts\/(.*)$/,
        replacement: here('../../packages/block-view-contracts/src/$1.ts'),
      },
      {
        find: /^@commonplace\/theorem-acp\/(.*)$/,
        replacement: here('../../packages/theorem-acp/src/$1.ts'),
      },
      // V8's other front. The console app is not a workspace dependency of the
      // pack and must not become one; the parity test reaches its adapter by
      // path so the comparison can run without coupling the two builds.
      {
        find: /^@commonplace\/console-editor\/(.*)$/,
        replacement: here('../console/src/lib/editor-intelligence/$1.ts'),
      },
    ],
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
