// SOURCING: none. Pure helpers for opening prototype.stage from program runs.
// SPEC-THEOREM-PROTOTYPE-PIPELINE-1.0 C1 / PLAN-CLOSEOUT PT-006/PT-007.

import type { JsonValue } from '@commonplace/block-view/types';
import type { ProgramDefinition, ProgramRunReceipt } from '@commonplace/program-contracts';

export type PrototypeStageConfig = {
  readonly recording_id: string;
  readonly view_node_id: string;
  readonly path_to_expr: Record<string, string>;
  readonly definition: ProgramDefinition;
  readonly program_id?: string;
  readonly gateway_base?: string;
  readonly recording_url?: string;
};

/** True when a program node kind is the View variant. */
export function isViewNodeKind(kind: unknown): boolean {
  if (!kind || typeof kind !== 'object' || Array.isArray(kind)) return false;
  return 'View' in kind || 'view' in kind;
}

/** Find View node ids in a program definition. */
export function findViewNodeIds(definition: ProgramDefinition): string[] {
  return definition.nodes
    .filter((node) => isViewNodeKind(node.kind))
    .map((node) => node.id);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/**
 * Pull recording_id from a run receipt (simulate node output chunk / inspection).
 */
export function recordingIdFromReceipt(receipt: ProgramRunReceipt): string | null {
  for (const inspection of Object.values(receipt.inspections ?? {})) {
    const outputs = inspection.outputs as unknown;
    const inline = asRecord(outputs);
    const value = inline?.value ?? inline;
    const record = asRecord(value);
    if (typeof record?.recording_id === 'string' && record.recording_id.trim()) {
      return record.recording_id;
    }
  }
  for (const event of receipt.events ?? []) {
    const value = asRecord(event.value as unknown);
    const nested = asRecord(value?.value) ?? value;
    if (typeof nested?.recording_id === 'string' && nested.recording_id.trim()) {
      return nested.recording_id;
    }
  }
  return null;
}

/**
 * Build view-instance properties for `prototype.stage`.
 * `path_to_expr` may be empty when the viewer later supplies payload expr_id.
 */
export function buildPrototypeStageProps(input: {
  readonly recordingId: string;
  readonly viewNodeId: string;
  readonly definition: ProgramDefinition;
  readonly pathToExpr?: Record<string, string>;
  readonly programId?: string | null;
  readonly gatewayBase?: string | null;
  readonly recordingUrl?: string | null;
}): Record<string, JsonValue> {
  const config: Record<string, JsonValue> = {
    recording_id: input.recordingId,
    view_node_id: input.viewNodeId,
    path_to_expr: (input.pathToExpr ?? {}) as unknown as JsonValue,
    definition: input.definition as unknown as JsonValue,
  };
  if (input.programId) config.program_id = input.programId;
  if (input.gatewayBase) config.gateway_base = input.gatewayBase;
  if (input.recordingUrl) config.recording_url = input.recordingUrl;
  return { config };
}

/**
 * Default entity_path → expr_id map for the falling-boxes fixture
 * (`program_node_id = simulate`). Consoles may merge richer maps from the
 * assemble/port payload when available.
 */
export function fallingBoxesPathToExpr(
  programNodeId = 'simulate',
): Record<string, string> {
  const parts = ['ground', 'box_a', 'box_b', 'box_c'] as const;
  const out: Record<string, string> = {};
  for (const part of parts) {
    out[`/proto/${programNodeId}/${part}`] = `expr:${part}`;
  }
  return out;
}

/**
 * Decide whether opening a compound interior should also open the stage.
 */
export function shouldOpenPrototypeStageForInterior(
  interior: ProgramDefinition | null | undefined,
): { open: true; viewNodeId: string } | { open: false } {
  if (!interior) return { open: false };
  const ids = findViewNodeIds(interior);
  if (ids.length === 0) return { open: false };
  return { open: true, viewNodeId: ids[0] };
}
