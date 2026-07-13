'use client';

/* The Index gains a row per active room (SPEC-OPERATOR-SURFACE-V2): each claimed
   task in a bay is one quiet row here; clicking opens the same Room Panel via the
   Operator's ?room= deep link. On the console register now (its own cr-* styles,
   decoupled from operator.module.css). Renders nothing while loading or when no
   room is active. */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApiData } from '@/lib/commonplace-api';
import { fetchOperatorState } from '@/lib/theorem-operator-client';
import { formatAge } from '@/app/v2/operator/parts';

export function ActiveRoomsBand() {
  const { data } = useApiData(() => fetchOperatorState(), [], { cacheKey: 'v2:operator' });
  // "now" is state, not Date.now() in render (which the render-purity rule flags),
  // and it ticks on an interval so the elapsed labels stay live while mounted.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const active = (data?.bays ?? []).filter((b) => b.task);
  if (active.length === 0) return null;

  return (
    <section aria-label="Active rooms" className="px-cr-4 pb-cr-2 pt-cr-1">
      <div className="mb-cr-1">
        <h2 className="font-cr-mono text-cr-caption uppercase tracking-[0.08em] text-cr-ink-3">
          Active rooms
        </h2>
      </div>
      <div className="flex flex-col gap-[2px]">
        {active.map((bay) => {
          const task = bay.task!;
          const elapsed = task.claim
            ? formatAge(now - new Date(task.claim.claimedAt).getTime())
            : null;
          return (
            <Link
              key={bay.head}
              href={`/v2/operator?room=${encodeURIComponent(task.id)}`}
              className="flex items-center gap-cr-2 rounded-cr px-cr-2 py-cr-1 no-underline transition-colors duration-chrome ease-cr hover:bg-cr-top focus-visible:[outline:2px_solid_var(--cr-signal)] focus-visible:outline-offset-1"
            >
              <span
                className="size-[7px] shrink-0 rounded-full bg-cr-ink-3 data-[streaming=true]:bg-cr-signal"
                data-streaming={bay.streaming ? 'true' : undefined}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-cr-small text-cr-ink">{task.goal}</span>
              <span className="shrink-0 rounded-cr-sm bg-cr-ground px-cr-1 py-[1px] font-cr-mono text-cr-caption text-cr-ink-3">
                {bay.label}
              </span>
              {elapsed && (
                <span className="shrink-0 font-cr-mono text-cr-caption tabular-nums text-cr-ink-3">
                  {elapsed}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
