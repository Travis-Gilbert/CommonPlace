// SOURCING: none — server-side REST client for the harness memory-docs API
// (/v1/tenants/{tenant}/memory/docs). Pure fetch plus JSON narrowing; no upstream
// component models this. The harness serves GraphQL only inside the /mcp tunnel
// (budget-capped); the no-budget HTTP surface is this REST family, tenant-on-path.
// memory_docs_list selects via memory_documents_by_updated_at (time-ordered
// enumeration, tenant + status filtered, cursor-paged) NOT recall, so this is an
// exhaustive, unranked listing: the correct transport for a file browser.
/**
 * Harness memory documents, read straight from the REST API.
 *
 * Tenant travels on the connection (the path segment), set here server-side from
 * the environment and never client-supplied. When the tenant env is unset the
 * client REFUSES (returns tenant-unset) without issuing a request: a silent
 * default would render another tenant's personal documents, which is the one
 * failure this read must never have (SPEC-HARNESS-MEMORY-PROJECTION D1).
 */
import { THEOREM_HARNESS_ORIGIN } from '@/lib/theorem-hosted';

/** One harness memory document as the REST API returns it, narrowed to the
 *  fields the Files surfaces need. The deployed memory_docs_list json! block
 *  emits doc_id/kind/title/summary/content/content_hash/status/tags/links/
 *  created_at/updated_at; it does NOT emit gist/confidence/derivation_ref, so
 *  those are absent here until that json! block gains them (small Rust change). */
export interface HarnessMemoryDoc {
  docId: string;
  kind: string;
  title: string;
  summary: string;
  content: string;
  /** The server's own content hash (memory_content_hash over the body). */
  bodyHash: string | null;
  tags: string[];
  status: string | null;
  sourcePath: string | null;
  createdAtMs: number;
  updatedAtMs: number;
}

export type HarnessMemoryFetchResult =
  | { ok: true; docs: HarnessMemoryDoc[]; maxUpdatedAt: string | null }
  | { ok: false; docs: HarnessMemoryDoc[]; error: string; reason: 'tenant-unset' | 'unavailable' };

const PAGE_LIMIT = 500;
const MAX_PAGES = 8;
const REQUEST_TIMEOUT_MS = 12_000;

/**
 * Fetch the tenant's memory documents. Pages by the API's `next_before` cursor
 * until `truncated` is false (capped at MAX_PAGES). Never throws: a failure
 * resolves with ok=false so the caller can render an honest empty state. When
 * the tenant env is unset it resolves ok=false/reason=tenant-unset and issues no
 * request.
 */
export async function fetchHarnessMemoryDocs(): Promise<HarnessMemoryFetchResult> {
  const slug = tenant();
  if (!slug) {
    return { ok: false, docs: [], error: 'tenant-unset', reason: 'tenant-unset' };
  }

  const docs: HarnessMemoryDoc[] = [];
  let before: string | undefined;
  let maxUpdatedAt: string | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(docsUrl(slug, before), {
        headers: requestHeaders(),
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) {
        return unavailable(docs, `memory/docs returned ${response.status}`);
      }
      const body = asRecord(await response.json());
      if (!body || body.ok === false) {
        return unavailable(docs, text(body?.error) ?? 'memory/docs returned not ok');
      }
      for (const raw of asArray(body.docs)) {
        const doc = toDoc(raw);
        if (doc) docs.push(doc);
      }
      const pageMax = text(body.max_updated_at);
      if (pageMax && (!maxUpdatedAt || pageMax > maxUpdatedAt)) maxUpdatedAt = pageMax;
      const nextBefore = text(body.next_before);
      if (body.truncated !== true || !nextBefore) break;
      before = nextBefore;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return unavailable(docs, `memory/docs timed out after ${REQUEST_TIMEOUT_MS}ms`);
      }
      return unavailable(docs, err instanceof Error ? err.message : String(err));
    } finally {
      clearTimeout(timer);
    }
  }

  return { ok: true, docs, maxUpdatedAt };
}

