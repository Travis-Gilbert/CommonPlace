"use strict";

const { TextDecoder } = require("node:util");
const path = require("node:path");
const { Worker } = require("node:worker_threads");

const TEXT_MEDIA_TYPES = new Set([
  "text/markdown",
  "text/plain",
]);
const DEFAULT_MAX_EXTRACTED_TEXT_BYTES = 16 * 1024 * 1024;
const DEFAULT_MAX_PARSER_WORKERS = 2;
const PARSER_RESOURCE_LIMITS = Object.freeze({
  maxOldGenerationSizeMb: 96,
  maxYoungGenerationSizeMb: 16,
  stackSizeMb: 4,
});
const workerAdmissionPools = new Map();

class UnsupportedCollectorMediaTypeError extends Error {
  constructor(mediaType) {
    super(`The first collector slice does not parse ${mediaType}.`);
    this.name = "UnsupportedCollectorMediaTypeError";
    this.statusCode = 415;
  }
}

class InvalidCollectorTextError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidCollectorTextError";
    this.statusCode = 422;
  }
}

async function parseDocumentBytes({
  bytes,
  filename,
  mediaType,
  signal,
  maxExtractedTextBytes = DEFAULT_MAX_EXTRACTED_TEXT_BYTES,
}) {
  signal?.throwIfAborted();
  const normalizedMediaType = mediaType.split(";", 1)[0].trim().toLowerCase();
  if (!TEXT_MEDIA_TYPES.has(normalizedMediaType)) {
    throw new UnsupportedCollectorMediaTypeError(normalizedMediaType);
  }
  if (
    !Number.isSafeInteger(maxExtractedTextBytes) ||
    maxExtractedTextBytes < 1
  ) {
    throw new InvalidCollectorTextError(
      "Collector text limit must be a positive safe integer."
    );
  }
  if (bytes.byteLength > maxExtractedTextBytes) {
    throw new InvalidCollectorTextError(
      "Parsed text exceeds the extracted text limit."
    );
  }

  let pageContent;
  try {
    pageContent = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new InvalidCollectorTextError("Upload is not valid UTF-8 text.");
  }
  signal?.throwIfAborted();
  if (Buffer.byteLength(pageContent) > maxExtractedTextBytes) {
    throw new InvalidCollectorTextError(
      "Parsed text exceeds the extracted text limit."
    );
  }
  const wordCount = countWords(pageContent);
  if (wordCount === 0) {
    throw new InvalidCollectorTextError("Upload contains no text.");
  }

  return {
    documents: [
      {
        title: filename,
        pageContent,
        wordCount,
      },
    ],
    sourceFacts: {
      parser: "commonplace-text-v1",
      mediaType: normalizedMediaType,
      byteLength: bytes.length,
    },
  };
}

function countWords(text) {
  let words = 0;
  let insideWord = false;
  for (let index = 0; index < text.length; index += 1) {
    const whitespace = isWhitespaceCodeUnit(text.charCodeAt(index));
    if (!whitespace && !insideWord) {
      words += 1;
    }
    insideWord = !whitespace;
  }
  return words;
}

function isWhitespaceCodeUnit(code) {
  return (
    (code >= 0x0009 && code <= 0x000d) ||
    code === 0x0020 ||
    code === 0x00a0 ||
    code === 0x1680 ||
    (code >= 0x2000 && code <= 0x200a) ||
    code === 0x2028 ||
    code === 0x2029 ||
    code === 0x202f ||
    code === 0x205f ||
    code === 0x3000 ||
    code === 0xfeff
  );
}

