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
import { DocListView } from './DocListView';
import { IndexDestinationsView } from './IndexDestinationsView';
import { IndexStreamView } from './IndexStreamView';
import { IndexRulesView } from './IndexRulesView';
import { UrgentLaneView } from './UrgentLaneView';
import { CardFullView, CardGridView } from './CardView';
import { HunkReviewView } from './HunkReviewView';
import { AppearanceView } from './AppearanceView';
import { AccountView } from './AccountView';
import { FilesView } from './FilesView';
import { ContextView } from './ContextView';
import { ProactivityView } from './ProactivityView';
import { WorkspaceSubstrateView } from './workspace/WorkspaceSubstrateView';
import { GoalStackView } from './goal-stack/GoalStackView';

function ThreadRender(props: ViewRenderProps) {
  return <ThreadView host={props.host} density="compact" />;
}

function ChatSurfaceRender(props: ViewRenderProps) {
  return <ThreadView host={props.host} density="full" />;
}

function FilesRender(props: ViewRenderProps) {
  return <FilesView host={props.host} />;
}

function ContextRender(props: ViewRenderProps) {
  return <ContextView host={props.host} />;
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

const CHAT_SURFACE: ViewDescriptor = {
  id: 'chat.surface',
  name: 'Chat',
  accepts: {},
  emits: ['run_agent', 'open'],
  renderer: 'chat.surface',
  source: {
    package: '@assistant-ui/react',
    component: 'ThreadPrimitive',
    mode: 'wrap',
    regime: 'css-vars',
  },
  render: ChatSurfaceRender,
};

const FILES_TREE: ViewDescriptor = {
  id: 'files.tree',
  name: 'Files',
  accepts: {},
  emits: ['open'],
  renderer: 'files.tree',
  source: {
    package: '@tanstack/react-virtual',
    component: 'useVirtualizer',
    mode: 'wrap',
    regime: 'css-vars',
  },
  render: FilesRender,
};

const CONTEXT_GRAPH: ViewDescriptor = {
  id: 'context.graph',
  name: 'Context',
  accepts: {},
  emits: ['select', 'open'],
  renderer: 'context.graph',
  source: {
    package: 'd3',
    component: 'scalePoint',
    mode: 'wrap',
    regime: 'css-vars',
  },
  render: ContextRender,
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

// The Index descriptor family (SPEC-COMMONPLACE-FILING-AND-INDEX-1.0). The
// arrival state is sorted, so none of these renders a pending queue, and none
// of them renders a count: the wire contract carries no number for one.
const INDEX_RAIL: ViewDescriptor = {
  id: 'index.rail',
  name: 'Destinations',
  accepts: {},
  emits: ['select'],
  renderer: 'index.rail',
  source: {
    package: '@commonplace/block-view',
    component: 'BlockHost',
    mode: 'bespoke',
    regime: 'css-vars',
    allowedBespokeReason:
      'A destination rail is a list of shelves at register density; no library models the filing contract behind it.',
  },
  render: IndexDestinationsView,
};

const INDEX_STREAM: ViewDescriptor = {
  id: 'index.stream',
  name: 'Recently filed',
  accepts: {},
  emits: ['update', 'select'],
  renderer: 'index.stream',
  source: {
    package: '@dnd-kit/core',
    component: 'DndContext',
    mode: 'wrap',
    regime: 'css-vars',
  },
  render: IndexStreamView,
};

const INDEX_RULES: ViewDescriptor = {
  id: 'index.rules',
  name: 'Rules',
  accepts: {},
  emits: ['create', 'update', 'delete'],
  renderer: 'index.rules',
  source: {
    package: 'cmdk',
    component: 'Command',
    mode: 'wrap',
    regime: 'css-vars',
  },
  render: IndexRulesView,
};

const INDEX_URGENT: ViewDescriptor = {
  id: 'index.urgent',
  name: 'Needs you today',
  accepts: {},
  emits: ['select'],
  renderer: 'index.urgent',
  source: {
    package: '@commonplace/block-view',
    component: 'BlockHost',
    mode: 'bespoke',
    regime: 'css-vars',
    allowedBespokeReason:
      'A lane whose empty state is its designed norm is a product claim, not a generic list: no library models "reassure, do not gamify".',
  },
  render: UrgentLaneView,
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

const PROACTIVITY: ViewDescriptor = {
  id: 'proactivity.graph',
  name: 'Proactivity',
  accepts: { required_types: ['pg.stake'], cardinality: 'many' },
  emits: ['update', 'create', 'delete'],
  renderer: 'proactivity.graph',
  source: {
    package: '@commonplace/block-view',
    component: 'BlockHost',
    mode: 'bespoke',
    regime: 'css-vars',
    allowedBespokeReason:
      'The editable proactivity graph is the product contract: the standing structure renders and edits as one object at three altitudes, and the dagre layered layout is the join-visible surface. Node kinds and edges resolve through the block-view seam.',
  },
  render: ProactivityView,
};

const WORKSPACE_SUBSTRATE: ViewDescriptor = {
  id: 'workspace.substrate',
  name: 'Workspace',
  accepts: {},
  emits: ['select', 'open', 'update'],
  renderer: 'workspace.substrate',
  source: {
    package: '@tanstack/react-virtual',
    component: 'useVirtualizer',
    mode: 'wrap',
    regime: 'css-vars',
  },
  render: WorkspaceSubstrateView,
};

const GOAL_STACK: ViewDescriptor = {
  id: 'goal.stack',
  name: 'Goal Stack',
  accepts: {},
  emits: ['select', 'invoke_tool', 'update'],
  renderer: 'goal.stack',
  source: {
    package: '@xyflow/react',
    component: 'ReactFlow',
    mode: 'wrap',
    regime: 'css-vars',
  },
  render: GoalStackView,
};

const APPEARANCE: ViewDescriptor = {
  id: 'settings.appearance',
  name: 'Appearance',
  accepts: {},
  emits: ['update'],
  renderer: 'settings.appearance',
  source: {
    package: '@commonplace/block-view',
    component: 'BlockHost',
    mode: 'bespoke',
    regime: 'css-vars',
  },
  render: AppearanceView,
};

const ACCOUNT: ViewDescriptor = {
  id: 'settings.account',
  name: 'Account',
  accepts: {},
  emits: ['update'],
  renderer: 'settings.account',
  source: {
    package: 'next-auth/react',
    component: 'SessionProvider',
    mode: 'wrap',
    regime: 'css-vars',
  },
  render: AccountView,
};

export const CONSOLE_VIEW_REGISTRY = createViewRegistry([
  RECORD_TABLE,
  MARKDOWN_DOC,
  CODE_FILE,
  CHAT_THREAD,
  CHAT_SURFACE,
  FILES_TREE,
  CONTEXT_GRAPH,
  DOC_LIST,
  INDEX_RAIL,
  INDEX_STREAM,
  INDEX_RULES,
  INDEX_URGENT,
  CARD_FULL,
  CARDS_GRID,
  HUNK_REVIEW,
  APPEARANCE,
  PROACTIVITY,
  WORKSPACE_SUBSTRATE,
  GOAL_STACK,
  ACCOUNT,
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
