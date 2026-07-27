"use strict";

const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");

const { createApp, secretMatches } = require("../app");
const { IdentityOperationError } = require("../utils/identity/operations");

const INTERNAL_KEY = "internal-test-key-that-is-longer-than-thirty-two-characters";

async function listen(app, t) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

test("constant-time service credential comparison fails closed", () => {
  assert.equal(secretMatches(INTERNAL_KEY, INTERNAL_KEY), true);
  assert.equal(secretMatches(`${INTERNAL_KEY}x`, INTERNAL_KEY), false);
  assert.equal(secretMatches(null, INTERNAL_KEY), false);
});

test("service credential admission rejects derived placeholders precisely", () => {
  for (const placeholder of [
    "change-me-to-a-random-service-secret-before-deploying",
    "replace-with-a-random-service-secret-before-deploying",
    "same-service-secret-used-by-both-peers",
    "set-a-random-secret-with-at-least-32-characters",
  ]) {
    assert.throws(
      () => createApp({ internalKey: placeholder, operations: {} }),
      /non-placeholder value/
    );
  }

  assert.doesNotThrow(() =>
    createApp({
      internalKey:
        "example-company-production-key-with-verified-random-suffix-7D9m",
      operations: {},
    })
  );
});

test("public invite inspection is separate from internal identity routes", async (t) => {
  const calls = [];
  const app = createApp({
    internalKey: INTERNAL_KEY,
    operations: {
      async inspectInvite(code) {
        calls.push(["inspect", code]);
        return { id: "invite-1", codeVisible: false };
      },
      async reconcilePrincipal(principal) {
        calls.push(["reconcile", principal]);
        return { user: { id: "user-1" }, workspaces: [] };
      },
    },
    logger: { error() {} },
  });
  const origin = await listen(app, t);

  const inspected = await fetch(`${origin}/v1/invites/code-1`);
  assert.equal(inspected.status, 200);
  assert.deepEqual(await inspected.json(), {
    invite: { id: "invite-1", codeVisible: false },
  });

  const refused = await fetch(`${origin}/v1/principals/reconcile`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ principal: { subject: "github:1" } }),
  });
  assert.equal(refused.status, 401);
  assert.equal((await refused.json()).error, "internal_auth_refused");

  const admitted = await fetch(`${origin}/v1/principals/reconcile`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${INTERNAL_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ principal: { subject: "github:1" } }),
  });
  assert.equal(admitted.status, 200);
  assert.deepEqual(calls, [
    ["inspect", "code-1"],
    ["reconcile", { subject: "github:1" }],
  ]);
});

test("maps expected domain errors and hides unexpected failures", async (t) => {
  const logs = [];
  const app = createApp({
    internalKey: INTERNAL_KEY,
    operations: {
      async inspectInvite(code) {
        if (code === "expected") {
          throw new IdentityOperationError(
            404,
            "invite_invalid",
            "This invitation is invalid or expired"
          );
        }
        throw Object.assign(new Error("database included sensitive detail"), {
          code: "P2024",
        });
      },
    },
    logger: { error(value) { logs.push(value); } },
  });
  const origin = await listen(app, t);

  const expected = await fetch(`${origin}/v1/invites/expected`);
  assert.equal(expected.status, 404);
  assert.equal((await expected.json()).error, "invite_invalid");

  const unexpected = await fetch(`${origin}/v1/invites/unexpected`);
  assert.equal(unexpected.status, 500);
  const body = await unexpected.json();
  assert.equal(body.error, "identity_server_error");
  assert.equal(JSON.stringify(body).includes("sensitive"), false);
  assert.equal(logs[0].code, "P2024");
});

test("document upload derives request identity inside the authenticated peer", async (t) => {
  const calls = [];
  const principal = {
    subject: "github:42",
    username: "Travis-Gilbert",
    displayName: "Travis Gilbert",
    email: "travis@example.test",
  };
  const app = createApp({
    internalKey: INTERNAL_KEY,
    operations: {},
    requestIdFactory: () => "express-document-request-0001",
    documentIngest: {
      async ingestUpload(input) {
        calls.push(input);
        return {
          correlationId: input.request.id,
          idempotencyKey: "collector:sha256:receipt",
          scopeRef: "workspace:workspace-42",
          receipts: [{ item: { id: "item-1" } }],
        };
      },
    },
    logger: { error() {} },
  });
  const origin = await listen(app, t);
  const response = await fetch(
    `${origin}/v1/workspaces/workspace-42/documents?filename=research.txt`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${INTERNAL_KEY}`,
        "content-type": "text/plain",
        "x-commonplace-correlation-id": "browser-forged-request",
        "x-commonplace-principal": Buffer.from(
          JSON.stringify(principal)
        ).toString("base64url"),
        "x-commonplace-tags": Buffer.from(
          JSON.stringify({ tags: ["research"] })
        ).toString("base64url"),
      },
      body: "A graph-native document.",
    }
  );

  assert.equal(response.status, 201);
  assert.equal((await response.json()).scopeRef, "workspace:workspace-42");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].request.id, "express-document-request-0001");
  assert.equal(calls[0].workspaceId, "workspace-42");
  assert.equal(calls[0].filename, "research.txt");
  assert.equal(calls[0].mediaType, "text/plain");
  assert.equal(calls[0].bytes.toString("utf8"), "A graph-native document.");
  assert.deepEqual(calls[0].tags, ["research"]);
  assert.deepEqual(calls[0].principal, principal);
});

test("document upload outage does not block identity health", async (t) => {
  const app = createApp({
    internalKey: INTERNAL_KEY,
    operations: {},
    logger: { error() {} },
  });
  const origin = await listen(app, t);

  const health = await fetch(`${origin}/healthz`);
  assert.equal(health.status, 200);

  const upload = await fetch(
    `${origin}/v1/workspaces/workspace-42/documents?filename=research.txt`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${INTERNAL_KEY}`,
        "content-type": "text/plain",
      },
      body: "not admitted",
    }
  );
  assert.equal(upload.status, 503);
  assert.equal((await upload.json()).error, "content_ingest_unconfigured");
});
