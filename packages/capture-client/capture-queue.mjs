export const COMMONPLACE_CAPTURE_CONTRACT_VERSION = "commonplace-capture/v1";

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_RETRY_BASE_MS = 1_000;

export function normalizeCaptureApiBase(endpoint) {
  const trimmed = endpoint.trim();
  if (!trimmed) return "";

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    throw new TypeError(`invalid capture API base: ${trimmed}`);
  }
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname
    .replace(/\/(?:ingest\/(?:capture|blob)|graphql)\/?$/i, "")
    .replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
}

export function captureEndpoint(apiBase) {
  const normalized = normalizeCaptureApiBase(apiBase);
  return normalized ? `${normalized}/ingest/capture` : "";
}

export function isRetryableCaptureStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function normalizedEntries(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        typeof entry.id === "string" &&
        entry.envelope &&
        typeof entry.envelope.client_id === "string",
    )
    .map((entry) => {
      const {
        local_file_paths: legacyLocalFilePaths,
        ...wireEnvelope
      } = entry.envelope;
      const localFilePaths =
        entry.localFilePaths ??
        (Array.isArray(legacyLocalFilePaths)
          ? legacyLocalFilePaths
          : undefined);
      return {
        ...entry,
        envelope: wireEnvelope,
        ...(localFilePaths ? { localFilePaths } : {}),
      };
    })
    .sort(
      (left, right) =>
        left.createdAt - right.createdAt || left.id.localeCompare(right.id),
    );
}

function errorMessage(result) {
  if (result.error) return result.error;
  if (result.status) return `CommonPlace capture failed with ${result.status}`;
  return "CommonPlace capture failed";
}

export function createCaptureQueue({
  storage,
  send,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  retryBaseMs = DEFAULT_RETRY_BASE_MS,
  now = Date.now,
}) {
  if (!storage?.read || !storage?.write) {
    throw new TypeError("capture queue storage must provide read and write");
  }
  if (typeof send !== "function") {
    throw new TypeError("capture queue send must be a function");
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError(
      "capture queue maxAttempts must be a positive integer",
    );
  }
  if (!Number.isFinite(retryBaseMs) || retryBaseMs < 0) {
    throw new RangeError(
      "capture queue retryBaseMs must be a non-negative finite number",
    );
  }

  let mutationTail = Promise.resolve();

  function serialize(task) {
    const result = mutationTail.then(task, task);
    mutationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async function load() {
    return normalizedEntries(await storage.read());
  }

  async function persist(entries) {
    const ordered = normalizedEntries(entries);
    await storage.write(ordered);
    return ordered;
  }

  async function enqueueNow(envelope) {
    if (!envelope?.client_id) {
      throw new TypeError("capture envelope client_id is required");
    }
    const entries = await load();
    const existing = entries.find(
      (entry) => entry.envelope.client_id === envelope.client_id,
    );
    if (existing) return existing;

    const {
      local_file_paths: localFilePaths,
      ...wireEnvelope
    } = structuredClone(envelope);
    const timestamp = now();
    const entry = {
      id: envelope.client_id,
      envelope: wireEnvelope,
      ...(Array.isArray(localFilePaths) ? { localFilePaths } : {}),
      state: "kept",
      attempts: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      nextAttemptAt: timestamp,
    };
    entries.push(entry);
    await persist(entries);
    return entry;
  }

  async function drainNow() {
    const entries = await load();
    for (const entry of entries) {
      if (entry.state === "sent" || entry.state === "error") continue;
      if (entry.nextAttemptAt > now()) break;

      entry.state = "sending";
      entry.attempts += 1;
      entry.updatedAt = now();
      await persist(entries);

      let result;
      try {
        result = await send(structuredClone(entry.envelope), {
          localFilePaths: structuredClone(entry.localFilePaths ?? []),
        });
        if (
          !result ||
          typeof result !== "object" ||
          typeof result.ok !== "boolean"
        ) {
          throw new TypeError("capture sender returned an invalid result");
        }
      } catch (error) {
        result = {
          ok: false,
          retryable: true,
          error: error instanceof Error ? error.message : String(error),
        };
      }

      entry.updatedAt = now();
      if (result.ok) {
        entry.state = "sent";
        entry.receipt = result.receipt;
        delete entry.lastError;
        await persist(entries);
        continue;
      }

      entry.lastError = errorMessage(result);
      const retryable =
        result.retryable ?? isRetryableCaptureStatus(result.status ?? 0);
      if (retryable && entry.attempts < maxAttempts) {
        entry.state = "kept";
        entry.nextAttemptAt =
          now() + retryBaseMs * 2 ** Math.max(0, entry.attempts - 1);
      } else {
        entry.state = "error";
      }
      await persist(entries);

      if (entry.state === "kept") break;
    }
    const completed = normalizedEntries(entries);
    await persist(entries.filter((entry) => entry.state !== "sent"));
    return completed;
  }

  return {
    enqueue: (envelope) => serialize(() => enqueueNow(envelope)),
    drain: () => serialize(drainNow),
    list: () => serialize(load),
  };
}
