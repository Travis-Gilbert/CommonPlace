"use strict";

/*
 * CommonPlace parser worker. The worker is the hard cancellation boundary for
 * CPU-bound document parsing and can be terminated without stalling the peer.
 */

const { parentPort, workerData } = require("node:worker_threads");

const { parseDocumentBytes } = require("./parser");

void parseDocumentBytes(workerData)
  .then((result) => {
    parentPort.postMessage({ ok: true, result });
  })
  .catch((error) => {
    parentPort.postMessage({
      ok: false,
      error: {
        name: error?.name ?? "Error",
        message: error?.message ?? "Collector parser failed.",
        statusCode: Number.isInteger(error?.statusCode)
          ? error.statusCode
          : null,
      },
    });
  });
