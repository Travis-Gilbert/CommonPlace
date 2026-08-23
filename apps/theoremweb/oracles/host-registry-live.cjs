#!/usr/bin/env node
"use strict";

// V01: prove the new root is an actual graph-backed product host, not another
// fixture page.
//
// The assertions run against the receipt the Rust host itself emits. This
// oracle never reimplements intent resolution or history in JavaScript,
// because an oracle that reimplements the product proves only itself.
//
//   node oracles/host-registry-live.cjs                  offline contract check
//   node oracles/host-registry-live.cjs --live --seed    write absent rows
//   node oracles/host-registry-live.cjs --live           verify against graph
//   node oracles/host-registry-live.cjs --live --verify  same, explicitly
//
// Live mode needs THEOREMWEB_MCP_URL and THEOREMWEB_AUTH_TOKEN_FILE, matching
// oracles/surface-navigation.cjs.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const args = new Set(process.argv.slice(2));
const live = args.has("--live");
const seed = args.has("--seed");
const verify = args.has("--verify") || (live && !seed);

const HERE = __dirname;
const APP_ROOT = path.resolve(HERE, "..");
const EXPECTED = path.join(HERE, "fixtures", "registry-contract-expected.json");

// SPEC-THEOREMWEB-SURFACE-1.0 TW1 fixes this set exactly.
const SEVEN = ["canvas", "records", "model", "chat", "document", "ide", "browser"];
// The spec's BodyKind line fixes this set exactly. `agent_thread` is not in it.
const CANONICAL_BODIES = [
  "fields", "related_records", "record_table", "thread", "document",
  "chart", "timeline", "iframe", "sub_canvas", "log",
];
// Written to the graph during --seed and expected back during --verify. It is
// absent from the pinned fixture on purpose: a host that reads a client list or
// the checked-in fixture cannot possibly report it.
const GRAPH_ONLY_PROBE = "v01-graph-only-probe";

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sortedEqual(actual, expected, message) {
  const left = [...actual].sort();
  const right = [...expected].sort();
  invariant(
    left.length === right.length && left.every((value, index) => value === right[index]),
    `${message}\n  expected: ${right.join(", ")}\n  actual:   ${left.join(", ")}`,
  );
}

/** Run the real host binary against a canonical document and return its receipt. */
function hostReceipt(contract) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "theoremweb-v01-"));
  const documentPath = path.join(scratch, "contract.json");
  try {
    fs.writeFileSync(documentPath, JSON.stringify(contract));
    const stdout = execFileSync(
      "cargo",
      ["run", "--quiet", "--bin", "theoremweb", "--", documentPath],
      { cwd: APP_ROOT, encoding: "utf8", env: { ...process.env } },
    );
    return JSON.parse(stdout);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

/** Assertions that hold for any canonical document, live or pinned. */
function assertHostContract(receipt, { expectProbe }) {
  invariant(
    receipt.registry_source === "canonical-document",
    `host resolved its registry from ${receipt.registry_source}, not the canonical document`,
  );
  for (const id of SEVEN) {
    invariant(
      receipt.surface_ids.includes(id),
      `seed row ${id} is missing from the host's resolved catalog`,
    );
  }
  invariant(
    receipt.missing_seed_ids.length === 0,
    `host reports unseeded rows: ${receipt.missing_seed_ids.join(", ")}`,
  );
  sortedEqual(
    receipt.body_kinds,
    CANONICAL_BODIES,
    "host body kinds are not the canonical set",
  );
  invariant(
    !receipt.body_kinds.includes("agent_thread"),
    "agent_thread is not a canonical body kind and must not reach the host",
  );

  // TW3. A record identifier opens the record surface at Record scope; a
  // question opens the chat surface at Workspace scope.
  const record = receipt.intents.find((intent) => intent.step === "record");
  const question = receipt.intents.find((intent) => intent.step === "question");
  invariant(record, "host resolved no record intent");
  invariant(question, "host resolved no question intent");
  invariant(
    record.surface_id === "records" && record.binding.kind === "record" &&
      record.binding.object_type === "company" && record.binding.record_id === "acme",
    "record intent did not open the record surface at Record scope",
  );
  invariant(
    question.surface_id === "chat" && question.binding.kind === "workspace",
    "question intent did not open the chat surface at Workspace scope",
  );

  // TW3. Back and forward restore both surface and binding.
  const back = receipt.history.find((entry) => entry.step === "back");
  const forward = receipt.history.find((entry) => entry.step === "forward");
  invariant(back && forward, "host produced no back/forward history");
  invariant(
    back.surface_id === record.surface_id && back.binding.record_id === "acme",
    "back did not restore the complete record surface and binding",
  );
  invariant(
    forward.surface_id === question.surface_id && forward.binding.kind === "workspace",
    "forward did not restore the complete chat surface and binding",
  );

  if (expectProbe) {
    // The discriminating test. This row exists only in the graph.
    invariant(
      receipt.surface_ids.includes(GRAPH_ONLY_PROBE),
      `host did not see ${GRAPH_ONLY_PROBE}, so registry truth came from a client list or a fixture, not the graph`,
    );
    invariant(
      receipt.unavailable_labels.some((label) => label.includes("future_gpu")),
      "an unknown renderer variant was dropped instead of labeled",
    );
  }
}

// ---------------------------------------------------------------- live client

function parseMcpBody(text, contentType) {
  if (!contentType.includes("text/event-stream")) {
    return JSON.parse(text);
  }
  const events = text
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== "[DONE]")
    .map(JSON.parse);
  invariant(events.length > 0, "MCP returned an empty event stream");
  return events.at(-1);
}

