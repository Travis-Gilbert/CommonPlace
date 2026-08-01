// Fork of twenty-ui's own Vite build. Two plugins are dropped relative to
// upstream: vite-plugin-checker (type checking is `npm run check`) and
// vite-plugin-sass-dts (every *.module.scss already has a committed *.d.ts
// sibling, so nothing needs generating at build time).
import react from '@vitejs/plugin-react-swc';
import * as fs from 'fs';
import * as path from 'path';
import { defineConfig } from 'vite';
import dts, { type PluginOptions } from 'vite-plugin-dts';
import svgr from 'vite-plugin-svgr';

import packageJson from './package.json';

const entries = Object.keys(packageJson.exports)
  .filter((el) => !el.endsWith('.css'))
  .map((module) => `src/${module}/index.ts`);

const entryFileNames = (chunk: any, extension: 'cjs' | 'mjs') => {
  if (!chunk.isEntry) {
    throw new Error(
      `Should never occurs, encountered a non entry chunk ${chunk.facadeModuleId}`,
    );
  }

  const splitFaceModuleId = chunk.facadeModuleId?.split('/');
  if (splitFaceModuleId === undefined) {
    throw new Error(
      `Should never occurs splitFaceModuleId is undefined ${chunk.facadeModuleId}`,
    );
  }

  const moduleDirectory = splitFaceModuleId[splitFaceModuleId?.length - 2];
  if (moduleDirectory === 'src') {
    return `${chunk.name}.${extension}`;
  }
  return `${moduleDirectory}.${extension}`;
};

export default defineConfig(() => {
  const tsConfigPath = path.resolve(__dirname, './tsconfig.lib.json');

  const dtsConfig: PluginOptions = {
    entryRoot: 'src',
    tsconfigPath: tsConfigPath,
    // Type errors are the business of `npm run check`; a d.ts emit failure
    // must not silently ship a build with missing types either.
    logLevel: 'warn',
  };

  const BUNDLED_DEPS: string[] = [];

  const externalDeps = Object.keys({
    ...(packageJson.dependencies || {}),
    ...(packageJson.peerDependencies || {}),
  }).filter((dep) => !BUNDLED_DEPS.includes(dep));

  return {
    resolve: {
      alias: {
        '@ui/': path.resolve(__dirname, 'src') + '/',
        '@assets/': path.resolve(__dirname, 'src/assets') + '/',
        '@styles/': path.resolve(__dirname, 'src/styles') + '/',
      },
    },
    css: {
      modules: {
        localsConvention: 'camelCaseOnly',
      },
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
          loadPaths: [path.resolve(__dirname, 'src/styles')],
          additionalData: [
            `@use 'abstracts/functions' as *;`,
            `@use 'abstracts/mixins' as *;`,
            `@use 'abstracts/breakpoints' as *;`,
            '',
          ].join('\n'),
        },
      },
    },
    root: __dirname,
    cacheDir: 'node_modules/.vite',
    assetsInclude: ['src/**/*.svg'],
    plugins: [
      react(),
      svgr(),
      dts(dtsConfig),
      {
        // The generated --t-* layer is the fork's reskin seam. It ships beside
        // the bundle instead of inside it so the console can decide when the
        // variables mount.
        name: 'copy-theme-css',
        closeBundle() {
          const distDir = path.resolve(__dirname, 'dist');
          fs.mkdirSync(distDir, { recursive: true });
          for (const file of ['theme-light.css', 'theme-dark.css']) {
            fs.copyFileSync(
              path.resolve(__dirname, `src/theme-constants/${file}`),
              path.resolve(distDir, file),
            );
          }
        },
      },
    ],
    build: {
      cssCodeSplit: false,
      minify: 'esbuild' as const,
      sourcemap: false,
      emptyOutDir: false,
      outDir: './dist',
      reportCompressedSize: true,
      commonjsOptions: {
        transformMixedEsModules: true,
        interopDefault: true,
        defaultIsModuleExports: true,
        requireReturnsDefault: 'auto' as const,
      },
      lib: {
        entry: ['src/index.ts', ...entries],
        name: 'twenty-ui',
      },
      rollupOptions: {
        external: (id: string) =>
          externalDeps.some((dep) => id === dep || id.startsWith(dep + '/')),
        output: [
          {
            assetFileNames: 'style.css',
            globals: {
              react: 'React',
              'react-dom': 'ReactDOM',
            },
            format: 'es' as const,
            entryFileNames: (chunk: any) => entryFileNames(chunk, 'mjs'),
          },
          {
            assetFileNames: 'style.css',
            format: 'cjs' as const,
            globals: {
              react: 'React',
              'react-dom': 'ReactDOM',
            },
            esModule: true,
            exports: 'named' as const,
            entryFileNames: (chunk: any) => entryFileNames(chunk, 'cjs'),
          },
        ],
      },
    },
    logLevel: 'error' as const,
  };
});