/**
 * Fetch one memory document by id for the reader (hydrate-on-select). The
 * deployed REST surface has no by-id route, so this pages the tenant listing and
 * selects: acceptable at the real corpus size (hundreds), and the natural place a
 * by-id or graph/query fetch swaps in later. Returns the full document (content
 * intact); the listing path strips bodies, this path keeps them.
 */
export async function fetchHarnessMemoryDoc(
  docId: string,
): Promise<
  | { ok: true; doc: HarnessMemoryDoc }
  | { ok: false; error: string; reason: 'tenant-unset' | 'unavailable' | 'not-found' }
> {
  const result = await fetchHarnessMemoryDocs();
  if (!result.ok) return { ok: false, error: result.error, reason: result.reason };
  const doc = result.docs.find((candidate) => candidate.docId === docId);
  if (!doc) return { ok: false, error: `memory doc ${docId} not found`, reason: 'not-found' };
  return { ok: true, doc };
}

function unavailable(docs: HarnessMemoryDoc[], error: string): HarnessMemoryFetchResult {
  return { ok: false, docs, error, reason: 'unavailable' };
}

function docsUrl(slug: string, before?: string): string {
  const origin = (text(process.env.THEOREM_HARNESS_API_URL) ?? THEOREM_HARNESS_ORIGIN).replace(/\/+$/, '');
  const url = new URL(`${origin}/v1/tenants/${encodeURIComponent(slug)}/memory/docs`);
  url.searchParams.set('limit', String(PAGE_LIMIT));
  if (before) url.searchParams.set('before', before);
  return url.toString();
}

/** The tenant slug from the environment, or undefined when unset. There is NO
 *  hardcoded default: an unset tenant is a refusal, not a fallback. */
function tenant(): string | undefined {
  return text(process.env.THEOREM_HARNESS_TENANT) ?? text(process.env.RUSTY_RED_MCP_DEFAULT_TENANT);
}

function requestHeaders(): HeadersInit {
  const token = text(
    process.env.THEOREM_HARNESS_API_TOKEN ??
      process.env.THEOREM_HARNESS_BEARER ??
      process.env.THEOREM_API_TOKEN ??
      process.env.HARNESS_API_KEY,
  );
  return token ? { Accept: 'application/json', Authorization: `Bearer ${token}` } : { Accept: 'application/json' };
}

function toDoc(value: unknown): HarnessMemoryDoc | undefined {
  const doc = asRecord(value);
  if (!doc) return undefined;
  const docId = text(doc.doc_id) ?? text(doc.id);
  if (!docId) return undefined;

  const metadata = asRecord(doc.metadata) ?? {};
  return {
    docId,
    kind: text(doc.kind) ?? 'memory',
    title: text(doc.title) ?? docId,
    summary: text(doc.summary) ?? '',
    content: text(doc.content) ?? '',
    bodyHash: text(doc.content_hash) ?? null,
    tags: asArray(doc.tags)
      .map((tag) => text(tag))
      .filter(nonNullable),
    status: text(doc.status) ?? null,
    sourcePath: text(metadata.source_path) ?? text(metadata.okf_resource) ?? firstLink(doc.links),
    createdAtMs: parseMs(doc.created_at),
    updatedAtMs: parseMs(doc.updated_at),
  };
}

function firstLink(value: unknown): string | null {
  for (const link of asArray(value)) {
    const href = text(link) ?? text(asRecord(link)?.href) ?? text(asRecord(link)?.url) ?? text(asRecord(link)?.target);
    if (href) return href;
  }
  return null;
}

/** Harness timestamps arrive as "unix_ms:<n>"; also tolerate raw numbers and ISO. */
function parseMs(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = text(value);
  if (!raw) return 0;
  const unix = raw.match(/^unix_ms:(\d+)$/);
  if (unix) return Number(unix[1]);
  if (/^\d+$/.test(raw)) return Number(raw);
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/* Narrow JSON helpers (kept local so this module has no runtime deps). */

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function nonNullable<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
