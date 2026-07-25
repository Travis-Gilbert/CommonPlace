import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const crateRoot = resolve(scriptDirectory, "../..");
const manifest = join(crateRoot, "Cargo.toml");
const targetDirectory = process.env.CARGO_TARGET_DIR
  ?? mkdtempSync(join(tmpdir(), "commonplace-console-cc2-"));
const environment = { ...process.env, CARGO_TARGET_DIR: targetDirectory };

function run(command, argv) {
  const result = spawnSync(command, argv, {
    cwd: resolve(crateRoot, "../.."),
    env: environment,
    stdio: "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${argv.join(" ")} exited ${result.status}`);
  }
}

run("cargo", ["test", "--manifest-path", manifest, "--test", "sim", "sim::"]);
run("cargo", [
  "test",
  "--manifest-path",
  manifest,
  "--features",
  "gpu",
  "--test",
  "sim",
  "sim::",
]);
run("cargo", [
  "build",
  "--manifest-path",
  manifest,
  "--target",
  "wasm32-unknown-unknown",
  "--lib",
]);

const wasmArtifact = join(
  targetDirectory,
  "wasm32-unknown-unknown",
  "debug",
  "commonplace_console_core.wasm",
);
run("node", [
  join(scriptDirectory, "check-wasm-layout.mjs"),
  wasmArtifact,
  "5604591119938928748",
]);
run("cargo", [
  "test",
  "--manifest-path",
  manifest,
  "--test",
  "sim",
  "sim::sim_benchmark_5000",
  "--",
  "--ignored",
  "--nocapture",
  "--test-threads=1",
]);
