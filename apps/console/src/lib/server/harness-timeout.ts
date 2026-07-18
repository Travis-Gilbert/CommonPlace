const DEFAULT_HARNESS_TIMEOUT_MS = 15_000;
const MIN_HARNESS_TIMEOUT_MS = 1_000;
const MAX_HARNESS_TIMEOUT_MS = 60_000;

function configuredTimeoutMs(): number {
  const configured = Number(process.env.CONSOLE_HARNESS_TIMEOUT_MS);
  if (!Number.isFinite(configured)) return DEFAULT_HARNESS_TIMEOUT_MS;
  return Math.min(MAX_HARNESS_TIMEOUT_MS, Math.max(MIN_HARNESS_TIMEOUT_MS, configured));
}

export function startHarnessRequestTimeout(): {
  readonly signal: AbortSignal;
  readonly didTimeout: () => boolean;
  readonly clear: () => void;
} {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, configuredTimeoutMs());

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    clear: () => clearTimeout(timer),
  };
}
