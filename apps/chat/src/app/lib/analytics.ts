/**
 * Analytics, severed.
 *
 * SPEC-COMMONPLACE-OPENWORK-FORK-1.0 OW1: no telemetry leaves this app.
 * Upstream shipped a PostHog client with a baked-in publishable project key
 * (`analytics-key.ts`, deleted) that defaulted to ON in production builds, and
 * an `identify()` path that linked the anonymous id to the signed-in Den user.
 *
 * The public surface is preserved so the existing call sites keep compiling, and
 * the local inspector mirror is preserved because coded evals assert on
 * `window.__openwork.record("analytics.<event>")`. What is gone is the network:
 * no key, no host, no queue, no flush, no identify.
 *
 * ponytail: kept as a typed no-op rather than deleted, because deleting it means
 * editing every call site to prove a negative. One file that cannot network is
 * the smaller and more auditable guarantee.
 */
import { recordInspectorEvent } from "./app-inspector";

export type AnalyticsProperties = Record<string, string | number | boolean | null>;

/** Always false. No analytics backend exists in this fork. */
export function isAnalyticsEnabled(): boolean {
  return false;
}

/**
 * Upstream minted and persisted a stable per-install id to correlate events
 * across sessions. With no backend there is nothing to correlate, so this
 * returns a constant instead of creating and storing an identifier.
 */
export function getAnalyticsDistinctId(): string {
  return "anonymous";
}

/** Mirrors to the local inspector only. Never enqueues, never sends. */
export function captureAnalyticsEvent(event: string, properties: AnalyticsProperties = {}) {
  try {
    recordInspectorEvent(`analytics.${event}`, properties);
  } catch {
    // Inspector unavailable (non-browser context).
  }
}

export async function flushAnalytics(): Promise<void> {
  // Nothing is queued, so there is nothing to flush.
}

// Task-run timing is read back by the session UI to show elapsed time, so the
// in-memory map stays. It is process-local and never transmitted.
const taskRunStarts = new Map<string, number>();

export function markTaskRunStart(sessionId: string) {
  taskRunStarts.set(sessionId, Date.now());
}

export function takeTaskRunStart(sessionId: string): number | null {
  const started = taskRunStarts.get(sessionId);
  if (started === undefined) return null;
  taskRunStarts.delete(sessionId);
  return started;
}

export function initAnalytics() {
  // No client to initialise.
}

export function disposeAnalytics() {
  taskRunStarts.clear();
}
