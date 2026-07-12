import type { Page } from '@playwright/test';

/** INP budget for the CommonPlace core interactions (SPEC-UX-PHYSICS D7). */
export const INP_BUDGET_MS = 200;

/**
 * Upper bound for prompt first feedback under the wait ladder (WL). T0 (< 300ms)
 * renders nothing and T1 morphs the control; feedback that lands within the T2
 * boundary (2s) is well inside the tier rules for an optimistic interaction.
 */
export const FIRST_FEEDBACK_TIER_MS = 2000;

/** Accessible name of the one true indeterminate spinner (WeaveSpinner). */
export const THINKING_SPINNER = { role: 'status' as const, name: 'Thinking' };

/** CommandBar capture input placeholder (the real capture affordance on /commonplace). */
export const CAPTURE_PLACEHOLDER = 'Search, capture, or / for commands';

interface DurationWindow {
  __cpDurations?: number[];
  __cpPO?: PerformanceObserver;
}

/**
 * Measure the worst interaction latency (INP-style: input to next paint) that
 * occurs while `action` runs, using the browser Event Timing API. Returns the
 * max reported event `duration` in ms, or 0 when no interaction crossed the
 * ~16ms reporting threshold (i.e. everything was fast). A handler that blocks
 * past the 200ms budget shows up here directly.
 */
export async function measureInteractionLatencyMs(
  page: Page,
  action: () => Promise<void>,
): Promise<number> {
  await page.evaluate(() => {
    const w = window as unknown as DurationWindow;
    w.__cpDurations = [];
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        w.__cpDurations!.push((entry as PerformanceEntry & { duration: number }).duration);
      }
    });
    po.observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
    w.__cpPO = po;
  });

  await action();

  // Let the post-interaction paint settle so Event Timing finalizes the entry.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.waitForTimeout(120);

  return page.evaluate(() => {
    const w = window as unknown as DurationWindow;
    w.__cpPO?.disconnect();
    const arr = w.__cpDurations ?? [];
    return arr.length ? Math.max(...arr) : 0;
  });
}

/** Resolve true if `locator` becomes visible within `timeout`, false otherwise (no throw). */
export async function becomesVisible(
  locator: import('@playwright/test').Locator,
  timeout: number,
): Promise<boolean> {
  return locator
    .waitFor({ state: 'visible', timeout })
    .then(() => true)
    .catch(() => false);
}
