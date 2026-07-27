"use strict";

const { HarnessAgentBridge } = require("./bridge");
const { resolveHarnessConfig } = require("./config");
const { HarnessBridgeError } = require("./errors");
const { HarnessMcpClient } = require("./mcp-client");
const {
  HarnessToolSurface,
  MODEL_TOOL_DEFINITIONS,
  MODEL_TOOL_IDS,
  MODEL_TOOL_NAMES,
} = require("./tool-surface");

function createHarnessAgentBridge({
  contextSource,
  environment = process.env,
  fetchImpl = globalThis.fetch,
  persistence,
  policy,
  receiptVerifier,
  runner,
} = {}) {
  const config = resolveHarnessConfig(environment);
  const client = new HarnessMcpClient({ config, fetchImpl });
  const toolSurface = new HarnessToolSurface({
    client,
    policy,
    maxPageSize: config.maxCatalogPageSize,
    maxWindow: config.maxCatalogWindow,
  });
  return new HarnessAgentBridge({
    contextSource,
    persistence,
    receiptVerifier,
    runner,
    toolSurface,
  });
}

module.exports = {
  HarnessAgentBridge,
  HarnessBridgeError,
  HarnessMcpClient,
  HarnessToolSurface,
  MODEL_TOOL_DEFINITIONS,
  MODEL_TOOL_IDS,
  MODEL_TOOL_NAMES,
  createHarnessAgentBridge,
  resolveHarnessConfig,
};
