'use client';

// SOURCING: @commonplace/block-view (createViewRegistry, ViewDescriptor).
// The console view registry: every pane the shell can host is a descriptor
// registered here. The shell never grows a bespoke page; a new surface is a
// registration in this file (the marriage requirement, G3/G8).

import type { ViewDescriptor, ViewRenderProps } from '@commonplace/block-view/types';
import { createViewRegistry } from '@commonplace/block-view/registry';
import type { ConsoleViewDescriptor } from '@/lib/rail/rail-model';
import { RecordTableView } from './RecordTableView';
import { GalleyDocView } from './GalleyDocView';
import { CodeFileView } from './CodeFileView';
import { ThreadView } from './ThreadView';
import { ThreadListView } from './ThreadListView';
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
import { CanvasView } from './canvas/CanvasView';
import { StatusPanel } from './harness-ux/StatusPanel';
import { WhyTracePanel } from './harness-ux/WhyTracePanel';
import { AutomationHistoryView } from './blocks/AutomationHistoryView';
import { KanbanBlock } from './blocks/KanbanBlock';
import { SurveyView } from './SurveyView';
import { ModelView } from './model/ModelView';
import { ProgramView } from './program/ProgramView';
import { SearchStackView } from './search/SearchStackView';
import { CommandsGalleryView } from './CommandsGalleryView';
import { PG_TYPES } from '@/lib/proactivity/object-bridge';
import {
  openSearchPageInWebEdition,
  recordSearchSessionOrigin,
} from './search/search-host';
import { AgentRailBlock } from '@/components/blocks/AgentRailBlock';
import { RecordsBlock } from '@/components/blocks/RecordsBlock';
import { RecordPage } from '@/components/blocks/RecordPage';

import { ConsoleDataView } from './ConsoleDataView';

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

function SearchStackRender(props: ViewRenderProps) {
  const sessionId = props.instance?.id ?? 'search.stack';
  return (
    <SearchStackView
      sessionId={sessionId}
      onOpenPage={openSearchPageInWebEdition}
      onRecordSessionOrigin={(id, origin) =>
        recordSearchSessionOrigin(props.host, id, origin).then(() => undefined)}
    />
  );
}

const RECORD_TABLE: ConsoleViewDescriptor = {
  id: 'record.table',
  name: 'Records',
  paletteVisible: true,
  palette: {
    id: 'records',
    kind: 'records',
    material: 'sunken',
    query: { types: ['record'], page: { limit: 100 }, live: true },
  },
  accepts: {},
  emits: ['select', 'open', 'update'],
  renderer: 'record.table',
  source: {
    package: 'jacksonkasi1/tnks-data-table',
    component: 'TnksDataTable',
    mode: 'wrap',
    regime: 'css-vars',
  },
  block: {
    usage: 'browse records',
    placements: ['ground', 'full', 'rail'],
    defaultSize: 'm',
    density: 'compact',
    surfaceClass: 'tool',
    kindGlyph: 'records',
    bodyBleed: 'flush',
  },
  render: RecordTableView,
};

/** Generated palette entry for a declared object type (SPEC RT1). */
export function declaredRecordPaletteDescriptor(
  objectTypeKey: string,
  label: string,
): ConsoleViewDescriptor {
  const key = objectTypeKey.trim() || 'record';
  return {
    ...RECORD_TABLE,
    id: `record.table.${key}`,
    name: label || key,
    paletteVisible: true,
    palette: {
      id: `records-${key}`,
      label: label || key,
      kind: 'records',
      material: 'sunken',
      query: {
        types: [key],
        page: { limit: 100 },
        live: true,
      },
    },
    renderer: 'record.table',
    render: RecordTableView,
  };
}

const MARKDOWN_DOC: ConsoleViewDescriptor = {
  id: 'markdown.doc',
  name: 'Document',
  paletteVisible: true,
  palette: {
    id: 'documents',
    label: 'Documents',
    kind: 'documents',
    material: 'lifted',
    query: { types: ['doc'], page: { limit: 100 }, live: true },
  },
  accepts: {},
  emits: ['update', 'open'],
  renderer: 'markdown.doc',
  source: {
    package: '@travis-gilbert/markdown-theory',
    component: 'Galley',
    mode: 'wrap',
    regime: 'css-vars',
  },
  block: {
    usage: 'read a document',
    placements: ['ground', 'full', 'rail'],
    defaultSize: 'm',
    density: 'both',
    surfaceClass: 'editor',
    kindGlyph: 'doc',
  },
  render: GalleyDocView,
};

