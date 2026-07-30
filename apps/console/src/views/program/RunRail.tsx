'use client';

// SOURCING: none. Receipt-backed Program Canvas playground and node inspector.

import { useState } from 'react';
import type {
  ProcessLiveness,
  ProgramRunReceipt,
  ProgramValueRef,
} from '@commonplace/program-contracts';

export type RunRailProps = {
  readonly busy: boolean;
  readonly livenessByNode: Readonly<Record<string, ProcessLiveness>>;
  readonly receipt: ProgramRunReceipt | null;
  readonly selectedNodeId: string | null;
  readonly tweakText: string;
  readonly pinned: boolean;
  readonly authoringRuntime: string | null;
  readonly codeSource: string;
  readonly onTweakTextChange: (value: string) => void;
  readonly onCodeSourceChange: (value: string) => void;
  readonly onRun: () => void;
  readonly onPin: (value: ProgramValueRef) => void;
  readonly onUnpin: () => void;
  readonly onResume: (answer: string) => void;
  readonly onFetchSpill: (fetchHandle: string) => Promise<Record<string, unknown>>;
  readonly notice?: string | null;
};

function ValuePreview({
  value,
  onFetchSpill,
}: {
  readonly value: ProgramValueRef | null | undefined;
  readonly onFetchSpill: (fetchHandle: string) => Promise<Record<string, unknown>>;
}) {
  const [fetched, setFetched] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!value) return <p className="text-xs text-ij-ink-info">No value captured.</p>;
  if (value.storage === 'inline') {
    return (
      <pre className="max-h-48 overflow-auto rounded-ij-arc bg-ij-editor p-2 font-ij-mono text-xs text-ij-ink" data-mono-ok>
        {JSON.stringify(value.value, null, 2)}
      </pre>
    );
  }
  return (
    <div className="grid gap-2">
      <pre className="max-h-32 overflow-auto rounded-ij-arc bg-ij-editor p-2 font-ij-mono text-xs text-ij-ink" data-mono-ok>
        {JSON.stringify(fetched ?? value.summary, null, 2)}
      </pre>
      <button
        type="button"
        className="h-ij-control rounded-ij-arc border border-ij-control-border px-2 text-xs hover:bg-ij-hover-surface"
        onClick={() => {
          setError(null);
          void onFetchSpill(value.fetch_handle)
            .then(setFetched)
            .catch((fetchError: unknown) => {
              setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
            });
        }}
      >
        Fetch full output
      </button>
      {error ? <p className="text-xs text-ij-warn">{error}</p> : null}
    </div>
  );
}

