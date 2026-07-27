"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  HarnessAgentBridge,
  HarnessMcpClient,
  HarnessToolSurface,
  MODEL_TOOL_DEFINITIONS,
  MODEL_TOOL_IDS,
  MODEL_TOOL_NAMES,
  resolveHarnessConfig,
} = require("../../../utils/agents");

const SCOPE = Object.freeze({
  tenant: "Travis-Gilbert",
  principalId: "principal:travis",
  invocationId: "invocation:chat-42",
  workspace: Object.freeze({ id: 42, slug: "research" }),
  user: Object.freeze({ id: 7 }),
  thread: Object.freeze({ id: 11, slug: "ppr-notes" }),
});

test("Harness configuration refuses implicit endpoints, credentials, and tenants", () => {
  assert.throws(() => resolveHarnessConfig({}), {
    code: "HARNESS_CONFIGURATION_INVALID",
  });
  assert.throws(
    () =>
      resolveHarnessConfig({
        COMMONPLACE_HARNESS_URL: "https://harness.example.test",
        COMMONPLACE_HARNESS_ALLOWED_TENANTS: "Travis-Gilbert",
      }),
    { code: "HARNESS_CONFIGURATION_INVALID" }
  );
  assert.throws(
    () =>
      resolveHarnessConfig({
        COMMONPLACE_HARNESS_URL: "https://harness.example.test",
        COMMONPLACE_HARNESS_TOKEN: "test-token",
        COMMONPLACE_HARNESS_ALLOWED_TENANTS: "Travis-Gilbert",
      }),
    { code: "HARNESS_CONFIGURATION_INVALID" }
  );
  assert.throws(
    () =>
      resolveHarnessConfig({
        NODE_ENV: "production",
        COMMONPLACE_HARNESS_URL: "http://127.0.0.1:8380",
        COMMONPLACE_HARNESS_TOKEN: "test-token",
        COMMONPLACE_HARNESS_TOKEN_TENANT: "Travis-Gilbert",
        COMMONPLACE_HARNESS_ALLOWED_TENANTS: "Travis-Gilbert",
        COMMONPLACE_HARNESS_ALLOW_INSECURE_LOCAL: "1",
      }),
    { code: "HARNESS_CONFIGURATION_INVALID" }
  );

  const config = resolveHarnessConfig({
    COMMONPLACE_HARNESS_URL: "https://harness.example.test/mcp/",
    COMMONPLACE_HARNESS_TOKEN: "test-token",
    COMMONPLACE_HARNESS_TOKEN_TENANT: "Travis-Gilbert",
    COMMONPLACE_HARNESS_TOKEN_PRINCIPAL: "token:commonplace-fingerprint",
    COMMONPLACE_HARNESS_TOKEN_BINDING: "agent:commonplace",
    COMMONPLACE_HARNESS_TOKEN_ACTOR: "commonplace",
    COMMONPLACE_HARNESS_ALLOWED_TENANTS:
      "Travis-Gilbert, other-tenant, Travis-Gilbert",
  });

  assert.equal(config.endpoint, "https://harness.example.test/mcp");
  assert.deepEqual(config.allowedTenants, ["Travis-Gilbert", "other-tenant"]);
  assert.equal(config.maxCatalogPageSize, 10);
  assert.equal(config.maxCatalogWindow, 100);
  assert.equal(config.tokenTenant, "Travis-Gilbert");
  assert.equal(config.tokenPrincipal, "token:commonplace-fingerprint");
  assert.equal(config.tokenBinding, "agent:commonplace");
  assert.equal(config.tokenActor, "commonplace");
});

test("explicit local Harness mode admits WHATWG IPv6 loopback", () => {
  const config = resolveHarnessConfig({
    COMMONPLACE_HARNESS_URL: "http://[::1]:8380",
    COMMONPLACE_HARNESS_ALLOW_INSECURE_LOCAL: "1",
    COMMONPLACE_HARNESS_ALLOW_UNAUTHENTICATED_LOCAL: "1",
    COMMONPLACE_HARNESS_ALLOWED_TENANTS: "Travis-Gilbert",
  });

  assert.equal(config.endpoint, "http://[::1]:8380/mcp");
});

