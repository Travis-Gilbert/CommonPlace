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
import { MailConnectView, MailReaderView } from './MailConnectView';
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
import { ModelView } from './model/ModelView';
import { ProgramView } from './program/ProgramView';
import { StatusPanel } from './harness-ux/StatusPanel';
import { WhyTracePanel } from './harness-ux/WhyTracePanel';
import {
  BrowserPaneBlock,
  DocumentBlock,
  KanbanBlock,
  TerminalBlock,
  VideoBlock,
} from './blocks/DeclaredBlocks';
import { AutomationHistoryView } from './blocks/AutomationHistoryView';
import { FindIndexView } from './FindIndexView';

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
  sourcing: {
    mode: 'wrap',
    upstream: 'jacksonkasi1/tnks-data-table/TnksDataTable',
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

const MARKDOWN_DOC: ViewDescriptor = {
  id: 'markdown.doc',
  name: 'Document',
  accepts: {},
  emits: ['update', 'open'],
  renderer: 'markdown.doc',
  sourcing: {
    mode: 'wrap',
    upstream: '@travis-gilbert/markdown-theory/Galley',
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
  emits: ['open'],
  renderer: 'code.file',
  sourcing: {
    mode: 'wrap',
    upstream: 'codemirror/EditorView',
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
  sourcing: {
    mode: 'wrap',
    upstream: '@assistant-ui/react/ThreadPrimitive',
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
  sourcing: {
    mode: 'wrap',
    upstream: '@assistant-ui/react/Composer',
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

const FILES_TREE: ViewDescriptor = {
  id: 'files.tree',
  name: 'Files',
  accepts: {},
  emits: ['open'],
  renderer: 'files.tree',
  sourcing: {
    mode: 'wrap',
    upstream: '@tanstack/react-virtual/useVirtualizer',
  },
  block: {
    usage: 'browse files',
    placements: ['dock'],
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
  sourcing: {
    mode: 'wrap',
    upstream: 'd3/scalePoint',
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
    allowedBespokeReason:
      'Documents list is a host-query retarget of markdown.doc arrangement; no list library owns surface-instance patching.',
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
  sourcing: {
    mode: 'bespoke',
    allowedBespokeReason: 'A destination rail is a list of shelves at register density; no library models the filing contract behind it.',
  },
  render: IndexDestinationsView,
};

const INDEX_STREAM: ViewDescriptor = {
  id: 'index.stream',
  name: 'Recently filed',
  accepts: {},
  emits: ['update', 'select'],
  renderer: 'index.stream',
  sourcing: {
    mode: 'wrap',
    upstream: '@dnd-kit/core/DndContext',
  },
  render: IndexStreamView,
};

const FIND_INDEX: ViewDescriptor = {
  id: 'find.index',
  name: 'Find',
  accepts: {},
  emits: ['select', 'open'],
  renderer: 'find.index',
  sourcing: {
    mode: 'wrap',
    upstream: 'jacksonkasi1/tnks-data-table/TnksDataTable',
  },
  block: {
    usage: 'search the index',
    placements: ['ground', 'full', 'rail'],
    defaultSize: 'm',
    density: 'compact',
    surfaceClass: 'tool',
    kindGlyph: 'memory',
    bodyBleed: 'flush',
  },
  render: FindIndexView,
};

const INDEX_RULES: ViewDescriptor = {
  id: 'index.rules',
  name: 'Rules',
  accepts: {},
  emits: ['create', 'update', 'delete'],
  renderer: 'index.rules',
  sourcing: {
    mode: 'wrap',
    upstream: 'cmdk/Command',
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
    allowedBespokeReason: 'A lane whose empty state is its designed norm is a product claim, not a generic list: no library models "reassure, do not gamify".',
  },
  render: UrgentLaneView,
};

const MAIL_CONNECT: ViewDescriptor = {
  id: 'mail.connect',
  name: 'Mail connect',
  accepts: {},
  emits: ['update'],
  renderer: 'mail.connect',
  sourcing: {
    mode: 'bespoke',
    allowedBespokeReason: 'JMAP connect, mapping, consent, and sync status are a product contract with no ledger library for the multi-step flow.',
  },
  render: MailConnectView,
};

const MAIL_READER: ViewDescriptor = {
  id: 'mail.reader',
  name: 'Mail reader',
  accepts: {},
  emits: ['select'],
  renderer: 'mail.reader',
  sourcing: {
    mode: 'bespoke',
    allowedBespokeReason: 'Minimal mail reader with entity chips, thread rail, and sanitizer policy is bespoke to the JMAP spoke handoff.',
  },
  render: MailReaderView,
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
  sourcing: {
    mode: 'wrap',
    upstream: '@tanstack/react-virtual/useVirtualizer',
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
  sourcing: {
    mode: 'bespoke',
    allowedBespokeReason: 'The editable proactivity graph is the product contract: the standing structure renders and edits as one object at three altitudes, and the dagre layered layout is the join-visible surface. Node kinds and edges resolve through the block-view seam.',
  },
  render: ProactivityView,
};

const WORKSPACE_SUBSTRATE: ViewDescriptor = {
  id: 'workspace.substrate',
  name: 'Workspace',
  accepts: {},
  emits: ['select', 'open', 'update'],
  renderer: 'workspace.substrate',
  sourcing: {
    mode: 'wrap',
    upstream: '@tanstack/react-virtual/useVirtualizer',
  },
  render: WorkspaceSubstrateView,
};

const GOAL_STACK: ViewDescriptor = {
  id: 'goal.stack',
  name: 'Goal Stack',
  accepts: {},
  emits: ['select', 'invoke_tool', 'update', 'link'],
  renderer: 'goal.stack',
  sourcing: {
    mode: 'wrap',
    upstream: '@xyflow/react/ReactFlow',
  },
  block: {
    usage: 'program a goal graph',
    placements: ['ground', 'full'],
    defaultSize: 'full',
    density: 'both',
    surfaceClass: 'editor',
    kindGlyph: 'automation',
    bodyBleed: 'flush',
    acceptsDrop: { semantic: 'relate', accepts: ['*'] },
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
    allowedBespokeReason: 'The status report is a Harness contract surface with actionable waiting items and backend degradation.',
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
    allowedBespokeReason: 'The why trace renders an untransformed Harness explainer payload and optional remedy.',
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
    allowedBespokeReason:
      'Appearance knobs drive the console register seed; no upstream settings panel owns --ij token mutation.',
  },
  render: AppearanceView,
};

const ACCOUNT: ViewDescriptor = {
  id: 'settings.account',
  name: 'Account',
  accepts: {},
  emits: ['update'],
  renderer: 'settings.account',
  sourcing: {
    mode: 'wrap',
    upstream: 'next-auth/react/SessionProvider',
  },
  render: AccountView,
};

const TERMINAL: ViewDescriptor = {
  id: 'terminal',
  name: 'Terminal',
  accepts: {},
  emits: ['invoke_tool'],
  renderer: 'terminal',
  sourcing: {
    mode: 'wrap',
    upstream: 'textmode.js/Textmode',
  },
  block: {
    usage: 'operate a shell',
    placements: ['ground', 'full'],
    defaultSize: 'w',
    density: 'compact',
    surfaceClass: 'tool',
    kindGlyph: 'terminal',
    bodyBleed: 'flush',
    dataNote:
      'Web edition: textmode (or similar) inside the React canvas. Native shell edition: native terminal surface. Same capability via host-bridge openTarget; native supersedes the block renderer when the shell is present.',
  },
  render: TerminalBlock,
};

const BROWSER_PANE: ViewDescriptor = {
  id: 'browser-pane',
  name: 'Browser',
  accepts: {},
  emits: ['open'],
  renderer: 'browser-pane',
  sourcing: {
    mode: 'wrap',
    upstream: 'servo-render-worker/POST /render',
  },
  block: {
    usage: 'view a page',
    placements: ['ground', 'full'],
    defaultSize: 'w',
    density: 'both',
    surfaceClass: 'tool',
    kindGlyph: 'browser',
    bodyBleed: 'flush',
    dataNote:
      'Web edition: Servo render worker (POST /render) into the React canvas. Native shell edition: native Servo surface. Same capability via host-bridge openTarget; native supersedes the block renderer when the shell is present.',
  },
  render: BrowserPaneBlock,
};

const KANBAN: ViewDescriptor = {
  id: 'kanban',
  name: 'Kanban',
  accepts: {},
  emits: ['update', 'move', 'select'],
  renderer: 'kanban',
  sourcing: {
    mode: 'wrap',
    upstream: '@dnd-kit/core/DndContext',
  },
  block: {
    usage: 'move work through states',
    placements: ['ground', 'full'],
    defaultSize: 'm',
    density: 'both',
    surfaceClass: 'tool',
    kindGlyph: 'kanban',
    acceptsChildren: { layout: 'columns', accepts: ['*'] },
  },
  render: KanbanBlock,
};

const DOCUMENT_OUTPUT: ViewDescriptor = {
  id: 'document',
  name: 'Document output',
  accepts: {},
  emits: ['open', 'dispatch'],
  renderer: 'document',
  sourcing: {
    mode: 'wrap',
    upstream: 'akii09/pdfx/PdfxDocument',
  },
  block: {
    usage: 'produce a document',
    placements: ['full', 'ground'],
    defaultSize: 'm',
    density: 'cozy',
    surfaceClass: 'editor',
    kindGlyph: 'doc',
  },
  render: DocumentBlock,
};

const VIDEO: ViewDescriptor = {
  id: 'video',
  name: 'Video',
  accepts: {},
  emits: ['dispatch', 'open'],
  renderer: 'video',
  sourcing: {
    mode: 'wrap',
    upstream: 'remotion-dev/remotion/Composition',
  },
  block: {
    usage: 'compose video',
    placements: ['full', 'ground'],
    defaultSize: 'w',
    density: 'both',
    surfaceClass: 'editor',
    kindGlyph: 'doc',
    bodyBleed: 'flush',
    dataNote:
      'Sibling to the pdfx document block: artifact production with a server-side render pipeline (Remotion → headless browser → MP4). In-app mount is composition preview plus a dispatch render action; the rendered artifact returns with a receipt. Pipeline wiring is a follow-on; this registration reserves the mount with a designed empty state only.',
  },
  render: VideoBlock,
};

const CANVAS: ViewDescriptor = {
  id: 'canvas',
  name: 'Canvas',
  accepts: {},
  emits: ['create', 'update', 'move', 'link', 'unlink', 'delete', 'open', 'select'],
  renderer: 'canvas',
  sourcing: {
    mode: 'wrap',
    upstream: '@xyflow/react/ReactFlow',
  },
  block: {
    usage: 'arrange spatially',
    placements: ['ground', 'full', 'rail'],
    defaultSize: 'full',
    density: 'both',
    surfaceClass: 'editor',
    kindGlyph: 'canvas',
    bodyBleed: 'flush',
    acceptsDrop: { semantic: 'relate', accepts: ['*'] },
  },
  render: CanvasView,
};

const MODEL_STUDIO: ViewDescriptor = {
  id: 'model.studio',
  name: 'Models',
  accepts: { required_types: ['model-scope'] },
  emits: ['select', 'create', 'update', 'delete'],
  renderer: 'model.studio',
  sourcing: {
    mode: 'wrap',
    upstream: '@xyflow/react/ReactFlow',
  },
  block: {
    usage: 'inspect observed model',
    placements: ['ground', 'full', 'rail'],
    defaultSize: 'full',
    density: 'compact',
    surfaceClass: 'editor',
    kindGlyph: 'model',
    bodyBleed: 'flush',
  },
  render: ModelView,
};

const PROGRAM_GRAPH: ViewDescriptor = {
  id: 'program.graph',
  name: 'Program',
  accepts: { required_types: ['program'] },
  emits: ['select', 'create', 'update', 'link', 'unlink', 'delete'],
  renderer: 'program.graph',
  sourcing: {
    mode: 'wrap',
    upstream: '@xyflow/react/ReactFlow',
  },
  block: {
    usage: 'compose typed dataflow',
    placements: ['ground', 'full', 'rail'],
    defaultSize: 'full',
    density: 'both',
    surfaceClass: 'editor',
    kindGlyph: 'automation',
    bodyBleed: 'flush',
    acceptsDrop: { semantic: 'relate', accepts: ['program.node'] },
    dataNote:
      'Programmable graph is typed dataflow (ProgramDefinition), not JSON Canvas spatial arrangement. Connection validation is structural at v1.',
  },
  render: ProgramView,
};

const AUTOMATION_HISTORY: ViewDescriptor = {
  id: 'automation.history',
  name: 'Automation history',
  accepts: {},
  emits: ['select', 'open'],
  renderer: 'automation.history',
  sourcing: {
    mode: 'reskin',
    upstream: 'jal-co/ui/commit-graph',
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
  FIND_INDEX,
  INDEX_RULES,
  INDEX_URGENT,
  MAIL_CONNECT,
  MAIL_READER,
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
  TERMINAL,
  BROWSER_PANE,
  KANBAN,
  DOCUMENT_OUTPUT,
  VIDEO,
  CANVAS,
  MODEL_STUDIO,
  PROGRAM_GRAPH,
  AUTOMATION_HISTORY,
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
