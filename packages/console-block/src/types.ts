export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export type ReadinessState = 'ready' | 'building' | 'unavailable';

export interface CapabilityReadiness {
  readonly capability: string;
  readonly state: ReadinessState;
  readonly detail: string;
}

export interface StoreOverview {
  readonly counts_by_type: readonly (readonly [string, number])[];
  readonly generation: number;
  readonly readiness: readonly CapabilityReadiness[];
}

export interface GoldenRecord {
  readonly id: string;
  readonly entity_type: string;
  readonly title: string;
  readonly fields: Readonly<Record<string, JsonValue>>;
  readonly updated_at_ms: number;
}

export interface MergeReceipt {
  readonly id: string;
  readonly golden_id: string;
  readonly merged_ids: readonly string[];
  readonly confidence_ppm: number;
  readonly decided_at_ms: number;
  readonly basis: readonly string[];
}

export interface DoppelgangerCandidate {
  readonly candidate_id: string;
  readonly confidence_ppm: number;
  readonly shared_signals: readonly string[];
}

export type ReceiptKind = 'ingest' | 'merge' | 'query_firing' | 'consent';

export interface Receipt {
  readonly id: string;
  readonly kind: ReceiptKind;
  readonly subject_id: string;
  readonly actor: string;
  readonly occurred_at_ms: number;
  readonly summary: string;
  readonly evidence: Readonly<Record<string, JsonValue>>;
}

export interface EntityDetail {
  readonly record: GoldenRecord;
  readonly merges: readonly MergeReceipt[];
  readonly receipts: readonly Receipt[];
  readonly candidates: readonly DoppelgangerCandidate[];
}

export interface ReceiptFilter {
  readonly kind?: ReceiptKind;
  readonly subject_id?: string;
}

export interface Page {
  readonly cursor?: string;
  readonly limit: number;
}

export interface ReceiptPage {
  readonly receipts: readonly Receipt[];
  readonly next_cursor?: string;
  readonly total: number;
}

export interface GraphNode {
  readonly id: string;
  readonly golden_id?: string;
  readonly node_type: string;
  readonly label: string;
}

export interface GraphEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly edge_type: string;
  readonly weight: number;
}

export interface GraphSlice {
  readonly root: string;
  readonly depth: number;
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

export interface StandingQueryDefinition {
  readonly id: string;
  readonly name: string;
  readonly shape: string;
  readonly enabled: boolean;
}

export interface StandingFiring {
  readonly query_id: string;
  readonly sequence: number;
  readonly occurred_at_ms: number;
  readonly matched_ids: readonly string[];
  readonly receipt_id: string;
}

export type PluginState = 'available' | 'pending_consent' | 'installed' | 'denied';

export interface PluginInfo {
  readonly app_id: string;
  readonly version: string;
  readonly state: PluginState;
  readonly grants: readonly string[];
  readonly contributions: readonly string[];
}

export interface ConsoleSnapshot {
  readonly contract_version: string;
  readonly overview: StoreOverview;
  readonly entities: readonly EntityDetail[];
  readonly receipts: readonly Receipt[];
  readonly graph: GraphSlice;
  readonly standing_queries: readonly StandingQueryDefinition[];
  readonly firings: readonly StandingFiring[];
  readonly plugin: PluginInfo;
}

export interface NodePosition {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly pinned: boolean;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function jsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true;
  }
  if (Array.isArray(value)) return value.every(jsonValue);
  const object = record(value);
  return object !== null && Object.values(object).every(jsonValue);
}

function jsonRecord(value: unknown): value is Readonly<Record<string, JsonValue>> {
  const object = record(value);
  return object !== null && Object.values(object).every(jsonValue);
}

function receipt(value: unknown): value is Receipt {
  const item = record(value);
  return (
    item !== null &&
    typeof item.id === 'string' &&
    (item.kind === 'ingest' ||
      item.kind === 'merge' ||
      item.kind === 'query_firing' ||
      item.kind === 'consent') &&
    typeof item.subject_id === 'string' &&
    typeof item.actor === 'string' &&
    typeof item.occurred_at_ms === 'number' &&
    Number.isFinite(item.occurred_at_ms) &&
    typeof item.summary === 'string' &&
    jsonRecord(item.evidence)
  );
}

