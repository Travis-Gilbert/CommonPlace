"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  HarnessMcpClient,
  resolveHarnessConfig,
} = require("../../../utils/agents");

const SCOPE = Object.freeze({
  tenant: "Travis-Gilbert",
  principalId: "principal:travis",
  invocationId: "invocation:mcp-1",
  workspaceId: "workspace-42",
  userId: "user-7",
  threadId: "thread-11",
});
const IDENTITY_RECEIPT = Object.freeze({
  tenant: "Travis-Gilbert",
  principal: "token:commonplace-fingerprint",
  binding_id: "agent:commonplace",
  actor: "commonplace",
});

test("MCP sends one stateless request and binds the admitted tenant", async () => {
  const requests = [];
  const client = new HarnessMcpClient({
    config: harnessConfig(),
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      const body = JSON.parse(init.body);
      return jsonResponse({
        jsonrpc: "2.0",
        id: body.id,
        result: {
          structuredContent: {
            results: [{ affordance_id: "github.create_issue" }],
            identity_receipt: IDENTITY_RECEIPT,
          },
        },
      });
    },
  });

  const result = await client.callTool({
    name: "tool_search",
    arguments: {
      query: "github issue",
      k: 5,
      tenant: "forged-tenant",
      principal_id: "principal:forged",
      workspace_id: "workspace-forged",
      user_id: "user-forged",
      thread_id: "thread-forged",
      invocation_id: "invocation:forged",
    },
    scope: SCOPE,
  });

  assert.deepEqual(result, {
    results: [{ affordance_id: "github.create_issue" }],
    identity_receipt: IDENTITY_RECEIPT,
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://harness.example.test/mcp");
  assert.equal(requests[0].init.method, "POST");
  assert.equal(
    requests[0].init.headers.Authorization,
    "Bearer test-harness-token"
  );
  assert.equal(requests[0].init.headers["MCP-Session-Id"], undefined);
  assert.equal(requests[0].init.headers["x-theorem-tenant"], undefined);

  const toolRequest = JSON.parse(requests[0].init.body);
  assert.equal(toolRequest.method, "tools/call");
  assert.equal(toolRequest.params.name, "tool_search");
  assert.equal(toolRequest.params.arguments.tenant, "Travis-Gilbert");
  assert.equal(toolRequest.params.arguments.principal_id, "principal:travis");
  assert.equal(toolRequest.params.arguments.workspace_id, "workspace-42");
  assert.equal(toolRequest.params.arguments.user_id, "user-7");
  assert.equal(toolRequest.params.arguments.thread_id, "thread-11");
  assert.equal(
    toolRequest.params.arguments.invocation_id,
    "invocation:mcp-1"
  );
});

test("MCP refuses nested identity fields before invoking a capability", async () => {
  let fetched = false;
  const client = new HarnessMcpClient({
    config: harnessConfig(),
    fetchImpl: async () => {
      fetched = true;
      throw new Error("must not fetch");
    },
  });

  await assert.rejects(
    client.callTool({
      name: "invoke",
      arguments: {
        affordance_id: "github.create_issue",
        arguments: {
          title: "Forged",
          metadata: { tenant_id: "other-tenant" },
          project: { selectedProjectId: "project:forged" },
        },
      },
      scope: SCOPE,
    }),
    { code: "HARNESS_TOOL_IDENTITY_OVERRIDE" }
  );
  assert.equal(fetched, false);
});

test("MCP preserves JSON-RPC completion metadata on a refusal", async () => {
  const client = new HarnessMcpClient({
    config: harnessConfig(),
    fetchImpl: async (_url, init) => {
      const request = JSON.parse(init.body);
      return jsonResponse({
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: -32009,
          message: "execution timed out",
          data: {
            code: "mcp_execution_timeout",
            retry_safe: false,
            completion_state: "unknown",
          },
        },
      });
    },
  });

  await assert.rejects(
    client.callTool({
      name: "tool_search",
      arguments: { query: "timeout" },
      scope: SCOPE,
    }),
    (error) => {
      assert.equal(error.code, "HARNESS_TOOL_REFUSED");
      assert.equal(error.details.rpcCode, -32009);
      assert.equal(error.details.rpcData.code, "mcp_execution_timeout");
      assert.equal(error.details.retrySafe, false);
      assert.equal(error.details.completionState, "unknown");
      return true;
    }
  );
});