function structuredResult(response) {
  if (response.error) {
    throw new Error(`MCP ${response.error.code}: ${response.error.message}`);
  }
  const result = response.result ?? {};
  if (result.isError) {
    const text = result.content?.find((part) => part.type === "text")?.text;
    throw new Error(`MCP tool error: ${text ?? JSON.stringify(result)}`);
  }
  if (result.structuredContent) {
    return result.structuredContent;
  }
  const text = result.content?.find((part) => part.type === "text")?.text;
  invariant(text, "MCP tool response has no structured content");
  return JSON.parse(text);
}

async function liveClient() {
  const endpoint = process.env.THEOREMWEB_MCP_URL;
  const tokenFile = process.env.THEOREMWEB_AUTH_TOKEN_FILE;
  invariant(endpoint, "THEOREMWEB_MCP_URL is required for --live");
  invariant(tokenFile, "THEOREMWEB_AUTH_TOKEN_FILE is required for --live");
  const token = fs.readFileSync(tokenFile, "utf8").trim();
  invariant(token, `${tokenFile} is empty`);
  let id = 0;

  async function postMcp(message, { sessionId, expectResponse = true } = {}) {
    const headers = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token}`,
    };
    if (sessionId) {
      headers["mcp-session-id"] = sessionId;
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(message),
    });
    const text = await response.text();
    invariant(
      response.ok,
      `MCP ${message.method} returned HTTP ${response.status}: ${text.slice(0, 400)}`,
    );
    if (!expectResponse) {
      return { body: null, sessionId: response.headers.get("mcp-session-id") };
    }
    return {
      body: parseMcpBody(text, response.headers.get("content-type") ?? ""),
      sessionId: response.headers.get("mcp-session-id"),
    };
  }

  id += 1;
  const initialized = await postMcp({
    jsonrpc: "2.0",
    id,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "theoremweb-host-registry-oracle", version: "1.0" },
    },
  });
  if (initialized.body.error) {
    throw new Error(
      `MCP ${initialized.body.error.code}: ${initialized.body.error.message}`,
    );
  }
  invariant(initialized.sessionId, "MCP initialize returned no Mcp-Session-Id");
  await postMcp(
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { sessionId: initialized.sessionId, expectResponse: false },
  );

  return async function call(method, params) {
    id += 1;
    const response = await postMcp(
      {
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: { name: method, arguments: params ?? {} },
      },
      { sessionId: initialized.sessionId },
    );
    return structuredResult(response.body);
  };
}

async function seedLiveGraph(call) {
  const expected = JSON.parse(fs.readFileSync(EXPECTED, "utf8"));
  const existing = (await call("surface_list")).surfaces ?? [];
  const present = new Set(existing.map((surface) => surface.surface_id));
  const written = [];
  for (const surface of expected.surfaces) {
    if (!present.has(surface.surface_id)) {
      await call("surface_write", { surface });
      written.push(surface.surface_id);
    }
  }
  if (!present.has(GRAPH_ONLY_PROBE)) {
    await call("surface_write", {
      surface: {
        surface_id: GRAPH_ONLY_PROBE,
        title: "Graph-only probe",
        icon: "spark",
        default_scope: { kind: "workspace" },
        renderer: { kind: "future_gpu", quality: "high" },
        capabilities: [],
      },
    });
    written.push(GRAPH_ONLY_PROBE);
  }
  return { phase: "seed", written, already_present: [...present] };
}

async function verifyLiveGraph(call) {
  const payload = await call("surface_list");
  const contractPayload = await call("surface_contract");
  const contract = contractPayload.contract;
  invariant(
    contract?.version === "theoremweb-surface-v1",
    "surface_contract returned the wrong version",
  );
  invariant(Array.isArray(contract.bodies), "surface_contract returned no bodies array");
  invariant(
    Array.isArray(contract.surfaces),
    "surface_contract returned no surfaces array",
  );
  const { bodies, surfaces } = contract;
  const receipt = hostReceipt(contract);
  assertHostContract(receipt, { expectProbe: true });

  // Registry drift between the client's pinned expectation and live truth is a
  // failure, not a warning. Same filename, different document is exactly how
  // the two copies of theoremweb-surface-v1.json diverged.
  const expected = JSON.parse(fs.readFileSync(EXPECTED, "utf8"));
  const drift = [];
  for (const body of expected.bodies) {
    const liveBody = bodies.find((candidate) => candidate.kind === body.kind);
    if (!liveBody) {
      drift.push(`${body.kind}: absent from the live registry`);
      continue;
    }
    if (liveBody.icon !== body.icon) {
      drift.push(`${body.kind}.icon: pinned ${body.icon}, live ${liveBody.icon}`);
    }
    if (liveBody.renderer_binding !== body.renderer_binding) {
      drift.push(
        `${body.kind}.renderer_binding: pinned ${body.renderer_binding}, live ${liveBody.renderer_binding}`,
      );
    }
    if (liveBody.size?.default_width !== body.size.default_width ||
        liveBody.size?.default_height !== body.size.default_height) {
      drift.push(
        `${body.kind}.size: pinned ${body.size.default_width}x${body.size.default_height}, ` +
        `live ${liveBody.size?.default_width}x${liveBody.size?.default_height}`,
      );
    }
  }
  invariant(
    drift.length === 0,
    `the client's pinned contract has drifted from the live registry:\n  ${drift.join("\n  ")}`,
  );

  return {
    phase: "verify",
    oracle: "host-registry-live",
    authenticated_tenant: payload.identity_receipt?.tenant ?? null,
    live_surface_count: surfaces.length,
    live_body_count: bodies.length,
    graph_only_probe_seen: receipt.surface_ids.includes(GRAPH_ONLY_PROBE),
    receipt,
  };
}

async function main() {
  if (!live) {
    const contract = JSON.parse(fs.readFileSync(EXPECTED, "utf8"));
    const receipt = hostReceipt(contract);
    assertHostContract(receipt, { expectProbe: false });
    process.stdout.write(`${JSON.stringify({
      phase: "offline-contract",
      oracle: "host-registry-live",
      note: "pinned contract only; this cannot discharge V01, which requires a live oracle",
      receipt,
    }, null, 2)}\n`);
    return;
  }
  invariant(seed !== verify, "--live requires exactly one of --seed or --verify");
  const call = await liveClient();
  const result = seed ? await seedLiveGraph(call) : await verifyLiveGraph(call);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
