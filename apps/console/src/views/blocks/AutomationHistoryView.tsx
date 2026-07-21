'use client';

// SOURCING: hand-roll until jal-co/ui commit-graph is installed and reskinned
// (HANDOFF-CONSOLE-BLOCK-SYSTEM B9 automation-history). Designed empty body
// when no run-shaped objects are in the set; never an error string.

import type { ViewRenderProps } from '@commonplace/block-view/types';
import { IslandEmptyBody } from './IslandEmptyBody';

export function AutomationHistoryView({ set }: ViewRenderProps) {
  const runs = set.objects;
  if (runs.length === 0) {
    return (
      <IslandEmptyBody
        title="Automation history"
        detail="Review automation history as a commit graph once run and dispatch objects project through the object seam."
      />
    );
  }
  return (
    <div data-automation-history className="flex h-full min-h-0 flex-col gap-2 overflow-auto px-3 py-3">
      <p
        className="text-ij-ink"
        style={{ fontFamily: 'var(--cp-font-human)', fontWeight: 600 }}
      >
        Automation history
      </p>
      <ul className="flex flex-col gap-1 font-ij-mono text-ij-ink-info">
        {runs.map((run) => (
          <li key={run.id} className="truncate border-b border-ij-seam py-1">
            {String(run.properties.title ?? run.id)}
          </li>
        ))}
      </ul>
    </div>
  );
}
