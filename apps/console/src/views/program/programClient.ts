// SOURCING: none. Console client for programmable_graph PG2 actions.

import type { CanvasLayoutWire } from '@commonplace/canvas-substrate';
import type {
  CanvasProjection,
  CatalogEntry,
  CompilerProposal,
  ProgramBindingPreset,
  ProgramDefinition,
  ProgramPort,
  ProgramRunOptions,
  ProgramRunReceipt,
  ProgramStationReplication,
  StationDropReceipt,
} from '@commonplace/program-contracts';
import {
  edgeSchemaValidationFromResponse,
  type EdgeSchemaValidation,
} from './connection';
async function callProgramGraph(
  action: string,
  args: Record<string, unknown> = {},
  tool: 'programmable_graph' | 'programmable_graph_apply' = 'programmable_graph',
): Promise<Record<string, unknown>> {
  const response = await fetch('/api/harness/programmable-graph', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, action, args }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `programmable_graph_${response.status}`);
  }
  const payload = (await response.json()) as Record<string, unknown>;
  if (payload.ok === false) {
    const refusal = payload.refusal as { message?: string; code?: string } | undefined;
    throw new Error(refusal?.message ?? refusal?.code ?? `${action}_refused`);
  }
  const nested = payload.result;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return payload;
}

export async function fetchProgramCatalog(): Promise<CatalogEntry[]> {
  const data = await callProgramGraph('catalog');
  const catalog = data.catalog;
  const published = data.published_blocks;
  const embedded = Array.isArray(catalog)
    ? (catalog as CatalogEntry[])
    : catalog && typeof catalog === 'object' && Array.isArray((catalog as { entries?: unknown }).entries)
      ? ((catalog as { entries: CatalogEntry[] }).entries)
      : [];
  const blocks = Array.isArray(published) ? (published as CatalogEntry[]) : [];
  return [...embedded, ...blocks];
}

export async function fetchProgramContext(): Promise<{ tenantId: string }> {
  const data = await callProgramGraph('context');
  const tenantId = typeof data.tenant_id === 'string' ? data.tenant_id : '';
  if (!tenantId) throw new Error('programmable_graph_context_missing_tenant');
  return { tenantId };
}

export async function fetchStarterPrograms(): Promise<ProgramDefinition[]> {
  const data = await callProgramGraph('starters');
  return Array.isArray(data.programs) ? data.programs as ProgramDefinition[] : [];
}

export async function fetchBindingPresets(): Promise<ProgramBindingPreset[]> {
  const data = await callProgramGraph('binding_presets');
  return Array.isArray(data.presets) ? data.presets as ProgramBindingPreset[] : [];
}

export async function dropBindingPreset(input: {
  readonly programId: string;
  readonly nodeId: string;
  readonly presetId: string;
  readonly requestedReplication?: ProgramStationReplication;
}): Promise<StationDropReceipt> {
  const data = await callProgramGraph(
    'drop_binding_preset',
    {
      drop: {
        program_id: input.programId,
        node_id: input.nodeId,
        preset_id: input.presetId,
        ...(input.requestedReplication
          ? { requested_replication: input.requestedReplication }
          : {}),
      },
    },
    'programmable_graph_apply',
  );
  if (!data.receipt || typeof data.receipt !== 'object' || Array.isArray(data.receipt)) {
    throw new Error('drop_binding_preset_missing_receipt');
  }
  return data.receipt as unknown as StationDropReceipt;
}

export type ProgramListItem = {
  readonly id: string;
  readonly name?: string;
  readonly authority?: string;
  readonly content_id?: string;
  readonly draft?: boolean;
};

/**
 * The canvas layout wire. The server stores `program.layout` opaquely, so this
 * is the substrate's own wire shape rather than a narrowed copy: rebuilding it
 * field by field is what silently dropped reroute waypoints and frames on
 * reload, since only the keys named here survived the round trip.
 */
export type ProgramLayout = CanvasLayoutWire;

