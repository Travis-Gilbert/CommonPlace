import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const [wasmPath, nativeFixtureBinary] = process.argv.slice(2);

if (!wasmPath || !nativeFixtureBinary) {
  throw new Error("usage: node check-wasm-fixture.mjs <wasm-path> <native-fixture-binary>");
}

const nativeJson = execFileSync(nativeFixtureBinary, { encoding: "utf8" }).trim();
const wasmBytes = await readFile(wasmPath);
const module = new WebAssembly.Module(wasmBytes);
const imports = {};
for (const entry of WebAssembly.Module.imports(module)) {
  if (entry.kind !== "function") {
    throw new Error(`unsupported wasm import kind: ${entry.module}.${entry.name} (${entry.kind})`);
  }
  imports[entry.module] ??= {};
  imports[entry.module][entry.name] = () => 0;
}
const instance = new WebAssembly.Instance(module, imports);
const prepare = instance.exports.commonplace_console_fixture_json_prepare;
const pointer = instance.exports.commonplace_console_fixture_json_ptr;
const memory = instance.exports.memory;

assert.equal(typeof prepare, "function", "wasm fixture length export is present");
assert.equal(typeof pointer, "function", "wasm fixture pointer export is present");
assert.ok(memory instanceof WebAssembly.Memory, "wasm linear memory is exported");

const length = prepare();
const offset = pointer();
const wasmJson = new TextDecoder().decode(new Uint8Array(memory.buffer, offset, length));

assert.deepEqual(JSON.parse(wasmJson), JSON.parse(nativeJson));
assert.equal(wasmJson, nativeJson, "native and wasm fixture bytes match");
console.log(`fixture parity passed: ${length} bytes`);
