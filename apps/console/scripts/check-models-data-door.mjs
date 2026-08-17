#!/usr/bin/env node
// HANDOFF-CONSOLE-SINGLE-DOOR-1.0: keep Models and OKF on the consumer data API.

import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONSOLE_ROOT = resolve(SCRIPT_DIR, '..');
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const FORBIDDEN_REFERENCES = [
  'harness-mcp',
  'harness-graphql',
  'callHarnessMcp',
  'callHarnessGraphql',
  'CONSOLE_HARNESS_URL',
  'CONSOLE_HARNESS_TOKEN',
  'graphql_query',
  'graphql_mutate',
  '/mcp',
];

export function scanModelsDataDoorSource(path, source) {
  const violations = [];
  const lines = source.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    for (const reference of FORBIDDEN_REFERENCES) {
      if (line.includes(reference)) {
        violations.push({
          path,
          line: index + 1,
          reference,
        });
      }
    }
  }
  return violations;
}

export function assertModelsDataDoorSources(sources) {
  const violations = sources.flatMap(({ path, source }) =>
    scanModelsDataDoorSource(path, source));
  if (violations.length === 0) return;

  const detail = violations
    .map(({ path, line, reference }) => `${path}:${line} references ${reference}`)
    .join('\n');
  throw new Error(`Models data-door gate failed:\n${detail}`);
}

function sourceFilesIn(directory, files = []) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      sourceFilesIn(path, files);
    } else if (SOURCE_EXTENSIONS.has(extname(name))) {
      files.push(path);
    }
  }
  return files;
}

export function modelsDataDoorSources(consoleRoot = DEFAULT_CONSOLE_ROOT) {
  const adapters = [
    join(consoleRoot, 'src/lib/server/consumer-graphql-client.ts'),
    join(consoleRoot, 'src/lib/server/observed-model-harness.ts'),
  ];
  const routeRoot = join(consoleRoot, 'src/app/api/observed-model');
  if (adapters.some((path) => !existsSync(path)) || !existsSync(routeRoot)) {
    throw new Error('Models data-door gate targets are missing');
  }

  return [...adapters, ...sourceFilesIn(routeRoot)].map((path) => ({
    path: relative(consoleRoot, path),
    source: readFileSync(path, 'utf8'),
  }));
}

export function runModelsDataDoorGate(consoleRoot = DEFAULT_CONSOLE_ROOT) {
  const sources = modelsDataDoorSources(consoleRoot);
  assertModelsDataDoorSources(sources);
  return sources.length;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  try {
    const count = runModelsDataDoorGate();
    console.log(`check-models-data-door: ok (${count} files scanned)`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