export async function listPrograms(): Promise<ProgramListItem[]> {
  const data = await callProgramGraph('list');
  const items = data.programs ?? data.items ?? data;
  if (!Array.isArray(items)) return [];
  return items.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const source = item as Record<string, unknown>;
    const id = typeof source.id === 'string'
      ? source.id
      : typeof source.node_id === 'string'
        ? source.node_id
        : '';
    return id ? [{ ...source, id } as ProgramListItem] : [];
  });
}

export async function loadProgram(programId: string): Promise<{
  definition: ProgramDefinition;
  layout?: ProgramLayout;
}> {
  const data = await callProgramGraph('load', {
    node_id: programId,
    program_node_id: programId,
    program_id: programId,
    id: programId,
  });
  const definition = (data.definition ?? data.program ?? data) as ProgramDefinition;
  const layoutRaw = data.layout ?? data.program_layout;
  let layout: ProgramLayout | undefined;
  if (layoutRaw && typeof layoutRaw === 'object' && !Array.isArray(layoutRaw)) {
    const record = layoutRaw as Record<string, unknown>;
    layout = record.nodes && typeof record.nodes === 'object' && !Array.isArray(record.nodes)
      // Pass the whole document through; `fromLayoutWire` validates it and is
      // the single place that decides which keys are meaningful.
      ? (record as unknown as ProgramLayout)
      // Pre-metadata layouts were a bare positions map.
      : { nodes: layoutRaw as ProgramLayout['nodes'] };
  }
  return { definition, layout };
}

export async function saveProgramDraft(
  definition: ProgramDefinition,
  layout?: ProgramLayout,
  programId?: string,
): Promise<Record<string, unknown>> {
  return callProgramGraph(
    'save',
    {
      definition,
      program: definition,
      layout,
      program_layout: layout,
      node_id: programId,
      program_id: programId,
      id: programId,
      draft: true,
    },
    'programmable_graph_apply',
  );
}

export async function validNext(boundary: Record<string, unknown>): Promise<CatalogEntry[]> {
  const data = await callProgramGraph('valid_next', { boundary });
  const entries = data.entries ?? data.valid_next ?? data;
  return Array.isArray(entries) ? (entries as CatalogEntry[]) : [];
}

export async function validateEdgeSchema(
  producer: ProgramPort,
  consumer: ProgramPort,
): Promise<EdgeSchemaValidation> {
  const response = await callProgramGraph('validate_edge', { producer, consumer });
  return edgeSchemaValidationFromResponse(response);
}

export async function projectProgram(definition: ProgramDefinition): Promise<CanvasProjection> {
  const data = await callProgramGraph('project', { definition, program: definition });
  return (data as unknown as CanvasProjection);
}

export async function materializeProgram(
  definition: ProgramDefinition,
  programId?: string | null,
): Promise<Record<string, unknown>> {
  return callProgramGraph(
    'materialize',
    { definition, program: definition, program_id: programId },
    'programmable_graph_apply',
  );
}

/** Server-authored run events (PG7). Console must not invent ProcessLiveness. */
export async function runProgramDefinition(
  definition: ProgramDefinition,
  options: ProgramRunOptions,
): Promise<ProgramRunReceipt> {
  const data = await callProgramGraph(
    'run',
    { definition, program: definition, options },
    'programmable_graph_apply',
  );
  return data as unknown as ProgramRunReceipt;
}

export async function resumeProgramDefinition(
  definition: ProgramDefinition,
  options: ProgramRunOptions,
  resumeToken: string,
): Promise<ProgramRunReceipt> {
  const data = await callProgramGraph(
    'resume',
    {
      definition,
      program: definition,
      options,
      resume_token: resumeToken,
    },
    'programmable_graph_apply',
  );
  return data as unknown as ProgramRunReceipt;
}