async function parseDocumentBytesInWorker({
  bytes,
  filename,
  mediaType,
  correlationId,
  signal,
  maxExtractedTextBytes = DEFAULT_MAX_EXTRACTED_TEXT_BYTES,
  maxWorkers = DEFAULT_MAX_PARSER_WORKERS,
}) {
  if (
    !Number.isSafeInteger(maxExtractedTextBytes) ||
    maxExtractedTextBytes < 1
  ) {
    throw new InvalidCollectorTextError(
      "Collector text limit must be a positive safe integer."
    );
  }
  const normalizedMediaType = mediaType.split(";", 1)[0].trim().toLowerCase();
  if (
    TEXT_MEDIA_TYPES.has(normalizedMediaType) &&
    bytes.byteLength > maxExtractedTextBytes
  ) {
    throw new InvalidCollectorTextError(
      "Parsed text exceeds the extracted text limit."
    );
  }
  const releaseWorkerSlot = await acquireWorkerSlot(maxWorkers, signal);
  try {
    return await new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(createAbortError());
        return;
      }
      const transferable = createTransferableBytes(bytes);
      const worker = new Worker(path.join(__dirname, "parser-worker.js"), {
        workerData: {
          bytes: transferable.bytes,
          filename,
          mediaType,
          correlationId,
          maxExtractedTextBytes,
        },
        transferList: transferable.transferList,
        resourceLimits: PARSER_RESOURCE_LIMITS,
      });
      let settled = false;
      const finish = async (callback, value, terminate = true) => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener("abort", onAbort);
        if (terminate) {
          await worker.terminate().catch(() => undefined);
        }
        callback(value);
      };
      const onAbort = () => {
        void finish(reject, createAbortError());
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      worker.once("message", (message) => {
        if (message?.ok === true) {
          void finish(resolve, message.result);
        } else {
          const error = new Error(
            message?.error?.message ?? "Collector parser worker failed."
          );
          error.name = message?.error?.name ?? "CollectorParserWorkerError";
          if (Number.isInteger(message?.error?.statusCode)) {
            error.statusCode = message.error.statusCode;
          }
          void finish(reject, error);
        }
      });
      worker.once("error", (error) => {
        void finish(reject, error);
      });
      worker.once("exit", (code) => {
        if (!settled) {
          void finish(
            reject,
            new Error(
              `Collector parser worker exited before returning a result with status ${code}.`
            ),
            false
          );
        }
      });
      if (signal?.aborted) {
        onAbort();
      }
    });
  } finally {
    releaseWorkerSlot();
  }
}

function acquireWorkerSlot(maxWorkers, signal) {
  if (!Number.isSafeInteger(maxWorkers) || maxWorkers < 1) {
    return Promise.reject(
      new InvalidCollectorTextError(
        "Collector worker limit must be a positive safe integer."
      )
    );
  }
  if (signal?.aborted) {
    return Promise.reject(createAbortError());
  }
  const pool = workerPool(maxWorkers);
  if (pool.active < maxWorkers) {
    pool.active += 1;
    return Promise.resolve(createWorkerSlotRelease(pool));
  }
  return new Promise((resolve, reject) => {
    const waiter = { resolve, reject, signal, onAbort: null };
    waiter.onAbort = () => {
      const index = pool.waiters.indexOf(waiter);
      if (index >= 0) pool.waiters.splice(index, 1);
      reject(createAbortError());
    };
    signal?.addEventListener("abort", waiter.onAbort, { once: true });
    if (signal?.aborted) {
      signal.removeEventListener("abort", waiter.onAbort);
      reject(createAbortError());
      return;
    }
    pool.waiters.push(waiter);
  });
}

function createWorkerSlotRelease(pool) {
  let released = false;
  return () => {
    if (released) return;
    released = true;
    pool.active -= 1;
    while (pool.waiters.length > 0) {
      const waiter = pool.waiters.shift();
      waiter.signal?.removeEventListener("abort", waiter.onAbort);
      if (waiter.signal?.aborted) {
        waiter.reject(createAbortError());
        continue;
      }
      pool.active += 1;
      waiter.resolve(createWorkerSlotRelease(pool));
      break;
    }
  };
}

function workerPool(maxWorkers) {
  let pool = workerAdmissionPools.get(maxWorkers);
  if (!pool) {
    pool = { active: 0, waiters: [] };
    workerAdmissionPools.set(maxWorkers, pool);
  }
  return pool;
}

function getParserWorkerState(maxWorkers = DEFAULT_MAX_PARSER_WORKERS) {
  const pool = workerAdmissionPools.get(maxWorkers);
  return Object.freeze({
    active: pool?.active ?? 0,
    queued: pool?.waiters.length ?? 0,
    limit: maxWorkers,
  });
}

function createTransferableBytes(bytes) {
  const input = Buffer.isBuffer(bytes)
    ? bytes
    : bytes instanceof Uint8Array
      ? Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      : Buffer.from(bytes);
  const buffer = new ArrayBuffer(input.byteLength);
  const owned = new Uint8Array(buffer);
  owned.set(input);
  return {
    bytes: owned,
    transferList: [buffer],
  };
}

function createAbortError() {
  const error = new Error("Collector parser worker was aborted.");
  error.name = "AbortError";
  return error;
}

module.exports = {
  countWords,
  DEFAULT_MAX_EXTRACTED_TEXT_BYTES,
  DEFAULT_MAX_PARSER_WORKERS,
  getParserWorkerState,
  InvalidCollectorTextError,
  TEXT_MEDIA_TYPES,
  UnsupportedCollectorMediaTypeError,
  parseDocumentBytes,
  parseDocumentBytesInWorker,
};
