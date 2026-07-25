import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [wasmPath, expectedValue] = process.argv.slice(2);
if (!wasmPath || !expectedValue) {
  throw new Error("usage: node check-wasm-layout.mjs <wasm-path> <expected-u64>");
}

const module = new WebAssembly.Module(await readFile(wasmPath));
const imports = {};
for (const entry of WebAssembly.Module.imports(module)) {
  if (entry.kind !== "function") {
    throw new Error(`unsupported wasm import kind: ${entry.module}.${entry.name} (${entry.kind})`);
  }
  imports[entry.module] ??= {};
  imports[entry.module][entry.name] = () => 0;
}

const instance = new WebAssembly.Instance(module, imports);
const fingerprint = instance.exports.commonplace_console_fixture_layout_fingerprint;
assert.equal(typeof fingerprint, "function", "wasm layout fingerprint export is present");

const actual = fingerprint(0x00c0ffee, 0, 360);
const expected = BigInt(expectedValue);
assert.equal(actual, expected, "native and wasm layout fingerprints match");
console.log(`layout parity passed: ${actual}`);

