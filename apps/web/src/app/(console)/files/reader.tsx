// SOURCING: @travis-gilbert/markdown-theory (Galley): the memory body renders
// through the project's markdown renderer (the same Galley used by published
// blocks). The surrounding read-state shell (loading / error / tenant-unset /
// header strip) is thin composition; no upstream component models a harness
// memory reader.
'use client';

/* The harness memory reader (SPEC-HARNESS-MEMORY-PROJECTION D4). Hydrates one
   document on select through /api/theorem/harness/memory-doc/[id] and renders its
   full body as markdown via the project's Galley renderer. No body is present in
   the listing; it arrives from the request issued here. States are honest:
   loading, loaded, error, tenant-unset, not-found. gist / confidence render only
   when the server emits them (it does not yet), never as fabricated empties. */

import { useEffect, useState } from 'react';
import { Galley } from '@travis-gilbert/markdown-theory/react';
import '@travis-gilbert/markdown-theory/css';
import type { HarnessMemoryDoc, HarnessMemoryDocResponse } from '@/lib/harness-memory-files';
import styles from './files.module.css';

type State =
  | { status: 'loading' }
  | { status: 'loaded'; doc: HarnessMemoryDoc }
  | { status: 'error'; message: string }
  | { status: 'tenant-unset' }
  | { status: 'not-found' };

/** Map a memory kind to a Galley template. Memory kinds are open tokens
 *  (note, decision, handoff, postmortem, self_note, ...); anything without a
 *  specific template reads well as an article. */
function templateFor(kind: string): string {
  switch (kind) {
    case 'note':
    case 'self_note':
      return 'note';
    case 'reference':
    case 'source':
      return 'reference';
    case 'log':
    case 'worklog':
      return 'log';
    default:
      return 'article';
  }
}

function formatUpdated(ms: number): string | null {
  if (!ms) return null;
  try {
    return new Date(ms).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return null;
  }
}

export function MemoryReader({ docId }: { docId: string }) {
  const [state, setState] = useState<State>({ status: 'loading' });

  // The reader is remounted per docId (keyed at the call site), so state starts
  // at `loading` on every selection: no reset in the effect, no flash of the
  // previous document's body while the next one loads.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/theorem/harness/memory-doc/${encodeURIComponent(docId)}`, { cache: 'no-store' })
      .then(async (response) => (await response.json()) as HarnessMemoryDocResponse)
      .then((body) => {
        if (cancelled) return;
        if (body.source === 'live' && body.doc) {
          setState({ status: 'loaded', doc: body.doc });
        } else if (body.source === 'tenant-unset') {
          setState({ status: 'tenant-unset' });
        } else if (body.source === 'not-found') {
          setState({ status: 'not-found' });
        } else {
          setState({ status: 'error', message: body.error ?? 'harness unavailable' });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [docId]);

  if (state.status === 'loading') {
    return <div className={styles.memState}>Loading the memory document</div>;
  }
  if (state.status === 'tenant-unset') {
    return (
      <div className={styles.memState}>
        No tenant configured. Set THEOREM_HARNESS_TENANT to read harness memory.
      </div>
    );
  }
  if (state.status === 'not-found') {
    return <div className={styles.memState}>This memory document is no longer in the harness.</div>;
  }
  if (state.status === 'error') {
    return <div className={styles.memState}>Could not load this document: {state.message}</div>;
  }

  const { doc } = state;
  const updated = formatUpdated(doc.updatedAtMs);
  const lede = doc.gist ?? doc.summary;

  return (
    <article className={styles.memReader}>
      <header className={styles.memHead}>
        <div className={styles.memKind}>{doc.kind}</div>
        <h2 className={styles.memTitle}>{doc.title}</h2>
        <div className={styles.memMeta}>
          {updated && <span>Updated {updated}</span>}
          {doc.status && <span>{doc.status}</span>}
          {typeof doc.confidence === 'number' && (
            <span>confidence {Math.round(doc.confidence * 100)}%</span>
          )}
        </div>
        {doc.tags.length > 0 && (
          <div className={styles.memTags}>
            {doc.tags.map((tag) => (
              <span key={tag} className={styles.memTag}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>
      {lede && <p className={styles.memGist}>{lede}</p>}
      <div className={styles.memBody}>
        <Galley doc={doc.content} template={templateFor(doc.kind)} />
      </div>
    </article>
  );
}
