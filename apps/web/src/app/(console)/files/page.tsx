'use client';

/* Files (Data): the DocTree in an inset tray. A real folder tree of the store's
   file-backed Items; picking one opens it in the reader sheet.

   Strangler discipline: seed folder structure so the surface can be judged
   against the porcelain north-star before wiring the real DocTree. Replace TREE
   with the commonplace-api file listing (Items where kind=File, grouped by
   folder_path/collection); the reader binds pdf.js / per-type viewers next.

   Hand-rolled tree for this seed cut (a tree is nested rendering; no lib needed).
   The IA names @pierre/trees for the production tree (drag, reorder, virtualize);
   it is installed and swaps in when those affordances are needed. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FileText,
  Image as ImageIcon,
  Link2,
  Mic,
  StickyNote,
} from '@/lib/icons';
import { refileOverrideList, useRefileSignal } from '@/lib/commonplace/index-queries';
import { useHarnessMemoryDeltas } from '@/lib/harness-changefeed';
import type { HarnessMemoryFile, HarnessMemoryFilesResponse } from '@/lib/harness-memory-files';
import { MemoryReader } from './reader';
import styles from './files.module.css';

type Node = { id: string; name: string; kind?: string; docId?: string; children?: Node[] };

/** Move the first leaf matching `matches` into a top-level folder named
 *  `folderName` (created if absent). Returns the new tree and the destination
 *  folder id (so the caller can expand it), or the unchanged tree if nothing
 *  matched. This is how a refile correction elsewhere lands in the DocTree. */
function moveFileToFolder(
  tree: Node[],
  matches: (node: Node) => boolean,
  folderName: string,
): { tree: Node[]; folderId: string | null } {
  let moved: Node | null = null;
  const strip = (nodes: Node[]): Node[] =>
    nodes.reduce<Node[]>((acc, node) => {
      if (node.children) {
        acc.push({ ...node, children: strip(node.children) });
      } else if (!moved && matches(node)) {
        moved = node; // drop it from its current folder
      } else {
        acc.push(node);
      }
      return acc;
    }, []);

  const stripped = strip(tree);
  if (!moved) return { tree, folderId: null };

  const existing = stripped.find(
    (node) => node.children && node.name.toLowerCase() === folderName.toLowerCase(),
  );
  if (existing) {
    return {
      tree: stripped.map((node) =>
        node === existing ? { ...node, children: [...(node.children ?? []), moved!] } : node,
      ),
      folderId: existing.id,
    };
  }
  const folderId = `dest:${folderName.toLowerCase().replace(/\s+/g, '-')}`;
  return { tree: [...stripped, { id: folderId, name: folderName, children: [moved] }], folderId };
}

const TREE: Node[] = [
  {
    id: 'zoning',
    name: 'Zoning',
    children: [
      { id: 'f1', name: 'Ordinance 24-113, porch lighting and setbacks.pdf', kind: 'pdf' },
      { id: 'f2', name: '2019 zoning map, Genesee County', kind: 'image' },
      { id: 'f3', name: 'Required setback distance (claim)', kind: 'note' },
    ],
  },
  {
    id: 'reading',
    name: 'Reading',
    children: [
      { id: 'f4', name: 'How ADHD brains use external memory systems', kind: 'link' },
      { id: 'f5', name: 'Elicit corpus-table extraction pattern', kind: 'link' },
    ],
  },
  {
    id: 'porchfest',
    name: 'PorchFest 2026',
    children: [
      { id: 'f6', name: 'Voice note, 47 seconds', kind: 'audio' },
      { id: 'f7', name: 'GCLBA compliance report, week 27', kind: 'doc' },
    ],
  },
  {
    id: 'engine',
    name: 'Engine',
    children: [{ id: 'f8', name: 'Pairformer scatter-add kernel notes', kind: 'note' }],
  },
];

function FileGlyph({ kind }: { kind?: string }) {
  const cls = styles.glyph;
  switch (kind) {
    case 'image':
      return <ImageIcon className={cls} />;
    case 'link':
      return <Link2 className={cls} />;
    case 'audio':
      return <Mic className={cls} />;
    case 'note':
      return <StickyNote className={cls} />;
    default:
      return <FileText className={cls} />;
  }
}

