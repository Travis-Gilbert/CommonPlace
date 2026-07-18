import type * as React from 'react';

import type { ViewDescriptor, ViewRenderProps } from './types';

/**
 * Platform-neutral half of a view descriptor. The object shape and action
 * contract live once; each platform binds its own renderer implementation.
 */
export type ViewDescriptorContract = Omit<ViewDescriptor, 'render'>;

export const fieldOrganContracts = {
  compactCard: {
    id: 'card.compact',
    name: 'Compact card',
    accepts: { cardinality: 'one' },
    emits: ['open', 'select'],
    renderer: 'card.compact',
    source: {
      package: '@commonplace/block-view',
      component: 'CompactCardRenderer',
      mode: 'wrap',
      regime: 'css-vars',
    },
  },
  thread: {
    id: 'chat.thread',
    name: 'Thread',
    accepts: { required_types: ['thread'], cardinality: 'one' },
    emits: ['open', 'invoke_tool'],
    renderer: 'chat.thread',
    source: {
      package: '@assistant-ui/react',
      component: 'ThreadPrimitive',
      mode: 'wrap',
      regime: 'css-vars',
    },
  },
  markdownDocument: {
    id: 'markdown.doc',
    name: 'Document',
    accepts: { required_types: ['doc'], required_fields: ['bodyText'], cardinality: 'one' },
    emits: ['open'],
    renderer: 'markdown.doc',
    source: {
      package: '@travis-gilbert/markdown-theory',
      component: 'Galley',
      mode: 'wrap',
      regime: 'css-vars',
    },
  },
  proposalCard: {
    id: 'agency.proposal',
    name: 'Proposal',
    accepts: { required_types: ['agency.proposal'], cardinality: 'one' },
    emits: ['open', 'invoke_tool'],
    renderer: 'agency.proposal',
    source: {
      package: '@commonplace/block-view',
      component: 'ProposalCardRenderer',
      mode: 'wrap',
      regime: 'css-vars',
    },
  },
} as const satisfies Record<string, ViewDescriptorContract>;

/** Bind a platform renderer without changing the shared descriptor contract. */
export function bindViewRenderer(
  contract: ViewDescriptorContract,
  render: React.ComponentType<ViewRenderProps>,
): ViewDescriptor {
  return { ...contract, render };
}
