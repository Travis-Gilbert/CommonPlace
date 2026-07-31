'use client';

// SOURCING: @commonplace/canvas-substrate node-kind registry — the ERD card is
// registered as a kind rather than shipping its own node component (issue 144
// A). The card body reuses the existing fork's field rows unchanged; only the
// chrome around them moves to the shared shell.

import type { NodeBadge, NodeKindEntry, SubstratePort } from '@commonplace/canvas-substrate';
import { shortNodeBadge } from '@commonplace/canvas-substrate';
import type { SchemaField } from '@commonplace/okf';
import { DataMartIcon } from '../lib/icons';
import { ErdFieldRows, type MartNodeData } from '../components/canvas/MartNode';

export const MODEL_CARD_KIND = 'model-card';

/** The card badge for the registry provider facet (issue 144 D). */
export interface ProviderBadge {
  readonly text: string;
  readonly title?: string;
}

export type ModelCardData = MartNodeData & {
  /** Rendered as the per-card source badge; the general form of the fork's SQL badge. */
  readonly _provider?: ProviderBadge;
};

const STATUS_TIP: Record<string, string> = {
  created: 'Declared in registry',
  pending: 'Observed only -- not declared',
  creating: 'Declaring…',
  error: 'Declaration refused',
};

function badgesFor(node: ModelCardData): NodeBadge[] {
  const badges: NodeBadge[] = [];
  const hidden = node._objHidden;

  if (node._ghost) {
    badges.push({ id: 'observed', text: 'observed', title: STATUS_TIP.pending });
  } else if (node._provider) {
    // The provider facet supersedes the raw inputSource chip: it says where the
    // rows actually come from rather than which importer produced the card.
    badges.push({
      id: 'provider',
      text: node._provider.text,
      title: node._provider.title,
      tone: 'info',
    });
  } else if (!hidden?.source) {
    badges.push({ id: 'source', text: node.inputSource });
  }

  if (typeof node._recordCount === 'number') {
    badges.push({ id: 'records', text: String(node._recordCount), mono: true, title: 'Records' });
  }
  if (typeof node._coverage === 'number') {
    badges.push({
      id: 'coverage',
      text: `${Math.round(node._coverage * 100)}%`,
      mono: true,
      title: 'Observed field coverage',
    });
  }
  if ((node._divergenceCount ?? 0) > 0) {
    badges.push({
      id: 'divergence',
      text: `${node._divergenceCount} diverge`,
      tone: 'warn',
      title: 'Writes diverging from the declared shape',
    });
  }
  return badges;
}

/**
 * Node-level ports are the only way to draw a new relationship. Field rows get
 * anchor-only handles so an existing edge can land on the right row without the
 * row offering to start a connection of its own.
 */
function portsFor(node: ModelCardData): SubstratePort[] {
  const ports: SubstratePort[] = [
    { id: 'left', side: 'source', label: 'left' },
    { id: 'right', side: 'source', label: 'right' },
  ];
  if (node._viewMode !== 'erd') return ports;
  for (const field of node.schema ?? ([] as SchemaField[])) {
    ports.push(
      { id: `fl:${field.name}`, side: 'source', connectable: false },
      { id: `fr:${field.name}`, side: 'source', connectable: false },
    );
  }
  return ports;
}

export const modelCardKind: NodeKindEntry<ModelCardData> = {
  id: MODEL_CARD_KIND,
  // Relation edges are not typed flows, so the model palette keeps them neutral
  // and spends the reader's attention on the chip and cardinality glyph instead.
  palette: 'model',
  shell: (node, context) => ({
    kindId: MODEL_CARD_KIND,
    title: node.title,
    icon: <DataMartIcon size={15} />,
    idBadge: shortNodeBadge(context.nodeId),
    badges: badgesFor(node),
    ports: portsFor(node),
    ghost: Boolean(node._ghost),
    accent: !node._objHidden?.source && !node._ghost,
    status: node.status === 'error' ? 'failed' : node.status === 'creating' ? 'running' : 'idle',
    width: node._viewMode === 'erd' ? 256 : 208,
  }),
  Body: ({ data }) => <ErdFieldRows node={data} />,
};
