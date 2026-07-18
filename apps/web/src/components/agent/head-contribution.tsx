'use client';

import { useMemo } from 'react';

import type { HeadContribution } from '@/server/acp/state';

export function HeadContribution({ contributions }: { contributions: HeadContribution[] }) {
  const groups = useMemo(() => {
    const byHead = new Map<string, HeadContribution[]>();
    for (const contribution of contributions) {
      byHead.set(contribution.headId, [...(byHead.get(contribution.headId) ?? []), contribution]);
    }
    return Array.from(byHead.entries()).sort(([left], [right]) => left.localeCompare(right));
  }, [contributions]);
  if (groups.length === 0) return null;
  return (
    <section aria-label="Theorem head contributions" className="mt-3 space-y-2">
      {groups.map(([headId, entries]) => (
        <details key={headId} className="rounded-md border border-cr-hairline bg-cr-surface px-3 py-2">
          <summary className="cursor-pointer font-mono text-xs text-cr-ink">{headId}</summary>
          <div className="mt-2 space-y-2 text-sm leading-6 text-cr-ink-2">
            {entries.map((entry, index) => (
              <p key={`${entry.at}:${entry.summary}:${index}`} className="m-0">
                {entry.summary}
              </p>
            ))}
          </div>
        </details>
      ))}
    </section>
  );
}
