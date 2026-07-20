'use client';

// SOURCING: none. Intent authoring, the compile path (PG5, named choice 4). A
// person writes plain language; Forme (the stub, verify-first V9) compiles it
// into candidate nodes; the compilation renders for review with what it made
// and why; the person commits, edits, or discards. Committed nodes carry
// author: human and are otherwise indistinguishable. An intent Forme cannot
// compile fails honestly with what it could not resolve, never a silent
// partial. Discarding emits nothing, so it leaves no nodes.

import { useRef, useState } from 'react';
import type { BlockHost } from '@commonplace/block-view/types';
import type { EffectContract, SourceNode, StandingNode } from '@/lib/proactivity/model';
import { commitCandidateAction } from '@/lib/proactivity/node-actions';
import { stubForme, type IntentCompileResult } from '@/lib/proactivity/forme';
import { CommitRow } from '@/components/commit-graph';
import { candidateCommit } from './commits';
import { KIND_META } from './kinds';
import { faceClass } from './typography';

export function IntentComposer({
  host,
  sources,
  contracts,
  hint,
  result,
  onResult,
}: {
  readonly host: BlockHost;
  readonly sources: readonly SourceNode[];
  readonly contracts: readonly EffectContract[];
  /** A prefilled hint from a compile-only block add: opens the composer with the
   *  hint so a custom or complex condition is described and compiled, never a
   *  blank hand-written row (the node-model grammar). */
  readonly hint?: string;
  /** The pending compilation, held by the surface rather than by this
   *  component. The graph altitude renders the same candidates as uncommitted
   *  commits ahead of HEAD (P5), and the card altitude unmounts when you switch
   *  to it: if the review lived here, switching altitudes would strand
   *  candidates the graph was still showing. One source of truth, held above
   *  both altitudes. */
  readonly result: IntentCompileResult | null;
  readonly onResult: (result: IntentCompileResult | null) => void;
}) {
  const [intent, setIntent] = useState('');
  // Adjust state during render when the hint prop changes (the React-sanctioned
  // pattern, not an effect): a compile-only block add prefills the input with the
  // hint, without a cascading-render effect.
  const [seenHint, setSeenHint] = useState<string | undefined>(hint);
  if (hint !== seenHint) {
    setSeenHint(hint);
    if (hint) setIntent(hint);
  }
  const [committing, setCommitting] = useState(false);
  const [committed, setCommitted] = useState<string | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const seq = useRef(0);

  const compile = () => {
    setCommitted(null);
    setCommitError(null);
    seq.current += 1;
    onResult(stubForme.compileIntent(intent, { sources, contracts, idPrefix: `authored-${seq.current}` }));
  };

  const discard = () => {
    // Nothing was emitted, so there is nothing to remove.
    onResult(null);
    setIntent('');
    setCommitted(null);
    setCommitError(null);
  };

  const commit = async (candidates: readonly StandingNode[]) => {
    setCommitting(true);
    setCommitError(null);
    // Commit atomically: a candidate trio (or stake plus program) is one intent,
    // so if any node is refused, roll back the ones already created. A failed
    // commit leaves nothing behind, never a silent partial.
    const committedIds: string[] = [];
    for (const candidate of candidates) {
      const receipt = await host.emit(commitCandidateAction(candidate));
      if (!receipt.ok) {
        for (const id of [...committedIds].reverse()) {
          await host.emit({ kind: 'delete', id });
        }
        setCommitError(receipt.error ?? 'The commit was refused.');
        setCommitting(false);
        return;
      }
      committedIds.push(...(receipt.value?.target_ids ?? [candidate.id]));
    }
    setCommitting(false);
    onResult(null);
    setIntent('');
    setCommitted('Added to your graph. It is now editable like any other node.');
  };

  return (
    <div className="flex flex-col gap-2" data-intent-composer>
      {/* The compile affordance, bounded (32 named choice 6). A screen-wide
          single-line strip with a vague placeholder is the Composer's silhouette,
          and this is not the Composer: it is the plain-language compiler, it
          belongs to this panel, and it says so by being measured, labelled, and
          seated in the panel's header region. `max-w-2xl` is the 560-to-640
          measure the handoff specifies. */}
      <div className="flex max-w-2xl items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label
            className="font-ij-mono text-rec-machine uppercase tracking-wide text-ij-ink-info"
            htmlFor="pg-intent"
            data-type-role="machine"
          >
            Say what you want, in plain language
          </label>
          <input
            id="pg-intent"
            data-intent-input
            className="h-ij-control w-full rounded-ij-arc border border-ij-control-border bg-ij-editor px-2 font-ij-ui text-rec-body text-ij-ink"
            placeholder="tell me when anyone I owe work to goes quiet"
            value={intent}
            onChange={(event) => setIntent(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && intent.trim()) compile();
            }}
          />
        </div>
        <button
          type="button"
          className="h-ij-control shrink-0 rounded-ij-arc bg-ij-accent px-3 text-rec-body text-ij-ink-bright hover:bg-ij-accent-hover disabled:bg-ij-chrome disabled:text-ij-ink-disabled"
          style={{ transition: 'var(--rec-clickable-transition)' }}
          disabled={!intent.trim()}
          onClick={compile}
        >
          Compile
        </button>
      </div>

      {committed ? <p className="font-cp-agent text-rec-body text-ij-ok" data-type-role="body" data-type-speaker="agent">{committed}</p> : null}

      {result && !result.ok ? (
        <div className="rounded-ij-arc bg-ij-warn-bg p-3">
          <p className="font-cp-agent text-rec-body text-ij-warn" data-type-role="body" data-type-speaker="agent">Could not compile: {result.reason}</p>
        </div>
      ) : null}

      {result && result.ok ? (
        <div className="flex max-w-2xl flex-col gap-2 rounded-ij-arc border border-ij-seam-raised bg-ij-editor p-2" data-intent-review>
          <p className="font-ij-mono text-rec-machine uppercase tracking-wide text-ij-ink-info" data-type-role="machine">
            Uncommitted, ahead of HEAD
          </p>
          {/* Candidates read as what they are: commits that do not exist yet.
              Dashed, on your lane, in the same row grammar the graph uses, so
              committing them is visibly the same act as any other commit. */}
          <ul className="flex flex-col gap-1" data-candidate-list>
            {result.candidates.map((candidate) => (
              <li
                key={candidate.id}
                data-candidate={candidate.kind}
                className="flex items-center gap-2 rounded-ij-arc border border-dashed border-cp-human px-2 py-1"
              >
                <span
                  data-type-role="machine"
                  className={`rounded-ij-arc px-2 py-0 font-ij-mono text-rec-machine ${KIND_META[candidate.kind].tint} ${KIND_META[candidate.kind].ink}`}
                >
                  {KIND_META[candidate.kind].label}
                </span>
                <CommitRow
                  commit={candidateCommit(candidate)}
                  lane="human"
                  titleClass={faceClass('title', 'human')}
                  dashed
                />
              </li>
            ))}
          </ul>
          <p className="font-cp-agent text-rec-body text-ij-ink-info" data-type-role="body" data-type-speaker="agent">{result.rationale}</p>
          {commitError ? <p className="font-cp-agent text-rec-body text-ij-error" data-type-role="body" data-type-speaker="agent">{commitError}</p> : null}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={committing}
              className="h-ij-control rounded-ij-arc bg-ij-accent px-3 text-rec-body text-ij-ink-bright hover:bg-ij-accent-hover"
              onClick={() => void commit(result.candidates)}
            >
              {committing ? 'Committing…' : 'Commit'}
            </button>
            <button type="button" className="h-ij-control rounded-ij-arc border border-ij-control-border px-3 text-rec-body text-ij-ink" onClick={compile}>
              Edit and recompile
            </button>
            <button type="button" className="h-ij-control rounded-ij-arc px-3 text-rec-body text-ij-ink-info" onClick={discard}>
              Discard
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