export function RunRail({
  busy,
  livenessByNode,
  receipt,
  selectedNodeId,
  tweakText,
  pinned,
  authoringRuntime,
  codeSource,
  onTweakTextChange,
  onCodeSourceChange,
  onRun,
  onPin,
  onUnpin,
  onResume,
  onFetchSpill,
  notice,
}: RunRailProps) {
  const [answer, setAnswer] = useState('');
  const counts = Object.values(livenessByNode).reduce(
    (acc, value) => {
      acc[value] = (acc[value] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const inspection = selectedNodeId ? receipt?.inspections[selectedNodeId] : undefined;
  const runtimeReceipt = selectedNodeId
    ? receipt?.runtime_receipts?.[selectedNodeId]
    : undefined;
  const parked = receipt?.parked;

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col overflow-auto border-l border-ij-seam bg-ij-chrome px-3 py-3 text-ij-ink">
      <h2 className="text-sm" style={{ fontWeight: 'var(--rec-weight-cap)' as never }}>Playground</h2>
      <button
        type="button"
        disabled={busy}
        onClick={onRun}
        className="mt-3 h-ij-control rounded-ij-arc bg-ij-accent px-3 text-ij-ink-bright disabled:opacity-50"
      >
        {busy ? 'Running' : 'Run program'}
      </button>
      <ul className="mt-3 flex flex-wrap gap-2 font-ij-mono text-xs text-ij-ink-info" data-mono-ok>
        {Object.entries(counts).map(([state, count]) => (
          <li key={state}>{state}: {count}</li>
        ))}
      </ul>

      {selectedNodeId ? (
        <section className="mt-4 grid gap-3 border-t border-ij-seam pt-3" aria-label="Selected node inspection">
          <div>
            <p className="text-xs text-ij-ink-info">Selected node</p>
            <p className="break-all font-ij-mono text-xs" data-mono-ok>{selectedNodeId}</p>
          </div>
          <label className="grid gap-1 text-xs text-ij-ink-info">
            Run tweak as JSON
            <textarea
              value={tweakText}
              onChange={(event) => onTweakTextChange(event.target.value)}
              placeholder={'{"temperature": 0.2}'}
              className="min-h-20 rounded-ij-arc border border-ij-control-border bg-ij-editor p-2 font-ij-mono text-xs text-ij-ink"
              data-mono-ok
            />
          </label>
          {authoringRuntime ? (
            <label className="grid gap-1 text-xs text-ij-ink-info">
              {authoringRuntime === 'quick_js' ? 'QuickJS source' : 'WASM text (WAT) module'}
              <textarea
                value={codeSource}
                onChange={(event) => onCodeSourceChange(event.target.value)}
                className="min-h-32 rounded-ij-arc border border-ij-control-border bg-ij-editor p-2 font-ij-mono text-xs text-ij-ink"
                data-mono-ok
                spellCheck={false}
              />
              <span>Runs only through the declared sandbox capability.</span>
            </label>
          ) : null}
          <div>
            <p className="mb-1 text-xs text-ij-ink-info">Inputs</p>
            <ValuePreview
              key={`inputs:${receipt?.receipt_id ?? 'none'}:${selectedNodeId}`}
              value={inspection?.inputs}
              onFetchSpill={onFetchSpill}
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-ij-ink-info">Outputs</p>
            <ValuePreview
              key={`outputs:${receipt?.receipt_id ?? 'none'}:${selectedNodeId}`}
              value={inspection?.outputs}
              onFetchSpill={onFetchSpill}
            />
          </div>
          {runtimeReceipt ? (
            <details className="rounded-ij-arc border border-ij-control-border p-2">
              <summary className="cursor-pointer text-xs text-ij-ink-info">
                Sandbox receipt
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto font-ij-mono text-xs text-ij-ink" data-mono-ok>
                {JSON.stringify(runtimeReceipt, null, 2)}
              </pre>
            </details>
          ) : null}
          {inspection?.outputs ? (
            <button
              type="button"
              onClick={() => pinned ? onUnpin() : onPin(inspection.outputs!)}
              className="h-ij-control rounded-ij-arc border border-ij-control-border px-2 text-xs hover:bg-ij-hover-surface"
            >
              {pinned ? 'Unpin output' : 'Pin output'}
            </button>
          ) : null}
        </section>
      ) : null}

      {parked ? (
        <section className="mt-4 grid gap-2 border-t border-ij-seam pt-3" aria-label="Parked human input">
          <p className="text-xs text-ij-gold">Waiting for human input</p>
          <p className="text-sm">{parked.prompt}</p>
          <p className="font-ij-mono text-xs text-ij-ink-info" data-mono-ok>
            {parked.coordination_stream}
          </p>
          <textarea
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            className="min-h-20 rounded-ij-arc border border-ij-control-border bg-ij-editor p-2 text-sm text-ij-ink"
            aria-label="Human answer"
          />
          <button
            type="button"
            disabled={busy || !answer.trim()}
            onClick={() => onResume(answer)}
            className="h-ij-control rounded-ij-arc bg-ij-accent px-3 text-ij-ink-bright disabled:opacity-50"
          >
            Resume run
          </button>
        </section>
      ) : null}

      {receipt?.events.length ? (
        <section className="mt-4 border-t border-ij-seam pt-3">
          <p className="text-xs text-ij-ink-info">Latest events</p>
          <ol className="mt-2 grid gap-1 font-ij-mono text-xs text-ij-ink-info" data-mono-ok>
            {receipt.events.slice(-8).map((event) => (
              <li key={event.sequence}>
                {event.sequence} {event.node_id} {event.kind}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {notice ? <p className="mt-3 text-xs text-ij-ink-info">{notice}</p> : null}
    </aside>
  );
}
