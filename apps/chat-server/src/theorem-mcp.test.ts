import { describe, expect, it, test } from "bun:test";

import { buildOpenworkRuntimeConfigObjectFromSnapshot } from "./openwork-runtime-config.js";
import {
  THEOREM_MCP_NAME,
  resolveTheoremMcpConfig,
  theoremCredentialScope,
  theoremCredentialWarning,
  withTheoremMcp,
} from "./theorem-mcp.js";

const URL_ONLY = { THEOREM_MCP_URL: "https://api.theoremharness.com/mcp" };
const FULL = {
  ...URL_ONLY,
  THEOREM_API_KEY: "tk_live_example",
  THEOREM_TENANT_ID: "Travis-Gilbert",
};

describe("theorem mcp resolution", () => {
  it("is absent until an operator configures a URL", () => {
    // OW1 severed a hosted catalog whose only reason for existing was a
    // constant. A default endpoint here would reintroduce exactly that.
    expect(resolveTheoremMcpConfig({})).toBeNull();
    expect(resolveTheoremMcpConfig({ THEOREM_MCP_URL: "   " })).toBeNull();
  });

  it("builds a remote entry the engine's validator accepts", () => {
    expect(resolveTheoremMcpConfig(URL_ONLY)).toEqual({
      type: "remote",
      url: "https://api.theoremharness.com/mcp",
      enabled: true,
    });
  });

  it("omits headers entirely when no credential is configured", () => {
    // An empty Authorization header reads as a malformed credential, which
    // fails differently (and less legibly) than sending none.
    expect(resolveTheoremMcpConfig(URL_ONLY)).not.toHaveProperty("headers");
    expect(resolveTheoremMcpConfig({ ...URL_ONLY, THEOREM_API_KEY: "  " }))
      .not.toHaveProperty("headers");
  });

  it("carries the bearer key and tenant when both are configured", () => {
    expect(resolveTheoremMcpConfig(FULL)?.headers).toEqual({
      Authorization: "Bearer tk_live_example",
      "x-theorem-tenant": "Travis-Gilbert",
    });
  });

  it("returns null for a malformed or non-http URL instead of throwing", () => {
    // A bad value must not take the engine config down: the failure that
    // matters is a head with no graph door, not a daemon that will not start.
    for (const url of ["not-a-url", "ftp://example.com/mcp", "file:///etc/passwd", "//example.com"]) {
      expect(resolveTheoremMcpConfig({ THEOREM_MCP_URL: url })).toBeNull();
    }
  });
});

describe("theorem mcp merge", () => {
  it("leaves the operator map untouched when unconfigured", () => {
    const operator = { notion: { type: "remote", url: "https://mcp.notion.com/mcp" } };
    expect(withTheoremMcp(operator, {})).toEqual(operator);
  });

  it("preserves operator entries alongside the head's door", () => {
    const merged = withTheoremMcp({ notion: { type: "remote", url: "https://mcp.notion.com/mcp" } }, URL_ONLY);
    expect(Object.keys(merged).sort()).toEqual(["notion", THEOREM_MCP_NAME]);
  });

  it("wins over a runtime entry of the same name", () => {
    // The settings UI writes the runtime map. A stale or hand-edited "theorem"
    // entry there would otherwise silently repoint the head's graph door.
    const merged = withTheoremMcp(
      { [THEOREM_MCP_NAME]: { type: "remote", url: "https://stale.example/mcp", enabled: false } },
      URL_ONLY,
    );
    expect(merged[THEOREM_MCP_NAME]).toEqual({
      type: "remote",
      url: "https://api.theoremharness.com/mcp",
      enabled: true,
    });
  });
});

describe("engine config", () => {
  it("carries the graph door into the config the engine reads", () => {
    const previous = process.env.THEOREM_MCP_URL;
    process.env.THEOREM_MCP_URL = "https://api.theoremharness.com/mcp";
    try {
      const config = buildOpenworkRuntimeConfigObjectFromSnapshot({});
      const mcp = config.mcp as Record<string, Record<string, unknown>>;
      expect(mcp[THEOREM_MCP_NAME]?.url).toBe("https://api.theoremharness.com/mcp");
    } finally {
      if (previous === undefined) delete process.env.THEOREM_MCP_URL;
      else process.env.THEOREM_MCP_URL = previous;
    }
  });

  it("names the graph, not Den's meta-MCP, in the agent prompt", () => {
    // OW1 severed every Den endpoint but left the prompt instructing the head
    // to reach Den's meta-MCP for memory. A head told to open a door that no
    // longer exists reports the failure as its own confusion.
    const config = buildOpenworkRuntimeConfigObjectFromSnapshot({});
    const agent = config.agent as { openwork: { prompt: string } };
    expect(agent.openwork.prompt).not.toContain("search_capabilities");
    expect(agent.openwork.prompt).not.toContain("postMemory");
    expect(agent.openwork.prompt).toContain(THEOREM_MCP_NAME);
  });
});

describe("credential scoping", () => {
  const URL_ONLY_ENV = { THEOREM_MCP_URL: "https://api.theoremharness.com/mcp" };

  test("prefers the workspace-scoped key over the tenant key", () => {
    // Both present is the migration window. The narrower credential is the one
    // that should be on the wire while the broad variable is being removed.
    const config = resolveTheoremMcpConfig({
      ...URL_ONLY_ENV,
      THEOREM_API_KEY: "tenant-wide-value",
      THEOREM_WORKSPACE_API_KEY: "workspace-scoped-value",
    });
    expect(config?.headers?.Authorization).toBe("Bearer workspace-scoped-value");
  });

  test("still authenticates with a tenant key alone", () => {
    // Refusing it would take the graph door down on every deployment that has
    // not migrated, which trades a scoping problem for an outage.
    const config = resolveTheoremMcpConfig({ ...URL_ONLY_ENV, THEOREM_API_KEY: "tenant-wide-value" });
    expect(config?.headers?.Authorization).toBe("Bearer tenant-wide-value");
  });

  test("reports which scope the credential actually has", () => {
    expect(theoremCredentialScope({ THEOREM_WORKSPACE_API_KEY: "k" })).toBe("workspace");
    expect(theoremCredentialScope({ THEOREM_API_KEY: "k" })).toBe("tenant");
    expect(theoremCredentialScope({})).toBe("none");
    expect(theoremCredentialScope({ THEOREM_API_KEY: "   " })).toBe("none");
  });

  test("warns only when a tenant-wide key is actually in use", () => {
    // A warning that fires on the healthy case teaches operators to skip
    // warnings, so it stays silent when the key is narrow, when there is no
    // key, and when there is no graph door to authenticate against at all.
    expect(theoremCredentialWarning({ ...URL_ONLY_ENV, THEOREM_API_KEY: "k" })).toContain("THEOREM_WORKSPACE_API_KEY");
    expect(theoremCredentialWarning({ ...URL_ONLY_ENV, THEOREM_WORKSPACE_API_KEY: "k" })).toBeNull();
    expect(theoremCredentialWarning({ ...URL_ONLY_ENV })).toBeNull();
    expect(theoremCredentialWarning({ THEOREM_API_KEY: "k" })).toBeNull();
  });
});