const CODE_FILE: ViewDescriptor = {
  id: 'code.file',
  name: 'Code',
  accepts: {},
  emits: ['open', 'invoke_tool'],
  renderer: 'code.file',
  sourcing: { mode: 'wrap', upstream: 'codemirror/EditorView' },
  source: {
    package: 'codemirror',
    component: 'EditorView',
    mode: 'wrap',
    regime: 'css-vars',
  },
  block: {
    usage: 'inspect code',
    placements: ['ground', 'full', 'rail'],
    defaultSize: 'm',
    density: 'both',
    surfaceClass: 'editor',
    kindGlyph: 'terminal',
  },
  render: CodeFileView,
};

const CHAT_THREAD: ViewDescriptor = {
  id: 'chat.thread',
  name: 'Thread',
  accepts: {},
  emits: ['run_agent', 'open'],
  renderer: 'chat.thread',
  sourcing: { mode: 'wrap', upstream: '@assistant-ui/react/ThreadPrimitive' },
  source: {
    package: '@assistant-ui/react',
    component: 'ThreadPrimitive',
    mode: 'wrap',
    regime: 'css-vars',
  },
  block: {
    usage: 'follow the thread',
    placements: ['dock', 'rail'],
    defaultSize: 'm',
    density: 'compact',
    surfaceClass: 'tool',
    kindGlyph: 'thread',
  },
  render: ThreadRender,
};

const CHAT_SURFACE: ViewDescriptor = {
  id: 'chat.surface',
  name: 'Chat',
  accepts: {},
  emits: ['run_agent', 'open'],
  renderer: 'chat.surface',
  sourcing: { mode: 'wrap', upstream: '@assistant-ui/react/Composer' },
  source: {
    package: '@assistant-ui/react',
    component: 'Composer',
    mode: 'wrap',
    regime: 'css-vars',
  },
  block: {
    usage: 'compose with the agent',
    placements: ['full', 'ground', 'rail'],
    defaultSize: 'full',
    density: 'both',
    surfaceClass: 'tool',
    kindGlyph: 'thread',
  },
  render: ChatSurfaceRender,
};

const THREAD_LIST: ViewDescriptor = {
  id: 'thread.list',
  name: 'Threads',
  accepts: {},
  emits: ['open'],
  renderer: 'thread.list',
  sourcing: { mode: 'wrap', upstream: '@assistant-ui/react/ThreadPrimitive' },
  source: {
    package: '@assistant-ui/react',
    component: 'ThreadPrimitive',
    mode: 'wrap',
    regime: 'css-vars',
  },
  block: {
    usage: 'browse threads',
    placements: ['full', 'ground'],
    defaultSize: 'full',
    density: 'compact',
    surfaceClass: 'tool',
    kindGlyph: 'thread',
  },
  render: ThreadListView,
};

const FILES_TREE: ConsoleViewDescriptor = {
  id: 'files.tree',
  name: 'Files',
  paletteVisible: true,
  palette: {
    id: 'files',
    kind: 'files',
    material: 'sunken',
    query: { types: ['files-view'] },
  },
  accepts: {},
  emits: ['open'],
  renderer: 'files.tree',
  source: {
    package: '@tanstack/react-virtual',
    component: 'useVirtualizer',
    mode: 'wrap',
    regime: 'css-vars',
  },
  block: {
    usage: 'browse files',
    placements: ['dock', 'ground', 'full'],
    defaultSize: 'm',
    density: 'compact',
    surfaceClass: 'tool',
    kindGlyph: 'files',
  },
  render: FilesRender,
};

const CONTEXT_GRAPH: ViewDescriptor = {
  id: 'context.graph',
  name: 'Context',
  accepts: {},
  emits: ['select', 'open'],
  renderer: 'context.graph',
  sourcing: { mode: 'wrap', upstream: 'd3/scalePoint' },
  source: {
    package: 'd3',
    component: 'scalePoint',
    mode: 'wrap',
    regime: 'css-vars',
  },
  block: {
    usage: 'inspect context',
    placements: ['dock'],
    defaultSize: 'm',
    density: 'compact',
    surfaceClass: 'tool',
    kindGlyph: 'context',
  },
  render: ContextRender,
};

