'use client';

// SOURCING: jacksonkasi1/tnks-data-table + @cosmos.gl/graph planned for the
// Find index (SPEC-CONSOLE-COMPONENT-SOURCING-1.0 SC6). CN7 find / scatter /
// expand resolvers are not live yet. This surface stays honest: unavailable,
// never a fixture FindResponse.

import type { ViewRenderProps } from '@commonplace/block-view/types';
import { ViewState } from './ViewStates';

/** True when the GraphQL find resolvers (CN7) are reachable for this host. */
export function findResolversAvailable(): boolean {
  return false;
}

export function FindIndexView(_props: ViewRenderProps) {
  if (!findResolversAvailable()) {
    return (
      <div data-find-index data-paint-region="find-index" className="h-full min-h-0">
        <ViewState
          state="unavailable"
          capability="find resolvers (CN7: find, scatter, expand)"
        />
      </div>
    );
  }

  // Live path binds one FindResponse into tnks-data-table (list) and cosmos.gl
  // (constellation). Unreachable until CN7 ships.
  return (
    <div data-find-index data-paint-region="find-index" className="h-full min-h-0">
      <ViewState state="empty" emptyTitle="No find results" emptyCause="no-results" />
    </div>
  );
}
