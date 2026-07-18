export type TopicStatus = 'active' | 'paused' | 'error';

export interface TopicConfig {
  id: string;
  name: string;
  intent: string;
  status: TopicStatus;
  cadenceSeconds: number;
  seedUrls: string[];
  queries: string[];
  allowedHosts: string[];
  maxDepth: number;
  maxItems: number;
  maxBytes: number;
  maxSeconds: number;
  maxWorkUnits: number;
}

export interface TopicRecord {
  id: string;
  name: string;
  intent: string;
  status: TopicStatus;
  cadenceSeconds?: number;
  documentCount: number;
  destinationCount: number;
  connectorCount: number;
  lastRunAtMs?: number;
  nextRunAtMs?: number;
  updatedAtMs?: number;
  gateModelVersion?: string;
  learningSignalCount: number;
  feedbackAcceptRate?: number;
  lastTrainingAtMs?: number;
  trainingPrecision?: number;
  trainingCalibrationError?: number;
  trainingDecision?: string;
}

export type TopicAction =
  | { action: 'list' }
  | { action: 'create'; config: TopicConfig }
  | { action: 'plan'; topicId: string; sequence?: number };

export interface TopicActionResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

const ENDPOINT = '/api/theorem/topics';

export async function runTopicAction(action: TopicAction): Promise<TopicActionResult> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action),
    cache: 'no-store',
  });
  const result = (await response.json().catch(() => null)) as TopicActionResult | null;
  if (!result) throw new Error(`Topic action failed (${response.status}).`);
  return result;
}

export function topicRecords(value: unknown): TopicRecord[] {
  const payload = unwrapGraphqlField(value, 'topics');
  const nodes = objectValue(payload)?.topics;
  if (!Array.isArray(nodes)) return [];
  return nodes.flatMap((node) => {
    const record = objectValue(node);
    const properties = objectValue(record?.properties);
    const extra = objectValue(properties?.extra);
    const subscription = objectValue(extra?.subscription);
    if (!properties || !extra || !subscription) return [];
    const id = text(properties.topic_id);
    const name = text(properties.title) || text(subscription.name);
    const intent = bodyText(properties.body) || text(subscription.intent);
    if (!id || !name) return [];
    return [{
      id,
      name,
      intent,
      status: topicStatus(properties.status),
      cadenceSeconds: cadenceSeconds(properties.cadence),
      documentCount: number(properties.document_count),
      destinationCount: number(properties.destination_count),
      connectorCount: number(extra.connector_count),
      lastRunAtMs: optionalNumber(properties.last_run_at_ms),
      nextRunAtMs: optionalNumber(properties.next_run_at_ms),
      updatedAtMs: optionalNumber(properties.updated_at_ms),
      gateModelVersion: optionalText(properties.gate_model_version),
      learningSignalCount: number(properties.learning_signal_count),
      feedbackAcceptRate: optionalNumber(properties.feedback_accept_rate),
      lastTrainingAtMs: optionalNumber(properties.last_training_at_ms),
      trainingPrecision: optionalNumber(properties.training_precision),
      trainingCalibrationError: optionalNumber(properties.training_calibration_error),
      trainingDecision: optionalText(properties.training_decision),
    }];
  });
}

export function unwrapGraphqlField(value: unknown, field: string): unknown {
  const root = objectValue(value);
  const result = objectValue(root?.result) ?? root;
  const structured = objectValue(result?.structuredContent) ?? objectValue(result?.structured_content);
  const envelope = structured ?? result;
  const data = objectValue(envelope?.data);
  return data?.[field] ?? envelope?.[field];
}

function cadenceSeconds(value: unknown): number | undefined {
  const cadence = objectValue(value);
  return cadence?.kind === 'interval' ? optionalNumber(cadence.every_seconds) : undefined;
}

function bodyText(value: unknown): string {
  const body = objectValue(value);
  return body?.body_kind === 'inline' ? text(body.text) : '';
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalText(value: unknown): string | undefined {
  const valueText = text(value);
  return valueText || undefined;
}

function number(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function topicStatus(value: unknown): TopicStatus {
  return value === 'paused' || value === 'error' ? value : 'active';
}
