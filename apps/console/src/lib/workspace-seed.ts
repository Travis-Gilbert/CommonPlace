// SOURCING: @commonplace/block-view (ObjectRef, CONTAINS_EDGE). Seed data only.
/**
 * The proof workspace seed (HANDOFF-GREENFIELD-CONSOLE G8): one surface object
 * composing the product sentence. Left tool window: a record set. Editor: a
 * markdown brief through Galley and a read-only code file. Right tool window:
 * the thread. Review is another named surface whose typed HunkSet rides the
 * same object seam. The arrangement is data; the shell renders whatever the
 * surface object says. A second arrangement is a second seed, zero code.
 *
 * Records are generated with the repo's deterministic PRNG convention
 * (djb2 + LCG, no Math.random) so builds and snapshots are stable.
 */

import type { ObjectRef, JsonValue } from '@commonplace/block-view/types';
import { CONTAINS_EDGE } from '@commonplace/block-view/surface-tree';

export const SURFACE_ID = 'console-chat';
export const WORKSPACE_SURFACE_ID = 'console-workspace';
export const ACCOUNT_SURFACE_ID = 'console-account';

function layoutObject(
  id: string,
  type: string,
  properties: Record<string, JsonValue>,
  children?: readonly string[],
): ObjectRef {
  return {
    id,
    type,
    properties,
    relations: children ? { [CONTAINS_EDGE]: children } : undefined,
  };
}

export type ToolWindowRole = 'surface' | 'companion';

interface ToolWindowSeed {
  readonly id: string;
  readonly title: string;
  readonly icon: string;
  readonly side: 'left' | 'right';
  readonly size: number;
  readonly open: boolean;
  readonly role: ToolWindowRole;
  readonly descriptorId: string;
  readonly companion?: 'files' | 'context' | 'thread';
  readonly queryTypes?: readonly string[];
  readonly live?: boolean;
}

/** Register one role-bearing tool window and its descriptor-backed view. */
export function registerToolWindow(seed: ToolWindowSeed): ObjectRef[] {
  const viewId = `${seed.id}.view`;
  return [
    layoutObject(
      seed.id,
      'region',
      {
        kind: 'tool-window',
        side: seed.side,
        title: seed.title,
        icon: seed.icon,
        size: seed.size,
        open: seed.open,
        role: seed.role,
        ...(seed.companion ? { companion: seed.companion } : {}),
      },
      [viewId],
    ),
    layoutObject(viewId, 'view-instance', {
      descriptor_id: seed.descriptorId,
      title: seed.title,
      query: {
        types: seed.queryTypes ?? (seed.companion === 'thread'
          ? ['thread']
          : seed.companion === 'files'
            ? ['files-view']
            : seed.companion === 'context'
              ? ['context-view']
              : ['surface-tool']),
        ...(seed.live ? { live: true } : {}),
      } as unknown as JsonValue,
    }),
  ];
}

function companionSeeds(prefix: string, threadOpen = false): ObjectRef[] {
  return [
    ...registerToolWindow({
      id: `${prefix}.region-files`,
      title: 'Files',
      icon: 'files',
      side: 'left',
      size: 24,
      open: false,
      role: 'companion',
      companion: 'files',
      descriptorId: 'files.tree',
    }),
    ...registerToolWindow({
      id: `${prefix}.region-context`,
      title: 'Context',
      icon: 'context',
      side: 'right',
      size: 24,
      open: false,
      role: 'companion',
      companion: 'context',
      descriptorId: 'context.graph',
    }),
    ...registerToolWindow({
      id: `${prefix}.region-thread`,
      title: 'Thread',
      icon: 'thread',
      side: 'right',
      size: 28,
      open: threadOpen,
      role: 'companion',
      companion: 'thread',
      descriptorId: 'chat.thread',
    }),
  ];
}

function companionIds(prefix: string): string[] {
  return [`${prefix}.region-files`, `${prefix}.region-context`, `${prefix}.region-thread`];
}

/** The durable IA seed: six primary surfaces in stripe order, plus secondary
 * layouts available through the layout switcher and Command mode. */
