import 'server-only';

import {
  CONSOLE_READS,
  PLUGIN_CONSENT,
  PLUGIN_DENY,
  PLUGIN_STATE,
  PLUGIN_UNINSTALL,
} from '@commonplace/console-block/graphql';
import {
  CONSOLE_APP_ID,
  CONSOLE_PANE_KIND,
  CORPUS_READ_GRANT,
  type ConsolePluginStatus,
} from '@commonplace/console-block/plugin';
import {
  isConsoleSnapshot,
  type ConsoleSnapshot,
  type DoppelgangerCandidate,
  type EntityDetail,
  type GraphEdge,
  type GraphNode,
  type MergeReceipt,
  type Receipt,
  type StandingFiring,
} from '@commonplace/console-block/types';
import { callHarnessGraphql } from '@/lib/server/harness-graphql';

export type ConsoleSnapshotRead =
  | { readonly ok: true; readonly snapshot: ConsoleSnapshot }
  | { readonly ok: false; readonly status: number; readonly error: string };

export type ConsolePluginStatusRead =
  | { readonly ok: true; readonly plugin: ConsolePluginStatus }
  | { readonly ok: false; readonly status: number; readonly error: string };

export type ConsolePluginMutation = 'consent' | 'deny' | 'uninstall';

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeGraphNode(value: unknown): GraphNode | null {
  const node = record(value);
  if (!node || typeof node.id !== 'string') return null;
  return {
    id: node.id,
    golden_id:
      typeof node.golden_id === 'string'
        ? node.golden_id
        : typeof node.goldenId === 'string'
          ? node.goldenId
          : undefined,
    node_type:
      typeof node.node_type === 'string'
        ? node.node_type
        : typeof node.nodeType === 'string'
          ? node.nodeType
          : 'unknown',
    label: typeof node.label === 'string' ? node.label : node.id,
  };
}

function normalizeGraphEdge(value: unknown): GraphEdge | null {
  const edge = record(value);
  if (
    !edge ||
    typeof edge.id !== 'string' ||
    typeof edge.source !== 'string' ||
    typeof edge.target !== 'string'
  ) {
    return null;
  }
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    edge_type:
      typeof edge.edge_type === 'string'
        ? edge.edge_type
        : typeof edge.edgeType === 'string'
          ? edge.edgeType
          : 'related',
    weight: typeof edge.weight === 'number' ? edge.weight : 1,
  };
}

function normalizeReceipt(value: unknown): Receipt | null {
  const receipt = record(value);
  const kind = receipt?.kind;
  if (
    !receipt ||
    typeof receipt.id !== 'string' ||
    (kind !== 'ingest' && kind !== 'merge' && kind !== 'query_firing' && kind !== 'consent')
  ) {
    return null;
  }
  const subjectId =
    typeof receipt.subject_id === 'string'
      ? receipt.subject_id
      : typeof receipt.subjectId === 'string'
        ? receipt.subjectId
        : null;
  const occurredAt =
    typeof receipt.occurred_at_ms === 'number'
      ? receipt.occurred_at_ms
      : typeof receipt.occurredAtMs === 'number'
        ? receipt.occurredAtMs
        : null;
  const evidence = record(receipt.evidence);
  if (
    !subjectId ||
    occurredAt === null ||
    typeof receipt.actor !== 'string' ||
    typeof receipt.summary !== 'string' ||
    !evidence
  ) {
    return null;
  }
  return {
    id: receipt.id,
    kind,
    subject_id: subjectId,
    actor: receipt.actor,
    occurred_at_ms: occurredAt,
    summary: receipt.summary,
    evidence: evidence as Receipt['evidence'],
  };
}

function normalizeMerge(value: unknown): MergeReceipt | null {
  const merge = record(value);
  if (!merge || typeof merge.id !== 'string') return null;
  const goldenId =
    typeof merge.golden_id === 'string'
      ? merge.golden_id
      : typeof merge.goldenId === 'string'
        ? merge.goldenId
        : null;
  const mergedIds = Array.isArray(merge.merged_ids)
    ? merge.merged_ids
    : Array.isArray(merge.mergedIds)
      ? merge.mergedIds
      : null;
  const confidence =
    typeof merge.confidence_ppm === 'number'
      ? merge.confidence_ppm
      : typeof merge.confidencePpm === 'number'
        ? merge.confidencePpm
        : null;
  const decidedAt =
    typeof merge.decided_at_ms === 'number'
      ? merge.decided_at_ms
      : typeof merge.decidedAtMs === 'number'
        ? merge.decidedAtMs
        : null;
  if (
    !goldenId ||
    !mergedIds?.every((id) => typeof id === 'string') ||
    confidence === null ||
    decidedAt === null ||
    !Array.isArray(merge.basis) ||
    !merge.basis.every((item) => typeof item === 'string')
  ) {
    return null;
  }
  return {
    id: merge.id,
    golden_id: goldenId,
    merged_ids: mergedIds as string[],
    confidence_ppm: confidence,
    decided_at_ms: decidedAt,
    basis: merge.basis as string[],
  };
}

