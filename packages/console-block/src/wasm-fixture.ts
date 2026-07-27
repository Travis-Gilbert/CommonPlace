import { isConsoleSnapshot, type ConsoleSnapshot } from './types';

interface FixtureWasmExports extends WebAssembly.Exports {
  readonly memory: WebAssembly.Memory;
  readonly commonplace_console_fixture_json_prepare: () => number;
  readonly commonplace_console_fixture_json_ptr: () => number;
  readonly commonplace_console_fixture_layout_fingerprint: (
    seedLow: number,
    seedHigh: number,
    steps: number,
  ) => bigint;
  readonly commonplace_console_fixture_settled_layout_fingerprint: (
    seedLow: number,
    seedHigh: number,
    maxSteps: number,
  ) => bigint;
}

export interface ConsoleWasmRuntime {
  readonly snapshot: ConsoleSnapshot;
  layoutFingerprint(seed: bigint, steps: number): bigint;
  settledLayoutFingerprint(seed: bigint, maxSteps: number): bigint;
}

function importsFor(module: WebAssembly.Module): WebAssembly.Imports {
  const imports: Record<string, WebAssembly.ModuleImports> = {};
  for (const entry of WebAssembly.Module.imports(module)) {
    if (entry.kind !== 'function') {
      throw new Error(`Unsupported console WASM import: ${entry.module}.${entry.name}`);
    }
    const namespace = imports[entry.module] ?? {};
    namespace[entry.name] = () => 0;
    imports[entry.module] = namespace;
  }
  return imports;
}

export async function instantiateConsoleWasm(
  bytes: BufferSource,
): Promise<ConsoleWasmRuntime> {
  const module = await WebAssembly.compile(bytes);
  const instance = await WebAssembly.instantiate(module, importsFor(module));
  const exports = instance.exports as FixtureWasmExports;
  if (!(exports.memory instanceof WebAssembly.Memory)) {
    throw new Error('Console WASM did not export linear memory');
  }
  if (
    typeof exports.commonplace_console_fixture_json_prepare !== 'function' ||
    typeof exports.commonplace_console_fixture_json_ptr !== 'function' ||
    typeof exports.commonplace_console_fixture_layout_fingerprint !== 'function' ||
    typeof exports.commonplace_console_fixture_settled_layout_fingerprint !== 'function'
  ) {
    throw new Error('Console WASM is missing its fixture contract exports');
  }

  const length = exports.commonplace_console_fixture_json_prepare();
  const offset = exports.commonplace_console_fixture_json_ptr();
  const json = new TextDecoder().decode(
    new Uint8Array(exports.memory.buffer, offset, length),
  );
  const snapshot: unknown = JSON.parse(json);
  if (!isConsoleSnapshot(snapshot)) {
    throw new Error('Console WASM fixture did not match contract v1');
  }

  return {
    snapshot,
    layoutFingerprint(seed, steps) {
      return BigInt.asUintN(
        64,
        exports.commonplace_console_fixture_layout_fingerprint(
          Number(seed & 0xffff_ffffn),
          Number((seed >> 32n) & 0xffff_ffffn),
          steps,
        ),
      );
    },
    settledLayoutFingerprint(seed, maxSteps) {
      return BigInt.asUintN(
        64,
        exports.commonplace_console_fixture_settled_layout_fingerprint(
          Number(seed & 0xffff_ffffn),
          Number((seed >> 32n) & 0xffff_ffffn),
          maxSteps,
        ),
      );
    },
  };
}

let browserRuntime: Promise<ConsoleWasmRuntime> | null = null;

export function loadConsoleWasm(
  url = '/wasm/commonplace_console_core.wasm',
): Promise<ConsoleWasmRuntime> {
  browserRuntime ??= fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Console WASM request failed with ${response.status}`);
      }
      return response.arrayBuffer();
    })
    .then(instantiateConsoleWasm);
  return browserRuntime;
}

export function resetConsoleWasmCacheForTests(): void {
  browserRuntime = null;
}