function entityDetail(value: unknown): value is EntityDetail {
  const detail = record(value);
  const golden = record(detail?.record);
  return (
    detail !== null &&
    golden !== null &&
    typeof golden.id === 'string' &&
    typeof golden.entity_type === 'string' &&
    typeof golden.title === 'string' &&
    jsonRecord(golden.fields) &&
    typeof golden.updated_at_ms === 'number' &&
    Number.isFinite(golden.updated_at_ms) &&
    Array.isArray(detail.merges) &&
    detail.merges.every((value) => {
      const merge = record(value);
      return (
        merge !== null &&
        typeof merge.id === 'string' &&
        typeof merge.golden_id === 'string' &&
        stringArray(merge.merged_ids) &&
        typeof merge.confidence_ppm === 'number' &&
        typeof merge.decided_at_ms === 'number' &&
        stringArray(merge.basis)
      );
    }) &&
    Array.isArray(detail.receipts) &&
    detail.receipts.every(receipt) &&
    Array.isArray(detail.candidates) &&
    detail.candidates.every((value) => {
      const candidate = record(value);
      return (
        candidate !== null &&
        typeof candidate.candidate_id === 'string' &&
        typeof candidate.confidence_ppm === 'number' &&
        stringArray(candidate.shared_signals)
      );
    })
  );
}

export function isConsoleSnapshot(value: unknown): value is ConsoleSnapshot {
  const candidate = record(value);
  const overview = record(candidate?.overview);
  const graph = record(candidate?.graph);
  const plugin = record(candidate?.plugin);
  return (
    candidate !== null &&
    candidate.contract_version === 'commonplace-console-core/v1' &&
    overview !== null &&
    Array.isArray(overview.counts_by_type) &&
    overview.counts_by_type.every(
      (count) =>
        Array.isArray(count) &&
        count.length === 2 &&
        typeof count[0] === 'string' &&
        typeof count[1] === 'number',
    ) &&
    typeof overview.generation === 'number' &&
    Array.isArray(overview.readiness) &&
    overview.readiness.every((value) => {
      const readiness = record(value);
      return (
        readiness !== null &&
        typeof readiness.capability === 'string' &&
        (readiness.state === 'ready' ||
          readiness.state === 'building' ||
          readiness.state === 'unavailable') &&
        typeof readiness.detail === 'string'
      );
    }) &&
    Array.isArray(candidate.entities) &&
    candidate.entities.every(entityDetail) &&
    Array.isArray(candidate.receipts) &&
    candidate.receipts.every(receipt) &&
    graph !== null &&
    typeof graph.root === 'string' &&
    typeof graph.depth === 'number' &&
    Array.isArray(graph.nodes) &&
    graph.nodes.every((value) => {
      const node = record(value);
      return (
        node !== null &&
        typeof node.id === 'string' &&
        (node.golden_id === undefined || typeof node.golden_id === 'string') &&
        typeof node.node_type === 'string' &&
        typeof node.label === 'string'
      );
    }) &&
    Array.isArray(graph.edges) &&
    graph.edges.every((value) => {
      const edge = record(value);
      return (
        edge !== null &&
        typeof edge.id === 'string' &&
        typeof edge.source === 'string' &&
        typeof edge.target === 'string' &&
        typeof edge.edge_type === 'string' &&
        typeof edge.weight === 'number'
      );
    }) &&
    Array.isArray(candidate.standing_queries) &&
    candidate.standing_queries.every((value) => {
      const query = record(value);
      return (
        query !== null &&
        typeof query.id === 'string' &&
        typeof query.name === 'string' &&
        typeof query.shape === 'string' &&
        typeof query.enabled === 'boolean'
      );
    }) &&
    Array.isArray(candidate.firings) &&
    candidate.firings.every((value) => {
      const firing = record(value);
      return (
        firing !== null &&
        typeof firing.query_id === 'string' &&
        typeof firing.sequence === 'number' &&
        typeof firing.occurred_at_ms === 'number' &&
        stringArray(firing.matched_ids) &&
        typeof firing.receipt_id === 'string'
      );
    }) &&
    plugin !== null &&
    typeof plugin.app_id === 'string' &&
    typeof plugin.version === 'string' &&
    (plugin.state === 'available' ||
      plugin.state === 'pending_consent' ||
      plugin.state === 'installed' ||
      plugin.state === 'denied') &&
    stringArray(plugin.grants) &&
    stringArray(plugin.contributions)
  );
}
