"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { createShutdownHandler } = require("../../../index");

test("shutdown closes idle connections and disconnects once after drain", async () => {
  const events = [];
  let closeCallback;
  const timerHandle = {
    unref() {
      assert.fail("shutdown grace timer must remain referenced");
    },
  };
  const server = {
    close(callback) {
      events.push("close");
      closeCallback = callback;
    },
    closeAllConnections() {
      events.push("close-all");
    },
    closeIdleConnections() {
      events.push("close-idle");
    },
  };
  const shutdown = createShutdownHandler({
    server,
    async disconnect() {
      events.push("disconnect");
    },
    exit(code) {
      events.push(`exit:${code}`);
    },
    logger: { error() {}, info() {} },
    scheduleTimeout(callback, delay) {
      events.push(`timer:${delay}`);
      return Object.assign(timerHandle, { callback });
    },
    cancelTimeout(handle) {
      assert.equal(handle, timerHandle);
      events.push("timer-cancel");
    },
  });

  const first = shutdown("SIGTERM");
  const repeated = shutdown("SIGINT");
  assert.equal(first, repeated);
  assert.ok(events.indexOf("close") < events.indexOf("close-idle"));

  closeCallback();
  assert.equal(await first, 0);
  assert.equal(events.filter((event) => event === "close").length, 1);
  assert.equal(events.filter((event) => event === "disconnect").length, 1);
  assert.equal(events.includes("close-all"), false);
  assert.ok(events.indexOf("disconnect") < events.indexOf("exit:0"));
});

test("shutdown force-closes active connections before a failed exit", async () => {
  const events = [];
  let forceClose;
  const server = {
    close() {
      events.push("close");
    },
    closeAllConnections() {
      events.push("close-all");
    },
    closeIdleConnections() {
      events.push("close-idle");
    },
  };
  const shutdown = createShutdownHandler({
    server,
    async disconnect() {
      events.push("disconnect");
    },
    exit(code) {
      events.push(`exit:${code}`);
    },
    logger: { error() {}, info() {} },
    graceMs: 25,
    scheduleTimeout(callback, delay) {
      assert.equal(delay, 25);
      forceClose = callback;
      return {
        unref() {
          assert.fail("shutdown grace timer must remain referenced");
        },
      };
    },
    cancelTimeout() {
      events.push("timer-cancel");
    },
  });

  const result = shutdown("SIGTERM");
  forceClose();

  assert.equal(await result, 1);
  assert.deepEqual(events, [
    "close",
    "close-idle",
    "close-all",
    "timer-cancel",
    "exit:1",
  ]);
});
