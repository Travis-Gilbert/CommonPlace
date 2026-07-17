'use client';

// SOURCING: @commonplace/block-view (createViewRegistry, ViewDescriptor).
// The console view registry: every pane the shell can host is a descriptor
// registered here. The shell never grows a bespoke page; a new surface is a
// registration in this file (the marriage requirement, G3/G8).

import type { ViewDescriptor, ViewRenderProps } from '@commonplace/block-view/types';
import { createViewRegistry } from '@commonplace/block-view/registry';
import { RecordTableView } from './RecordTableView';
import { GalleyDocView } from './GalleyDocView';
import { CodeFileView } from './CodeFileView';
import { ThreadView } from './ThreadView';
import { DocListView, IndexRailView } from './DocListView';
import { CardFullView, CardGridView } from './CardView';
import { HunkReviewView } from './HunkReviewView';

function ThreadRender(_props: ViewRenderProps) {
  return <ThreadView />;
}

const RECORD_TABLE: ViewDescriptor = {
  id: 'record.table',
  name: 'Records',
  accepts: {},
  emits: ['select', 'open', 'update'],
  renderer: 'record.table',
  source: {
    package: '@tanstack/react-table',
    component: 'useReactTable',
    mode: 'wrap',
    regime: 'css-vars',
  },
  render: RecordTableView,
};

const MARKDOWN_DOC: ViewDescriptor = {
  id: 'markdown.doc',
  name: 'Document',
  accepts: {},
  emits: ['update', 'open'],
  renderer: 'markdown.doc',
  source: {
    package: '@travis-gilbert/markdown-theory',
    component: 'Galley',
    mode: 'wrap',
    regime: 'css-vars',
  },
  render: GalleyDocView,
};

const CODE_FILE: ViewDescriptor = {
  id: 'code.file',
  name: 'Code',
  accepts: {},
  emits: ['open'],
  renderer: 'code.file',
  source: {
    package: 'codemirror',
    component: 'EditorView',
    mode: 'wrap',
    regime: 'css-vars',
  },
  render: CodeFileView,
};

const CHAT_THREAD: ViewDescriptor = {
  id: 'chat.thread',
  name: 'Thread',
  accepts: {},
  emits: ['run_agent', 'open'],
  renderer: 'chat.thread',
  source: {
    package: '@assistant-ui/react',
    component: 'ThreadPrimitive',
    mode: 'wrap',
    regime: 'css-vars',
  },
  render: ThreadRender,
};

const DOC_LIST: ViewDescriptor = {
  id: 'doc.list',
  name: 'Documents',
  accepts: {},
  emits: ['select', 'update'],
  renderer: 'doc.list',
  source: {
    package: '@commonplace/block-view',
    component: 'BlockHost',
    mode: 'bespoke',
    regime: 'css-vars',
  },
  render: DocListView,
};

const INDEX_RAIL: ViewDescriptor = {
  id: 'index.rail',
  name: 'Destinations',
  accepts: {},
  emits: [],
  renderer: 'index.rail',
  source: {
    package: '@commonplace/block-view',
    component: 'BlockHost',
    mode: 'bespoke',
    regime: 'css-vars',
  },
  render: IndexRailView,
};

// The card engine descriptor family (HANDOFF-CARDS-ACTIONS-MENTIONS K1):
// one engine renders any kind's template. card.full mounts in panes and
// documents; cards.grid renders an ObjectQuery as faces at Twenty density.
const CARD_FULL: ViewDescriptor = {
  id: 'card.full',
  name: 'Card',
  accepts: {},
  emits: ['select', 'open'],
  renderer: 'card.full',
  source: {
    package: '@commonplace/block-view',
    component: 'BlockHost',
    mode: 'bespoke',
    regime: 'css-vars',
    allowedBespokeReason: 'kind-templated card layouts are a domain concept no library models',
  },
  render: CardFullView,
};

const CARDS_GRID: ViewDescriptor = {
  id: 'cards.grid',
  name: 'Cards',
  accepts: {},
  emits: ['select', 'open'],
  renderer: 'cards.grid',
  source: {
    package: '@tanstack/react-virtual',
    component: 'useVirtualizer',
    mode: 'wrap',
    regime: 'css-vars',
  },
  render: CardGridView,
};

const HUNK_REVIEW: ViewDescriptor = {
  id: 'hunk.review',
  name: 'Review',
  accepts: { required_types: ['hunk'], cardinality: 'many' },
  emits: ['invoke_tool'],
  renderer: 'hunk.review',
  source: {
    package: '@commonplace/block-view',
    component: 'BlockHost',
    mode: 'bespoke',
    regime: 'css-vars',
    allowedBespokeReason: 'The typed Hunk review mechanics are the product contract; nested structured values still resolve through registered descriptors.',
  },
  render: HunkReviewView,
};

export const CONSOLE_VIEW_REGISTRY = createViewRegistry([
  RECORD_TABLE,
  MARKDOWN_DOC,
  CODE_FILE,
  CHAT_THREAD,
  DOC_LIST,
  INDEX_RAIL,
  CARD_FULL,
  CARDS_GRID,
  HUNK_REVIEW,
]);

/** The forward-compat invariant: an unknown descriptor renders the fallback
 *  card, never a crash, so shared or future arrangements stay safe. */
export function FallbackCard({ descriptorId }: { descriptorId: string }) {
  return (
    <div className="m-3 rounded-ij-arc border border-ij-seam-raised bg-ij-raised p-4 text-ij-ink-info">
      view &quot;{descriptorId}&quot; unavailable: no renderer registered
    </div>
  );
}