export function seedLayout(): ObjectRef[] {
  return [
    layoutObject('console.region-landmarks', 'region', {
      kind: 'landmarks',
      title: 'Landmarks',
      collapsed: false,
      seed_revision: 1,
    }, ['console.landmark-chat', 'console.landmark-records']),
    layoutObject('console.landmark-chat', 'view-instance', {
      descriptor_id: 'chat.surface',
      title: 'Chat',
      pinned: true,
      query: { types: ['thread'] } as unknown as JsonValue,
    }),
    layoutObject('console.landmark-records', 'view-instance', {
      descriptor_id: 'record.table',
      title: 'Records',
      query: { types: ['record'], page: { limit: 100 } } as unknown as JsonValue,
    }),

    layoutObject(SURFACE_ID, 'surface', {
      name: 'Chat', kind: 'chat', role: 'surface', stripe_order: 0, active: true, seed_revision: 3,
    }, ['chat.region-editor', ...companionIds('chat')]),
    layoutObject('chat.region-editor', 'region', {
      kind: 'editor', chrome: 'bare', size: 100, active_tab: 'chat.vi-surface', seed_revision: 2,
    }, ['chat.vi-surface']),
    layoutObject('chat.vi-surface', 'view-instance', {
      descriptor_id: 'chat.surface', title: 'Chat', query: { types: ['thread'] } as unknown as JsonValue,
    }),
    ...companionSeeds('chat'),

    layoutObject(WORKSPACE_SURFACE_ID, 'surface', {
      name: 'Workspace', kind: 'workspace', role: 'surface', stripe_order: 1, active: false, seed_revision: 4,
    }, ['region-editor', ...companionIds('workspace'), 'workspace.region-automation']),
    layoutObject('region-editor', 'region', {
      kind: 'editor', size: 72, active_tab: 'workspace.vi-substrate', seed_revision: 3,
    }, ['workspace.vi-substrate', 'vi-brief', 'vi-code']),
    layoutObject('workspace.vi-substrate', 'view-instance', {
      descriptor_id: 'workspace.substrate', title: 'Workspace substrate',
      query: { types: ['surface-tool'] } as unknown as JsonValue,
    }),
    layoutObject('vi-brief', 'view-instance', {
      descriptor_id: 'markdown.doc', title: 'Console brief',
      query: { types: ['doc'], where: { kind: 'eq', field: 'slug', value: 'console-brief' } } as unknown as JsonValue,
    }),
    layoutObject('vi-code', 'view-instance', {
      descriptor_id: 'code.file', title: 'surface-tree.ts',
      query: { types: ['code-file'], where: { kind: 'eq', field: 'path', value: 'packages/block-view/src/surface-tree.ts' } } as unknown as JsonValue,
    }),
    ...companionSeeds('workspace', true),
    ...registerToolWindow({
      id: 'workspace.region-automation',
      title: 'Automation',
      icon: 'automation',
      side: 'left',
      size: 28,
      open: false,
      role: 'companion',
      descriptorId: 'automation.history',
      queryTypes: ['run', 'dispatch'],
      live: true,
    }),

    layoutObject('console-goals', 'surface', {
      name: 'Goal Stack', kind: 'goals', role: 'surface', stripe_order: 2, active: false, seed_revision: 3,
    }, ['goals.region-editor', ...companionIds('goals')]),
    layoutObject('goals.region-editor', 'region', {
      kind: 'editor', size: 100, active_tab: 'goals.vi-stack', seed_revision: 3,
    }, ['goals.vi-stack']),
    layoutObject('goals.vi-stack', 'view-instance', {
      descriptor_id: 'goal.stack', title: 'Goal Stack',
      query: { types: ['surface-tool'] } as unknown as JsonValue,
    }),
    ...companionSeeds('goals'),

    // The Index (SPEC-COMMONPLACE-FILING-AND-INDEX-1.0). The rail names the
    // shelves; the editor holds the recently-filed ribbon, the digest, and the
    // rules tab; the urgent lane is its own small tool window whose empty state
    // is the designed norm. The triage stream used to point at record.table
    // over 5000 fixture records, which is why seed_revision moves: an existing
    // arrangement must re-seed to reach the real one.
    layoutObject('console-index', 'surface', {
      name: 'Index', kind: 'index', role: 'surface', stripe_order: 3, active: false, seed_revision: 3,
    }, ['index.region-rail', 'index.region-editor', 'index.region-urgent', ...companionIds('index')]),
    ...registerToolWindow({
      id: 'index.region-rail', title: 'Destinations', icon: 'rail', side: 'left', size: 22,
      open: true, role: 'surface', descriptorId: 'index.rail', queryTypes: ['record'],
    }),
    ...registerToolWindow({
      id: 'index.region-urgent', title: 'Needs you today', icon: 'rail', side: 'right', size: 22,
      open: true, role: 'surface', descriptorId: 'index.urgent', queryTypes: ['record'],
    }),
    layoutObject('index.region-editor', 'region', {
      kind: 'editor', size: 56, active_tab: 'index.vi-stream', seed_revision: 3,
    }, ['index.vi-stream', 'index.vi-rules']),
    layoutObject('index.vi-stream', 'view-instance', {
      descriptor_id: 'index.stream', title: 'Recently filed',
      query: { types: ['record'], live: true } as unknown as JsonValue,
    }),
    layoutObject('index.vi-rules', 'view-instance', {
      descriptor_id: 'index.rules', title: 'Rules',
      query: { types: ['record'] } as unknown as JsonValue,
    }),
    ...companionSeeds('index'),

    layoutObject('console-docs', 'surface', {
      name: 'Documents', kind: 'documents', role: 'surface', stripe_order: 4, active: false, seed_revision: 2,
    }, ['docs.region-list', 'docs.region-editor', ...companionIds('docs')]),
    ...registerToolWindow({
      id: 'docs.region-list', title: 'Documents', icon: 'docs', side: 'left', size: 22,
      open: true, role: 'surface', descriptorId: 'doc.list', queryTypes: ['doc'],
    }),
    layoutObject('docs.region-editor', 'region', {
      kind: 'editor', size: 78, active_tab: 'docs.vi-reader', seed_revision: 2,
    }, ['docs.vi-reader']),
    layoutObject('docs.vi-reader', 'view-instance', {
      descriptor_id: 'markdown.doc', title: 'Reading',
      query: { types: ['doc'], where: { kind: 'eq', field: 'slug', value: 'console-brief' } } as unknown as JsonValue,
    }),
    ...companionSeeds('docs'),

    layoutObject('console-cards', 'surface', {
      name: 'Cards', kind: 'cards', role: 'surface', stripe_order: 5, active: false, seed_revision: 3,
    }, ['cards.region-editor', 'cards.region-stripe-tray', ...companionIds('cards')]),
    layoutObject('cards.region-editor', 'region', {
      kind: 'grid', size: 100, seed_revision: 3,
    }, ['cards.vi-grid', 'cards.vi-records']),
    layoutObject('cards.vi-grid', 'view-instance', {
      descriptor_id: 'cards.grid', title: 'Cards',
      query: { types: ['person', 'task', 'project', 'org'], page: { limit: 400 }, live: true } as unknown as JsonValue,
      config: { size: 'w' } as unknown as JsonValue,
    }),
    layoutObject('cards.vi-records', 'view-instance', {
      descriptor_id: 'record.table', title: 'Records',
      query: { types: ['record'], page: { limit: 100 }, live: true } as unknown as JsonValue,
      config: { size: 'm' } as unknown as JsonValue,
    }),
    layoutObject('cards.region-stripe-tray', 'region', {
      kind: 'stripe-tray',
      side: 'left',
      title: 'Stripe tray',
      icon: 'records',
      companion: 'stripe-tray',
      size: 12,
      open: false,
      role: 'companion',
    }, []),
    ...companionSeeds('cards'),

    layoutObject('console-review', 'surface', {
      name: 'Review', kind: 'review', role: 'surface', active: false, seed_revision: 2,
    }, ['review.region-editor', ...companionIds('review')]),
    layoutObject('review.region-editor', 'region', {
      kind: 'editor', size: 100, active_tab: 'review.vi-hunks', seed_revision: 2,
    }, ['review.vi-hunks']),
    layoutObject('review.vi-hunks', 'view-instance', {
      descriptor_id: 'hunk.review', title: 'Hunk review', query: { types: ['hunk'], live: true } as unknown as JsonValue,
    }),
    ...companionSeeds('review'),

    layoutObject('console-appearance', 'surface', {
      name: 'Appearance', kind: 'settings', role: 'surface', active: false, seed_revision: 2,
    }, ['appearance.region-editor', ...companionIds('appearance')]),
    layoutObject('appearance.region-editor', 'region', {
      kind: 'editor', size: 100, active_tab: 'appearance.vi-theme', seed_revision: 2,
    }, ['appearance.vi-theme']),
    layoutObject('appearance.vi-theme', 'view-instance', {
      descriptor_id: 'settings.appearance', title: 'Appearance', query: { types: ['surface'] } as unknown as JsonValue,
    }),
    ...companionSeeds('appearance'),

    // Proactivity: the editable standing graph, projected from fixtures until
    // the kernel lands behind the same seam. A secondary surface reached through
    // the layout switcher and Command mode, like Review and Appearance; the
    // editor hosts all three altitudes and the switcher flips the active flag.
    layoutObject('console-proactivity', 'surface', {
      name: 'Proactivity', kind: 'proactivity', role: 'surface', active: false, seed_revision: 2,
    }, ['proactivity.region-editor', ...companionIds('proactivity')]),
    layoutObject('proactivity.region-editor', 'region', {
      kind: 'editor', size: 100, active_tab: 'proactivity.vi-graph', seed_revision: 2,
    }, ['proactivity.vi-graph']),
    layoutObject('proactivity.vi-graph', 'view-instance', {
      descriptor_id: 'proactivity.graph',
      title: 'Proactivity',
      query: {
        types: ['pg.stake', 'pg.source', 'pg.watch', 'pg.judgment', 'pg.response', 'pg.assumption'],
        live: true,
      } as unknown as JsonValue,
    }),
    ...companionSeeds('proactivity'),

    layoutObject('console-harness-status', 'surface', {
      name: 'Harness Status', kind: 'harness-status', role: 'surface', active: false, seed_revision: 1,
    }, ['harness-status.region-editor', ...companionIds('harness-status')]),
    layoutObject('harness-status.region-editor', 'region', {
      kind: 'editor', size: 100, active_tab: 'harness-status.vi-status', seed_revision: 1,
    }, ['harness-status.vi-status', 'harness-status.vi-why']),
    layoutObject('harness-status.vi-status', 'view-instance', {
      descriptor_id: 'harness.status', title: 'Harness Status', query: { types: ['surface-tool'], live: true } as unknown as JsonValue,
    }),
    layoutObject('harness-status.vi-why', 'view-instance', {
      descriptor_id: 'harness.why', title: 'Why Trace', query: { types: ['surface-tool'] } as unknown as JsonValue,
    }),
    ...companionSeeds('harness-status'),

    layoutObject(ACCOUNT_SURFACE_ID, 'surface', {
      name: 'Account', kind: 'account', role: 'surface', active: false, seed_revision: 2,
    }, ['account.region-editor']),
    layoutObject('account.region-editor', 'region', {
      kind: 'editor', size: 100, active_tab: 'account.vi-profile', seed_revision: 2,
    }, ['account.vi-profile']),
    layoutObject('account.vi-profile', 'view-instance', {
      descriptor_id: 'settings.account', title: 'Account', query: { types: ['surface-tool'] } as unknown as JsonValue,
    }),
  ];
}