export async function fetchProgramSpill(fetchHandle: string): Promise<Record<string, unknown>> {
  let offset = 0;
  let totalBytes: number | null = null;
  let text = '';

  do {
    const response = await fetch('/api/harness/tool-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fetchHandle, offset }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
      const error = payload && typeof payload === 'object' && !Array.isArray(payload)
        && typeof (payload as { error?: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : `tool_result_fetch_${response.status}`;
      throw new Error(error);
    }
    const page = payload as Record<string, unknown>;
    if (
      typeof page.text !== 'string'
      || typeof page.offset !== 'number'
      || page.offset !== offset
      || typeof page.total_bytes !== 'number'
    ) {
      throw new Error('tool_result_fetch_invalid_page');
    }
    totalBytes ??= page.total_bytes;
    if (page.total_bytes !== totalBytes) {
      throw new Error('tool_result_fetch_changed_during_read');
    }
    text += page.text;
    if (page.next_offset === null || page.next_offset === undefined) break;
    if (typeof page.next_offset !== 'number' || page.next_offset <= offset) {
      throw new Error('tool_result_fetch_invalid_continuation');
    }
    offset = page.next_offset;
  } while (offset < totalBytes);

  if (new TextEncoder().encode(text).byteLength !== totalBytes) {
    throw new Error('tool_result_fetch_incomplete');
  }
  return {
    fetch_handle: fetchHandle,
    offset: 0,
    next_offset: null,
    total_bytes: totalBytes,
    text,
  };
}

export type PublicationAttestation = {
  readonly identity: string;
  readonly signature: readonly number[];
  readonly public_key: readonly number[];
};

function isFabricatedAttestation(attestation: PublicationAttestation): boolean {
  const sig = attestation.signature.join(',');
  const key = attestation.public_key.join(',');
  return sig === '1,2,3' || key === '4,5,6';
}

/** PG9: publication requires a real principal attestation -- never invent signature bytes. */
export async function publishProgramAsBlock(
  definition: ProgramDefinition,
  options: {
    readonly principal: string;
    readonly attestation: PublicationAttestation;
  },
): Promise<Record<string, unknown>> {
  if (
    !options.attestation.identity.trim()
    || options.attestation.signature.length === 0
    || options.attestation.public_key.length === 0
    || isFabricatedAttestation(options.attestation)
  ) {
    throw new Error(
      'publication_attestation_unavailable: publish requires a named principal attestation with real signature and public key bytes',
    );
  }
  const projected = await projectProgram(definition);
  const programId = projected.program_id;
  const publishedAtMs = Date.now();
  return callProgramGraph(
    'publish',
    {
      definition,
      program: definition,
      publication: {
        attestation: {
          identity: options.attestation.identity,
          signature: [...options.attestation.signature],
          public_key: [...options.attestation.public_key],
        },
        grants: [{
          id: `grant:${programId}`,
          from: options.principal,
          to: programId,
          capability: {
            namespace: 'execute',
            action: 'programmable_graph',
            scope: programId,
          },
          expires_at: null,
          delegatable: false,
          signature: [...options.attestation.signature],
        }],
        published_at_ms: publishedAtMs,
      },
    },
    'programmable_graph_apply',
  );
}

export async function validateCompilerProposal(
  proposal: CompilerProposal,
): Promise<Record<string, unknown>> {
  return callProgramGraph('compiler', { proposal });
}

export async function forkProgramDefinition(
  definition: ProgramDefinition,
  name: string,
  intent: string,
): Promise<ProgramDefinition> {
  const data = await callProgramGraph('fork', {
    definition,
    program: definition,
    name,
    intent,
  });
  return (data as unknown as ProgramDefinition);
}

export type CompoundMutationResult = {
  readonly node_id: string;
  readonly content_id: string;
  readonly exterior_program_id: string;
  readonly program: ProgramDefinition;
  readonly event: Record<string, unknown>;
  readonly persisted_interiors: ReadonlyArray<{ readonly node_id: string; readonly content_id: string }>;
};

export type ProgramEnvironmentResult = {
  readonly node_id: string;
  readonly program_id: string;
  readonly environment: Record<string, unknown>;
  readonly palette: ReadonlyArray<Record<string, unknown>>;
};

export type ProgramInteriorResult = {
  readonly exterior_node_id: string;
  readonly node_id: string;
  readonly interior_program_id: string;
  readonly pinned_content_id: string;
  readonly program: ProgramDefinition;
};

function asCompoundMutationResult(data: Record<string, unknown>): CompoundMutationResult {
  if (!data.program || typeof data.program !== 'object' || Array.isArray(data.program)) {
    throw new Error('compound_mutation_missing_program');
  }
  const persisted = Array.isArray(data.persisted_interiors)
    ? data.persisted_interiors.flatMap((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
        const row = item as Record<string, unknown>;
        if (typeof row.node_id !== 'string' || typeof row.content_id !== 'string') return [];
        return [{ node_id: row.node_id, content_id: row.content_id }];
      })
    : [];
  return {
    node_id: typeof data.node_id === 'string' ? data.node_id : '',
    content_id: typeof data.content_id === 'string' ? data.content_id : '',
    exterior_program_id: typeof data.exterior_program_id === 'string' ? data.exterior_program_id : '',
    program: data.program as ProgramDefinition,
    event: data.event && typeof data.event === 'object' && !Array.isArray(data.event)
      ? data.event as Record<string, unknown>
      : {},
    persisted_interiors: persisted,
  };
}

/** Expand an atom node into a Compound (SPEC-THEOREM-COMPOUND-NODES-1.0 D3/D6). */
export async function expandProgramNode(input: {
  readonly programId: string;
  readonly nodeId: string;
}): Promise<CompoundMutationResult> {
  const data = await callProgramGraph(
    'expand_node',
    { program_id: input.programId, node_id: input.nodeId },
    'programmable_graph_apply',
  );
  return asCompoundMutationResult(data);
}

/** Collapse a Compound back to a Rule atom. */
export async function collapseProgramNode(input: {
  readonly programId: string;
  readonly nodeId: string;
}): Promise<CompoundMutationResult> {
  const data = await callProgramGraph(
    'collapse_node',
    { program_id: input.programId, node_id: input.nodeId },
    'programmable_graph_apply',
  );
  return asCompoundMutationResult(data);
}

/** Advance the Compound pin to a newer interior content id. */
export async function advanceProgramPin(input: {
  readonly programId: string;
  readonly nodeId: string;
  readonly toContentId: string;
}): Promise<CompoundMutationResult> {
  const data = await callProgramGraph(
    'advance_pin',
    {
      program_id: input.programId,
      node_id: input.nodeId,
      to_content_id: input.toContentId,
    },
    'programmable_graph_apply',
  );
  return asCompoundMutationResult(data);
}

/** Resolve the lexical engine environment for a program. */
export async function fetchProgramEnvironment(programId: string): Promise<ProgramEnvironmentResult> {
  const data = await callProgramGraph('environment', { program_id: programId });
  return {
    node_id: typeof data.node_id === 'string' ? data.node_id : '',
    program_id: typeof data.program_id === 'string' ? data.program_id : programId,
    environment: data.environment && typeof data.environment === 'object' && !Array.isArray(data.environment)
      ? data.environment as Record<string, unknown>
      : { bindings: [] },
    palette: Array.isArray(data.palette) ? data.palette as Array<Record<string, unknown>> : [],
  };
}

/** Load the pinned interior program for a Compound node. */
export async function fetchProgramInterior(input: {
  readonly programId: string;
  readonly nodeId: string;
}): Promise<ProgramInteriorResult> {
  const data = await callProgramGraph('interior', {
    program_id: input.programId,
    node_id: input.nodeId,
  });
  if (!data.program || typeof data.program !== 'object' || Array.isArray(data.program)) {
    throw new Error('interior_missing_program');
  }
  return {
    exterior_node_id: typeof data.exterior_node_id === 'string' ? data.exterior_node_id : '',
    node_id: typeof data.node_id === 'string' ? data.node_id : input.nodeId,
    interior_program_id: typeof data.interior_program_id === 'string' ? data.interior_program_id : '',
    pinned_content_id: typeof data.pinned_content_id === 'string' ? data.pinned_content_id : '',
    program: data.program as ProgramDefinition,
  };
}
