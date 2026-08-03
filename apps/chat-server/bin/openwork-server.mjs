#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);

// Binaries are published one per platform, named by the bun target they were
// compiled for. The unsuffixed name is only what a local `build:bin` produces,
// and preferring it meant a package built on one machine handed every other
// platform an executable it cannot run — the wrapper "found" a binary and the
// JS fallbacks below never got a chance.
const BUN_PLATFORMS = { darwin: "darwin", linux: "linux", win32: "windows" };
const BUN_ARCHS = { arm64: "arm64", x64: "x64" };

function platformBinaryNames() {
  const platform = BUN_PLATFORMS[process.platform];
  const arch = BUN_ARCHS[process.arch];
  const exe = process.platform === "win32" ? ".exe" : "";
  const names = [];
  if (platform && arch) {
    names.push(`openwork-server-bun-${platform}-${arch}${exe}`);
  }
  // A single-platform build, which is correct when it is this platform.
  names.push(`openwork-server${exe}`);
  return names;
}

const binRoot = new URL("../dist/bin/", import.meta.url);
const compiledBinary = platformBinaryNames()
  .map((name) => fileURLToPath(new URL(name, binRoot)))
  .find((candidate) => existsSync(candidate));
const builtCli = fileURLToPath(new URL("./dist/cli.js", `${new URL("../", import.meta.url)}`));
const sourceCli = fileURLToPath(new URL("./src/cli.ts", `${new URL("../", import.meta.url)}`));

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { stdio: "inherit" });
  if (result.error) {
    if (result.error.code === "ENOENT") {
      console.error(`Missing runtime dependency: ${command}`);
      process.exit(1);
    }
    throw result.error;
  }
  process.exit(result.status ?? 1);
}

if (compiledBinary) {
  run(compiledBinary, args);
}

if (existsSync(builtCli)) {
  run("bun", [builtCli, ...args]);
}

if (existsSync(sourceCli)) {
  run("bun", [sourceCli, ...args]);
}

console.error(
  `Unable to find an OpenWork server entrypoint in ${basename(packageRoot)}. Build the package or run it from a source checkout with Bun available.`,
);
process.exit(1);