// Deterministic PRNG: djb2 seed + LCG stream (repo convention).
function djb2(text: string): number {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  return hash;
}

function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

const RECORD_KINDS = ['capture', 'source', 'note', 'run'] as const;
const RECORD_STATUS = ['open', 'processing', 'settled'] as const;
const RECORD_TAGS = ['harness', 'memory', 'graph', 'index', 'publish', 'agent', 'room'] as const;
const TITLE_HEADS = [
  'Ingest receipt', 'Recall trace', 'Graph delta', 'Publish attestation', 'Session summary',
  'Tension record', 'Capture batch', 'Provenance chain', 'Index sweep', 'Coordination intent',
] as const;
const TITLE_TAILS = [
  'for the harness console', 'from the memory substrate', 'across tenant records',
  'on the object contract', 'over the descriptor registry', 'through the block seam',
  'against the run journal', 'for the proof workspace', 'in the arrangement graph',
] as const;

export const RECORD_COUNT = 5000;

export function seedRecords(): ObjectRef[] {
  const rand = lcg(djb2('console-records-v1'));
  const records: ObjectRef[] = [];
  const start = Date.UTC(2026, 0, 1);
  for (let i = 0; i < RECORD_COUNT; i += 1) {
    const kind = RECORD_KINDS[Math.floor(rand() * RECORD_KINDS.length)];
    const status = RECORD_STATUS[Math.floor(rand() * RECORD_STATUS.length)];
    const head = TITLE_HEADS[Math.floor(rand() * TITLE_HEADS.length)];
    const tail = TITLE_TAILS[Math.floor(rand() * TITLE_TAILS.length)];
    const tagCount = 1 + Math.floor(rand() * 2);
    const tags: string[] = [];
    for (let t = 0; t < tagCount; t += 1) {
      const tag = RECORD_TAGS[Math.floor(rand() * RECORD_TAGS.length)];
      if (!tags.includes(tag)) tags.push(tag);
    }
    const updated = new Date(start + Math.floor(rand() * 197) * 86400000).toISOString().slice(0, 10);
    records.push({
      id: `rec-${i + 1}`,
      type: 'record',
      properties: { title: `${head} ${i + 1} ${tail}`, kind, status, updated, tags },
    });
  }
  return records;
}

