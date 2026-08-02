/**
 * Den telemetry, severed.
 *
 * SPEC-COMMONPLACE-OPENWORK-FORK-1.0 OW1. Upstream posted usage signals to
 * `POST {denBaseUrl}/v1/telemetry/ingest`, activating lazily once the user was
 * signed into Den. Den is gone, so the reporter is gone with it.
 *
 * The exported surface is preserved so existing call sites keep compiling.
 * Every function is a no-op; none reads Den settings and none constructs a URL.
 *
 * ponytail: no-op rather than deleted, same reasoning as `analytics.ts` — one
 * inert module beats editing every caller to prove a negative.
 */

export type TelemetryDimensionInput = {
  type: string;
  value?: string;
  label: string;
  metadata?: Record<string, unknown>;
};

type TelemetryEventFields = {
  sessionId?: string;
  durationMs?: number;
  success?: boolean;
  dimensions?: TelemetryDimensionInput[];
};

/* eslint-disable @typescript-eslint/no-unused-vars */

export function trackTelemetryEvent(_type: string, _fields: TelemetryEventFields = {}): void {}

export function trackSessionActive(
  _sessionId?: string,
  _dimensions?: TelemetryDimensionInput[],
): void {}

export function trackTaskStarted(
  _sessionId: string,
  _dimensions?: TelemetryDimensionInput[],
): void {}

export function trackTaskCompleted(_sessionId: string, _durationMs: number): void {}

export function trackTaskFailed(_sessionId: string, _durationMs: number): void {}

export function flushTelemetry(): void {}
