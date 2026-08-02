import { describe, expect, it } from "bun:test";

import { sanitizeDiagnosticValue } from "./diagnostic-sanitizer.js";
import { buildOpenworkRuntimeConfigObjectFromSnapshot } from "./openwork-runtime-config.js";

// OW2 injects the Theorem MCP with an Authorization header built from
// THEOREM_API_KEY. The runtime-config diagnostic returns the effective config,
// and that route is "client" auth, which admits a viewer token. Returned
// verbatim it handed every viewer the workspace's bearer key.
describe("runtime config diagnostic redaction", () => {
  const KEY = "tk_live_diagnostic_leak_canary";

  function effectiveConfig() {
    const previousUrl = process.env.THEOREM_MCP_URL;
    const previousKey = process.env.THEOREM_API_KEY;
    process.env.THEOREM_MCP_URL = "https://api.theoremharness.com/mcp";
    process.env.THEOREM_API_KEY = KEY;
    try {
      return buildOpenworkRuntimeConfigObjectFromSnapshot({});
    } finally {
      if (previousUrl === undefined) delete process.env.THEOREM_MCP_URL;
      else process.env.THEOREM_MCP_URL = previousUrl;
      if (previousKey === undefined) delete process.env.THEOREM_API_KEY;
      else process.env.THEOREM_API_KEY = previousKey;
    }
  }

  it("confirms the key really is in the unredacted config", () => {
    // Without this the test could pass because the key was never there.
    expect(JSON.stringify(effectiveConfig())).toContain(KEY);
  });

  it("strips the injected bearer key from the diagnostic payload", () => {
    const payload = sanitizeDiagnosticValue({ effectiveRuntime: effectiveConfig() });
    expect(JSON.stringify(payload)).not.toContain(KEY);
  });
});