test("the model surface stays fixed at three affordances for a 108-tool tenant", async () => {
  const catalog = Array.from({ length: 108 }, (_, index) => ({
    affordance_id: `tool-${index + 1}`,
    name: `Tool ${index + 1}`,
    one_line_description: `Capability ${index + 1}`,
    input_schema: { type: "object", secret: true },
  }));
  const calls = [];
  const surface = new HarnessToolSurface({
    client: {
      async callTool(request) {
        calls.push(request);
        return {
          results: catalog.slice(0, request.arguments.k),
        };
      },
    },
    policy: { async authorize() { return true; } },
    maxPageSize: 20,
    maxWindow: 100,
  });

  assert.deepEqual(
    surface.definitions().map(({ name }) => name),
    MODEL_TOOL_NAMES
  );
  assert.deepEqual(
    surface.definitions().map(({ id }) => id),
    MODEL_TOOL_IDS
  );
  assert.equal(surface.definitions(), MODEL_TOOL_DEFINITIONS);
  assert.equal(Object.isFrozen(surface.definitions()), true);

  const page = await surface.execute(
    "catalog",
    { query: "capability", pageSize: 20 },
    SCOPE
  );

  assert.equal(page.results.length, 20);
  assert.equal(page.page.boundedWindow, 100);
  assert.equal(typeof page.page.nextCursor, "string");
  assert.equal(calls[0].name, "tool_search");
  assert.equal(calls[0].arguments.k, 100);
  assert.equal(page.results[0].description, "Capability 1");
  assert.equal("inputSchema" in page.results[0], false);
  assert.equal("input_schema" in page.results[0], false);
});

test("explicit unauthenticated local mode retains scope provenance", async () => {
  const config = resolveHarnessConfig({
    COMMONPLACE_HARNESS_URL: "http://127.0.0.1:8380",
    COMMONPLACE_HARNESS_ALLOW_INSECURE_LOCAL: "1",
    COMMONPLACE_HARNESS_ALLOW_UNAUTHENTICATED_LOCAL: "1",
    COMMONPLACE_HARNESS_ALLOWED_TENANTS: "Travis-Gilbert",
  });
  const client = new HarnessMcpClient({
    config,
    fetchImpl: async (_url, init) => {
      const request = JSON.parse(init.body);
      const structuredContent =
        request.params.name === "describe"
          ? {
              affordance_id: "local.echo",
              server_id: "local",
              tool_name: "echo",
              input_schema: { type: "object" },
            }
          : {
              planned: {
                affordance_id: "local.echo",
                server_id: "local",
                tool_name: "echo",
              },
              recorded: { node_id: "local:receipt:1" },
            };
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: request.id,
          result: { structuredContent },
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    },
  });
  const surface = new HarnessToolSurface({
    client,
    policy: { async authorize() { return true; } },
  });

  const result = await surface.execute(
    "invoke",
    { capabilityId: "local.echo", arguments: { text: "hello" } },
    SCOPE,
    { toolCallId: "test:local-echo" }
  );

  assert.equal(result.provenance.tenant, "Travis-Gilbert");
  assert.equal(result.provenance.authenticated, false);
  assert.equal(result.provenance.principal, null);
});