function normalizeCandidate(value: unknown): DoppelgangerCandidate | null {
  const candidate = record(value);
  if (!candidate) return null;
  const candidateId =
    typeof candidate.candidate_id === 'string'
      ? candidate.candidate_id
      : typeof candidate.candidateId === 'string'
        ? candidate.candidateId
        : null;
  const confidence =
    typeof candidate.confidence_ppm === 'number'
      ? candidate.confidence_ppm
      : typeof candidate.confidencePpm === 'number'
        ? candidate.confidencePpm
        : null;
  const signals = Array.isArray(candidate.shared_signals)
    ? candidate.shared_signals
    : Array.isArray(candidate.sharedSignals)
      ? candidate.sharedSignals
      : null;
  if (!candidateId || confidence === null || !signals?.every((item) => typeof item === 'string')) {
    return null;
  }
  return {
    candidate_id: candidateId,
    confidence_ppm: confidence,
    shared_signals: signals as string[],
  };
}

function normalizeEntity(value: unknown): EntityDetail | null {
  const detail = record(value);
  const golden = record(detail?.record);
  if (!detail || !golden || typeof golden.id !== 'string') return null;
  const entityType =
    typeof golden.entity_type === 'string'
      ? golden.entity_type
      : typeof golden.entityType === 'string'
        ? golden.entityType
        : null;
  const updatedAt =
    typeof golden.updated_at_ms === 'number'
      ? golden.updated_at_ms
      : typeof golden.updatedAtMs === 'number'
        ? golden.updatedAtMs
        : null;
  const fields = record(golden.fields);
  if (!entityType || updatedAt === null || typeof golden.title !== 'string' || !fields) return null;
  const merges = Array.isArray(detail.merges)
    ? detail.merges.map(normalizeMerge).filter((item): item is MergeReceipt => item !== null)
    : [];
  const receipts = Array.isArray(detail.receipts)
    ? detail.receipts.map(normalizeReceipt).filter((item): item is Receipt => item !== null)
    : [];
  const candidates = Array.isArray(detail.candidates)
    ? detail.candidates
        .map(normalizeCandidate)
        .filter((item): item is DoppelgangerCandidate => item !== null)
    : [];
  if (
    merges.length !== (Array.isArray(detail.merges) ? detail.merges.length : 0) ||
    receipts.length !== (Array.isArray(detail.receipts) ? detail.receipts.length : 0) ||
    candidates.length !== (Array.isArray(detail.candidates) ? detail.candidates.length : 0)
  ) {
    return null;
  }
  return {
    record: {
      id: golden.id,
      entity_type: entityType,
      title: golden.title,
      fields: fields as EntityDetail['record']['fields'],
      updated_at_ms: updatedAt,
    },
    merges,
    receipts,
    candidates,
  };
}

function normalizeFiring(value: unknown): StandingFiring | null {
  const firing = record(value);
  if (!firing) return null;
  const queryId =
    typeof firing.query_id === 'string'
      ? firing.query_id
      : typeof firing.queryId === 'string'
        ? firing.queryId
        : null;
  const occurredAt =
    typeof firing.occurred_at_ms === 'number'
      ? firing.occurred_at_ms
      : typeof firing.occurredAtMs === 'number'
        ? firing.occurredAtMs
        : null;
  const matchedIds = Array.isArray(firing.matched_ids)
    ? firing.matched_ids
    : Array.isArray(firing.matchedIds)
      ? firing.matchedIds
      : null;
  const receiptId =
    typeof firing.receipt_id === 'string'
      ? firing.receipt_id
      : typeof firing.receiptId === 'string'
        ? firing.receiptId
        : null;
  if (
    !queryId ||
    typeof firing.sequence !== 'number' ||
    occurredAt === null ||
    !matchedIds?.every((id) => typeof id === 'string') ||
    !receiptId
  ) {
    return null;
  }
  return {
    query_id: queryId,
    sequence: firing.sequence,
    occurred_at_ms: occurredAt,
    matched_ids: matchedIds as string[],
    receipt_id: receiptId,
  };
}

