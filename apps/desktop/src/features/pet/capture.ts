import {
  createCaptureQueue,
  type CaptureQueueEntry,
  type QueuedCaptureEnvelope,
} from "@commonplace/capture-client";

import {
  petCapture,
  petCaptureFiles,
  petStageCaptureFiles,
} from "../../lib/commands";

const PET_CAPTURE_QUEUE_KEY = "commonplace:pet-capture-queue:v1";
let sharedQueue: ReturnType<typeof createCaptureQueue> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

function captureStorage() {
  return {
    async read(): Promise<CaptureQueueEntry[]> {
      const value = window.localStorage.getItem(PET_CAPTURE_QUEUE_KEY);
      if (!value) return [];
      try {
        const parsed = JSON.parse(value) as unknown;
        return Array.isArray(parsed) ? (parsed as CaptureQueueEntry[]) : [];
      } catch {
        return [];
      }
    },
    async write(entries: CaptureQueueEntry[]): Promise<void> {
      window.localStorage.setItem(PET_CAPTURE_QUEUE_KEY, JSON.stringify(entries));
    },
  };
}

export function newPetCaptureEnvelope(
  values: Omit<
    QueuedCaptureEnvelope,
    "client_id" | "captured_at" | "properties" | "source"
  > &
    Partial<Pick<QueuedCaptureEnvelope, "properties">>,
): QueuedCaptureEnvelope {
  return {
    ...values,
    client_id: `local-${crypto.randomUUID()}`,
    captured_at: new Date().toISOString(),
    properties: values.properties ?? {},
    source: "pet",
  };
}

function scheduleNextDrain(entries: readonly CaptureQueueEntry[]): void {
  if (retryTimer !== undefined) {
    clearTimeout(retryTimer);
    retryTimer = undefined;
  }
  const nextAttemptAt = entries.reduce(
    (earliest, entry) =>
      entry.state === "kept" && Number.isFinite(entry.nextAttemptAt)
        ? Math.min(earliest, entry.nextAttemptAt)
        : earliest,
    Number.POSITIVE_INFINITY,
  );
  if (!Number.isFinite(nextAttemptAt)) return;

  retryTimer = setTimeout(() => {
    retryTimer = undefined;
    void drainPetCaptureQueue().catch(() => {
      // Queue entries remain durable; connectivity changes also trigger a drain.
    });
  }, Math.max(0, nextAttemptAt - Date.now()));
}

function petCaptureQueue() {
  sharedQueue ??= createCaptureQueue({
    storage: captureStorage(),
    send: async (envelope, metadata) => {
      try {
        const paths = metadata.localFilePaths;
        const result =
          paths && paths.length > 0
            ? await petCaptureFiles(paths, envelope)
            : await petCapture(envelope);
        if (!result.id) {
          return {
            ok: false,
            retryable: result.source.retryable,
            error: result.source.reason ?? "CommonPlace capture failed",
          };
        }
        return {
          ok: true,
          receipt: {
            id: result.id,
            slug: result.slug,
            created: result.created,
            clientId: result.clientId,
          },
        };
      } catch (error) {
        return {
          ok: false,
          retryable: true,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
  return sharedQueue;
}

export async function enqueuePetCapture(
  envelope: QueuedCaptureEnvelope,
): Promise<CaptureQueueEntry> {
  const queue = petCaptureQueue();
  const paths = envelope.local_file_paths;
  const queuedEnvelope =
    paths && paths.length > 0
      ? {
          ...envelope,
          local_file_paths: await petStageCaptureFiles(
            paths,
            envelope.client_id,
          ),
        }
      : envelope;
  await queue.enqueue(queuedEnvelope);
  const entries = await queue.drain();
  scheduleNextDrain(entries);
  const entry = entries.find((candidate) => candidate.id === envelope.client_id);
  if (!entry) {
    throw new Error("The durable capture queue lost its persisted entry");
  }
  return entry;
}

export async function drainPetCaptureQueue(): Promise<CaptureQueueEntry[]> {
  const entries = await petCaptureQueue().drain();
  scheduleNextDrain(entries);
  return entries;
}
