/**
 * Client-observed usage receipts (HANDOFF-WAIT-LADDER WL-4c).
 *
 * A usage receipt records the cost signals the browser can measure for one
 * ask request, keyed by the provider route that served it. The one signal a
 * browser can measure on its own is TTFT: time to first streamed token, taken
 * with performance.now() from request start to the first token event.
 *
 * The receipt is built per request (askTheseusAsyncStream measures it, the
 * chat surface stores it on the assistant message, the message footer shows
 * it). A cross-session usage ledger and server-side (Django) persistence of
 * TTFT into the durable usage receipt are a backend follow-up; this is the
 * client half, and every number here is a real elapsed-time measurement, not
 * an estimate.
 */

export interface UsageReceipt {
  /** Provider route that served the request (endpoint path). */
  route: string;
  /** Stable id of the pipeline/model provider behind that route. */
  provider: string;
  /** Client-observed time to first streamed token, in milliseconds. */
  ttftMs: number;
  /** Epoch ms when the first token was observed. */
  observedAt: number;
}

/**
 * Build a TTFT usage receipt from an already-measured elapsed time. The caller
 * measures ttftMs with performance.now(); this only stamps the route/provider
 * key and the observation time, so no number here is ever fabricated.
 */
export function buildTtftReceipt(
  route: string,
  provider: string,
  ttftMs: number,
  observedAt: number = Date.now(),
): UsageReceipt {
  return { route, provider, ttftMs, observedAt };
}
