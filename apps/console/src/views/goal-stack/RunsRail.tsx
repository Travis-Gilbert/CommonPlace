'use client';

// Runs rail: active and recent runs with completion from real task counts.
// Empty when the substrate has not published runsRail yet.

import type { RunRailItem } from '@commonplace/theorem-acp/plan-state';

export function RunsRail({
  runs,
  activePlanId,
  onOpen,
}: {
  runs: readonly RunRailItem[];
  activePlanId: string;
  onOpen: (planId: string) => void;
}) {
  return (
    <aside className="flex shrink-0 flex-col border-b border-ij-seam bg-ij-chrome" aria-label="Runs rail" data-runs-rail>
      <div className="flex items-center gap-2 px-3 py-1 text-ij-ink-info">
        <span>Runs</span>
        <span className="font-ij-mono">{runs.length}</span>
      </div>
      {runs.length === 0 ? (
        <div className="px-3 pb-2 text-ij-ink-info">No active or recent runs from the substrate.</div>
      ) : (
        <ul className="flex gap-2 overflow-x-auto px-3 pb-2">
          {runs.map((run) => {
            const active = run.planId === activePlanId || run.runId === activePlanId;
            const percent = Math.round(clamp(run.completionFraction) * 100);
            return (
              <li key={run.runId}>
                <button
                  type="button"
                  data-run-rail={run.runId}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => onOpen(run.planId)}
                  className="min-w-48 rounded-ij-arc border px-3 py-2 text-left hover:bg-ij-hover-surface"
                  style={{
                    borderColor: active ? 'var(--ij-accent)' : 'var(--ij-seam-raised)',
                    background: active ? 'var(--ij-selection)' : 'var(--ij-raised)',
                  }}
                >
                  <div className="truncate" style={{ fontWeight: 'var(--rec-weight-cap)' }}>{run.name}</div>
                  <div className="mt-1 flex items-center gap-2 font-ij-mono text-ij-ink-info">
                    <span>{percent}%</span>
                    {run.headPresence ? <span>{run.headPresence}</span> : null}
                    {run.lastEventAt ? <span className="ml-auto truncate">{formatTime(run.lastEventAt)}</span> : null}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
