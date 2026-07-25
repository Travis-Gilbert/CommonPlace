import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(packageRoot, '../..');
const manifestPath = resolve(repositoryRoot, 'crates/console-core/Cargo.toml');
const targetRoot = process.env.CARGO_TARGET_DIR
  ? resolve(process.env.CARGO_TARGET_DIR)
  : resolve(repositoryRoot, 'target/console-core-wasm');
const outputPath = resolve(
  repositoryRoot,
  'apps/console/public/wasm/commonplace_console_core.wasm',
);

const build = spawnSync(
  'cargo',
  [
    'build',
    '--manifest-path',
    manifestPath,
    '--target',
    'wasm32-unknown-unknown',
    '--lib',
    '--release',
  ],
  {
    cwd: repositoryRoot,
    env: { ...process.env, CARGO_TARGET_DIR: targetRoot },
    stdio: 'inherit',
  },
);

if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

const artifactPath = resolve(
  targetRoot,
  'wasm32-unknown-unknown/release/commonplace_console_core.wasm',
);
await mkdir(dirname(outputPath), { recursive: true });
await copyFile(artifactPath, outputPath);
console.log(`WASM console core copied to ${outputPath}`);
