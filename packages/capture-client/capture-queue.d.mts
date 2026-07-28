export const COMMONPLACE_CAPTURE_CONTRACT_VERSION: "commonplace-capture/v1";

export type CaptureQueueState = "kept" | "sending" | "sent" | "error";

export interface CaptureEnvelope {
  client_id: string;
  title?: string;
  body: string;
  object_type: string;
  capture_method: string;
  source: string;
  captured_at: string;
  source_url?: string;
  kind_hint?: string;
  properties: Record<string, string>;
  attachments?: Array<{
    blob_hash: string;
    file_name?: string;
    mime?: string;
  }>;
  idempotency_key?: string;
}

export interface QueuedCaptureEnvelope extends CaptureEnvelope {
  /** Client-local retry metadata, stored separately from the wire envelope. */
  local_file_paths?: string[];
}

export interface CaptureQueueLocalMetadata {
  localFilePaths: string[];
}

export interface CaptureReceipt {
  id: string;
  created?: boolean;
  clientId?: string;
  slug?: string;
  [key: string]: unknown;
}

export interface CaptureQueueEntry {
  id: string;
  envelope: CaptureEnvelope;
  localFilePaths?: string[];
  state: CaptureQueueState;
  attempts: number;
  createdAt: number;
  updatedAt: number;
  nextAttemptAt: number;
  lastError?: string;
  receipt?: CaptureReceipt;
}

export interface CaptureQueueStorage {
  read(): Promise<CaptureQueueEntry[]>;
  write(entries: CaptureQueueEntry[]): Promise<void>;
}

export interface CaptureSendResult {
  ok: boolean;
  retryable?: boolean;
  status?: number;
  error?: string;
  receipt?: CaptureReceipt;
}

export interface CaptureQueueOptions {
  storage: CaptureQueueStorage;
  send(
    envelope: CaptureEnvelope,
    metadata: CaptureQueueLocalMetadata,
  ): Promise<CaptureSendResult>;
  maxAttempts?: number;
  retryBaseMs?: number;
  now?: () => number;
}

export interface CaptureQueue {
  enqueue(envelope: QueuedCaptureEnvelope): Promise<CaptureQueueEntry>;
  drain(): Promise<CaptureQueueEntry[]>;
  list(): Promise<CaptureQueueEntry[]>;
}

export function createCaptureQueue(options: CaptureQueueOptions): CaptureQueue;
export function normalizeCaptureApiBase(endpoint: string): string;
export function captureEndpoint(apiBase: string): string;
export function isRetryableCaptureStatus(status: number): boolean;
