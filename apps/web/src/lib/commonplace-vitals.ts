'use client';

/**
 * CommonPlace latency instrumentation (SPEC-UX-PHYSICS D7.1 / plan UX-D7.1).
 *
 * Reports INP (Interaction to Next Paint) for the core CommonPlace
 * interactions (capture submit, tab switch, object open, approve) against a
 * 200ms budget. INP is the browser-native measure of interaction latency the
 * D7 budget is written in terms of; LCP and CLS are reported alongside it for
 * context. Each report is dispatched as a real `cp:vitals` CustomEvent on
 * `window` (a genuine, observable, testable sink) and, in development only,
 * mirrored to the console as a diagnostic.
 *
 * Offline-build honesty note: `web-vitals` is declared in package.json but is
 * NOT resolvable from the warm offline pnpm store this worktree installs from.
 * The import is therefore loaded dynamically and guarded. Offline the import
 * throws and the reporter is a documented no-op. In CI, where install has
 * network and `web-vitals` is present, the dynamic import resolves and
 * reporting activates automatically. No fabricated metric is ever emitted in
 * either case: if the library cannot load, nothing is reported.
 */

import { useEffect } from 'react';

/** INP budget for the CommonPlace core interactions, in milliseconds (D7). */
export const CP_INP_BUDGET_MS = 200;

/** Event name for the real reporting sink other code and tests can listen to. */
export const CP_VITALS_EVENT = 'cp:vitals';

/** Shape of a single reported metric. */
export interface CpVitalReport {
  /** Metric id: 'INP' | 'LCP' | 'CLS'. */
  name: string;
  /** Milliseconds for INP/LCP; unitless layout-shift score for CLS. */
  value: number;
  /** web-vitals rating bucket, or 'unknown' when unavailable. */
  rating: string;
  /** True only for INP values over CP_INP_BUDGET_MS. */
  overBudget: boolean;
  /** Best-effort CSS selector for the interaction target, when attributed. */
  target?: string;
}

/** Minimal structural type for a web-vitals metric (avoids depending on its types at compile time). */
interface WebVitalMetric {
  name: string;
  value: number;
  rating?: 'good' | 'needs-improvement' | 'poor';
  entries?: ReadonlyArray<{ target?: Element | null }>;
}

type MetricHandler = (metric: WebVitalMetric) => void;

/** Derive a stable-ish CSS selector for the element an interaction was attributed to. */
function interactionTarget(metric: WebVitalMetric): string | undefined {
  const el = metric.entries?.find((entry) => entry.target)?.target as HTMLElement | undefined | null;
  if (!el) return undefined;
  if (el.id) return `#${el.id}`;
  const tag = el.tagName ? el.tagName.toLowerCase() : 'node';
  const className = typeof el.className === 'string' ? el.className.trim() : '';
  return className ? `${tag}.${className.split(/\s+/).join('.')}` : tag;
}

/** Dispatch one metric to the real CustomEvent sink (and dev console). */
function emit(report: CpVitalReport): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<CpVitalReport>(CP_VITALS_EVENT, { detail: report }));
  }
  if (process.env.NODE_ENV !== 'production') {
    const unit = report.name === 'CLS' ? '' : 'ms';
    const budget =
      report.name === 'INP'
        ? ` (budget ${CP_INP_BUDGET_MS}ms${report.overBudget ? ', OVER' : ''})`
        : '';
    const line = `[cp-vitals] ${report.name} ${Math.round(report.value)}${unit}${budget}`;
    // Dev-only diagnostic. The CustomEvent above is the real, testable sink.
    if (report.overBudget) {
      console.warn(line);
    } else {
      console.info(line);
    }
  }
}

let started = false;

/**
 * Start CommonPlace latency reporting once per page. Safe to call repeatedly.
 *
 * Returns a promise that resolves after the (guarded) dynamic import settles,
 * so tests can await activation; it never rejects.
 */
export async function initCommonplaceVitals(): Promise<void> {
  if (typeof window === 'undefined' || started) return;
  started = true;
  try {
    // web-vitals is an optional-at-build dependency here (see file header):
    // resolved dynamically so an offline install cannot break typecheck or
    // the running app. Activates automatically once installed in CI.
    // @ts-ignore optional dependency resolved at runtime, absent in the offline store
    const vitals = await import('web-vitals');
    const onINP = vitals.onINP as ((cb: MetricHandler) => void) | undefined;
    const onLCP = vitals.onLCP as ((cb: MetricHandler) => void) | undefined;
    const onCLS = vitals.onCLS as ((cb: MetricHandler) => void) | undefined;

    onINP?.((metric) => {
      emit({
        name: 'INP',
        value: metric.value,
        rating: metric.rating ?? 'unknown',
        overBudget: metric.value > CP_INP_BUDGET_MS,
        target: interactionTarget(metric),
      });
    });
    onLCP?.((metric) => {
      emit({ name: 'LCP', value: metric.value, rating: metric.rating ?? 'unknown', overBudget: false });
    });
    onCLS?.((metric) => {
      emit({ name: 'CLS', value: metric.value, rating: metric.rating ?? 'unknown', overBudget: false });
    });
  } catch {
    // web-vitals not installed (offline store): documented no-op. Instrumentation
    // activates automatically once the dependency installs in CI. Nothing is reported.
  }
}

/**
 * Mount-once client component for the CommonPlace layout. Renders nothing; its
 * only effect is to start latency reporting on the client.
 */
export function CommonPlaceVitals(): null {
  useEffect(() => {
    void initCommonplaceVitals();
  }, []);
  return null;
}
