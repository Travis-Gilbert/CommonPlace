"use strict";

/*
 * CommonPlace collector entry point, adapted as a parse-only peer from
 * Mintplex-Labs/anything-llm's MIT-licensed collector service at commit
 * 633fc1960914298009134b40c25007cb422c7884. See LICENSE.anything-llm.
 */

const http = require("node:http");

const {
  DEFAULT_MAX_PARSER_WORKERS,
  parseDocumentBytesInWorker,
} = require("./parser");
const {
  DEFAULT_MAX_DOCUMENTS,
  DEFAULT_MAX_EXTRACTED_TEXT_BYTES,
  DEFAULT_MAX_RESPONSE_BYTES,
  DEFAULT_MAX_UPLOAD_BYTES,
  DEFAULT_PARSE_TIMEOUT_MS,
  createCollectorRequestHandler,
} = require("./service");

function createCollectorServer({
  peerToken = process.env.COMMONPLACE_COLLECTOR_PEER_TOKEN,
  previousPeerToken = process.env.COMMONPLACE_COLLECTOR_PREVIOUS_PEER_TOKEN,
  parseBytes,
  maxUploadBytes = readPositiveInteger(
    process.env.COLLECTOR_MAX_UPLOAD_BYTES,
    DEFAULT_MAX_UPLOAD_BYTES
  ),
  maxDocuments = readPositiveInteger(
    process.env.COLLECTOR_MAX_DOCUMENTS,
    DEFAULT_MAX_DOCUMENTS
  ),
  maxExtractedTextBytes = readPositiveInteger(
    process.env.COLLECTOR_MAX_EXTRACTED_TEXT_BYTES,
    DEFAULT_MAX_EXTRACTED_TEXT_BYTES
  ),
  maxResponseBytes = readPositiveInteger(
    process.env.COLLECTOR_MAX_RESPONSE_BYTES,
    DEFAULT_MAX_RESPONSE_BYTES
  ),
  parseTimeoutMs = readPositiveInteger(
    process.env.COLLECTOR_PARSE_TIMEOUT_MS,
    DEFAULT_PARSE_TIMEOUT_MS
  ),
  maxParserWorkers = readPositiveInteger(
    process.env.COLLECTOR_MAX_PARSER_WORKERS,
    DEFAULT_MAX_PARSER_WORKERS
  ),
} = {}) {
  const parser =
    parseBytes ??
    ((input) =>
      parseDocumentBytesInWorker({
        ...input,
        maxWorkers: maxParserWorkers,
      }));
  return http.createServer(
    createCollectorRequestHandler({
      peerToken,
      previousPeerToken,
      parseBytes: parser,
      maxUploadBytes,
      maxDocuments,
      maxExtractedTextBytes,
      maxResponseBytes,
      parseTimeoutMs,
      maxConcurrentParses: maxParserWorkers,
    })
  );
}

async function startCollector({
  host = process.env.COLLECTOR_BIND_HOST ?? "127.0.0.1",
  port = readPositiveInteger(process.env.COLLECTOR_PORT, 8888),
  ...serverOptions
} = {}) {
  const server = createCollectorServer(serverOptions);
  await new Promise((resolve, reject) => {
    function handleError(error) {
      server.off("listening", handleListening);
      reject(error);
    }

    function handleListening() {
      server.off("error", handleError);
      resolve();
    }

    server.once("error", handleError);
    server.once("listening", handleListening);
    server.listen(port, host);
  });
  const address = server.address();
  const boundPort =
    address && typeof address === "object" ? address.port : port;
  console.log(
    `CommonPlace collector parse boundary listening on ${host}:${boundPort}`
  );
  return server;
}

function readPositiveInteger(value, fallback) {
  if (value === undefined || value === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`Expected a positive integer, received "${value}".`);
  }
  return parsed;
}

if (require.main === module) {
  void startCollector().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  createCollectorServer,
  readPositiveInteger,
  startCollector,
};