const DOC_LIST: ViewDescriptor = {
  id: 'doc.list',
  name: 'Documents',
  accepts: {},
  emits: ['select', 'update'],
  renderer: 'doc.list',
  sourcing: {
    mode: 'bespoke',
    allowedBespokeReason: 'Document list binds the BlockHost object query to the Console collection contract.',
  },
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
const INDEX_RAIL: ConsoleViewDescriptor = {
  id: 'index.rail',
  name: 'Destinations',
  paletteVisible: true,
  palette: { id: 'index', label: 'Index', kind: 'index', material: 'sunken' },
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
  block: {
    usage: 'browse filing destinations',
    placements: ['ground', 'full'],
    defaultSize: 'm',
    density: 'compact',
    surfaceClass: 'tool',
    kindGlyph: 'records',
  },
  render: IndexDestinationsView,
};

const INDEX_STREAM: ViewDescriptor = {
  id: 'index.stream',
  name: 'Recently filed',
  accepts: {},
  emits: ['update', 'select'],
  renderer: 'index.stream',
  sourcing: { mode: 'wrap', upstream: '@dnd-kit/core/DndContext' },
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
  sourcing: { mode: 'wrap', upstream: 'cmdk/Command' },
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
  sourcing: {
    mode: 'bespoke',
    allowedBespokeReason: 'Urgent filing work is a typed BlockHost projection with a product-specific empty state.',
  },
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
  sourcing: {
    mode: 'bespoke',
    allowedBespokeReason: 'The full card is the product record contract rendered directly from BlockHost data.',
  },
  source: {
    package: '@commonplace/block-view',
    component: 'BlockHost',
    mode: 'bespoke',
    regime: 'css-vars',
    allowedBespokeReason: 'kind-templated card layouts are a domain concept no library models',
  },
  block: {
    usage: 'inspect a record card',
    placements: ['ground', 'full', 'rail'],
    defaultSize: 's',
    density: 'cozy',
    surfaceClass: 'editor',
    kindGlyph: 'cards',
  },
  render: CardFullView,
};

const CARDS_GRID: ViewDescriptor = {
  id: 'cards.grid',
  name: 'Cards',
  accepts: {},
  emits: ['select', 'open'],
  renderer: 'cards.grid',
  sourcing: { mode: 'wrap', upstream: '@tanstack/react-virtual/useVirtualizer' },
  source: {
    package: '@tanstack/react-virtual',
    component: 'useVirtualizer',
    mode: 'wrap',
    regime: 'css-vars',
  },
  block: {
    usage: 'browse record cards',
    placements: ['ground', 'full', 'rail'],
    defaultSize: 'm',
    density: 'cozy',
    surfaceClass: 'editor',
    kindGlyph: 'cards',
  },
  render: CardGridView,
};

const HUNK_REVIEW: ViewDescriptor = {
  id: 'hunk.review',
  name: 'Review',
  accepts: { required_types: ['hunk'], cardinality: 'many' },
  emits: ['invoke_tool'],
  renderer: 'hunk.review',
  sourcing: {
    mode: 'bespoke',
    allowedBespokeReason: 'Hunk review binds typed review objects and executor receipts to the product contract.',
  },
  source: {
    package: '@commonplace/block-view',
    component: 'BlockHost',
    mode: 'bespoke',
    regime: 'css-vars',
    allowedBespokeReason: 'The typed Hunk review mechanics are the product contract; nested structured values still resolve through registered descriptors.',
  },
  render: HunkReviewView,
};

const PROACTIVITY: ConsoleViewDescriptor = {
  id: 'proactivity.graph',
  name: 'Proactivity',
  paletteVisible: true,
  palette: {
    id: 'automation',
    label: 'Automation',
    kind: 'automation',
    material: 'sunken',
    query: { types: [...PG_TYPES], live: true },
  },
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
  block: {
    usage: 'inspect standing automation',
    placements: ['ground', 'full'],
    defaultSize: 'm',
    density: 'both',
    surfaceClass: 'tool',
    kindGlyph: 'automation',
  },
  render: ProactivityView,
};

const SURVEY_BOARD: ViewDescriptor = {
  id: 'survey.board',
  name: 'Indexer',
  accepts: { required_types: ['capture'], cardinality: 'many' },
  emits: ['open'],
  renderer: 'survey.board',
  sourcing: {
    mode: 'bespoke',
    allowedBespokeReason: 'The Researcher board is a typed evidence projection over BlockHost objects.',
  },
  source: {
    package: '@commonplace/block-view',
    component: 'BlockHost',
    mode: 'bespoke',
    regime: 'css-vars',
    allowedBespokeReason: 'The spherical topic corpus, semantic zoom ladder, and evidenced connection labels are the Indexer product contract.',
  },
  render: SurveyView,
};

const MODEL_STUDIO: ViewDescriptor = {
  id: 'model.studio',
  name: 'Data model',
  accepts: { required_types: ['model-scope'] },
  emits: ['select', 'create', 'update', 'delete'],
  renderer: 'model.studio',
  sourcing: { mode: 'wrap', upstream: '@xyflow/react/ReactFlow' },
  source: {
    package: '@xyflow/react',
    component: 'ReactFlow',
    mode: 'wrap',
    regime: 'css-vars',
  },
  block: {
    usage: 'inspect observed model',
    placements: ['ground', 'full', 'rail'],
    defaultSize: 'full',
    density: 'compact',
    surfaceClass: 'editor',
    kindGlyph: 'model',
    bodyBleed: 'flush',
    acceptsDrop: { semantic: 'relate', edge: 'RELATED_TO' },
  },
  render: ModelView,
};

const PROGRAM_CANVAS: ConsoleViewDescriptor = {
  id: 'program.canvas',
  name: 'Program',
  paletteVisible: true,
  palette: { id: 'program', label: 'Program', kind: 'automation', material: 'sunken' },
  accepts: {},
  emits: ['select', 'invoke_tool', 'update'],
  renderer: 'program.canvas',
  source: {
    package: '@xyflow/react',
    component: 'ReactFlow',
    mode: 'wrap',
    regime: 'css-vars',
  },
  block: {
    usage: 'compose programmable graph',
    placements: ['ground', 'full'],
    defaultSize: 'full',
    density: 'both',
    surfaceClass: 'editor',
    kindGlyph: 'automation',
    bodyBleed: 'flush',
  },
  render: ProgramView,
};

const SEARCH_STACK: ConsoleViewDescriptor = {
  id: 'search.stack',
  name: 'Search',
  paletteVisible: true,
  palette: { id: 'search', kind: 'search', material: 'sunken' },
  accepts: {},
  emits: ['open', 'select', 'create'],
  renderer: 'search.stack',
  source: {
    package: 'cmdk',
    component: 'Command',
    mode: 'wrap',
    regime: 'css-vars',
  },
  block: {
    usage: 'search across knowledge',
    placements: ['ground', 'full'],
    defaultSize: 'full',
    density: 'both',
    surfaceClass: 'editor',
    kindGlyph: 'context',
    bodyBleed: 'flush',
  },
  render: SearchStackRender,
};

const WORKSPACE_SUBSTRATE: ViewDescriptor = {
  id: 'workspace.substrate',
  name: 'Workspace',
  accepts: {},
  emits: ['select', 'open', 'update'],
  renderer: 'workspace.substrate',
  sourcing: { mode: 'wrap', upstream: '@tanstack/react-virtual/useVirtualizer' },
  source: {
    package: '@tanstack/react-virtual',
    component: 'useVirtualizer',
    mode: 'wrap',
    regime: 'css-vars',
  },
  render: WorkspaceSubstrateView,
};

const GOAL_STACK: ConsoleViewDescriptor = {
  id: 'goal.stack',
  name: 'Goal Stack',
  paletteVisible: true,
  palette: { id: 'plan', label: 'Plan', kind: 'plan', material: 'sunken' },
  accepts: {},
  emits: ['select', 'invoke_tool', 'update'],
  renderer: 'goal.stack',
  source: {
    package: '@xyflow/react',
    component: 'ReactFlow',
    mode: 'wrap',
    regime: 'css-vars',
  },
  block: {
    usage: 'inspect agent plan',
    placements: ['ground', 'full'],
    defaultSize: 'full',
    density: 'both',
    surfaceClass: 'editor',
    kindGlyph: 'automation',
  },
  render: GoalStackView,
};

const HARNESS_STATUS: ViewDescriptor = {
  id: 'harness.status',
  name: 'Harness Status',
  accepts: {},
  emits: ['open', 'select', 'update'],
  renderer: 'harness.status',
  sourcing: {
    mode: 'bespoke',
    allowedBespokeReason: 'Harness status renders a typed health contract with actionable degradation states.',
  },
  source: {
    package: '@commonplace/block-view',
    component: 'BlockHost',
    mode: 'bespoke',
    regime: 'css-vars',
    allowedBespokeReason:
      'The status report is a Harness contract surface with actionable waiting items and backend degradation.',
  },
  render: StatusPanel,
};

const HARNESS_WHY: ViewDescriptor = {
  id: 'harness.why',
  name: 'Why Trace',
  accepts: {},
  emits: ['open', 'select'],
  renderer: 'harness.why',
  sourcing: {
    mode: 'bespoke',
    allowedBespokeReason: 'Why trace renders the Harness explanation payload and its available remedy.',
  },
  source: {
    package: '@commonplace/block-view',
    component: 'BlockHost',
    mode: 'bespoke',
    regime: 'css-vars',
    allowedBespokeReason:
      'The why trace renders an untransformed Harness explainer payload and optional remedy.',
  },
  render: WhyTracePanel,
};

const APPEARANCE: ViewDescriptor = {
  id: 'settings.appearance',
  name: 'Appearance',
  accepts: {},
  emits: ['update'],
  renderer: 'settings.appearance',
  sourcing: {
    mode: 'bespoke',
    allowedBespokeReason: 'Appearance binds the Console register controls to persisted theme preferences.',
  },
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
  sourcing: { mode: 'wrap', upstream: 'next-auth/react/SessionProvider' },
  source: {
    package: 'next-auth/react',
    component: 'SessionProvider',
    mode: 'wrap',
    regime: 'css-vars',
  },
  render: AccountView,
};

const KANBAN: ConsoleViewDescriptor = {
  id: 'kanban',
  name: 'Kanban',
  paletteVisible: true,
  palette: { id: 'kanban', kind: 'kanban', material: 'sunken' },
  accepts: {},
  emits: ['update', 'move', 'select'],
  renderer: 'kanban',
  source: {
    package: '@dnd-kit/core',
    component: 'DndContext',
    mode: 'wrap',
    regime: 'css-vars',
  },
  block: {
    usage: 'move work through states',
    placements: ['ground', 'full'],
    defaultSize: 'm',
    density: 'both',
    surfaceClass: 'tool',
    kindGlyph: 'kanban',
    acceptsDrop: { semantic: 'contain', layout: 'columns', accepts: ['*'] },
  },
  render: KanbanBlock,
};

const CANVAS: ConsoleViewDescriptor = {
  id: 'canvas',
  name: 'Canvas',
  paletteVisible: true,
  palette: { id: 'canvas', kind: 'canvas', material: 'sunken' },
  accepts: {},
  emits: ['create', 'update', 'move', 'link', 'unlink', 'delete', 'open', 'select'],
  renderer: 'canvas',
  source: {
    package: '@xyflow/react',
    component: 'ReactFlow',
    mode: 'wrap',
    regime: 'css-vars',
  },
  block: {
    usage: 'arrange spatially',
    placements: ['ground', 'full'],
    defaultSize: 'full',
    density: 'both',
    surfaceClass: 'editor',
    kindGlyph: 'canvas',
    bodyBleed: 'flush',
  },
  render: CanvasView,
};

const AUTOMATION_HISTORY: ViewDescriptor = {
  id: 'automation.history',
  name: 'Automation history',
  accepts: {},
  emits: ['select', 'open'],
  renderer: 'automation.history',
  sourcing: { mode: 'reskin', upstream: 'jal-co/ui/commit-graph' },
  source: {
    package: 'jal-co/ui',
    component: 'commit-graph',
    mode: 'reskin',
    regime: 'css-vars',
  },
  block: {
    usage: 'review automation history',
    placements: ['ground', 'full'],
    defaultSize: 'm',
    density: 'compact',
    surfaceClass: 'tool',
    kindGlyph: 'automation',
  },
  render: AutomationHistoryView,
};

const COMMANDS_GALLERY: ConsoleViewDescriptor = {
  id: 'commands.gallery',
  name: 'Commands',
  paletteVisible: true,
  palette: {
    id: 'commands',
    label: 'Commands',
    kind: 'automation',
    material: 'sunken',
  },
  accepts: {},
  emits: ['invoke_tool', 'select', 'open'],
  renderer: 'commands.gallery',
  sourcing: { mode: 'wrap', upstream: 'cmdk/Command' },
  source: {
    package: 'cmdk',
    component: 'Command',
    mode: 'wrap',
    regime: 'css-vars',
  },
  block: {
    usage: 'browse and fork published commands and monitors',
    placements: ['ground', 'full', 'rail'],
    defaultSize: 'm',
    density: 'both',
    surfaceClass: 'tool',
    kindGlyph: 'automation',
  },
  render: CommandsGalleryView,
};

const AGENT_RAIL: ViewDescriptor = {
  id: 'agent.rail',
  name: 'Agent',
  accepts: {},
  emits: ['run_agent', 'open'],
  renderer: 'agent.rail',
  sourcing: { mode: 'wrap', upstream: '@assistant-ui/react/ThreadPrimitive' },
  source: {
    package: '@assistant-ui/react',
    component: 'ThreadPrimitive',
    mode: 'wrap',
    regime: 'css-vars',
  },
  render: AgentRailBlock,
};

const RECORDS_BLOCK: ViewDescriptor = {
  id: 'records.block',
  name: 'Records block',
  accepts: {},
  emits: ['select', 'open', 'update'],
  renderer: 'records.block',
  sourcing: { mode: 'wrap', upstream: '@tanstack/react-table/useReactTable' },
  source: {
    package: '@tanstack/react-table',
    component: 'useReactTable',
    mode: 'wrap',
    regime: 'css-vars',
  },
  render: RecordsBlock,
};

const RECORD_PAGE: ViewDescriptor = {
  id: 'record.page',
  name: 'Record',
  accepts: {},
  emits: ['update', 'open'],
  renderer: 'record.page',
  sourcing: {
    mode: 'bespoke',
    allowedBespokeReason: 'The Twenty record page contract binds field editors directly to BlockHost data.',
  },
  source: {
    package: '@commonplace/block-view',
    component: 'BlockHost',
    mode: 'bespoke',
    regime: 'css-vars',
    allowedBespokeReason: 'Twenty record page layout is the product contract; field editors bind from FieldSpec.',
  },
  render: RecordPage,
};

const COMMONPLACE_CONSOLE: ConsoleViewDescriptor = {
  id: 'commonplace.console',
  name: 'Your data',
  paletteVisible: true,
  palette: {
    id: 'your-data',
    label: 'Your data',
    kind: 'records',
    material: 'sunken',
  },
  accepts: {},
  emits: ['select', 'open'],
  renderer: 'commonplace.console',
  source: {
    package: '@commonplace/console-block',
    component: 'SameOriginGraphqlDoor',
    mode: 'wrap',
    regime: 'css-vars',
  },
  block: {
    usage: 'inspect your CommonPlace data',
    placements: ['ground', 'full', 'rail'],
    defaultSize: 'm',
    density: 'both',
    surfaceClass: 'tool',
    kindGlyph: 'records',
    bodyBleed: 'flush',
    dataNote:
      'Read-only v1 console. The renderer is static, while server-owned consent controls whether its pane instance is mounted.',
  },
  render: ConsoleDataView,
};
export const CONSOLE_VIEW_DESCRIPTORS: readonly ConsoleViewDescriptor[] = [
  RECORD_TABLE,
  MARKDOWN_DOC,
  CODE_FILE,
  CHAT_THREAD,
  CHAT_SURFACE,
  THREAD_LIST,
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
  HARNESS_STATUS,
  HARNESS_WHY,
  ACCOUNT,
  AGENT_RAIL,
  RECORDS_BLOCK,
  RECORD_PAGE,
  KANBAN,
  CANVAS,
  AUTOMATION_HISTORY,
  COMMANDS_GALLERY,
  SURVEY_BOARD,
  MODEL_STUDIO,
  PROGRAM_CANVAS,
  SEARCH_STACK,
  COMMONPLACE_CONSOLE,
] as const;

export const CONSOLE_VIEW_REGISTRY = createViewRegistry(CONSOLE_VIEW_DESCRIPTORS);

/** The forward-compat invariant: an unknown descriptor renders the fallback
 *  card, never a crash, so shared or future arrangements stay safe. */
export function FallbackCard({ descriptorId }: { descriptorId: string }) {
  return (
    <div className="m-3 rounded-ij-arc border border-ij-seam-raised bg-ij-raised p-4 text-ij-ink-info">
      view &quot;{descriptorId}&quot; unavailable: no renderer registered
    </div>
  );
}