function normalizeConsoleProjection(data: Record<string, unknown>): ConsoleSnapshot | null {
  const overview = record(data.consoleOverview);
  const receipts = record(data.consoleReceipts);
  const graph = record(data.consoleNeighborhood);
  if (
    !overview ||
    !receipts ||
    !graph ||
    !Array.isArray(overview.countsByType) ||
    !Array.isArray(overview.readiness) ||
    !Array.isArray(data.consoleEntities) ||
    !Array.isArray(receipts.receipts) ||
    !Array.isArray(graph.nodes) ||
    !Array.isArray(graph.edges) ||
    !Array.isArray(data.standingQueries) ||
    !Array.isArray(data.standingFirings)
  ) {
    return null;
  }

  const candidate: ConsoleSnapshot = {
    contract_version: 'commonplace-console-core/v1',
    overview: {
      counts_by_type: Array.isArray(overview.countsByType)
        ? overview.countsByType.flatMap((value) => {
            const count = record(value);
            return count &&
              typeof count.nodeType === 'string' &&
              typeof count.count === 'number'
              ? [[count.nodeType, count.count] as const]
              : [];
          })
        : [],
      generation: typeof overview.generation === 'number' ? overview.generation : 0,
      readiness: Array.isArray(overview.readiness)
        ? overview.readiness.flatMap((value) => {
            const item = record(value);
            if (
              !item ||
              typeof item.capability !== 'string' ||
              (item.state !== 'ready' &&
                item.state !== 'building' &&
                item.state !== 'unavailable')
            ) {
              return [];
            }
            return [
              {
                capability: item.capability,
                state: item.state,
                detail: typeof item.detail === 'string' ? item.detail : '',
              },
            ];
          })
        : [],
    },
    entities: Array.isArray(data.consoleEntities)
      ? data.consoleEntities
          .map(normalizeEntity)
          .filter((item): item is EntityDetail => item !== null)
      : [],
    receipts: Array.isArray(receipts.receipts)
      ? receipts.receipts
          .map(normalizeReceipt)
          .filter((item): item is Receipt => item !== null)
      : [],
    graph: {
      root: typeof graph.root === 'string' ? graph.root : '',
      depth: typeof graph.depth === 'number' ? graph.depth : 0,
      nodes: Array.isArray(graph.nodes)
        ? graph.nodes.map(normalizeGraphNode).filter((node): node is GraphNode => node !== null)
        : [],
      edges: Array.isArray(graph.edges)
        ? graph.edges.map(normalizeGraphEdge).filter((edge): edge is GraphEdge => edge !== null)
        : [],
    },
    standing_queries: Array.isArray(data.standingQueries)
      ? data.standingQueries.flatMap((value) => {
          const query = record(value);
          return query &&
            typeof query.id === 'string' &&
            typeof query.name === 'string' &&
            typeof query.shape === 'string'
            ? [
                {
                  id: query.id,
                  name: query.name,
                  shape: query.shape,
                  enabled: query.enabled !== false,
                },
              ]
            : [];
        })
      : [],
    firings: Array.isArray(data.standingFirings)
      ? data.standingFirings
          .map(normalizeFiring)
          .filter((item): item is StandingFiring => item !== null)
      : [],
    plugin: {
      app_id: 'commonplace.console',
      version: '1.0.0',
      state: 'installed',
      grants: ['corpus:read'],
      contributions: ['pane:commonplace.console'],
    },
  };
  if (
    candidate.overview.counts_by_type.length !== overview.countsByType.length ||
    candidate.overview.readiness.length !== overview.readiness.length ||
    candidate.entities.length !== data.consoleEntities.length ||
    candidate.receipts.length !== receipts.receipts.length ||
    candidate.graph.nodes.length !== graph.nodes.length ||
    candidate.graph.edges.length !== graph.edges.length ||
    candidate.standing_queries.length !== data.standingQueries.length ||
    candidate.firings.length !== data.standingFirings.length
  ) {
    return null;
  }
  return isConsoleSnapshot(candidate) ? candidate : null;
}

