#!/usr/bin/env node
"use strict";

// W05 / AC5: prove the *stateful* agent-runtime product path against the
// live console route -- not just that one SSE document carries every part
// type (agent-runtime-live.cjs already proves that offline-vs-live split),
// but that a real approval request survives a real approve resume, and that
// a cancel dispatches against a session with no open connection.
//
//   node oracles/agent-runtime-stateful-live.cjs                 offline contract check
//   node oracles/agent-runtime-stateful-live.cjs --live          read-only: revalidate the last --seed capture
//   node oracles/agent-runtime-stateful-live.cjs --live --seed   mutating: run a real turn against the live route
//
// Every request the route accepts is a genuine bridge command
// (add-message / permission-response / cancel); `validateBridgeCommands`
// rejects an empty commands array, so there is no side-effect-free request
// this oracle could send. "Read-only for bare --live" therefore means only
// --seed ever talks to the network and spends a real agent turn; bare
// --live re-validates the receipt --seed captured, so it is safe to run
// repeatedly (in CI, in a loop) without starting new turns.
//
// Local-only client state -- branch switching is pure local state and a
// cancel's immediate partial-text preservation applies before any network
// round trip completes (see `action.rs`'s doc comment) -- is proved by the
// Rust crate's own test suite
// (`apps/theoremweb/crates/agent-runtime/src/action.rs`,
// `.../render/surface.rs`). This oracle only has visibility into the wire
// contract an HTTP client would see, not an in-process `ThreadRuntime`, so
// it does not attempt to re-prove what is already pinned there.

const fs = require("node:fs");
const path = require("node:path");

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function partsFromSse(document) {
  return document
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== "[DONE]")
    .map(JSON.parse);
}

const HERE = __dirname;
const FIXTURE = path.join(HERE, "../crates/agent-runtime/fixtures/all-parts.sse");
const RECEIPT_FILE = path.join(HERE, "fixtures", "agent-runtime-stateful-receipt.json");

function offline() {
  const parts = partsFromSse(fs.readFileSync(FIXTURE, "utf8"));
  const request = parts.find((part) => part.type === "tool-approval-request");
  invariant(request, "fixture omits a tool-approval-request part");
  const response = parts.find(
    (part) => part.type === "tool-approval-response" && part.approvalId === request.approvalId,
  );
  invariant(
    response,
    `fixture never resolves approval ${request.approvalId}; the historical projection has ` +
      "nothing to prove an approve/deny resume against",
  );
  const source = parts.find(
    (part) => part.type === "source-document" && typeof part.sourceId === "string"
      && part.sourceId.includes(":"),
  );
  invariant(
    source,
    "fixture omits a source-document with a record-shaped sourceId, which the scope chip and " +
      "graph-record navigation target depend on",
  );
  return {
    mode: "offline",
    evidence_class: "fixture",
    approval_id: request.approvalId,
    approval_resolved: response.approved,
    source_id: source.sourceId,
    live_clauses: "not_run",
    note: "D04: fixture evidence does not discharge the live approve-resume or cancel clauses",
  };
}

function authHeaders() {
  const tokenFile = process.env.THEOREMWEB_AUTH_TOKEN_FILE;
  invariant(tokenFile, "THEOREMWEB_AUTH_TOKEN_FILE is required for --live");
  const token = fs.readFileSync(tokenFile, "utf8").trim();
  invariant(token, "authentication token file is empty");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function postTurn(url, headers, body) {
  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  invariant(response.ok, `live stream returned HTTP ${response.status}`);
  const sessionId = response.headers.get("x-theorem-agent-session");
  const parts = partsFromSse(await response.text());
  return { sessionId, parts };
}

async function liveSeed() {
  const url = process.env.AGENT_RUNTIME_LIVE_STREAM_URL;
  invariant(url, "AGENT_RUNTIME_LIVE_STREAM_URL is required for --live");
  const headers = authHeaders();

  const opening = await postTurn(url, headers, {
    content: [{
      type: "text",
      text: process.env.AGENT_RUNTIME_STATEFUL_PROMPT ?? "Reply with a short greeting.",
    }],
  });
  invariant(opening.sessionId, "the opening turn returned no x-theorem-agent-session header");

  // Whether the live agent actually asks for a tool approval on this prompt
  // is the live agent's own real decision, not something this oracle can
  // force deterministically. When it does, resolve it for real and record
  // that the resume was exercised; when it does not, report that honestly
  // rather than fabricating an approval round trip that never happened.
  const request = opening.parts.find((part) => part.type === "tool-approval-request");
  let approval = { exercised: false };
  if (request) {
    const decision = await postTurn(url, headers, {
      state: { sessionId: opening.sessionId },
      commands: [{ type: "permission-response", callId: request.toolCallId, decision: "allow" }],
    });
    approval = {
      exercised: true,
      approval_id: request.approvalId,
      tool_call_id: request.toolCallId,
      decision: "allow",
      resumed_part_types: [...new Set(decision.parts.map((part) => part.type))].sort(),
    };
  }

  // A cancel dispatched with no open connection (the approval request, if
  // any, already closed the response stream) is the "cancel preserving
  // partial output" clause's network half: it must still resolve, not hang
  // or 4xx, against a session that has nothing streaming right now.
  const cancelled = await postTurn(url, headers, {
    state: { sessionId: opening.sessionId },
    commands: [{ type: "cancel" }],
  });

  const receipt = {
    mode: "live-seed",
    session_id: opening.sessionId,
    opening_part_types: [...new Set(opening.parts.map((part) => part.type))].sort(),
    approval,
    cancel_part_types: [...new Set(cancelled.parts.map((part) => part.type))].sort(),
    captured_at: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(RECEIPT_FILE), { recursive: true });
  fs.writeFileSync(RECEIPT_FILE, `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}

function liveVerify() {
  invariant(
    fs.existsSync(RECEIPT_FILE),
    "no captured receipt at oracles/fixtures/agent-runtime-stateful-receipt.json; " +
      "run --live --seed first",
  );
  const receipt = JSON.parse(fs.readFileSync(RECEIPT_FILE, "utf8"));
  invariant(receipt.session_id, "captured receipt has no session_id");
  invariant(
    receipt.opening_part_types.includes("start"),
    "captured receipt's opening turn never started a message",
  );
  invariant(
    receipt.cancel_part_types.includes("abort") || receipt.cancel_part_types.includes("finish"),
    "captured receipt's cancel turn never finished or aborted the stream",
  );
  if (receipt.approval.exercised) {
    invariant(
      receipt.approval.resumed_part_types.length > 0,
      "captured receipt exercised an approval but recorded no resumed parts",
    );
  }
  return { ...receipt, mode: "live-verify" };
}

async function main() {
  const live = process.argv.includes("--live");
  const seed = process.argv.includes("--seed");
  if (!live) return offline();
  // The offline contract still has to hold in live mode; a live run that
  // skipped it could pass against a fixture whose approval/source shape the
  // rest of this oracle no longer actually depends on.
  offline();
  return seed ? liveSeed() : liveVerify();
}

main()
  .then((receipt) => {
    console.log(JSON.stringify(receipt, null, 2));
  })
  .catch((error) => {
    console.error(`agent-runtime-stateful-live: ${error.message}`);
    process.exitCode = 1;
  });
