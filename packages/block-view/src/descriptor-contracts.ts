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
    sourcing: {
      mode: 'wrap',
      upstream: '@commonplace/block-view/CompactCardRenderer',
    },
  },
  thread: {
    id: 'chat.thread',
    name: 'Thread',
    accepts: { required_types: ['thread'], cardinality: 'one' },
    emits: ['open', 'invoke_tool'],
    renderer: 'chat.thread',
    sourcing: {
      mode: 'wrap',
      upstream: '@assistant-ui/react/ThreadPrimitive',
    },
  },
  markdownDocument: {
    id: 'markdown.doc',
    name: 'Document',
    accepts: { required_types: ['doc'], required_fields: ['bodyText'], cardinality: 'one' },
    emits: ['open'],
    renderer: 'markdown.doc',
    sourcing: {
      mode: 'wrap',
      upstream: '@travis-gilbert/markdown-theory/Galley',
    },
  },
  proposalCard: {
    id: 'agency.proposal',
    name: 'Proposal',
    accepts: { required_types: ['agency.proposal'], cardinality: 'one' },
    emits: ['open', 'invoke_tool'],
    renderer: 'agency.proposal',
    sourcing: {
      mode: 'wrap',
      upstream: '@commonplace/block-view/ProposalCardRenderer',
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
