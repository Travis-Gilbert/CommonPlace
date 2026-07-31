// SOURCING: none. Subgraph publish / fork helpers (PG9).

import type { ProgramDefinition } from '@commonplace/program-contracts';
import {
  forkProgramDefinition,
  publishProgramAsBlock,
} from './programClient';

export async function publishSubgraph(args: {
  readonly definition: ProgramDefinition;
  readonly nodeIds?: readonly string[];
  readonly principal: string;
  readonly attestation: {
    readonly identity: string;
    readonly signature: readonly number[];
    readonly public_key: readonly number[];
  };
}): Promise<Record<string, unknown>> {
  const definition = args.nodeIds && args.nodeIds.length > 0
    ? {
        ...args.definition,
        nodes: args.definition.nodes.filter((node) => args.nodeIds!.includes(node.id)),
        edges: args.definition.edges.filter((edge) =>
          args.nodeIds!.includes(edge.from_node) && args.nodeIds!.includes(edge.to_node)),
      }
    : args.definition;
  return publishProgramAsBlock(definition, {
    principal: args.principal,
    attestation: args.attestation,
  });
}

export async function forkProgram(
  definition: ProgramDefinition,
  name: string,
  intent: string,
): Promise<ProgramDefinition> {
  return forkProgramDefinition(definition, name, intent);
}
