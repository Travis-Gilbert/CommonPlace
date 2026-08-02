import { describe, expect, it } from "bun:test";

import { isWithinDirectory } from "./server.js";

// The engine treats x-opencode-directory as its working directory, so a
// caller-supplied value that escapes the workspace root is a workspace escape.
// Upstream kept the caller's header whenever it was present.
describe("opencode directory containment", () => {
  const root = "/workspace/repo";

  it("admits the root itself and paths beneath it", () => {
    expect(isWithinDirectory("/workspace/repo", root)).toBe(true);
    expect(isWithinDirectory("/workspace/repo/src", root)).toBe(true);
    expect(isWithinDirectory("/workspace/repo/a/b/c", root)).toBe(true);
  });

  it("refuses paths outside the root", () => {
    expect(isWithinDirectory("/etc", root)).toBe(false);
    expect(isWithinDirectory("/", root)).toBe(false);
    expect(isWithinDirectory("/workspace", root)).toBe(false);
    expect(isWithinDirectory("/workspace/state", root)).toBe(false);
  });

  it("refuses a sibling whose name merely extends the root", () => {
    // The separator on the prefix check is what stops this.
    expect(isWithinDirectory("/workspace/repo-other", root)).toBe(false);
    expect(isWithinDirectory("/workspace/repository", root)).toBe(false);
  });

  it("collapses traversal before comparing", () => {
    expect(isWithinDirectory("/workspace/repo/../../etc", root)).toBe(false);
    expect(isWithinDirectory("/workspace/repo/../repo/src", root)).toBe(true);
    expect(isWithinDirectory("/workspace/repo/./src", root)).toBe(true);
  });

  it("decodes percent-encoded values, which buildOpencodeDirectoryHeader emits", () => {
    expect(isWithinDirectory(encodeURIComponent("/etc"), root)).toBe(false);
    expect(isWithinDirectory(encodeURIComponent("/workspace/repo/src"), root)).toBe(true);
  });

  it("treats an undecodable value as literal rather than throwing", () => {
    expect(() => isWithinDirectory("%E0%A4%A", root)).not.toThrow();
    expect(isWithinDirectory("%E0%A4%A", root)).toBe(false);
  });
});
