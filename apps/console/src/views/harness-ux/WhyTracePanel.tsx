'use client';

// SOURCING: @commonplace/block-view descriptor surface. Trace rendering is pure local JSON structure.

import { useEffect, useState } from 'react';
import type { ViewRenderProps } from '@commonplace/block-view/types';
import {
  fetchWhy,
  type WhyReport,
  type WhyTarget,
} from '@/lib/harness-ux';
import { RemedyCard } from './RemedyCard';

const WHY_KINDS: WhyTarget['kind'][] = [
  'node',
  'plan',
  'run',
  'receipt',
  'refusal',
  'context_generation',
  'entity',
  'source',
];

export function WhyTracePanel(_props: ViewRenderProps & { target?: WhyTarget }) {
  return <WhyTrace target={_props.target} />;
}

export function WhyTrace({ target }: { target?: WhyTarget | null }) {
  const [draftKind, setDraftKind] = useState<WhyTarget['kind']>(target?.kind ?? 'run');
  const [draftId, setDraftId] = useState(target?.id ?? '');
  const [activeTarget, setActiveTarget] = useState<WhyTarget | null>(target ?? null);
  const [report, setReport] = useState<WhyReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const currentTarget = target ?? activeTarget;

  useEffect(() => {
    if (!currentTarget) return;
    let live = true;
    void Promise.resolve().then(() => {
      if (!live) return;
      setLoading(true);
      setError(null);
      return fetchWhy(currentTarget).then(
        (next) => {
          if (!live) return;
          setReport(next);
          setError(null);
        },
        (whyError: unknown) => {
          if (!live) return;
          setReport(null);
          setError(whyError instanceof Error ? whyError.message : String(whyError));
        },
      ).finally(() => {
        if (live) setLoading(false);
      });
    });
    return () => {
      live = false;
    };
  }, [currentTarget]);

  return (
    <section className="flex h-full min-h-0 flex-col bg-ij-editor text-ij-ink" data-why-trace-panel>
      <header className="flex shrink-0 items-center gap-3 border-b border-ij-seam bg-ij-chrome px-4 py-2">
        <div>
          <div className="text-ij-ink-info">Why Trace</div>
          <h2 style={{ fontWeight: 'var(--rec-weight-cap)' }}>
            {currentTarget ? `${currentTarget.kind}: ${currentTarget.id}` : 'Select a target'}
          </h2>
        </div>
        <form
          className="ml-auto flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const id = draftId.trim();
            if (id) setActiveTarget({ kind: draftKind, id });
          }}
        >
          <select
            value={draftKind}
            onChange={(event) => setDraftKind(event.target.value as WhyTarget['kind'])}
            className="h-ij-control rounded-ij-arc border border-ij-control-border bg-ij-editor px-2 focus:outline-2 focus:outline-ij-accent"
            aria-label="Why target kind"
          >
            {WHY_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
          </select>
          <input
            value={draftId}
            onChange={(event) => setDraftId(event.target.value)}
            aria-label="Why target id"
            className="h-ij-control min-w-64 rounded-ij-arc border border-ij-control-border bg-ij-editor px-2 font-ij-mono focus:outline-2 focus:outline-ij-accent"
          />
          <button type="submit" className="h-ij-control rounded-ij-arc bg-ij-accent px-3 text-ij-ink-bright">
            Fetch why
          </button>
        </form>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-3 gap-3 overflow-auto p-3">
        <div className="col-span-2 min-h-0 rounded-ij-arc border border-ij-seam bg-ij-raised">
          {loading ? (
            <p className="p-3 text-ij-ink-info">Loading why trace.</p>
          ) : error ? (
            <p className="p-3 text-ij-error">{error}</p>
          ) : report ? (
            <TraceReport report={report} />
          ) : (
            <p className="p-3 text-ij-ink-info">Enter a target id to fetch a live why trace.</p>
          )}
        </div>
        <aside className="min-h-0 overflow-auto">
          {report?.degradation.degraded ? (
            <span className="mb-3 inline-flex rounded-ij-arc-underline bg-ij-warn-bg px-1 text-ij-warn" data-status-degraded>
              degraded: {report.degradation.missing.join(', ')}
            </span>
          ) : null}
          <RemedyCard remedy={report?.refusal?.remedy} />
          {report?.refs.length ? (
            <section className="mt-3 rounded-ij-arc border border-ij-seam bg-ij-raised p-3">
              <div className="text-ij-ink-info" style={{ fontWeight: 'var(--rec-weight-cap)' }}>Refs</div>
              <ul className="mt-2 grid gap-1">
                {report.refs.map((ref) => (
                  <li key={ref.id} className="font-ij-mono text-ij-ink-info">
                    {ref.label ? `${ref.label}: ` : null}{ref.id}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

function TraceReport({ report }: { report: WhyReport }) {
  return (
    <div className="min-h-0 overflow-auto p-3">
      <dl className="mb-3 grid gap-1 text-ij-ink-info">
        <div className="flex gap-2">
          <dt>kind</dt>
          <dd className="font-ij-mono text-ij-ink">{report.kind}</dd>
        </div>
        <div className="flex gap-2">
          <dt>target</dt>
          <dd className="font-ij-mono text-ij-ink">{report.target.kind}:{report.target.id}</dd>
        </div>
      </dl>
      <JsonTree value={report.trace} />
    </div>
  );
}

function JsonTree({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null) return <span className="font-ij-mono text-ij-ink-disabled">null</span>;
  if (typeof value === 'string') return <span className="font-ij-mono text-ij-ink">{JSON.stringify(value)}</span>;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return <span className="font-ij-mono text-ij-ink-info">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="font-ij-mono text-ij-ink-disabled">[]</span>;
    return (
      <ol className="grid gap-1" style={{ paddingLeft: depth ? '1rem' : 0 }}>
        {value.map((entry, index) => (
          <li key={index} className="flex gap-2">
            <span className="font-ij-mono text-ij-ink-disabled">[{index}]</span>
            <span className="min-w-0 flex-1"><JsonTree value={entry} depth={depth + 1} /></span>
          </li>
        ))}
      </ol>
    );
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="font-ij-mono text-ij-ink-disabled">{'{}'}</span>;
    return (
      <dl className="grid gap-1" style={{ paddingLeft: depth ? '1rem' : 0 }}>
        {entries.map(([key, entry]) => (
          <div key={key} className="flex gap-2">
            <dt className="min-w-32 max-w-48 truncate font-ij-mono text-ij-ink-info">{key}</dt>
            <dd className="min-w-0"><JsonTree value={entry} depth={depth + 1} /></dd>
          </div>
        ))}
      </dl>
    );
  }
  return <span className="font-ij-mono text-ij-ink-disabled">undefined</span>;
}
