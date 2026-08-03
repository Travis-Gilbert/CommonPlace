// SOURCING: esbuild, the bundler VS Code's own extension samples use for this
// exact job. No webpack config hand-rolled.
/**
 * Two outputs, because the extension host is two runtimes.
 *
 * The desktop host is Node and takes CommonJS, which is what `main` points at.
 * The web workbench host is a worker and takes ESM with no Node builtins, which
 * is what `browser` points at. Shipping only the first would make the pack
 * silently absent in the web build, which is the output V7 has to serve.
 */

import { build } from 'esbuild';

const shared = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  minify: process.argv.includes('--production'),
  sourcemap: !process.argv.includes('--production'),
  // The host injects it; bundling it would ship a copy that shadows the real one.
  external: ['vscode'],
  logLevel: 'info',
};

await build({
  ...shared,
  outfile: 'dist/extension.cjs',
  format: 'cjs',
  platform: 'node',
  target: 'node20',
});

await build({
  ...shared,
  outfile: 'dist/extension.web.js',
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
});
