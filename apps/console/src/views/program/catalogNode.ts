// SOURCING: none. Strict catalog-to-ProgramNode adapter for canvas insertion.

import type {
  CatalogEntry,
  ProgramDefinition,
} from '@commonplace/program-contracts';

type ProgramNode = ProgramDefinition['nodes'][number];

export function programNodeFromCatalog(entry: CatalogEntry, id: string): ProgramNode {
  if (!entry.contract || !entry.node_kind) {
    throw new Error(`Catalog entry ${entry.id} has no authoring contract.`);
  }
  if (entry.input_ports.length === 0 && entry.output_ports.length === 0) {
    throw new Error(`Catalog entry ${entry.id} has no declared ports.`);
  }
  const base = {
    id,
    block_id: entry.id,
    contract: entry.contract,
    inputs: entry.input_ports,
    outputs: entry.output_ports,
    bypassed: false,
    muted: false,
  };
  switch (entry.node_kind) {
    case 'source':
      return {
        ...base,
        kind: 'source',
        selector: {
          plane: 'tenant_graph',
          label: entry.class_name ?? entry.id,
          predicates: {},
        },
      };
    case 'sentinel':
      return {
        ...base,
        kind: 'sentinel',
        question: entry.class_name ?? entry.id,
        watch: {},
        target_derivation_id: entry.id,
      };
    case 'rule':
      return { ...base, kind: 'rule', expression_root: entry.id };
    case 'verify':
      return { ...base, kind: 'verify', verifier_id: entry.id };
    case 'fold':
      return { ...base, kind: 'fold', target_derivation_id: entry.id };
    case 'sink':
      return {
        ...base,
        kind: 'sink',
        sink_id: entry.id,
        asserts: false,
        effect: 'advisory',
      };
    case 'human_input':
      return {
        ...base,
        kind: 'human_input',
        prompt: entry.class_name ?? 'Input required',
        coordination_stream: 'program-human-input',
      };
    case 'stochastic':
      return {
        ...base,
        kind: 'stochastic',
        affordance_id: entry.published_program_id
          ? `program:${entry.published_program_id.replace(/^program:/, '')}`
          : entry.id,
      };
  }
}
