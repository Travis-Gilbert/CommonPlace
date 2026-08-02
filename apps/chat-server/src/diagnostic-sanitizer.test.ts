import { describe, expect, it } from "bun:test";

import { sanitizeDiagnosticString, sanitizeDiagnosticValue } from "./diagnostic-sanitizer.js";

const REDACTED = "[REDACTED]";

// The first version of this sanitizer matched keys against a fixed set of
// exact strings. That set was assembled from the keys this fork writes, which
// is the wrong population: the keys that matter are the ones an arbitrary MCP
// server, provider, or OAuth blob chose for itself. These are the shapes that
// slipped through.
describe("credential keys the exact-match rule missed", () => {
  it("redacts separator and camelCase spellings of the same secret", () => {
    // The values carry no test signal — redaction is decided by the key — so
    // they are deliberately not credential-shaped. A realistic-looking literal
    // here would only be bait for the repository's secret scanner.
    const sanitized = sanitizeDiagnosticValue({
      GITHUB_TOKEN: "unredacted",
      accessToken: "unredacted",
      refreshToken: "unredacted",
      clientSecret: "unredacted",
      "api-key": "unredacted",
      apiKey: "unredacted",
      api_key: "unredacted",
      userPassword: "unredacted",
      passphrase: "unredacted",
    }) as Record<string, unknown>;

    for (const [key, value] of Object.entries(sanitized)) {
      expect(`${key}=${value}`).toBe(`${key}=${REDACTED}`);
    }
  });

  it("redacts every value in a credential-bearing record, whatever the keys are called", () => {
    const sanitized = sanitizeDiagnosticValue({
      theorem: {
        type: "remote",
        url: "https://api.theoremharness.com/mcp",
        headers: { Authorization: "Bearer live", "x-theorem-tenant": "Travis-Gilbert" },
        environment: { WEIRDLY_NAMED_CREDENTIAL: "live", ALSO_SECRET: "live" },
      },
    }) as {
      theorem: {
        type: unknown;
        url: unknown;
        headers: Record<string, unknown>;
        environment: Record<string, unknown>;
      };
    };

    expect(sanitized.theorem.headers).toEqual({
      Authorization: REDACTED,
      "x-theorem-tenant": REDACTED,
    });
    expect(sanitized.theorem.environment).toEqual({
      WEIRDLY_NAMED_CREDENTIAL: REDACTED,
      ALSO_SECRET: REDACTED,
    });
    // The non-secret siblings are what make the diagnostic worth returning.
    expect(sanitized.theorem.type).toBe("remote");
    expect(sanitized.theorem.url).toBe("https://api.theoremharness.com/mcp");
  });
});

// Over-redaction is a real cost: this route exists so an operator can see why
// a head has no graph door, and a wall of [REDACTED] answers nothing.
describe("keys that must survive", () => {
  it("keeps keys that merely contain a sensitive word inside another word", () => {
    const sanitized = sanitizeDiagnosticValue({
      monkey: "fine",
      tokenizer: "fine",
      keyboardLayout: "fine",
    });
    expect(sanitized).toEqual({
      monkey: "fine",
      tokenizer: "fine",
      keyboardLayout: "fine",
    });
  });

  it("keeps weak words that are not the final segment", () => {
    // "key" and "auth" only redact as a tail, so these stay readable while
    // apiKey and Authorization above do not.
    const sanitized = sanitizeDiagnosticValue({ keyPath: "/etc/x", authUrl: "https://idp" });
    expect(sanitized).toEqual({ keyPath: "/etc/x", authUrl: "https://idp" });
  });
});

describe("value-shaped redaction still applies", () => {
  it("redacts bearer tokens, JWTs, and OpenWork token shapes inside free text", () => {
    const text = sanitizeDiagnosticString(
      "failed with Authorization: Bearer abc.def-ghi and owt_workspacetoken",
    );
    expect(text).not.toContain("abc.def-ghi");
    expect(text).not.toContain("owt_workspacetoken");
  });

  it("walks arrays and nested records", () => {
    const sanitized = sanitizeDiagnosticValue({
      servers: [{ name: "a", headers: { Authorization: "Bearer live" } }],
    }) as { servers: Array<{ name: string; headers: Record<string, unknown> }> };
    expect(sanitized.servers[0]!.name).toBe("a");
    expect(sanitized.servers[0]!.headers.Authorization).toBe(REDACTED);
  });
});
