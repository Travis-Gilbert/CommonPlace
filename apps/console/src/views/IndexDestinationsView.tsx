'use client';

// SOURCING: none. The Destinations rail: navigation and compact structure, per
// the IA rule that dense horizontal artifacts are surfaces and sidebars hold
// navigation. The shelves you drop onto live in the surface; this rail is how
// you scope what the surface shows.
//
// This replaces the rail's previous honest refusal, which named "the filing
// engine" as its missing capability. That engine now exists.

import type { ViewRenderProps } from '@commonplace/block-view/types';
import { ViewState } from './ViewStates';
import { useFilingIndex } from './filing/filing-client';
import { IconRecords } from '@/components/shell/icons';

export function IndexDestinationsView(_props: ViewRenderProps) {
  const { state, refresh } = useFilingIndex();

  if (state.status === 'loading') return <ViewState state="loading" />;
  if (state.status === 'unavailable') {
    return <ViewState state="unavailable" capability={state.capability} />;
  }
  if (state.status === 'error') {
    return <ViewState state="error" errorMessage={state.message} onRetry={refresh} />;
  }
  if (state.data.collections.length === 0) {
    return (
      <div className="flex h-full items-center p-4 text-ij-ink-info" data-filing-destinations-empty>
        No shelves yet. The first arrival makes one.
      </div>
    );
  }

  return (
    <ul
      data-filing-destinations
      className="min-h-0 flex-1 overflow-y-auto"
      aria-label="Destinations"
    >
      {state.data.collections.map((collection) => (
        <li key={collection.id}>
          <div
            data-filing-destination={collection.id}
            className="flex h-ij-row items-center gap-2 overflow-hidden border-b border-ij-seam px-2 text-ij-ink"
          >
            <IconRecords size={14} className="shrink-0 text-ij-ink-info" />
            <span className="truncate">{collection.name}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
