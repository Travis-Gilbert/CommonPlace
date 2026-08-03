import { describe, expect, it } from "bun:test";

import { buildOpenworkRuntimeConfigObjectFromSnapshot } from "./openwork-runtime-config.js";
import { THEOREM_MCP_NAME, resolveTheoremMcpConfig, withTheoremMcp } from "./theorem-mcp.js";

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
