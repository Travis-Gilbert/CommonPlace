export type LibraryRefreshPolicy = 'none' | 'cron' | 'on_change';

export interface LibraryConfig {
  id: string;
  name: string;
  rootUrl: string;
  maxPages: number;
  maxDepth: number;
  includeUrlRules: string[];
  excludeUrlRules: string[];
  renderMode: 'fetch' | 'browser';
  refreshPolicy: LibraryRefreshPolicy;
  refreshSchedule?: 'hourly' | 'daily' | 'weekly' | 'monthly';
}

export interface LibraryRecord {
  id: string;
  name: string;
  rootUrl: string;
  maxPages: number;
  maxDepth: number;
  refreshPolicy: LibraryRefreshPolicy;
  refreshSchedule?: string;
  updatedAtMs?: number;
}

export interface LibraryReceipt {
  receiptId: string;
  pagesFetched?: number;
  changedPages?: number;
  factsDeposited?: number;
  meteredCost?: { unit: string; quantity: number };
}

export interface LibraryQueryResult {
  libraryId: string;
  result: unknown;
}

export type LibraryAction =
  | { action: 'list' }
  | { action: 'create'; config: LibraryConfig }
  | { action: 'query'; libraryId: string; query: Record<string, unknown> };

export interface LibraryActionResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

const ENDPOINT = '/api/theorem/libraries';

export async function runLibraryAction(action: LibraryAction): Promise<LibraryActionResult> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action),
    cache: 'no-store',
  });
  const result = (await response.json().catch(() => null)) as LibraryActionResult | null;
  if (!result) {
    throw new Error(`Library action failed (${response.status}).`);
  }
  return result;
}

export function libraryRecords(value: unknown): LibraryRecord[] {
  const payload = unwrapGraphqlField(value, 'libraries');
  const nodes = objectValue(payload)?.libraries;
  if (!Array.isArray(nodes)) return [];
  return nodes.flatMap((node) => {
    const record = objectValue(node);
    const properties = objectValue(record?.properties);
    if (!properties) return [];
    const id = text(properties.library_id);
    const name = text(properties.name);
    const rootUrl = text(properties.root_url);
    if (!id || !name || !rootUrl) return [];
    return [{
      id,
      name,
      rootUrl,
      maxPages: number(properties.max_pages),
      maxDepth: number(properties.max_depth),
      refreshPolicy: refreshPolicy(properties.refresh_policy),
      refreshSchedule: text(properties.refresh_schedule) || undefined,
      updatedAtMs: optionalNumber(properties.updated_at_ms),
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

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function refreshPolicy(value: unknown): LibraryRefreshPolicy {
  return value === 'cron' || value === 'on_change' ? value : 'none';
}