test("suppression is applied to catalog and describe, then rechecked before invoke", async () => {
  const suppressed = new Set();
  const calls = [];
  const surface = new HarnessToolSurface({
    client: {
      async callTool(request) {
        calls.push(request.name);
        if (request.name === "tool_search") {
          return {
            results: [
              {
                affordance_id: "github.create_issue",
                server_id: "github",
                tool_name: "create_issue",
                name: "Create issue",
              },
            ],
          };
        }
        if (request.name === "describe") {
          return {
            affordance_id: "github.create_issue",
            server_id: "github",
            tool_name: "create_issue",
            input_schema: { type: "object" },
          };
        }
        return {
          fired: true,
          planned: {
            affordance_id: "github.create_issue",
            server_id: "github",
            tool_name: "create_issue",
          },
          recorded: { node_id: "gateway:invocation:1" },
        };
      },
    },
    policy: {
      async authorize({ capability }) {
        return !suppressed.has(capability.id);
      },
    },
  });

  const discovered = await surface.execute(
    "@@mcp_catalog",
    { query: "github issue" },
    SCOPE
  );
  assert.deepEqual(
    discovered.results.map(({ id }) => id),
    ["github.create_issue"]
  );

  suppressed.add("github.create_issue");
  const filtered = await surface.execute(
    "catalog",
    { query: "github issue" },
    SCOPE
  );
  assert.deepEqual(filtered.results, []);
  await assert.rejects(
    surface.execute(
      "describe",
      { capabilityId: "github.create_issue" },
      SCOPE
    ),
    { code: "HARNESS_CAPABILITY_SUPPRESSED" }
  );

  const invokeCallsBefore = calls.filter((name) => name === "invoke").length;
  const describeCallsBefore = calls.filter((name) => name === "describe").length;
  await assert.rejects(
    surface.execute(
      "invoke",
      {
        capabilityId: "github.create_issue",
        arguments: { title: "Refused after discovery" },
      },
      SCOPE,
      { toolCallId: "test:suppressed-invoke" }
    ),
    { code: "HARNESS_CAPABILITY_SUPPRESSED" }
  );
  assert.equal(
    calls.filter((name) => name === "invoke").length,
    invokeCallsBefore
  );
  assert.equal(
    calls.filter((name) => name === "describe").length,
    describeCallsBefore
  );
});

test("catalog pagination advances past a fully suppressed prefix", async () => {
  const catalog = Array.from({ length: 30 }, (_, index) => ({
    affordance_id: `tool-${index + 1}`,
    name: `Tool ${index + 1}`,
  }));
  const surface = new HarnessToolSurface({
    client: {
      async callTool({ arguments: argumentsValue }) {
        return { results: catalog.slice(0, argumentsValue.k) };
      },
    },
    policy: {
      async authorize({ capability }) {
        return Number(capability.id.split("-")[1]) > 20;
      },
    },
    maxPageSize: 5,
    maxWindow: 30,
  });

  const page = await surface.execute(
    "catalog",
    { query: "allowed tail", pageSize: 5 },
    SCOPE
  );

  assert.deepEqual(
    page.results.map(({ id }) => id),
    ["tool-21", "tool-22", "tool-23", "tool-24", "tool-25"]
  );
  assert.equal(typeof page.page.nextCursor, "string");
});

test("catalog pages use one stable bounded upstream window", async () => {
  const calls = [];
  const catalog = Array.from({ length: 8 }, (_, index) => ({
    affordance_id: `stable-${index + 1}`,
    name: `Stable ${index + 1}`,
  }));
  const surface = new HarnessToolSurface({
    client: {
      async callTool(request) {
        calls.push(request.arguments.k);
        return { results: catalog };
      },
    },
    policy: { async authorize() { return true; } },
    maxPageSize: 3,
    maxWindow: 100,
  });

  const catalogDefinition = surface
    .definitions()
    .find(({ name }) => name === "catalog");
  assert.equal(
    catalogDefinition.inputSchema.properties.pageSize.maximum,
    3
  );
  await assert.rejects(
    surface.execute(
      "catalog",
      { query: "stable", pageSize: 4 },
      SCOPE
    ),
    { code: "HARNESS_TOOL_ARGUMENTS_INVALID" }
  );

  const first = await surface.execute(
    "catalog",
    { query: "stable", pageSize: 3 },
    SCOPE
  );
  const second = await surface.execute(
    "catalog",
    {
      query: "stable",
      pageSize: 3,
      cursor: first.page.nextCursor,
    },
    SCOPE
  );

  assert.deepEqual(calls, [100, 100]);
  assert.deepEqual(
    first.results.map(({ id }) => id),
    ["stable-1", "stable-2", "stable-3"]
  );
  assert.deepEqual(
    second.results.map(({ id }) => id),
    ["stable-4", "stable-5", "stable-6"]
  );
});

test("invoke refuses nested identity before describe or invoke", async () => {
  const calls = [];
  const surface = new HarnessToolSurface({
    client: {
      async callTool(request) {
        calls.push(request);
        return {};
      },
    },
    policy: { async authorize() { return true; } },
  });

  await assert.rejects(
    surface.execute(
      "invoke",
      {
        capabilityId: "github.create_issue",
        arguments: {
          title: "Forged identity",
          metadata: { workspaceId: "workspace-other" },
        },
      },
      SCOPE,
      { toolCallId: "test:nested-identity" }
    ),
    { code: "HARNESS_TOOL_IDENTITY_OVERRIDE" }
  );
  assert.equal(calls.length, 0);
});

