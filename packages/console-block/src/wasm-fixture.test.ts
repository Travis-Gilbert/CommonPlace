import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CONSOLE_LAYOUT_FINGERPRINT,
  CONSOLE_LAYOUT_SEED,
  orderedPositionArray,
} from './fixture-layout';
import { instantiateConsoleWasm } from './wasm-fixture';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wasmPath = resolve(
  packageRoot,
  '../../apps/console/public/wasm/commonplace_console_core.wasm',
);

describe('console-core WASM artifact', () => {
  it('loads the canonical fixture and matches the native B2 fingerprint', async () => {
    const bytes = await readFile(wasmPath);
    const runtime = await instantiateConsoleWasm(bytes);
    expect(runtime.snapshot.overview.counts_by_type).toEqual([
      ['note', 1],
      ['person', 1],
      ['project', 1],
      ['receipt', 4],
    ]);
    expect(runtime.snapshot.entities.map((detail) => detail.record.id)).toEqual([
      'golden:person:ada',
      'golden:project:atlas',
      'golden:note:console',
    ]);
    expect(runtime.snapshot.receipts).toHaveLength(4);
    expect(runtime.layoutFingerprint(0x00c0ffeen, 360)).toBe(5604591119938928748n);
    expect(runtime.settledLayoutFingerprint(CONSOLE_LAYOUT_SEED, 10_000)).toBe(
      CONSOLE_LAYOUT_FINGERPRINT,
    );
  });

  it('lays out arbitrary graph nodes deterministically', () => {
    const first = orderedPositionArray(['node:dynamic-b', 'node:dynamic-a']);
    const repeated = orderedPositionArray(['node:dynamic-b', 'node:dynamic-a']);
    expect([...first]).toEqual([...repeated]);
    expect([...first]).not.toContain(Number.NaN);
  });
});
