#!/usr/bin/env node
"use strict";

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

function verify(parts, oracleClass) {
  const types = new Set(parts.map((part) => part.type));
  for (const required of [
    "text-delta",
    "reasoning-delta",
    "tool-input-available",
    "tool-approval-request",
  ]) {
    invariant(types.has(required), `${oracleClass} stream omitted ${required}`);
  }
  invariant(
    types.has("source-url") || types.has("source-document"),
    `${oracleClass} stream omitted a source part`,
  );
  invariant(
    parts.some((part) => part.type.startsWith("data-")),
    `${oracleClass} stream omitted an unknown data-* part`,
  );
  return {
    oracle_class: oracleClass,
    part_count: parts.length,
    part_types: [...types].sort(),
    approval_ids: parts
      .filter((part) => part.type === "tool-approval-request")
      .map((part) => part.approvalId),
    data_suffixes: parts
      .filter((part) => part.type.startsWith("data-"))
      .map((part) => part.type.slice(5)),
  };
}

async function liveDocument() {
  const url = process.env.AGENT_RUNTIME_LIVE_STREAM_URL;
  const tokenFile = process.env.THEOREMWEB_AUTH_TOKEN_FILE;
  invariant(url, "AGENT_RUNTIME_LIVE_STREAM_URL is required for --live");
  invariant(tokenFile, "THEOREMWEB_AUTH_TOKEN_FILE is required for --live");
  const token = fs.readFileSync(tokenFile, "utf8").trim();
  invariant(token, "authentication token file is empty");
  const bodyFile = process.env.AGENT_RUNTIME_LIVE_REQUEST_FILE;
  const response = await fetch(url, {
    method: bodyFile ? "POST" : "GET",
    headers: {
      Accept: "text/event-stream",
      Authorization: `Bearer ${token}`,
      ...(bodyFile ? { "Content-Type": "application/json" } : {}),
    },
    body: bodyFile ? fs.readFileSync(bodyFile) : undefined,
  });
  invariant(response.ok, `live stream returned HTTP ${response.status}`);
  return response.text();
}

async function main() {
  const live = process.argv.includes("--live");
  const document = live
    ? await liveDocument()
    : fs.readFileSync(
        path.join(__dirname, "../crates/agent-runtime/fixtures/all-parts.sse"),
        "utf8",
      );
  const receipt = verify(partsFromSse(document), live ? "live_proxy_stream" : "fixture_contract");
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});

