// SOURCING: none — data fetch plus a mapping from harness MemoryDocument rows
// into the existing ItemGql shape so the Files view renders them through the
// unchanged FileSystem tree and FileItemViewer. Pure logic; no upstream
// component models this projection.
/**
 * Harness memory documents projected as OKF-style files for the Files view.
 *
 * The forward half of the OKF bridge: documents that live in the RustyRed
 * harness memory (kind reference/spec/plan/note/...) surface in CommonPlace's
 * Files view as read-through OKF documents (markdown), grouped under a single
 * "Harness Memory" folder, without being copied into the CommonPlace object
 * store. Theorem stays the source of truth; CommonPlace renders the projection.
 *
 * Shape decisions follow HANDOFF-OKF-BRIDGE.md: a memory doc maps to an OKF
 * concept at path `{kind}/{title-slug}.md`, its `kind` is the OKF `type`, and
 * provenance (`source_path`) rides through as the file source.
 */
import type { ItemGql } from '@/lib/commonplace-graphql';

/** A harness memory document reduced to the fields a file listing needs. */
export interface HarnessMemoryFile {
  docId: string;
  kind: string;
  title: string;
  summary: string;
  gist: string;
  content: string;
  tags: string[];
  status: string | null;
  originSurface: string | null;
  sourcePath: string | null;
  createdAtMs: number;
  updatedAtMs: number;
}

/** Response shape of GET /api/theorem/harness/memory-files. */
export interface HarnessMemoryFilesResponse {
  source: 'live' | 'unavailable';
  files: HarnessMemoryFile[];
  count: number;
  attempts?: string[];
}

const MEMORY_FILES_PATH = '/api/theorem/harness/memory-files';

/** Top-level folder the memory documents are grouped under in the Files tree. */
export const HARNESS_MEMORY_FOLDER = 'Harness Memory';

/**
 * Fetch harness memory documents and adapt them into ItemGql so FilesView can
 * merge them with commonplace-api items and render both through one tree. Never
 * throws: on transport failure or an unavailable harness it resolves to [], so
 * the Files view degrades to an honest empty section rather than an error.
 */
export async function fetchHarnessMemoryFiles(
  options: { signal?: AbortSignal } = {},
): Promise<ItemGql[]> {
  try {
    const res = await fetch(MEMORY_FILES_PATH, { cache: 'no-store', signal: options.signal });
    if (!res.ok) return [];
    const body = (await res.json()) as HarnessMemoryFilesResponse;
    return (body.files ?? []).map(toItemGql);
  } catch {
    return [];
  }
}

function toItemGql(file: HarnessMemoryFile): ItemGql {
  return {
    id: `mem:${file.docId}`,
    kind: file.kind,
    title: file.title,
    bodyText: file.content || file.summary || null,
    blobHash: null,
    mime: 'text/markdown',
    source: file.sourcePath ?? file.originSurface,
    residency: 'harness-memory',
    tags: file.tags,
    collections: [HARNESS_MEMORY_FOLDER],
    classification: null,
    status: file.status,
    priority: null,
    dueAtMs: null,
    path: `${HARNESS_MEMORY_FOLDER}/${slug(file.kind)}/${slug(file.title)}.md`,
    extra: {
      docId: file.docId,
      gist: file.gist,
      summary: file.summary,
      sourcePath: file.sourcePath,
      originSurface: file.originSurface,
    },
    createdAtMs: file.createdAtMs,
    updatedAtMs: file.updatedAtMs,
  };
}

function slug(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 96) || 'untitled'
  );
}
