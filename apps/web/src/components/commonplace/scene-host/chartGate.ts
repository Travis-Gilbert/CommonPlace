import { compile, type TopLevelSpec } from 'vega-lite';

export const ALLOWED_VEGA_LITE_MARKS = new Set([
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

export function validateVegaLiteChartSpec(spec: unknown): ChartGateResult {
  if (!isRecord(spec)) return { ok: false, reason: 'chart spec must be an object' };
  const structuralReason = inspectVegaLiteSpec(spec);
  if (structuralReason) return { ok: false, reason: structuralReason };
  try {
    compile(spec as unknown as TopLevelSpec);
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? `vega-lite schema validation failed: ${error.message}` : 'vega-lite schema validation failed',
    };
  }
  return { ok: true };
}

function inspectVegaLiteSpec(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const reason = inspectVegaLiteSpec(item);
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
  if (typeof mark === 'string' && !ALLOWED_VEGA_LITE_MARKS.has(mark)) {
    return `mark ${mark} is not allowed`;
  }
  if (isRecord(mark)) {
    const markType = mark.type;
    if (typeof markType !== 'string') return 'mark type is required';
    if (!ALLOWED_VEGA_LITE_MARKS.has(markType)) return `mark ${markType} is not allowed`;
  }

  for (const child of Object.values(value)) {
    const reason = inspectVegaLiteSpec(child);
    if (reason) return reason;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
