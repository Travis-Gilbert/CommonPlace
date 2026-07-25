'use client';

// SOURCING: @commonplace/block-view descriptor surface. Status rows are domain objects no generic list models.

import { useCallback, useEffect, useState } from 'react';
import type { ViewRenderProps } from '@commonplace/block-view/types';
import {
  fetchStatus,
  type StatusReport,
  type WhyTarget,
} from '@/lib/harness-ux';
import { WhyTrace } from './WhyTracePanel';

export function StatusPanel(_props: ViewRenderProps) {
  const [report, setReport] = useState<StatusReport | null>(null);
  const [whyTarget, setWhyTarget] = useState<WhyTarget | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    void fetchStatus({ kind: 'all' }).then(
      (next) => {
        setReport(next);
        setError(null);
      },
      (statusError: unknown) => {
        setReport(null);
        setError(statusError instanceof Error ? statusError.message : String(statusError));
      },
    ).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let live = true;
    void Promise.resolve().then(() => {
      if (live) refresh();
    });
    return () => {
      live = false;
    };
  }, [refresh]);

  return (
    <section className="flex h-full min-h-0 flex-col bg-ij-editor text-ij-ink" data-status-panel>
      <header className="flex shrink-0 items-center gap-3 border-b border-ij-seam bg-ij-chrome px-4 py-2">
        <div>
          <div className="text-ij-ink-info">Harness</div>
          <h2 style={{ fontWeight: 'var(--rec-weight-cap)' }}>Status</h2>
        </div>
        {report?.degradation.degraded ? (
          <span className="inline-flex rounded-ij-arc-underline bg-ij-warn-bg px-1 text-ij-warn" data-status-degraded>
            degraded: {report.degradation.missing.join(', ')}
          </span>
        ) : null}
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="ml-auto h-ij-control rounded-ij-arc border border-ij-control-border px-3 hover:bg-ij-hover-surface disabled:opacity-50"
        >
          {loading ? 'Refreshing' : 'Refresh'}
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-3 gap-3 overflow-hidden p-3">
        <main className="col-span-2 min-h-0 overflow-auto">
          {error ? <p className="mb-3 rounded-ij-arc border border-ij-error bg-ij-raised p-3 text-ij-error">{error}</p> : null}
          {!report && !error ? <p className="text-ij-ink-info">Loading harness status.</p> : null}
          {report ? (
            <div className="grid gap-3">
              <section className="rounded-ij-arc border border-ij-seam bg-ij-raised" aria-label="Runs">
                <PanelHeader title="Runs" detail={`generation ${report.generation}`} />
                {report.runs.length ? (
                  <ul>
                    {report.runs.map((run) => (
                      <li key={run.id} className="border-t border-ij-seam p-3" data-status-run={run.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-ij-mono text-ij-ink">{run.id}</span>
                          <span className="ml-auto font-ij-mono text-ij-ink-info">
                            {run.fraction.done}/{run.fraction.total}
                          </span>
                        </div>
                        <div className="mt-2 grid gap-1 text-ij-ink-info">
                          <div>plan: <span className="font-ij-mono text-ij-ink">{run.planRef ?? 'none'}</span></div>
                          <div>head: <span className="font-ij-mono text-ij-ink">{run.headPresence ?? 'not present'}</span></div>
                          <div>last event: <span className="font-ij-mono text-ij-ink">{run.lastEvent ?? 'none'}</span></div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setWhyTarget({ kind: 'run', id: run.id })}
                          className="mt-2 h-ij-control rounded-ij-arc border border-ij-control-border px-2 hover:bg-ij-hover-surface"
                        >
                          Why this run
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="border-t border-ij-seam p-3 text-ij-ink-info">
                    No runs are visible from the live status door.
                  </p>
                )}
              </section>

              <section className="rounded-ij-arc border border-ij-seam bg-ij-raised" aria-label="Waiting on you">
                <PanelHeader title="Waiting on you" detail={`${report.waitingOnYou.length} item${report.waitingOnYou.length === 1 ? '' : 's'}`} />
                {report.waitingOnYou.length ? (
                  <ul>
                    {report.waitingOnYou.map((item) => {
                      const target = whyTargetForWaitingItem(item);
                      return (
                        <li key={`${item.kind}:${item.id}`} className="border-t border-ij-seam p-3" data-waiting-on-you={item.kind}>
                          <div className="flex items-center gap-2">
                            <span className="rounded-ij-arc-underline bg-ij-chrome px-1 font-ij-mono text-ij-ink-info">{item.kind}</span>
                            <span className="font-ij-mono text-ij-ink">{item.id}</span>
                          </div>
                          <p className="mt-2">{item.summary}</p>
                          <div className="mt-2 flex gap-2">
                            {target ? (
                              <button
                                type="button"
                                onClick={() => setWhyTarget(target)}
                                className="h-ij-control rounded-ij-arc border border-ij-control-border px-2 hover:bg-ij-hover-surface"
                              >
                                Open why
                              </button>
                            ) : null}
                            {item.href ? (
                              <a
                                href={item.href}
                                className="inline-flex h-ij-control items-center rounded-ij-arc border border-ij-control-border px-2 text-ij-link hover:bg-ij-hover-surface"
                              >
                                Open target
                              </a>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="border-t border-ij-seam p-3 text-ij-ink-info">
                    Nothing is waiting on you.
                  </p>
                )}
              </section>

              <section className="rounded-ij-arc border border-ij-seam bg-ij-raised" aria-label="Coordination">
                <PanelHeader title="Coordination" detail={report.coordination.roomId ?? 'no room'} />
                <div className="grid gap-1 border-t border-ij-seam p-3 text-ij-ink-info">
                  <div>unread stream deltas: <span className="font-ij-mono text-ij-ink">{report.coordination.unreadStreamDeltas}</span></div>
                  <div>intents: <span className="font-ij-mono text-ij-ink">{report.coordination.intents.length}</span></div>
                  <p className="pt-2 text-ij-warn">Live refresh is not available in this console surface yet. Use Refresh for a real status pull.</p>
                </div>
              </section>

              <CostSection report={report} />
            </div>
          ) : null}
        </main>
        <aside className="min-h-0 overflow-hidden rounded-ij-arc border border-ij-seam bg-ij-raised">
          <WhyTrace target={whyTarget} />
        </aside>
      </div>
    </section>
  );
}

function PanelHeader({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex h-ij-control items-center gap-2 px-3 text-ij-ink-info">
      <span style={{ fontWeight: 'var(--rec-weight-cap)' }}>{title}</span>
      <span className="ml-auto font-ij-mono">{detail}</span>
    </div>
  );
}

function CostSection({ report }: { report: StatusReport }) {
  return (
    <section className="rounded-ij-arc border border-ij-seam bg-ij-raised" aria-label="Cost">
      <PanelHeader title="Cost" detail={report.cost.visible ? (report.cost.priceTableVersion ?? 'price table unknown') : 'not visible'} />
      {report.cost.visible ? (
        <div className="grid gap-2 border-t border-ij-seam p-3">
          {report.cost.today ? (
            <div className="font-ij-mono text-ij-ink">
              today: {report.cost.today.tokens} tokens, {report.cost.today.cost} {report.cost.today.currency}
            </div>
          ) : (
            <p className="text-ij-ink-info">No cost total is available for today.</p>
          )}
          {report.cost.perRun.length ? (
            <ul className="grid gap-1">
              {report.cost.perRun.map((run) => (
                <li key={run.runId} className="font-ij-mono text-ij-ink-info">
                  {run.runId}: {run.tokens} tokens, {run.cost}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="border-t border-ij-seam p-3 text-ij-ink-info">
          Cost is not visible for this principal or backend door.
        </p>
      )}
    </section>
  );
}

function whyTargetForWaitingItem(item: StatusReport['waitingOnYou'][number]): WhyTarget | null {
  if (item.kind === 'mention') return { kind: 'entity', id: item.id };
  if (item.kind === 'low_confidence_receipt' || item.kind === 'peer_review' || item.kind === 'proposal' || item.kind === 'consent') {
    return { kind: 'receipt', id: item.id };
  }
  if (item.kind === 'refusal') return { kind: 'refusal', id: item.id };
  return null;
}