export async function readConsoleSnapshot(): Promise<ConsoleSnapshotRead> {
  const receipts: Receipt[] = [];
  const seenCursors = new Set<string>();
  let receiptCursor: string | null = null;
  let expectedTotal: number | null = null;
  let snapshot: ConsoleSnapshot | null = null;

  while (true) {
    const result = await callHarnessGraphql(CONSOLE_READS, {
      root: 'node:ada',
      depth: 2,
      receiptLimit: 250,
      receiptCursor,
    });
    if (!result.ok) {
      return {
        ok: false,
        status: result.status,
        error: result.error,
      };
    }
    const page = record(result.data.consoleReceipts);
    const normalized = normalizeConsoleProjection(result.data);
    const total = page?.total;
    const nextCursor = page?.nextCursor;
    if (
      !normalized ||
      typeof total !== 'number' ||
      !Number.isSafeInteger(total) ||
      total < 0 ||
      (nextCursor !== null &&
        nextCursor !== undefined &&
        typeof nextCursor !== 'string')
    ) {
      return {
        ok: false,
        status: 502,
        error: 'console_graphql_invalid_projection',
      };
    }
    if (expectedTotal !== null && total !== expectedTotal) {
      return {
        ok: false,
        status: 502,
        error: 'console_graphql_receipt_total_changed',
      };
    }
    expectedTotal = total;
    snapshot ??= normalized;
    receipts.push(...normalized.receipts);
    if (receipts.length > total) {
      return {
        ok: false,
        status: 502,
        error: 'console_graphql_receipt_overflow',
      };
    }
    if (!nextCursor) {
      if (receipts.length !== total) {
        return {
          ok: false,
          status: 502,
          error: 'console_graphql_receipt_truncated',
        };
      }
      return {
        ok: true,
        snapshot: { ...snapshot, receipts },
      };
    }
    if (seenCursors.has(nextCursor)) {
      return {
        ok: false,
        status: 502,
        error: 'console_graphql_receipt_cursor_loop',
      };
    }
    seenCursors.add(nextCursor);
    receiptCursor = nextCursor;
  }
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function contributionNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (typeof candidate === 'string') return [candidate];
    const item = record(candidate);
    if (!item) return [];
    const point = typeof item.point === 'string' ? item.point : '';
    const block = typeof item.block === 'string' ? item.block : '';
    return point === 'pane.kind' && block ? [`pane:${block}`] : [];
  });
}

function appId(value: Record<string, unknown>): string | null {
  if (typeof value.appId === 'string') return value.appId;
  return typeof value.app_id === 'string' ? value.app_id : null;
}

function statusFromApp(
  value: unknown,
  state: 'installed' | 'pending_consent',
): ConsolePluginStatus | null {
  const app = record(value);
  if (!app || appId(app) !== CONSOLE_APP_ID) return null;
  const grants = strings(app.grants);
  const contributions = contributionNames(app.contributions);
  return {
    state,
    grants,
    contributions,
  };
}

function normalizePluginProjection(data: Record<string, unknown>): ConsolePluginStatus {
  const installed = Array.isArray(data.installedApps)
    ? data.installedApps
        .map((value) => statusFromApp(value, 'installed'))
        .find((value): value is ConsolePluginStatus => value !== null)
    : undefined;
  if (installed) return installed;
  const pending = Array.isArray(data.pendingApps)
    ? data.pendingApps
        .map((value) => statusFromApp(value, 'pending_consent'))
        .find((value): value is ConsolePluginStatus => value !== null)
    : undefined;
  if (pending) return pending;
  return { state: 'available', grants: [], contributions: [] };
}

export async function readConsolePluginStatus(): Promise<ConsolePluginStatusRead> {
  const result = await callHarnessGraphql(PLUGIN_STATE);
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error };
  }
  return { ok: true, plugin: normalizePluginProjection(result.data) };
}

export async function mutateConsolePlugin(
  action: ConsolePluginMutation,
): Promise<ConsolePluginStatusRead> {
  const operation =
    action === 'consent'
      ? PLUGIN_CONSENT
      : action === 'deny'
        ? PLUGIN_DENY
        : PLUGIN_UNINSTALL;
  const result = await callHarnessGraphql(
    operation,
    { appId: CONSOLE_APP_ID },
    'mutate',
  );
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error };
  }
  if (action === 'deny') {
    return { ok: true, plugin: { state: 'denied', grants: [], contributions: [] } };
  }
  if (action === 'uninstall') {
    return { ok: true, plugin: { state: 'available', grants: [], contributions: [] } };
  }
  const status = await readConsolePluginStatus();
  if (!status.ok) return status;
  if (
    status.plugin.state !== 'installed' ||
    !status.plugin.grants.includes(CORPUS_READ_GRANT) ||
    !status.plugin.contributions.includes(`pane:${CONSOLE_PANE_KIND}`)
  ) {
    return { ok: false, status: 502, error: 'console_plugin_consent_not_reflected' };
  }
  return status;
}