test("invoke idempotency binds retry identity and execution options", async () => {
  const idempotencyKeys = [];
  let interruptFirstInvoke = true;
  const surface = new HarnessToolSurface({
    client: {
      async callTool(request) {
        if (request.name === "describe") {
          return {
            affordance_id: "github.create_issue",
            server_id: "github",
            tool_name: "create_issue",
            input_schema: { type: "object" },
          };
        }
        idempotencyKeys.push(request.arguments.idempotency_key);
        if (interruptFirstInvoke) {
          interruptFirstInvoke = false;
          const error = new Error("retryable transport interruption");
          error.details = {
            retrySafe: true,
            completionState: "not_started",
          };
          throw error;
        }
        return {
          planned: {
            affordance_id: "github.create_issue",
            server_id: "github",
            tool_name: "create_issue",
          },
          recorded: {
            node_id: `gateway:invocation:${idempotencyKeys.length}`,
          },
          identity_receipt: {
            tenant: "Travis-Gilbert",
          },
        };
      },
    },
    policy: { async authorize() { return true; } },
  });
  const invokeArguments = {
    capabilityId: "github.create_issue",
    arguments: { title: "Same payload" },
  };

  const bridge = new HarnessAgentBridge({
    contextSource: emptyContextSource(),
    persistence: {
      async beginTurn() {
        return { id: "chat-attempt-identity" };
      },
      async recordToolInvocation() {},
      async commitTurn() {},
      async failTurn() {},
    },
    receiptVerifier: verifiedReceipt(),
    runner: {
      async runTurn({ callTool }) {
        await assert.rejects(
          callTool({
            name: "invoke",
            arguments: invokeArguments,
          }),
          { code: "HARNESS_TOOL_CALL_ID_INVALID" }
        );
        await assert.rejects(
          callTool({
            name: "invoke",
            arguments: invokeArguments,
            toolCallId: "provider-call-retry",
          }),
          /retryable transport interruption/
        );
        await callTool({
          name: "invoke",
          arguments: invokeArguments,
          toolCallId: "provider-call-retry",
        });
        await callTool({
          name: "invoke",
          arguments: invokeArguments,
          toolCallId: "provider-call-2",
        });
        await callTool({
          name: "invoke",
          arguments: invokeArguments,
          toolCallId: "provider-call-3",
        });
        await callTool({
          name: "invoke",
          arguments: { ...invokeArguments, dryRun: true },
          toolCallId: "provider-call-mode",
        });
        await callTool({
          name: "invoke",
          arguments: { ...invokeArguments, dryRun: false },
          toolCallId: "provider-call-mode",
        });
        await callTool({
          name: "invoke",
          arguments: { ...invokeArguments, taskType: "research" },
          toolCallId: "provider-call-task",
        });
        await callTool({
          name: "invoke",
          arguments: { ...invokeArguments, taskType: "synthesis" },
          toolCallId: "provider-call-task",
        });
        return {
          text: "Attempts complete.",
          metrics: {},
          runReceipt: { run_id: "run:attempt-identity" },
        };
      },
    },
    toolSurface: surface,
  });

  await bridge.runTurn({
    ...SCOPE,
    prompt: "Exercise attempt identity",
    attachments: [],
  });

  assert.equal(idempotencyKeys.length, 8);
  assert.equal(idempotencyKeys[0], idempotencyKeys[1]);
  assert.notEqual(idempotencyKeys[0], idempotencyKeys[2]);
  assert.notEqual(idempotencyKeys[2], idempotencyKeys[3]);
  assert.notEqual(idempotencyKeys[4], idempotencyKeys[5]);
  assert.notEqual(idempotencyKeys[6], idempotencyKeys[7]);
});

