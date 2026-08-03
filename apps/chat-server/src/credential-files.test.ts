import { describe, expect, it } from "bun:test";

import { canReadWorkspacePath, isCredentialBearingWorkspacePath } from "./credential-files.js";

// The bug this module closes: the config *routes* were gated one at a time,
// and each time another door to the same bytes stayed open. The generic file
// reader would serve .opencode/opencode.json to a viewer verbatim.
describe("credential-bearing paths", () => {
  it("recognises the engine config in both positions it can live", () => {
    for (const path of [
      "opencode.json",
      "opencode.jsonc",
      ".opencode/opencode.json",
      ".opencode/openwork.json",
      ".opencode/auth/anthropic.json",
    ]) {
      expect(isCredentialBearingWorkspacePath(path)).toBe(true);
    }
  });

  it("recognises env files and their per-environment variants", () => {
    for (const path of [".env", ".env.local", ".env.production", "config/.env.staging"]) {
      expect(isCredentialBearingWorkspacePath(path)).toBe(true);
    }
  });

  it("leaves ordinary workspace files alone", () => {
    for (const path of [
      "README.md",
      "src/index.ts",
      "package.json",
      "docs/opencode-notes.md",
      "environment.md",
    ]) {
      expect(isCredentialBearingWorkspacePath(path)).toBe(false);
    }
  });
});

describe("who may read them", () => {
  it("refuses viewers", () => {
    expect(canReadWorkspacePath("viewer", ".opencode/opencode.json")).toBe(false);
    expect(canReadWorkspacePath("viewer", "opencode.json")).toBe(false);
  });

  it("allows collaborators and owners, who can already write these files", () => {
    expect(canReadWorkspacePath("collaborator", ".opencode/opencode.json")).toBe(true);
    expect(canReadWorkspacePath("owner", ".opencode/opencode.json")).toBe(true);
  });

  it("does not restrict viewers on ordinary files", () => {
    expect(canReadWorkspacePath("viewer", "README.md")).toBe(true);
  });
});
