import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("inventory generator reports unique paths and honest line-count wording", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fork-inventory-"));
  const sourcePath = path.join(tempRoot, "anything-llm");
  fs.mkdirSync(sourcePath, { recursive: true });
  const source = fs.realpathSync(sourcePath);
  const outputPath = path.join(tempRoot, "inventory.md");
  fs.mkdirSync(path.join(source, "frontend", "src"), { recursive: true });
  fs.mkdirSync(path.join(source, "server", "utils", "vectorDbProviders", "astra"), {
    recursive: true,
  });
  fs.mkdirSync(path.join(source, "collector"), { recursive: true });
  fs.writeFileSync(path.join(source, "frontend", "src", "App.jsx"), "export default 1;\n");
  fs.writeFileSync(
    path.join(source, "server", "utils", "vectorDbProviders", "astra", "index.js"),
    "module.exports = {};\n"
  );
  fs.writeFileSync(path.join(source, "collector", "index.js"), "module.exports = {};\n");
  execFileSync("git", ["init"], { cwd: source, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "Codex"], { cwd: source, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "codex@example.test"], {
    cwd: source,
    stdio: "ignore",
  });
  execFileSync("git", ["add", "."], { cwd: source, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "fixture"], { cwd: source, stdio: "ignore" });

  const script = path.resolve("apps/console/scripts/generate-fork-inventory.mjs");
  const stdout = execFileSync("node", [script, "--source", source], {
    cwd: path.resolve("."),
    encoding: "utf8",
    env: {
      ...process.env,
      FORK_INVENTORY_OUTPUT_PATH: outputPath,
      FORK_INVENTORY_SKIP_CUT_ASSERT: "1",
    },
  });
  const inventory = fs.readFileSync(outputPath, "utf8");

  assert.match(stdout, /tracked regular files, 3 unique paths\./);
  assert.match(
    inventory,
    /This generator does not copy upstream application files into the CommonPlace worktree;/
  );
  assert.match(
    inventory,
    /Lines are stored LF byte counts from Git blobs rather than editor line numbers\./
  );
  assert.match(inventory, /Binary assets can therefore report non-semantic counts\./);
});