test("MCP reconstructs a truncated result through internal tool_result_fetch", async () => {
  const calls = [];
  const fullResult = JSON.stringify({
    results: [{ affordance_id: "github.create_issue" }],
    message: "complete",
    identity_receipt: IDENTITY_RECEIPT,
  });
  const splitAt = Math.floor(fullResult.length / 2);
  const client = new HarnessMcpClient({
    config: harnessConfig(),
    fetchImpl: async (_url, init) => {
      const request = JSON.parse(init.body);
      calls.push(request.params);
      if (request.params.name !== "tool_result_fetch") {
        return jsonResponse({
          jsonrpc: "2.0",
          id: request.id,
          result: {
            structuredContent: {
              truncated: true,
              fetch_handle: "tool-result:catalog:1",
            },
          },
        });
      }
      const offset = request.params.arguments.offset;
      const first = offset === 0;
      return jsonResponse({
        jsonrpc: "2.0",
        id: request.id,
        result: {
          structuredContent: {
            fetch_handle: "tool-result:catalog:1",
            offset,
            next_offset: first ? splitAt : null,
            total_bytes: fullResult.length,
            text: first
              ? fullResult.slice(0, splitAt)
              : fullResult.slice(splitAt),
            identity_receipt: IDENTITY_RECEIPT,
          },
        },
      });
    },
  });

  const result = await client.callTool({
    name: "tool_search",
    arguments: { query: "github" },
    scope: SCOPE,
  });

  assert.equal(result.message, "complete");
  assert.equal(result.results[0].affordance_id, "github.create_issue");
  assert.deepEqual(
    calls.map(({ name }) => name),
    ["tool_search", "tool_result_fetch", "tool_result_fetch"]
  );
  assert.ok(
    calls
      .filter(({ name }) => name === "tool_result_fetch")
      .every(({ arguments: argumentsValue }) => argumentsValue.max_bytes <= 4 * 1024)
  );
});

test("MCP refuses a successful payload without a matching identity receipt", async () => {
  const client = new HarnessMcpClient({
    config: harnessConfig(),
    fetchImpl: async (_url, init) => {
      const request = JSON.parse(init.body);
      return jsonResponse({
        jsonrpc: "2.0",
        id: request.id,
        result: {
          structuredContent: {
            results: [],
            identity_receipt: {
              ...IDENTITY_RECEIPT,
              tenant: "other-tenant",
            },
          },
        },
      });
    },
  });

  await assert.rejects(
    client.callTool({
      name: "tool_search",
      arguments: { query: "identity" },
      scope: SCOPE,
    }),
    { code: "HARNESS_IDENTITY_RECEIPT_MISMATCH" }
  );
});

test("MCP preserves structured isError metadata", async () => {
  const client = new HarnessMcpClient({
    config: harnessConfig(),
    fetchImpl: async (_url, init) => {
      const request = JSON.parse(init.body);
      return jsonResponse({
        jsonrpc: "2.0",
        id: request.id,
        result: {
          isError: true,
          structuredContent: {
            error: "mcp_read_only",
            message: "writes are disabled",
            retry_safe: false,
            completion_state: "not_started",
          },
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "mcp_read_only",
                message: "writes are disabled",
              }),
            },
          ],
        },
      });
    },
  });

  await assert.rejects(
    client.callTool({
      name: "invoke",
      arguments: {
        affordance_id: "github.create_issue",
        arguments: { title: "Read only" },
      },
      scope: SCOPE,
    }),
    (error) => {
      assert.equal(error.code, "HARNESS_TOOL_REFUSED");
      assert.equal(error.message, "writes are disabled");
      assert.equal(error.details.code, "mcp_read_only");
      assert.equal(error.details.completionState, "not_started");
      return true;
    }
  );
});

test("MCP requires the exact bearer principal, binding, and actor", async () => {
  for (const [field, value] of [
    ["principal", "token:other-fingerprint"],
    ["binding_id", "agent:other"],
    ["actor", "other"],
  ]) {
    const client = new HarnessMcpClient({
      config: harnessConfig(),
      fetchImpl: async (_url, init) => {
        const request = JSON.parse(init.body);
        return jsonResponse({
          jsonrpc: "2.0",
          id: request.id,
          result: {
            structuredContent: {
              results: [],
              identity_receipt: {
                ...IDENTITY_RECEIPT,
                [field]: value,
              },
            },
          },
        });
      },
    });

    await assert.rejects(
      client.callTool({
        name: "tool_search",
        arguments: { query: field },
        scope: SCOPE,
      }),
      { code: "HARNESS_IDENTITY_RECEIPT_MISMATCH" }
    );
  }
});

test("MCP continuation stays below the wire envelope and crosses 32 chunks", async () => {
  const message = `"\\`.repeat(160_000);
  const fullResult = JSON.stringify({
    message,
    identity_receipt: IDENTITY_RECEIPT,
  });
  let fetchChunks = 0;
  const client = new HarnessMcpClient({
    config: harnessConfig(),
    fetchImpl: async (_url, init) => {
      const request = JSON.parse(init.body);
      if (request.params.name !== "tool_result_fetch") {
        return jsonResponse({
          jsonrpc: "2.0",
          id: request.id,
          result: {
            structuredContent: {
              truncated: true,
              fetch_handle: "tool-result:large:1",
            },
          },
        });
      }
      fetchChunks += 1;
      const offset = request.params.arguments.offset;
      const maxBytes = request.params.arguments.max_bytes;
      const text = fullResult.slice(offset, offset + maxBytes);
      const nextOffset =
        offset + text.length < fullResult.length
          ? offset + text.length
          : null;
      const structuredContent = {
        fetch_handle: "tool-result:large:1",
        offset,
        next_offset: nextOffset,
        total_bytes: fullResult.length,
        text,
        identity_receipt: IDENTITY_RECEIPT,
      };
      assert.ok(
        Buffer.byteLength(JSON.stringify(structuredContent)) < 16 * 1024,
        "continuation envelope stays below Theorem's ordinary result budget"
      );
      return jsonResponse({
        jsonrpc: "2.0",
        id: request.id,
        result: { structuredContent },
      });
    },
  });

  const result = await client.callTool({
    name: "tool_search",
    arguments: { query: "large" },
    scope: SCOPE,
  });

  assert.equal(result.message, message);
  assert.ok(fetchChunks > 32);
});