export const RECORD_FIELDS = ['title', 'kind', 'status', 'updated', 'tags'] as const;

const CONSOLE_BRIEF = `# The harness console

Imagine Cursor had forked IntelliJ instead of VS Code, with sidebars that show
code and markdown as easily as they show data models. This workspace is that
sentence made literal.

## The mechanism

The chrome outside is Int UI: tool window stripes down the edges, a sunken
editor well, a main toolbar with a run widget, a status bar. Every value is
pinned verbatim from the shipped JetBrains theme. Seams are darker than
surfaces; no light hairline exists anywhere.

The panes inside are the block-view object contract. Every pane you can see,
including the one this brief renders in, is a view instance resolved by
descriptor over an ObjectQuery against a BlockHost. The arrangement you are
looking at is not code; it is a surface object with regions, and dragging a
splitter writes back to it.

## Why this composes

- One material system: the Int UI register paints everything.
- Two structural sources: chrome uses Int UI metrics, record surfaces use
  Twenty metrics. Both are Inter, both sit on a 13px base and a 4px grid.
- Documents render through Galley, bridged to the chrome so a brief reads
  like a publication page inside an IDE that reads like an IDE.

## What to try

Drag the splitters and reload: the arrangement holds, because it is an
object, not component state. Toggle the tool windows from the stripes.
Double-press Shift for search everywhere.
`;

