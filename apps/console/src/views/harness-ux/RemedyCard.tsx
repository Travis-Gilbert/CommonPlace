'use client';

// SOURCING: @commonplace/block-view ledger copy affordance plus platform Clipboard API.

import type { Remedy } from '@/lib/harness-ux';
import { useCopyToClipboard } from '@/lib/use-copy';

export function RemedyCard({ remedy }: { remedy: Remedy | null | undefined }) {
  const { state, copy } = useCopyToClipboard();
  if (!remedy) {
    return (
      <section className="rounded-ij-arc border border-ij-seam bg-ij-raised p-3 text-ij-ink-info" data-remedy-card>
        No remedy was supplied by the harness.
      </section>
    );
  }
  const nextCall = remedy.nextCall ? JSON.stringify(remedy.nextCall, null, 2) : null;
  return (
    <section className="rounded-ij-arc border border-ij-seam bg-ij-raised p-3" data-remedy-card>
      <div className="text-ij-ink-info" style={{ fontWeight: 'var(--rec-weight-cap)' }}>Remedy</div>
      <p className="mt-2 text-ij-ink">{remedy.explanation}</p>
      {remedy.missing ? (
        <dl className="mt-3 grid gap-1 text-ij-ink-info">
          <div className="flex gap-2">
            <dt>missing</dt>
            <dd className="font-ij-mono text-ij-ink">{remedy.missing.kind}</dd>
          </div>
          {remedy.missing.value ? (
            <div className="flex gap-2">
              <dt>value</dt>
              <dd className="font-ij-mono text-ij-ink">{remedy.missing.value}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {nextCall ? (
        <div className="mt-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-ij-ink-info">next_call</span>
            <button
              type="button"
              onClick={() => copy(nextCall)}
              className="ml-auto h-ij-control rounded-ij-arc border border-ij-control-border px-2 text-ij-ink hover:bg-ij-hover-surface focus:outline-2 focus:outline-ij-accent"
            >
              Copy next_call
            </button>
          </div>
          <pre className="max-h-64 overflow-auto rounded-ij-arc bg-ij-editor p-2 font-ij-mono text-ij-ink-info">
            <code>{nextCall}</code>
          </pre>
          <p aria-live="polite" className="mt-2 text-ij-ink-info">
            {state === 'copied'
              ? 'next_call copied.'
              : state === 'unavailable'
                ? 'Clipboard unavailable. Select the JSON manually.'
                : ''}
          </p>
        </div>
      ) : null}
    </section>
  );
}