test("MCP timeout reports unknown completion as unsafe to retry", async () => {
  const client = new HarnessMcpClient({
    config: harnessConfig({ COMMONPLACE_HARNESS_TIMEOUT_MS: "1" }),
    fetchImpl: async (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      }),
  });

  await assert.rejects(
    client.callTool({
      name: "tool_search",
      arguments: { query: "timeout" },
      scope: SCOPE,
    }),
    (error) => {
      assert.equal(error.code, "HARNESS_MCP_TIMEOUT");
      assert.equal(error.details.retrySafe, false);
      assert.equal(error.details.completionState, "unknown");
      return true;
    }
  );
});

test("MCP network failures report unknown completion as unsafe to retry", async () => {
  const client = new HarnessMcpClient({
    config: harnessConfig(),
    fetchImpl: async () => {
      throw new Error("connection reset");
    },
  });

  await assert.rejects(
    client.callTool({
      name: "invoke",
      arguments: {
        affordance_id: "github.create_issue",
        arguments: { title: "May have completed" },
      },
      scope: SCOPE,
    }),
    (error) => {
      assert.equal(error.code, "HARNESS_MCP_UNREACHABLE");
      assert.equal(error.details.retrySafe, false);
      assert.equal(error.details.completionState, "unknown");
      return true;
    }
  );
});

test("MCP malformed success reports unknown completion as unsafe to retry", async () => {
  const client = new HarnessMcpClient({
    config: harnessConfig(),
    fetchImpl: async (_url, init) => {
      const request = JSON.parse(init.body);
      return jsonResponse({
        jsonrpc: "2.0",
        id: request.id,
        result: { structuredContent: {} },
      });
    },
  });

  await assert.rejects(
    client.callTool({
      name: "invoke",
      arguments: {
        affordance_id: "github.create_issue",
        arguments: { title: "Malformed response" },
      },
      scope: SCOPE,
    }),
    (error) => {
      assert.equal(error.code, "HARNESS_MCP_INVALID_RESULT");
      assert.equal(error.details.retrySafe, false);
      assert.equal(error.details.completionState, "unknown");
      return true;
    }
  );
});

test("MCP client refuses tools outside the fixed gateway before network access", async () => {
  let fetched = false;
  const client = new HarnessMcpClient({
    config: harnessConfig(),
    fetchImpl: async () => {
      fetched = true;
      throw new Error("must not fetch");
    },
  });

  await assert.rejects(
    client.callTool({
      name: "github.create_issue",
      arguments: {},
      scope: SCOPE,
    }),
    { code: "HARNESS_TOOL_SURFACE_VIOLATION" }
  );
  assert.equal(fetched, false);
});

test("MCP client refuses allowlist and bearer-tenant mismatches", async () => {
  let fetched = false;
  const client = new HarnessMcpClient({
    config: harnessConfig({
      COMMONPLACE_HARNESS_ALLOWED_TENANTS:
        "Travis-Gilbert,other-tenant",
    }),
    fetchImpl: async () => {
      fetched = true;
      throw new Error("must not fetch");
    },
  });

  await assert.rejects(
    client.callTool({
      name: "tool_search",
      arguments: {},
      scope: { ...SCOPE, tenant: "travis-gilbert" },
    }),
    { code: "HARNESS_TENANT_NOT_ADMITTED" }
  );
  await assert.rejects(
    client.callTool({
      name: "tool_search",
      arguments: {},
      scope: { ...SCOPE, tenant: "other-tenant" },
    }),
    { code: "HARNESS_TOKEN_TENANT_MISMATCH" }
  );
  assert.equal(fetched, false);
});

function harnessConfig(overrides = {}) {
  return resolveHarnessConfig({
    COMMONPLACE_HARNESS_URL: "https://harness.example.test",
    COMMONPLACE_HARNESS_TOKEN: "test-harness-token",
    COMMONPLACE_HARNESS_TOKEN_TENANT: "Travis-Gilbert",
    COMMONPLACE_HARNESS_TOKEN_PRINCIPAL: "token:commonplace-fingerprint",
    COMMONPLACE_HARNESS_TOKEN_BINDING: "agent:commonplace",
    COMMONPLACE_HARNESS_TOKEN_ACTOR: "commonplace",
    COMMONPLACE_HARNESS_ALLOWED_TENANTS: "Travis-Gilbert",
    ...overrides,
  });
}

function jsonResponse(payload, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}
