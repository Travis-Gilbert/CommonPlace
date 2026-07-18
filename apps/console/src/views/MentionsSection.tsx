'use client';

// SOURCING: @commonplace/block-view (host query/emit; candidates are objects
// on the seam). The Mentions section (HANDOFF-CARDS-ACTIONS-MENTIONS K6):
// mounts on cards and the inspector, reading "mentioned in N places, M
// unlinked," expanding to the passages with confirm and dismiss per row.
// Linking is computed and evidenced, never silent (named choice 6): confirm
// patches the candidate to confirmed and the engine writes the identity edge
// with the recorded basis; dismiss records the negative signal. An object
// with no candidates shows no mentions chrome at all.

import { useCallback, useEffect, useState } from 'react';
import type { BlockHost, ObjectRef } from '@commonplace/block-view/types';

// The seam's canonical type refs are dash-form: commonplace-api's
// normalize_type_ref rewrites underscores to dashes on every wire query.
export const MENTION_CANDIDATE_TYPE = 'mention-candidate';

export interface MentionCandidate {
  readonly id: string;
  readonly objectId: string;
  readonly atomId: string;
  readonly matchedAlias: string;
  readonly tier: string;
  readonly status: 'unlinked' | 'confirmed' | 'dismissed';
  /** The passage around the match, captured at detection time so the surface
   *  never re-fetches atom text. */
  readonly snippet: string;
  /** Offsets of the matched alias within `snippet`. */
  readonly snippetStart: number;
  readonly snippetEnd: number;
}

function candidateFromRef(ref: ObjectRef): MentionCandidate | null {
  const props = ref.properties;
  const objectId = props.object_id;
  const atomId = props.atom_id;
  const alias = props.matched_alias;
  if (typeof objectId !== 'string' || typeof atomId !== 'string' || typeof alias !== 'string') {
    return null;
  }
  const status = props.status === 'confirmed' || props.status === 'dismissed' ? props.status : 'unlinked';
  const snippet = typeof props.snippet === 'string' ? props.snippet : '';
  const start = typeof props.snippet_start === 'number' ? props.snippet_start : 0;
  const end = typeof props.snippet_end === 'number' ? props.snippet_end : 0;
  return {
    id: ref.id,
    objectId,
    atomId,
    matchedAlias: alias,
    tier: typeof props.tier === 'string' ? props.tier : 'exact',
    status,
    snippet,
    snippetStart: Math.max(0, Math.min(start, snippet.length)),
    snippetEnd: Math.max(0, Math.min(end, snippet.length)),
  };
}

