// SOURCING: none — structural gate for chart specs; Observable Plot is canonical render (HANDOFF-CANON C3)
/**
 * Validates chart projection specs without pulling vega-lite.
 * Specs may still use a Vega-Lite-shaped JSON for migration; Plot renders them.
 */

export const ALLOWED_CHART_MARKS = new Set([
  'area',
  'bar',
  'circle',
  'line',
  'point',
  'rect',
  'square',
  'tick',
]);

export interface ChartGateResult {
  ok: boolean;
  reason?: string;
}

/** @deprecated Prefer validateChartSpec; name kept for existing call sites. */
export function validateVegaLiteChartSpec(spec: unknown): ChartGateResult {
  return validateChartSpec(spec);
}

export function validateChartSpec(spec: unknown): ChartGateResult {
  if (!isRecord(spec)) return { ok: false, reason: 'chart spec must be an object' };
  const structuralReason = inspectChartSpec(spec);
  if (structuralReason) return { ok: false, reason: structuralReason };
  return { ok: true };
}

function inspectChartSpec(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const reason = inspectChartSpec(item);
      if (reason) return reason;
    }
    return undefined;
  }
  if (!isRecord(value)) return undefined;

  const data = value.data;
  if (isRecord(data)) {
    if (typeof data.url === 'string') return 'external data URLs are not allowed';
    if (!('values' in data)) return 'chart data must use inline values';
  }

  const mark = value.mark;
  if (typeof mark === 'string' && !ALLOWED_CHART_MARKS.has(mark)) {
    return `mark ${mark} is not allowed`;
  }
  if (isRecord(mark)) {
    const markType = mark.type;
    if (typeof markType !== 'string') return 'mark type is required';
    if (!ALLOWED_CHART_MARKS.has(markType)) return `mark ${markType} is not allowed`;
  }

  for (const child of Object.values(value)) {
    const reason = inspectChartSpec(child);
    if (reason) return reason;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