test("a turn preserves scoped context, attachments, metrics, citations, and persistence", async () => {
  const observed = {
    contextCalls: [],
    persistence: [],
    runnerRequest: null,
  };
  const contextSource = {
    async loadHistory(scope, options) {
      observed.contextCalls.push(["history", scope, options]);
      return [{ prompt: "Earlier question", response: "Earlier answer" }];
    },
    async loadParsedFiles(scope) {
      observed.contextCalls.push(["parsed", scope]);
      return [
        {
          id: "parsed-1",
          title: "Parsed file",
          pageContent: "Parsed context",
          source: "upload://parsed-1",
        },
      ];
    },
    async loadPinnedDocuments(scope) {
      observed.contextCalls.push(["pinned", scope]);
      return [
        {
          id: "pinned-1",
          title: "Pinned document",
          pageContent: "Pinned context",
          metadata: { source: "workspace://pinned-1" },
        },
      ];
    },
    async loadWorkspaceRagMemory(scope, input) {
      observed.contextCalls.push(["workspace-memory", scope, input]);
      return [{ id: "rag-1", content: "Workspace RAG memory" }];
    },
    async loadUserMemories(scope, input) {
      observed.contextCalls.push(["user-memory", scope, input]);
      return {
        global: [{ id: "global-1", content: "Global preference" }],
        workspace: [{ id: "workspace-1", content: "Workspace preference" }],
      };
    },
  };
  const persistence = {
    async beginTurn(record) {
      observed.persistence.push(["begin", record]);
      return { id: "chat-1" };
    },
    async commitTurn(record) {
      observed.persistence.push(["commit", record]);
    },
    async recordToolInvocation(record) {
      observed.persistence.push(["tool", record]);
    },
    async failTurn(record) {
      observed.persistence.push(["fail", record]);
    },
  };
  const surface = new HarnessToolSurface({
    client: {
      async callTool({ name }) {
        if (name === "describe") {
          return {
            affordance_id: "github.create_issue",
            server_id: "github",
            tool_name: "create_issue",
            input_schema: { type: "object" },
          };
        }
        if (name === "invoke") {
          return {
            fired: true,
            planned: {
              affordance_id: "github.create_issue",
              server_id: "github",
              tool_name: "create_issue",
            },
            outcome: { is_error: false, text: "created" },
            recorded: { node_id: "gateway:invocation:1" },
            identity_receipt: {
              tenant: "Travis-Gilbert",
              principal: "token:commonplace-fingerprint",
              binding_id: "agent:commonplace",
              actor: "commonplace",
            },
            sources: [
              {
                id: "tool-source",
                title: "Tool source",
                text: "Invocation evidence",
                source: "harness://receipt",
              },
            ],
          };
        }
        return { results: [] };
      },
    },
    policy: { async authorize() { return true; } },
  });
  const runner = {
    async runTurn(request) {
      observed.runnerRequest = request;
      await request.callTool({
        name: "invoke",
        toolCallId: "provider-call:bridge-proof",
        arguments: {
          capabilityId: "github.create_issue",
          arguments: { title: "Bridge proof" },
        },
      });
      return {
        text: "The issue was created.",
        citations: [
          {
            id: "tool-source",
            title: "Tool source",
            text: "Invocation evidence",
            chunkSource: "harness://receipt",
          },
        ],
        metrics: {
          prompt_tokens: 30,
          completion_tokens: 8,
          total_tokens: 38,
        },
        outputs: [{ type: "record", payload: { id: "issue-1" } }],
        clarifyingQuestions: [{ id: "survey-1", answers: ["confirmed"] }],
        runReceipt: {
          run_id: "run:chat-1",
          binding_id: "agent:commonplace",
        },
      };
    },
  };
  const bridge = new HarnessAgentBridge({
    contextSource,
    persistence,
    receiptVerifier: verifiedReceipt(),
    runner,
    toolSurface: surface,
  });
  const attachments = [
    {
      name: "diagram.png",
      mime: "image/png",
      contentString: "data:image/png;base64,dGVzdA==",
    },
  ];

  const response = await bridge.runTurn({
    ...SCOPE,
    prompt: "@agent Create the issue",
    attachments,
  });

  assert.equal(response.turnId, "chat-1");
  assert.equal(response.text, "The issue was created.");
  assert.equal(response.runReceipt.run_id, "run:chat-1");
  assert.deepEqual(
    observed.runnerRequest.tools.map(({ name }) => name),
    ["catalog", "describe", "invoke"]
  );
  assert.deepEqual(observed.runnerRequest.attachments, attachments);
  assert.equal(observed.runnerRequest.citationCandidates.length, 2);
  assert.equal("citations" in observed.runnerRequest, false);
  assert.deepEqual(observed.runnerRequest.documents.parsedFiles[0].id, "parsed-1");
  assert.deepEqual(observed.runnerRequest.memory.user.global[0].id, "global-1");

  const parsedScope = observed.contextCalls.find(([name]) => name === "parsed")[1];
  assert.equal(parsedScope.workspaceId, 42);
  assert.equal(parsedScope.userId, 7);
  assert.equal(parsedScope.threadId, 11);
  const pinnedScope = observed.contextCalls.find(([name]) => name === "pinned")[1];
  assert.equal(pinnedScope.workspaceId, 42);
  assert.equal(pinnedScope.userId, null);
  assert.equal(pinnedScope.threadId, null);

  assert.deepEqual(
    observed.persistence.map(([operation]) => operation),
    ["begin", "tool", "commit"]
  );
  const committed = observed.persistence[2][1];
  assert.equal(committed.prompt, "Create the issue");
  assert.deepEqual(committed.response.attachments, attachments);
  assert.equal(committed.response.metrics.total_tokens, 38);
  assert.equal(committed.response.sources.length, 1);
  assert.equal(committed.response.toolInvocations.length, 1);
  assert.equal(
    committed.response.toolInvocations[0].provenance.capabilityId,
    "github.create_issue"
  );
  assert.equal(
    committed.response.toolInvocations[0].provenance.principal,
    "token:commonplace-fingerprint"
  );
  assert.equal(
    committed.response.toolInvocations[0].provenance.bindingId,
    "agent:commonplace"
  );
  assert.equal(
    committed.response.toolInvocations[0].provenance.actor,
    "commonplace"
  );
  assert.equal(
    committed.response.toolInvocations[0].provenance.authenticated,
    true
  );
  assert.equal(
    committed.response.toolInvocations[0].receipt.recorded.node_id,
    "gateway:invocation:1"
  );
});

