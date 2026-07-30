#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const theoremRoot = process.env.THEOREM_REPO
  ? resolve(process.env.THEOREM_REPO)
  : resolve(packageRoot, '../../..', 'Theorem');
const workspaceRoot = resolve(theoremRoot, 'rustyredcore_THG');
const manifestPath = resolve(workspaceRoot, 'Cargo.toml');
const outputPath = resolve(packageRoot, 'src/program.generated.ts');

if (!existsSync(manifestPath)) {
  throw new Error(
    `Theorem Rust workspace not found at ${workspaceRoot}. Set THEOREM_REPO to the Theorem checkout.`,
  );
}

const sourceCommit = execFileSync('git', ['-C', theoremRoot, 'rev-parse', '--short', 'HEAD'], {
  encoding: 'utf8',
}).trim();
const exporterArgs = [
  'run',
  '--quiet',
  '-p',
  'rustyred-thg-programmable-graph',
  '--bin',
  'export_program_contracts',
  '--',
  '--output',
  outputPath,
  '--source-commit',
  sourceCommit,
];

if (process.argv.includes('--check')) {
  exporterArgs.push('--check');
}

execFileSync('cargo', exporterArgs, {
  cwd: workspaceRoot,
  env: {
    ...process.env,
    CARGO_BUILD_JOBS: process.env.CARGO_BUILD_JOBS ?? '1',
  },
  stdio: 'inherit',
});
