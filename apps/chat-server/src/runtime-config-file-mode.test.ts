import { describe, expect, it } from "bun:test";
import { chmod, mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { openworkRuntimeConfigFilePath, writeOpenworkRuntimeConfigFile } from "./openwork-runtime-config.js";
import type { ServerConfig } from "./types.js";

// The generated engine config carries OW2's Theorem Authorization header and
// any provider credentials the runtime config holds. Written with the process
// umask it lands 0644 under a typical 0022, readable by every local user.
describe("generated runtime config file permissions", () => {
  async function configIn(dir: string): Promise<ServerConfig> {
    return { configPath: join(dir, "server.json"), workspaces: [] } as unknown as ServerConfig;
  }

  it("creates the file 0600", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ow-cfg-"));
    const config = await configIn(dir);
    const { path } = await writeOpenworkRuntimeConfigFile(config, "ws_test");
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });

  it("tightens an existing permissive file even when the content is unchanged", async () => {
    // A file from an older build, or restored from a backup, would otherwise
    // keep its permissive bits forever, since the writer short-circuits on
    // matching content.
    const dir = await mkdtemp(join(tmpdir(), "ow-cfg-"));
    const config = await configIn(dir);
    const { path } = await writeOpenworkRuntimeConfigFile(config, "ws_test");
    // chmod, not writeFile with a mode: the mode option only applies when the
    // file is created, so writing over an existing file leaves it 0600 and the
    // setup would silently assert nothing.
    await chmod(path, 0o644);
    expect((await stat(path)).mode & 0o777).toBe(0o644);

    await writeOpenworkRuntimeConfigFile(config, "ws_test");
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });
});
