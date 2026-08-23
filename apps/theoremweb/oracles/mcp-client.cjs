#!/usr/bin/env node
"use strict";

// The shared MCP client for TheoremWeb oracles.
//
// Extracted rather than copied. The handshake this performs is easy to get
// subtly wrong -- `host-registry-live.cjs` originally called `tools/call` with
// no `initialize`, no `notifications/initialized`, and no `Mcp-Session-Id`
// propagation, which would have failed on its first live run and read as a
// broken backend. One implementation means the next oracle inherits the fix
// instead of rediscovering the bug.
//
// `host-registry-live.cjs` still carries its own inline copy; switching it to
// this module is its owner's call, not this module's to make.

const fs = require("node:fs");

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseMcpBody(text, contentType) {
  if (!contentType.includes("text/event-stream")) {
    return JSON.parse(text);
  }
  // SSE frames the JSON-RPC response in `data:` lines.
  const payload = text
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("");
  invariant(payload, "MCP event stream carried no data frame");
  return JSON.parse(payload);
}

function structured(result) {
  if (result.structuredContent) {
    return result.structuredContent;
  }
  const text = result.content?.find((part) => part.type === "text")?.text;
  invariant(text, "MCP tool response has no structured content");
  return JSON.parse(text);
}

/// Open an authenticated MCP session and return a `call(tool, args)` function.
async function connect(clientName) {
  const endpoint = process.env.THEOREMWEB_MCP_URL;
  const tokenFile = process.env.THEOREMWEB_AUTH_TOKEN_FILE;
  invariant(endpoint, "THEOREMWEB_MCP_URL is required for --live");
  invariant(tokenFile, "THEOREMWEB_AUTH_TOKEN_FILE is required for --live");
  const token = fs.readFileSync(tokenFile, "utf8").trim();
  invariant(token, `${tokenFile} is empty`);
  let id = 0;

  async function post(message, { sessionId, expectResponse = true } = {}) {
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
  const initialized = await post({
    jsonrpc: "2.0",
    id,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: clientName, version: "1.0" },
    },
  });
  if (initialized.body.error) {
    throw new Error(
      `MCP ${initialized.body.error.code}: ${initialized.body.error.message}`,
    );
  }
  invariant(initialized.sessionId, "MCP initialize returned no Mcp-Session-Id");
  await post(
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { sessionId: initialized.sessionId, expectResponse: false },
  );
  const sessionId = initialized.sessionId;

  return {
    sessionId,
    async listTools() {
      id += 1;
      const response = await post(
        { jsonrpc: "2.0", id, method: "tools/list", params: {} },
        { sessionId },
      );
      if (response.body.error) {
        throw new Error(
          `MCP ${response.body.error.code}: ${response.body.error.message}`,
        );
      }
      return response.body.result.tools ?? [];
    },
    async call(name, args) {
      id += 1;
      const response = await post(
        {
          jsonrpc: "2.0",
          id,
          method: "tools/call",
          params: { name, arguments: args },
        },
        { sessionId },
      );
      if (response.body.error) {
        throw new Error(
          `MCP ${response.body.error.code}: ${response.body.error.message}`,
        );
      }
      return structured(response.body.result);
    },
  };
}

module.exports = { connect, invariant, parseMcpBody, structured };
