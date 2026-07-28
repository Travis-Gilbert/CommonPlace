import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMONPLACE_CAPTURE_CONTRACT_VERSION,
  captureEndpoint,
  createCaptureQueue,
  normalizeCaptureApiBase,
} from "./capture-queue.mjs";

function memoryStorage(initial = []) {
  let entries = structuredClone(initial);
  return {
    async read() {
      return structuredClone(entries);
    },
    async write(next) {
      entries = structuredClone(next);
    },
  };
}

function envelope(clientId = "local-test") {
  return {
    client_id: clientId,
    body: "queued markdown",
    object_type: "note",
    capture_method: "composed",
    source: "pet",
    captured_at: "2026-07-27T20:30:00Z",
    properties: {},
  };
}

test("exports the versioned capture contract", () => {
  assert.equal(
    COMMONPLACE_CAPTURE_CONTRACT_VERSION,
    "commonplace-capture/v1",
  );
});

test("normalizes old full-route settings to the API base", () => {
  assert.equal(
    normalizeCaptureApiBase("https://example.test/ingest/capture"),
    "https://example.test",
  );
  assert.equal(
    normalizeCaptureApiBase("https://example.test/graphql/"),
    "https://example.test",
  );
  assert.equal(
    captureEndpoint("https://example.test/api/"),
    "https://example.test/api/ingest/capture",
  );
  assert.throws(
    () => normalizeCaptureApiBase("not an absolute endpoint"),
    /invalid capture API base/,
  );
});

test("serializes concurrent queue mutations", async () => {
  const storage = memoryStorage();
  const calls = [];
  const queue = createCaptureQueue({
    storage,
    send: async (capture) => {
      calls.push(capture.client_id);
      return { ok: true, receipt: { id: capture.client_id } };
    },
  });

  await Promise.all([
    queue.enqueue(envelope("local-concurrent-first")),
    queue.enqueue(envelope("local-concurrent-second")),
  ]);
  assert.deepEqual(
    (await queue.list()).map((entry) => entry.id),
    ["local-concurrent-first", "local-concurrent-second"],
  );

  await Promise.all([queue.drain(), queue.drain()]);
  assert.deepEqual(calls, [
    "local-concurrent-first",
    "local-concurrent-second",
  ]);
});

test("persists before send and keeps a retryable failure", async () => {
  const storage = memoryStorage();
  const observed = [];
  const queue = createCaptureQueue({
    storage,
    retryBaseMs: 0,
    send: async () => {
      observed.push(await storage.read());
      return { ok: false, retryable: true, error: "offline" };
    },
  });

  await queue.enqueue(envelope());
  const [entry] = await queue.drain();
  assert.equal(observed[0][0].state, "sending");
  assert.equal(entry.state, "kept");
  assert.equal(entry.attempts, 1);
  assert.equal(entry.lastError, "offline");
});

test("does not overtake an older capture during backoff", async () => {
  let currentTime = 100;
  const storage = memoryStorage();
  const calls = [];
  const queue = createCaptureQueue({
    storage,
    retryBaseMs: 1_000,
    now: () => currentTime,
    send: async (capture) => {
      calls.push(capture.client_id);
      return capture.client_id === "local-first"
        ? { ok: false, retryable: true, status: 503 }
        : { ok: true, receipt: { id: "item-second" } };
    },
  });

  await queue.enqueue(envelope("local-first"));
  currentTime += 1;
  await queue.enqueue(envelope("local-second"));
  await queue.drain();
  await queue.drain();
  assert.deepEqual(calls, ["local-first"]);

  currentTime += 1_000;
  await queue.drain();
  assert.deepEqual(calls, ["local-first", "local-first"]);
});

test("drains in order and bounds retries", async () => {
  const storage = memoryStorage();
  const calls = [];
  const queue = createCaptureQueue({
    storage,
    maxAttempts: 2,
    retryBaseMs: 0,
    send: async (capture) => {
      calls.push(capture.client_id);
      if (capture.client_id === "local-first") {
        return { ok: false, retryable: true, status: 503 };
      }
      return { ok: true, receipt: { id: "item-second" } };
    },
  });

  await queue.enqueue(envelope("local-first"));
  await queue.enqueue(envelope("local-second"));
  await queue.drain();
  assert.deepEqual(calls, ["local-first"]);
  const completed = await queue.drain();
  const entries = await queue.list();
  assert.deepEqual(calls, ["local-first", "local-first", "local-second"]);
  assert.equal(entries[0].state, "error");
  assert.equal(entries.length, 1);
  assert.equal(completed[1].state, "sent");
});
