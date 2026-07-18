// SOURCING: none — the OKF projection types for harness memory in the Files
// surfaces, plus the pinned-path mint and the ItemGql adapter the commonplace
// FilesView consumes. Pure logic; no upstream component models this projection.
/**
 * Harness memory documents projected as OKF-style files for the Files view.
 *
 * The forward half of the OKF bridge: documents that live in the RustyRed
 * harness memory (kind note/decision/handoff/...) surface in CommonPlace's Files
 * view as read-through OKF documents, grouped under a single "Harness Memory"
 * folder, without being copied into the CommonPlace object store. Theorem stays
 * the source of truth; CommonPlace renders the projection.
 *
 * The LISTING carries no body: it is title-level metadata plus a pinned
 * projection path and the server's content hash. Bodies hydrate per document, on
 * select, through the reader route (SPEC-HARNESS-MEMORY-PROJECTION D2 + D4).
 */
import type { ItemGql } from '@/lib/commonplace-graphql';

/** A harness memory document reduced to the fields a FILE LISTING needs. No
 *  body, summary, gist, or tags: those belong to the reader, fetched on select.
 *  `projectionPath` is the pinned address (keyed on docId, not title); `kind` is
 *  the memory's own kind (note/decision/postmortem/...), not the constant
 *  "memory". `bodyHash` is the harness's content_hash for change detection. */
export interface HarnessMemoryFile {
  docId: string;
  kind: string;
  title: string;
  projectionPath: string;
  bodyHash: string | null;
  status: string | null;
  createdAtMs: number;
  updatedAtMs: number;
}

/** Response shape of GET /api/theorem/harness/memory-files. `source` distinguishes
 *  an unset tenant (refusal, honest empty) from an unavailable harness (error,
 *  honest empty) from live data; the Files view renders each differently. */
export interface HarnessMemoryFilesResponse {
  source: 'live' | 'unavailable' | 'tenant-unset';
  files: HarnessMemoryFile[];
  count: number;
  /** Freshness marker: the max updated_at across the listing, or null. Not a
   *  graph commit version (the REST surface exposes none); it is the highest
   *  cursor seen, enough to tell a poll whether anything moved. */
  graphVersion: string | null;
}

/** The full document the reader renders, hydrated per doc on select. gist,
 *  confidence, and derivationRef are absent from the deployed memory_docs_list
 *  json! block, so they arrive null until that block emits them; the reader
 *  renders each field only when present (never a fabricated empty value). */
export interface HarnessMemoryDoc {
  docId: string;
  kind: string;
  title: string;
  content: string;
  summary: string | null;
  gist: string | null;
  tags: string[];
  status: string | null;
  confidence: number | null;
  derivationRef: string | null;
  bodyHash: string | null;
  sourcePath: string | null;
  createdAtMs: number;
  updatedAtMs: number;
}

/** Response shape of GET /api/theorem/harness/memory-doc/[id]. Lives here (a
 *  client-safe lib) so the reader component can type the fetch without importing
 *  from the server route module. */
export type HarnessMemoryDocResponse =
  | { source: 'live'; doc: HarnessMemoryDoc }
  | { source: 'tenant-unset' | 'unavailable' | 'not-found'; doc: null; error?: string };

const MEMORY_FILES_PATH = '/api/theorem/harness/memory-files';

/** Top-level folder the memory documents are grouped under in the Files tree. */
export const HARNESS_MEMORY_FOLDER = 'Harness Memory';

/**
 * The pinned projection path for a memory document. Keyed on `docId`, never on
 * `title`: a retitle changes the display name but leaves the address (and so the
 * tree position) byte-identical. `kind` is a folder segment for grouping; a
 * promotion (note -> decision) still moves the file, which the harness-side
 * mint (writing the path once on the node) closes durably.
 */
export function mintProjectionPath(kind: string, docId: string): string {
  return `${HARNESS_MEMORY_FOLDER}/${slug(kind)}/${docId}.md`;
}

/**
 * Fetch harness memory documents and adapt them into ItemGql so the commonplace
 * FilesView can merge them with commonplace-api items and render both through one
 * tree. Never throws: on transport failure it resolves to []. The listing is
 * lean (no body); FilesView shows titles, and body-on-select is the reader
 * route's job.
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
    bodyText: null,
    blobHash: file.bodyHash,
    mime: 'text/markdown',
    source: 'harness:memory',
    residency: 'harness-memory',
    tags: [],
    collections: [HARNESS_MEMORY_FOLDER],
    classification: null,
    status: file.status,
    priority: null,
    dueAtMs: null,
    path: file.projectionPath,
    extra: {
      docId: file.docId,
      projectionPath: file.projectionPath,
      bodyHash: file.bodyHash,
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