test("scope rejects conflicting entity and scalar identities", async () => {
  const bridge = new HarnessAgentBridge({
    contextSource: emptyContextSource(),
    persistence: {
      async beginTurn() {
        assert.fail("invalid scope must fail before persistence");
      },
      async commitTurn() {},
      async recordToolInvocation() {},
      async failTurn() {},
    },
    receiptVerifier: verifiedReceipt(),
    runner: {
      async runTurn() {
        assert.fail("invalid scope must fail before the runner");
      },
    },
    toolSurface: {
      definitions() {
        return MODEL_TOOL_DEFINITIONS;
      },
      async execute() {
        return {};
      },
    },
  });

  await assert.rejects(
    bridge.runTurn({
      ...SCOPE,
      userId: 8,
      prompt: "Conflicting scope",
      attachments: [],
    }),
    { code: "HARNESS_SCOPE_INVALID" }
  );
});

test("memory loaders fail closed when scope lanes are ambiguous", async () => {
  const contextSource = emptyContextSource();
  contextSource.loadUserMemories = async () => [{ content: "unscoped" }];
  const bridge = new HarnessAgentBridge({
    contextSource,
    persistence: {
      async beginTurn() {
        return { id: "chat-memory-invalid" };
      },
      async commitTurn() {
        assert.fail("ambiguous memory must not commit");
      },
      async recordToolInvocation() {},
      async failTurn() {},
    },
    receiptVerifier: verifiedReceipt(),
    runner: {
      async runTurn() {
        assert.fail("ambiguous memory must not reach the runner");
      },
    },
    toolSurface: {
      definitions() {
        return MODEL_TOOL_DEFINITIONS;
      },
      async execute() {
        return {};
      },
    },
  });

  await assert.rejects(
    bridge.runTurn({
      ...SCOPE,
      prompt: "Load memory",
      attachments: [],
    }),
    { code: "HARNESS_CONTEXT_INVALID" }
  );
});