export function useMentionCandidates(host: BlockHost, objectId: string) {
  const [candidates, setCandidates] = useState<readonly MentionCandidate[]>([]);
  const [generation, setGeneration] = useState(0);
  const refresh = useCallback(() => setGeneration((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const load = (attempt: number) => {
      Promise.resolve(
        host.query({
          types: [MENTION_CANDIDATE_TYPE],
          where: { kind: 'eq', field: 'object_id', value: objectId },
          page: { limit: 200 },
        }),
      )
        .then((set) => {
          if (!active) return;
          setCandidates(
            set.objects
              .map(candidateFromRef)
              .filter(
                (entry): entry is MentionCandidate => entry !== null && entry.objectId === objectId,
              ),
          );
        })
        .catch(() => {
          // One bounded retry before settling on the no-chrome state, so a
          // transient wire hiccup does not permanently hide real candidates.
          if (!active) return;
          if (attempt === 0) {
            retryTimer = setTimeout(() => load(1), 1000);
            return;
          }
          setCandidates([]);
        });
    };
    load(0);
    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [host, objectId, generation]);

  return { candidates, refresh };
}

function Passage({ candidate }: { candidate: MentionCandidate }) {
  const { snippet, snippetStart, snippetEnd } = candidate;
  if (!snippet) return <span className="text-ij-ink-info">{candidate.matchedAlias}</span>;
  const before = snippet.slice(0, snippetStart);
  const match = snippet.slice(snippetStart, snippetEnd);
  const after = snippet.slice(snippetEnd);
  return (
    <span className="text-ij-ink-info">
      {before}
      <mark data-mention-span className="bg-ij-selection text-ij-ink">
        {match || candidate.matchedAlias}
      </mark>
      {after}
    </span>
  );
}

/** The Mentions section body: mounts under the card facts (K1 children slot)
 *  and in the inspector. Renders nothing at all without candidates. */
export function MentionsSection({ host, object }: { host: BlockHost; object: ObjectRef }) {
  const { candidates, refresh } = useMentionCandidates(host, object.id);
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const linked = candidates.filter((entry) => entry.status === 'confirmed');
  const unlinked = candidates.filter((entry) => entry.status === 'unlinked');
  if (linked.length === 0 && unlinked.length === 0) return null;

  const setStatus = async (candidate: MentionCandidate, status: 'confirmed' | 'dismissed') => {
    setPending(candidate.id);
    await host.emit({ kind: 'update', id: candidate.id, patch: { status } });
    setPending(null);
    refresh();
  };

  return (
    <section data-mentions-section className="border-t border-ij-divider p-rec-cell-pad">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-baseline gap-2 text-left text-ij-ink hover:text-ij-accent focus:outline-2 focus:outline-ij-accent"
        style={{ transition: 'var(--rec-clickable-transition)' }}
      >
        <span style={{ fontWeight: 'var(--rec-weight-medium)' }}>Mentions</span>
        <span className="text-ij-ink-info" data-mentions-summary>
          mentioned in {candidates.length - candidates.filter((c) => c.status === 'dismissed').length}{' '}
          places, {unlinked.length} unlinked
        </span>
      </button>
      {expanded ? (
        <ul className="mt-1">
          {[...unlinked, ...linked].map((candidate) => (
            <li
              key={candidate.id}
              data-mention-candidate={candidate.status}
              className="border-b border-ij-divider py-rec-grid last:border-b-0"
            >
              <Passage candidate={candidate} />
              <div className="mt-1 flex items-center gap-2">
                <span className="font-ij-mono text-ij-ink-disabled">{candidate.tier}</span>
                {candidate.status === 'unlinked' ? (
                  <>
                    <button
                      type="button"
                      disabled={pending === candidate.id}
                      onClick={() => setStatus(candidate, 'confirmed')}
                      className="h-6 rounded-ij-arc border border-ij-control-border bg-ij-editor px-2 text-ij-ink hover:bg-ij-hover-surface focus:outline-2 focus:outline-ij-accent"
                      style={{ transition: 'var(--rec-clickable-transition)' }}
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      disabled={pending === candidate.id}
                      onClick={() => setStatus(candidate, 'dismissed')}
                      className="h-6 rounded-ij-arc px-2 text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink focus:outline-2 focus:outline-ij-accent"
                      style={{ transition: 'var(--rec-clickable-transition)' }}
                    >
                      Dismiss
                    </button>
                  </>
                ) : (
                  <span className="text-ij-ink-info">linked</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** The card-header chip: a small unlinked-total marker when candidates exist
 *  (K6). Renders nothing at zero. */
export function UnlinkedMentionsChip({ host, object }: { host: BlockHost; object: ObjectRef }) {
  const { candidates } = useMentionCandidates(host, object.id);
  const unlinked = candidates.filter((entry) => entry.status === 'unlinked').length;
  if (unlinked === 0) return null;
  return (
    <span
      data-mentions-chip
      className="ml-auto inline-flex h-5 shrink-0 items-center rounded-ij-arc-underline bg-ij-editor px-2 font-ij-mono text-ij-accent"
      aria-label={`${unlinked} unlinked mentions`}
    >
      {unlinked}
    </span>
  );
}
