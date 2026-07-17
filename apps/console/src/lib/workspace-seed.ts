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

export const SURFACE_ID = 'console-workspace';

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

/** Screens are seeded surfaces (HANDOFF-CONSOLE-ROUND-2 R3): the proof
 *  workspace, Index, Documents, and Appearance, each with
 *  its own namespaced regions so every screen remembers its own arrangement.
 *  The switcher flips the `active` flag; nothing else moves. */
export function seedLayout(): ObjectRef[] {
  return [
    // Workspace: the proof arrangement (G8), the default active surface.
    layoutObject(SURFACE_ID, 'surface', { name: 'Workspace', kind: 'workspace', active: true }, [
      'region-left',
      'region-editor',
      'region-right',
    ]),
    layoutObject(
      'region-left',
      'region',
      { kind: 'tool-window', side: 'left', title: 'Records', icon: 'records', size: 24, open: true },
      ['vi-records'],
    ),
    layoutObject(
      'region-editor',
      'region',
      { kind: 'editor', size: 48, active_tab: 'vi-brief' },
      ['vi-brief', 'vi-code'],
    ),
    layoutObject(
      'region-right',
      'region',
      { kind: 'tool-window', side: 'right', title: 'Thread', icon: 'thread', size: 28, open: true, mark: true },
      ['vi-thread'],
    ),
    layoutObject('vi-records', 'view-instance', {
      descriptor_id: 'record.table',
      title: 'Records',
      query: { types: ['record'], live: true } as unknown as JsonValue,
    }),
    layoutObject('vi-brief', 'view-instance', {
      descriptor_id: 'markdown.doc',
      title: 'Console brief',
      query: { types: ['doc'], where: { kind: 'eq', field: 'slug', value: 'console-brief' } } as unknown as JsonValue,
    }),
    layoutObject('vi-code', 'view-instance', {
      descriptor_id: 'code.file',
      title: 'surface-tree.ts',
      query: { types: ['code-file'], where: { kind: 'eq', field: 'path', value: 'packages/block-view/src/surface-tree.ts' } } as unknown as JsonValue,
    }),
    layoutObject('vi-thread', 'view-instance', {
      descriptor_id: 'chat.thread',
      title: 'Thread',
      query: { types: ['thread'] } as unknown as JsonValue,
    }),

    // Index: the IX7 skeleton landing as a screen (R3.1). The destination
    // rail names its missing wire; connectors and filing stay out of scope.
    layoutObject('console-index', 'surface', { name: 'Index', kind: 'index', active: false }, [
      'index.region-rail',
      'index.region-editor',
    ]),
    layoutObject(
      'index.region-rail',
      'region',
      { kind: 'tool-window', side: 'left', title: 'Destinations', icon: 'rail', size: 22, open: true },
      ['index.vi-rail'],
    ),
    layoutObject(
      'index.region-editor',
      'region',
      { kind: 'editor', size: 78, active_tab: 'index.vi-stream' },
      ['index.vi-stream'],
    ),
    layoutObject('index.vi-rail', 'view-instance', {
      descriptor_id: 'index.rail',
      title: 'Destinations',
      query: { types: ['record'], page: { limit: 1 } } as unknown as JsonValue,
    }),
    layoutObject('index.vi-stream', 'view-instance', {
      descriptor_id: 'record.table',
      title: 'Triage stream',
      query: { types: ['record'], live: true } as unknown as JsonValue,
    }),

    // Documents: list left, Galley reading view center, thread on its stripe
    // (closed by default) (R3.2).
    layoutObject('console-docs', 'surface', { name: 'Documents', kind: 'documents', active: false }, [
      'docs.region-list',
      'docs.region-editor',
      'docs.region-thread',
    ]),
    layoutObject(
      'docs.region-list',
      'region',
      { kind: 'tool-window', side: 'left', title: 'Documents', icon: 'docs', size: 22, open: true },
      ['docs.vi-list'],
    ),
    layoutObject(
      'docs.region-editor',
      'region',
      { kind: 'editor', size: 50, active_tab: 'docs.vi-reader' },
      ['docs.vi-reader'],
    ),
    layoutObject(
      'docs.region-thread',
      'region',
      { kind: 'tool-window', side: 'right', title: 'Thread', icon: 'thread', size: 28, open: false, mark: true },
      ['docs.vi-thread'],
    ),
    layoutObject('docs.vi-list', 'view-instance', {
      descriptor_id: 'doc.list',
      title: 'Documents',
      query: { types: ['doc'], live: true } as unknown as JsonValue,
    }),
    layoutObject('docs.vi-reader', 'view-instance', {
      descriptor_id: 'markdown.doc',
      title: 'Reading',
      query: { types: ['doc'], where: { kind: 'eq', field: 'slug', value: 'console-brief' } } as unknown as JsonValue,
    }),
    layoutObject('docs.vi-thread', 'view-instance', {
      descriptor_id: 'chat.thread',
      title: 'Thread',
      query: { types: ['thread'] } as unknown as JsonValue,
    }),

    // Review: the Hunk handoff re-scoped to the Greenfield shell. The route is
    // arrangement data (a named surface and registered view), while the typed
    // values and action receipts remain substrate-owned.
    layoutObject('console-review', 'surface', { name: 'Review', kind: 'review', active: false }, [
      'review.region-editor',
    ]),
    layoutObject(
      'review.region-editor',
      'region',
      { kind: 'editor', size: 100, active_tab: 'review.vi-hunks' },
      ['review.vi-hunks'],
    ),
    layoutObject('review.vi-hunks', 'view-instance', {
      descriptor_id: 'hunk.review',
      title: 'Hunk review',
      query: { types: ['hunk'], live: true } as unknown as JsonValue,
    }),

    // Appearance: one descriptor-backed editor surface. The controls mutate
    // the root register, so this screen is both configuration and live proof.
    layoutObject('console-appearance', 'surface', { name: 'Appearance', kind: 'settings', active: false }, [
      'appearance.region-editor',
    ]),
    layoutObject(
      'appearance.region-editor',
      'region',
      { kind: 'editor', size: 100, active_tab: 'appearance.vi-theme' },
      ['appearance.vi-theme'],
    ),
    layoutObject('appearance.vi-theme', 'view-instance', {
      descriptor_id: 'settings.appearance',
      title: 'Appearance',
      query: { types: ['surface'] } as unknown as JsonValue,
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