test("a tool receipt cannot substitute for the chat turn run receipt", async () => {
  const failed = [];
  const bridge = new HarnessAgentBridge({
    contextSource: emptyContextSource(),
    persistence: {
      async beginTurn() {
        return { id: "chat-failed" };
      },
      async commitTurn() {
        assert.fail("invalid turn must not commit");
      },
      async recordToolInvocation() {},
      async failTurn(record) {
        failed.push(record);
      },
    },
    receiptVerifier: verifiedReceipt(),
    runner: {
      async runTurn() {
        return {
          text: "Tool completed.",
          metrics: {},
          toolReceipt: { id: "tool-receipt-only" },
        };
      },
    },
    toolSurface: {
      definitions() {
        return MODEL_TOOL_DEFINITIONS;
      },
      async execute() {
        return {};
      },
    },
  });

  await assert.rejects(
    bridge.runTurn({
      ...SCOPE,
      prompt: "Run without a receipt",
      attachments: [],
    }),
    { code: "HARNESS_RUN_RECEIPT_MISSING" }
  );
  assert.equal(failed.length, 1);
  assert.equal(failed[0].error.code, "HARNESS_RUN_RECEIPT_MISSING");
  assert.deepEqual(failed[0].toolInvocations, []);
});

test("a run receipt must pass the injected verifier", async () => {
  const failed = [];
  const bridge = new HarnessAgentBridge({
    contextSource: emptyContextSource(),
    persistence: {
      async beginTurn() {
        return { id: "chat-unverified" };
      },
      async commitTurn() {
        assert.fail("unverified turn must not commit");
      },
      async recordToolInvocation() {},
      async failTurn(record) {
        failed.push(record);
      },
    },
    receiptVerifier: {
      async verifyRunReceipt() {
        return { verified: false };
      },
    },
    runner: {
      async runTurn() {
        return {
          text: "Unverified.",
          metrics: {},
          runReceipt: { run_id: "run:unverified" },
        };
      },
    },
    toolSurface: {
      definitions() {
        return MODEL_TOOL_DEFINITIONS;
      },
      async execute() {
        return {};
      },
    },
  });

  await assert.rejects(
    bridge.runTurn({
      ...SCOPE,
      prompt: "Verify this run",
      attachments: [],
    }),
    { code: "HARNESS_RUN_RECEIPT_UNVERIFIED" }
  );
  assert.equal(failed[0].error.code, "HARNESS_RUN_RECEIPT_UNVERIFIED");
});

test("failed turns preserve completed tool receipts for audit", async () => {
  const failed = [];
  const bridge = new HarnessAgentBridge({
    contextSource: emptyContextSource(),
    persistence: {
      async beginTurn() {
        return { id: "chat-tool-failed" };
      },
      async commitTurn() {
        assert.fail("failed runner must not commit");
      },
      async recordToolInvocation() {},
      async failTurn(record) {
        failed.push(record);
      },
    },
    receiptVerifier: verifiedReceipt(),
    runner: {
      async runTurn({ callTool }) {
        await callTool({
          name: "invoke",
          arguments: {},
          toolCallId: "provider-call:failed-turn",
        });
        throw new Error("runner failed after tool completion");
      },
    },
    toolSurface: {
      definitions() {
        return MODEL_TOOL_DEFINITIONS;
      },
      async execute() {
        return {
          provenance: { capabilityId: "github.create_issue" },
          receipt: { recorded: { node_id: "gateway:invocation:preserved" } },
        };
      },
    },
  });

  await assert.rejects(
    bridge.runTurn({
      ...SCOPE,
      prompt: "Fail after invoking",
      attachments: [],
    }),
    /runner failed/
  );
  assert.equal(
    failed[0].toolInvocations[0].receipt.recorded.node_id,
    "gateway:invocation:preserved"
  );
});

