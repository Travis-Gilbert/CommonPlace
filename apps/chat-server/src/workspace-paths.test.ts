import { afterAll, describe, expect, it } from "bun:test";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ApiError } from "./errors.js";
import { isRealPathWithinDirectory, resolveSafeChildPath } from "./workspace-paths.js";

// A workspace with an escaping symlink in it, which is the shape a checkout
// takes after cloning a repository that contains one.
const roots: string[] = [];

async function makeWorkspace() {
  const base = await mkdtemp(join(tmpdir(), "cp-paths-"));
  roots.push(base);
  const workspace = join(base, "workspace");
  const outside = join(base, "outside");
  await mkdir(workspace, { recursive: true });
  await mkdir(outside, { recursive: true });
  await writeFile(join(outside, "secret.txt"), "host-only", "utf8");
  await writeFile(join(workspace, "ok.txt"), "in-workspace", "utf8");
  return { workspace, outside };
}

afterAll(async () => {
  await Promise.all(roots.map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("symlink containment", () => {
  it("rejects a symlinked file whose target is outside the workspace", async () => {
    const { workspace, outside } = await makeWorkspace();
    await symlink(join(outside, "secret.txt"), join(workspace, "linked-secret"));

    // The lexical check passes this: "linked-secret" is textually a child.
    await expect(resolveSafeChildPath(workspace, "linked-secret")).rejects.toThrow(ApiError);
  });

  it("rejects a path that traverses a symlinked directory", async () => {
    const { workspace, outside } = await makeWorkspace();
    await symlink(outside, join(workspace, "linked-dir"));

    await expect(resolveSafeChildPath(workspace, "linked-dir/secret.txt")).rejects.toThrow(ApiError);
  });

  it("rejects a not-yet-created file under a symlinked directory", async () => {
    // The write path: realpath cannot resolve the leaf, so containment has to
    // be decided from the nearest existing ancestor.
    const { workspace, outside } = await makeWorkspace();
    await symlink(outside, join(workspace, "linked-dir"));

    await expect(resolveSafeChildPath(workspace, "linked-dir/new-file.txt")).rejects.toThrow(ApiError);
  });

  it("still rejects lexical traversal", async () => {
    const { workspace } = await makeWorkspace();
    await expect(resolveSafeChildPath(workspace, "../outside/secret.txt")).rejects.toThrow(ApiError);
  });
});

describe("paths that must keep working", () => {
  it("resolves an ordinary file in the workspace", async () => {
    const { workspace } = await makeWorkspace();
    const resolved = await resolveSafeChildPath(workspace, "ok.txt");
    expect(resolved.endsWith("ok.txt")).toBe(true);
  });

  it("resolves a file a write has not created yet", async () => {
    const { workspace } = await makeWorkspace();
    const resolved = await resolveSafeChildPath(workspace, "nested/dir/new.txt");
    expect(resolved.endsWith(join("nested", "dir", "new.txt"))).toBe(true);
  });

  it("allows a symlink whose target is inside the same workspace", async () => {
    // Containment is the rule, not "no symlinks" — an in-workspace link is a
    // normal thing for a checkout to contain.
    const { workspace } = await makeWorkspace();
    await mkdir(join(workspace, "sub"), { recursive: true });
    await symlink(join(workspace, "ok.txt"), join(workspace, "sub", "alias.txt"));

    const resolved = await resolveSafeChildPath(workspace, "sub/alias.txt");
    expect(resolved.endsWith("ok.txt")).toBe(true);
  });
});

describe("absolute-path containment for the engine proxy", () => {
  it("rejects a symlinked directory supplied as x-opencode-directory", async () => {
    // The escalation: the engine treats this header as its working directory,
    // so accepting a symlink pointed the engine at /etc for every subsequent
    // proxied operation.
    const { workspace, outside } = await makeWorkspace();
    await symlink(outside, join(workspace, "host"));

    expect(await isRealPathWithinDirectory(join(workspace, "host"), workspace)).toBe(false);
  });

  it("accepts a real subdirectory, which is the legitimate case", async () => {
    const { workspace } = await makeWorkspace();
    await mkdir(join(workspace, "packages", "api"), { recursive: true });

    expect(await isRealPathWithinDirectory(join(workspace, "packages", "api"), workspace)).toBe(true);
  });

  it("accepts the workspace root itself", async () => {
    const { workspace } = await makeWorkspace();
    expect(await isRealPathWithinDirectory(workspace, workspace)).toBe(true);
  });

  it("rejects a sibling whose path merely shares a prefix", async () => {
    const { workspace } = await makeWorkspace();
    const sibling = `${workspace}-other`;
    await mkdir(sibling, { recursive: true });
    roots.push(sibling);

    expect(await isRealPathWithinDirectory(sibling, workspace)).toBe(false);
  });

  it("rejects a directory that does not exist", async () => {
    const { workspace } = await makeWorkspace();
    expect(await isRealPathWithinDirectory(join(workspace, "nope"), workspace)).toBe(false);
  });

  it("decodes a percent-encoded header value before judging it", async () => {
    const { workspace } = await makeWorkspace();
    await mkdir(join(workspace, "sub dir"), { recursive: true });

    expect(await isRealPathWithinDirectory(encodeURIComponent(join(workspace, "sub dir")), workspace)).toBe(true);
  });
});