const CONSOLE_PUNCH_LIST = `# Console punch list

Working notes for the console itself. Each todo carries the action affordance:
the arrow at the end of a line (or Alt Enter with the line focused) hands that
item to the agent through the action sheet.

## Open items

- [ ] Wire the destination rail to live connector counts
- [ ] Capture a fresh visual baseline after the card engine lands
- [x] Point the record table at the deployed object seam

## Notes

The sheet stages this document plus the todo line as visible context; nothing
travels unseen.
`;

export function seedDocs(): ObjectRef[] {
  return [
    {
      id: 'doc-console-brief',
      type: 'doc',
      properties: {
        slug: 'console-brief',
        title: 'The harness console',
        markdown: CONSOLE_BRIEF,
      },
    },
    {
      id: 'doc-console-punch-list',
      type: 'doc',
      properties: {
        slug: 'console-punch-list',
        title: 'Console punch list',
        markdown: CONSOLE_PUNCH_LIST,
      },
    },
  ];
}

// The code tab proves the descriptor slot (full CodeBlockHost work stays with
// SPEC-CODE-SURFACE later). The fixture is the real source of the surface
// tree module this workspace itself renders through.
const SURFACE_TREE_SOURCE = `export const CONTAINS_EDGE = 'CONTAINS';

export interface SurfaceTreeNode {
  readonly object: ObjectRef;
  readonly children: readonly SurfaceTreeNode[];
}

export function buildSurfaceTree(
  surfaceId: string,
  objects: readonly ObjectRef[],
): SurfaceTreeNode | null {
  const map = new Map(objects.map((object) => [object.id, object]));
  return buildNode(surfaceId, map, new Set());
}

function buildNode(
  id: string,
  map: ReadonlyMap<string, ObjectRef>,
  visited: Set<string>,
): SurfaceTreeNode | null {
  const object = map.get(id);
  if (!object || visited.has(id)) return null;
  visited.add(id);
  const children = (object.relations?.[CONTAINS_EDGE] ?? [])
    .map((childId) => buildNode(childId, map, visited))
    .filter((node): node is SurfaceTreeNode => node !== null);
  visited.delete(id);
  return { object, children };
}

export function surfaceQuery(): ObjectQuery {
  return {
    types: ['surface', 'region', 'view-instance'],
    traverse: [{ edge: CONTAINS_EDGE, dir: 'out' }],
    live: true,
  };
}
`;

export function seedCodeFiles(): ObjectRef[] {
  return [
    {
      id: 'code-surface-tree',
      type: 'code-file',
      properties: {
        path: 'packages/block-view/src/surface-tree.ts',
        language: 'typescript',
        content: SURFACE_TREE_SOURCE,
      },
    },
  ];
}