test("runner citations must match admitted context or tool provenance", async () => {
  const bridge = new HarnessAgentBridge({
    contextSource: emptyContextSource(),
    persistence: {
      async beginTurn() {
        return { id: "chat-citation-forged" };
      },
      async recordToolInvocation() {},
      async commitTurn() {
        assert.fail("forged citation must not commit");
      },
      async failTurn() {},
    },
    receiptVerifier: verifiedReceipt(),
    runner: {
      async runTurn() {
        return {
          text: "Fabricated.",
          metrics: {},
          runReceipt: { run_id: "run:citation-forged" },
          citations: [
            {
              id: "not-loaded",
              text: "Invented evidence",
              chunkSource: "fixture://invented",
            },
          ],
        };
      },
    },
    toolSurface: {
      definitions() {
        return MODEL_TOOL_DEFINITIONS;
      },
      async execute() {
        return {};
      },
    },
  });

  await assert.rejects(
    bridge.runTurn({
      ...SCOPE,
      prompt: "Invent a source",
      attachments: [],
    }),
    { code: "HARNESS_CITATION_UNVERIFIED" }
  );
});

test("runner citation fields are replaced by canonical admitted evidence", async () => {
  let committed = null;
  const contextSource = emptyContextSource();
  contextSource.loadParsedFiles = async () => [
    {
      id: "canonical-1",
      title: "Canonical title",
      pageContent: "Canonical evidence text",
      source: "upload://canonical-1",
    },
  ];
  const bridge = new HarnessAgentBridge({
    contextSource,
    persistence: {
      async beginTurn() {
        return { id: "chat-citation-canonical" };
      },
      async recordToolInvocation() {},
      async commitTurn(record) {
        committed = record;
      },
      async failTurn() {},
    },
    receiptVerifier: verifiedReceipt(),
    runner: {
      async runTurn() {
        return {
          text: "Grounded.",
          metrics: {},
          runReceipt: { run_id: "run:citation-canonical" },
          citations: [
            {
              id: "canonical-1",
              title: "Substituted title",
              text: "Fabricated replacement",
              chunkSource: "upload://canonical-1",
            },
          ],
        };
      },
    },
    toolSurface: {
      definitions() {
        return MODEL_TOOL_DEFINITIONS;
      },
      async execute() {
        return {};
      },
    },
  });

  const response = await bridge.runTurn({
    ...SCOPE,
    prompt: "Use the document",
    attachments: [],
  });

  assert.deepEqual(response.sources, [
    {
      id: "canonical-1",
      title: "Canonical title",
      text: "Canonical evidence text",
      chunkSource: "upload://canonical-1",
      contextKind: "parsed-file",
    },
  ]);
  assert.deepEqual(committed.response.sources, response.sources);
});

test("audit persistence failures are surfaced with completion metadata", async () => {
  const bridge = new HarnessAgentBridge({
    contextSource: emptyContextSource(),
    persistence: {
      async beginTurn() {
        return { id: "chat-audit-failed" };
      },
      async recordToolInvocation() {},
      async commitTurn() {
        throw Object.assign(new Error("unknown completion"), {
          code: "HARNESS_TOOL_REFUSED",
          details: {
            retrySafe: false,
            completionState: "unknown",
          },
        });
      },
      async failTurn() {
        throw new Error("audit store unavailable");
      },
    },
    receiptVerifier: verifiedReceipt(),
    runner: {
      async runTurn() {
        return {
          text: "Completed.",
          metrics: {},
          runReceipt: { run_id: "run:audit-failed" },
        };
      },
    },
    toolSurface: {
      definitions() {
        return MODEL_TOOL_DEFINITIONS;
      },
      async execute() {
        return {};
      },
    },
  });

  await assert.rejects(
    bridge.runTurn({
      ...SCOPE,
      prompt: "Persist this turn",
      attachments: [],
    }),
    (error) => {
      assert.equal(error.code, "HARNESS_AUDIT_PERSISTENCE_FAILED");
      assert.equal(error.details.retrySafe, false);
      assert.equal(error.details.completionState, "unknown");
      assert.equal(
        error.details.originalError.details.completionState,
        "unknown"
      );
      assert.equal(error.details.auditError.message, "audit store unavailable");
      return true;
    }
  );
});

function emptyContextSource() {
  return {
    async loadHistory() {
      return [];
    },
    async loadParsedFiles() {
      return [];
    },
    async loadPinnedDocuments() {
      return [];
    },
    async loadWorkspaceRagMemory() {
      return [];
    },
    async loadUserMemories() {
      return { global: [], workspace: [] };
    },
  };
}

function verifiedReceipt() {
  return {
    async verifyRunReceipt() {
      return { verified: true };
    },
  };
}
