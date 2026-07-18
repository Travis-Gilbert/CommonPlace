export interface HarnessSignalModel {
  id: string;
  consumer: string;
  version: string;
  signalCount: number;
  trainedThroughMs: number;
  createdAtMs: number;
  weightedPrecision: number;
  calibrationError: number;
  reason: string;
}

const ENDPOINT = '/api/theorem/signal-models';

export async function fetchHarnessSignalModels(): Promise<HarnessSignalModel[]> {
  const response = await fetch(ENDPOINT, { method: 'GET', cache: 'no-store' });
  const result = await response.json().catch(() => null) as { ok?: boolean; data?: unknown; error?: string } | null;
  if (!response.ok || !result?.ok) {
    throw new Error(result?.error || 'Harness models unavailable (' + response.status + ').');
  }
  return harnessSignalModels(result.data);
}

export function harnessSignalModels(value: unknown): HarnessSignalModel[] {
  const payload = unwrapGraphqlField(value, 'harnessModelCatalog');
  const models = objectValue(payload)?.models;
  if (!Array.isArray(models)) return [];
  return models.flatMap((valueModel) => {
    const model = objectValue(valueModel);
    const evaluation = objectValue(model?.evaluation);
    const candidate = objectValue(evaluation?.candidate);
    const id = text(model?.id);
    const consumer = text(model?.consumer);
    const version = text(model?.version);
    if (!id || !consumer || !version || !candidate) return [];
    return [{
      id,
      consumer,
      version,
      signalCount: number(model?.signal_count),
      trainedThroughMs: number(model?.trained_through_ms),
      createdAtMs: number(model?.created_at_ms),
      weightedPrecision: number(candidate.weighted_precision),
      calibrationError: number(candidate.calibration_error),
      reason: text(evaluation?.reason),
    }];
  });
}

function unwrapGraphqlField(value: unknown, field: string): unknown {
  const root = objectValue(value);
  const result = objectValue(root?.result) ?? root;
  const structured = objectValue(result?.structuredContent) ?? objectValue(result?.structured_content);
  const envelope = structured ?? result;
  return objectValue(envelope?.data)?.[field] ?? envelope?.[field];
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function number(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
