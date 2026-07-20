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
  onCandidates,
}: {
  readonly host: BlockHost;
  readonly sources: readonly SourceNode[];
  readonly contracts: readonly EffectContract[];
  /** A prefilled hint from a compile-only block add: opens the composer with the
   *  hint so a custom or complex condition is described and compiled, never a
   *  blank hand-written row (the node-model grammar). */
  readonly hint?: string;
  /** The candidates currently awaiting review, published upward so the graph
   *  altitude can render them as uncommitted commits ahead of HEAD (P5). The
   *  composer stays the only place they are produced or resolved; the graph
   *  only shows them. */
  readonly onCandidates?: (candidates: readonly StandingNode[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState('');
  // Adjust state during render when the hint prop changes (the React-sanctioned
  // pattern, not an effect): a compile-only block add opens the composer with the
  // hint prefilled, without a cascading-render effect.
  const [seenHint, setSeenHint] = useState<string | undefined>(hint);
  if (hint !== seenHint) {
    setSeenHint(hint);
    if (hint) {
      setOpen(true);
      setIntent(hint);
    }
  }
  const [result, setResult] = useState<IntentCompileResult | null>(null);
  const [committing, setCommitting] = useState(false);
  const [committed, setCommitted] = useState<string | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const seq = useRef(0);

  const compile = () => {
    setCommitted(null);
    setCommitError(null);
    seq.current += 1;
    const next = stubForme.compileIntent(intent, { sources, contracts, idPrefix: `authored-${seq.current}` });
    setResult(next);
    onCandidates?.(next.ok ? next.candidates : []);
  };

  const discard = () => {
    // Nothing was emitted, so there is nothing to remove.
    setResult(null);
    setIntent('');
    setCommitted(null);
    setCommitError(null);
    onCandidates?.([]);
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
    setResult(null);
    setIntent('');
    onCandidates?.([]);
    setCommitted('Added to your graph. It is now editable like any other node.');
  };

  if (!open) {
    return (
      <button
        type="button"
        className="rounded-ij-arc border border-ij-control-border bg-ij-editor px-3 py-2 text-sm text-ij-ink hover:bg-ij-hover-surface"
        onClick={() => setOpen(true)}
      >
        I want help with something
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-ij-arc border border-ij-seam-raised bg-ij-editor p-3" data-intent-composer>
      <label className="text-xs uppercase tracking-wide text-ij-ink-info" htmlFor="pg-intent">
        Say what you want, in plain language
      </label>
      <textarea
        id="pg-intent"
        className="min-h-16 rounded-ij-arc border border-ij-control-border bg-ij-chrome p-2 text-sm text-ij-ink font-ij-ui"
        placeholder="tell me when anyone I owe work to goes quiet"
        value={intent}
        onChange={(event) => setIntent(event.target.value)}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-ij-arc bg-ij-accent px-3 py-1 text-sm text-ij-ink-bright hover:bg-ij-accent-hover"
          onClick={compile}
        >
          Compile it
        </button>
        <button type="button" className="rounded-ij-arc px-3 py-1 text-sm text-ij-ink-info" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>

      {committed ? <p className="text-sm text-ij-ok">{committed}</p> : null}

      {result && !result.ok ? (
        <div className="rounded-ij-arc bg-ij-warn-bg p-3">
          <p className="text-sm text-ij-warn">Could not compile: {result.reason}</p>
        </div>
      ) : null}

      {result && result.ok ? (
        <div className="flex flex-col gap-2 rounded-ij-arc bg-ij-chrome p-3" data-intent-review>
          <p className="font-ij-mono text-xs uppercase tracking-wide text-ij-ink-info" data-type-role="machine">
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
                  className={`rounded-ij-arc px-2 py-0 font-ij-mono text-xs ${KIND_META[candidate.kind].tint} ${KIND_META[candidate.kind].ink}`}
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
          <p className="text-sm text-ij-ink-info">{result.rationale}</p>
          {commitError ? <p className="text-sm text-ij-error">{commitError}</p> : null}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={committing}
              className="rounded-ij-arc bg-ij-accent px-3 py-1 text-sm text-ij-ink-bright hover:bg-ij-accent-hover"
              onClick={() => void commit(result.candidates)}
            >
              {committing ? 'Committing…' : 'Commit'}
            </button>
            <button type="button" className="rounded-ij-arc border border-ij-control-border px-3 py-1 text-sm text-ij-ink" onClick={compile}>
              Edit and recompile
            </button>
            <button type="button" className="rounded-ij-arc px-3 py-1 text-sm text-ij-ink-info" onClick={discard}>
              Discard
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