function TreeRows({
  nodes,
  depth,
  expanded,
  toggle,
  selected,
  onSelect,
}: {
  nodes: Node[];
  depth: number;
  expanded: Set<string>;
  toggle: (id: string) => void;
  selected: string | null;
  onSelect: (n: Node) => void;
}) {
  return (
    <>
      {nodes.map((node) => {
        const isFolder = !!node.children;
        const isOpen = expanded.has(node.id);
        return (
          <div key={node.id}>
            <button
              className={`${styles.row} ${selected === node.id ? styles.rowSelected : ''}`}
              style={{ paddingLeft: depth * 16 + 8 }}
              onClick={() => (isFolder ? toggle(node.id) : onSelect(node))}
            >
              {isFolder ? (
                <ChevronRight className={`${styles.chev} ${isOpen ? styles.chevOpen : ''}`} width={14} height={14} />
              ) : (
                <span className={styles.spacer} />
              )}
              {isFolder ? (
                isOpen ? <FolderOpen className={styles.glyph} /> : <Folder className={styles.glyph} />
              ) : (
                <FileGlyph kind={node.kind} />
              )}
              <span className={styles.name}>{node.name}</span>
            </button>
            {isFolder && isOpen && node.children && (
              <TreeRows
                nodes={node.children}
                depth={depth + 1}
                expanded={expanded}
                toggle={toggle}
                selected={selected}
                onSelect={onSelect}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

/* Build the "Harness Memory" subtree from the lean listing, grouping by the
   pinned projection path (SPEC-HARNESS-MEMORY-PROJECTION D5). The path is
   `Harness Memory/{slug(kind)}/{doc_id}.md`, so splitting on "/" yields the kind
   folder segment and the leaf. Leaf identity is the doc_id (via projectionPath),
   never the title: a retitle changes the display name but not the tree position.
   Returns null when there are no memory files, so an unavailable or unset harness
   leaves the seeded tree untouched. */
function buildHarnessTree(files: HarnessMemoryFile[]): Node | null {
  if (files.length === 0) return null;
  const folders = new Map<string, Node[]>();
  for (const file of files) {
    const parts = file.projectionPath.split('/');
    const kindSegment = parts.length >= 2 ? parts[1] : file.kind || 'memory';
    const leaf: Node = {
      id: `mem:${file.docId}`,
      name: file.title || file.docId,
      kind: 'note',
      docId: file.docId,
    };
    folders.set(kindSegment, [...(folders.get(kindSegment) ?? []), leaf]);
  }
  const kindFolders: Node[] = [...folders.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([segment, leaves]) => ({
      id: `hm:${segment}`,
      name: segment,
      children: leaves.sort((a, b) => a.name.localeCompare(b.name)),
    }));
  return { id: 'harness-memory', name: 'Harness Memory', children: kindFolders };
}

export default function FilesPage() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['zoning', 'harness-memory']));
  const [selected, setSelected] = useState<Node | null>(null);
  const [memoryFiles, setMemoryFiles] = useState<HarnessMemoryFile[]>([]);
  // Fold in refile corrections already made this session, then listen live.
  const [tree, setTree] = useState<Node[]>(() =>
    refileOverrideList().reduce(
      (folded, override) =>
        moveFileToFolder(
          folded,
          (node) => node.id === override.id || node.name === override.title,
          override.label,
        ).tree,
      TREE,
    ),
  );

  // A refile correction elsewhere (e.g. the Index) moves the matching file into
  // its new destination folder here, live. Match by id (live) or name (fixture).
  useRefileSignal((signal) => {
    const { tree: next, folderId } = moveFileToFolder(
      tree,
      (node) => node.id === signal.id || node.name === signal.title,
      signal.label,
    );
    setTree(next);
    if (folderId) setExpanded((prev) => new Set(prev).add(folderId));
  });

  // Forward OKF bridge: real RustyRed harness memory documents surface here as
  // OKF files under a "Harness Memory" folder, grouped by their pinned projection
  // path. This listing read is the authoritative convergence floor: an
  // unavailable or unset harness leaves the seeded tree untouched.
  const loadMemoryFiles = useCallback(async () => {
    try {
      const response = await fetch('/api/theorem/harness/memory-files', { cache: 'no-store' });
      if (!response.ok) return;
      const body = (await response.json()) as HarnessMemoryFilesResponse;
      setMemoryFiles(body.source === 'live' ? body.files : []);
    } catch {
      /* leave the last known listing in place; the next read reconverges */
    }
  }, []);

  useEffect(() => {
    // The mount read is the convergence floor. loadMemoryFiles setStates only
    // after its fetch resolves (async), not synchronously, so this is not the
    // render cascade the rule guards against; it is shared with the delta
    // refetch below, so inlining it here would duplicate the fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMemoryFiles();
  }, [loadMemoryFiles]);

  // A memory delta (rememberMemory / forgetMemory from Claude Code) is an
  // invalidation, not a patch: re-read the authoritative listing, debounced so a
  // burst of deltas coalesces into one read. Live deltas require the deployed
  // harness to enable its changefeed flags; absent them the mount read still
  // converges.
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useHarnessMemoryDeltas(
    useCallback(() => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(() => void loadMemoryFiles(), 500);
    }, [loadMemoryFiles]),
  );

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // The harness memory folder (live, listing-derived) leads; the seeded tree
  // follows. Keyed separately so a refile on the seed tree never disturbs it.
  const harnessRoot = useMemo(() => buildHarnessTree(memoryFiles), [memoryFiles]);
  const displayTree = harnessRoot
    ? [harnessRoot, ...tree.filter((node) => node.id !== 'harness-memory')]
    : tree;

  return (
    <>
      <header className="p-top">
        <div className="p-toph">
          <div className="p-kicker">Data / Files</div>
          <h1 className="p-h1">Files</h1>
        </div>
        <div className="p-cmd">
          <span>Search or command</span>
          <span className="p-kbd">&#8984;K</span>
        </div>
      </header>

      <div className={styles.body}>
        <aside className={styles.well} aria-label="File tree">
          <div className={styles.wellTitle}>Tree</div>
          <div className={styles.tree}>
            <TreeRows
              nodes={displayTree}
              depth={0}
              expanded={expanded}
              toggle={toggle}
              selected={selected?.id ?? null}
              onSelect={setSelected}
            />
          </div>
        </aside>

        <section className={styles.reader}>
          {selected?.docId ? (
            <MemoryReader key={selected.docId} docId={selected.docId} />
          ) : selected ? (
            <>
              <div className={styles.readerName}>{selected.name}</div>
              <div className={styles.readerHint}>
                Per-type viewer (pdf.js, image, note, link) binds here next.
              </div>
            </>
          ) : (
            <div className={styles.readerHint}>Select a file to open it in the reader.</div>
          )}
        </section>
      </div>
    </>
  );
}
