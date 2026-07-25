'use client';

// SOURCING: none. F5: the urgent lane.
//
// Its empty state is the designed norm, not a failure mode, so it gets the X5
// treatment: a bounded frame with a header, structure at every level, and a
// sentence written to reassure rather than to gamify. Nothing here counts
// anything in any state, which is the acceptance criterion and also the point:
// a lane that told you how quiet it was would not be quiet.

import type { ViewRenderProps } from '@commonplace/block-view/types';
import { ViewState } from './ViewStates';
import { useUrgentEvents } from './filing/filing-client';

/**
 * The bounded frame X5 asks for, minus a title bar: this view mounts as a tool
 * window, and IntuiShell already gives every tool window the Int UI header
 * strip with its hide affordance (X3.2). Drawing a second one here rendered
 * "Needs you today" twice, which a capture caught.
 */
function Frame({ children }: { readonly children: React.ReactNode }) {
  return (
    <div
      data-filing-urgent
      data-paint-region="filing-urgent"
      className="flex h-full min-h-0 flex-col bg-ij-editor font-ij-ui"
    >
      {children}
    </div>
  );
}

export function UrgentLaneView(_props: ViewRenderProps) {
  const state = useUrgentEvents();

  if (state.status === 'loading') {
    return (
      <Frame>
        <ViewState state="loading" />
      </Frame>
    );
  }
  if (state.status === 'unavailable') {
    return (
      <Frame>
        <ViewState state="unavailable" capability={state.capability} />
      </Frame>
    );
  }
  if (state.status === 'error') {
    return (
      <Frame>
        <ViewState state="error" errorMessage={state.message} />
      </Frame>
    );
  }

  if (state.data.events.length === 0) {
    return (
      <Frame>
        <div className="flex flex-1 items-center justify-center p-6" data-filing-urgent-empty>
          <p className="max-w-80 text-center text-ij-ink-info">
            Nothing needs you today. Everything that arrived is filed and will
            keep until you go looking for it.
          </p>
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {state.data.events.map((event) => (
          <li
            key={event.id}
            data-filing-urgent-event={event.item}
            className="border-b border-ij-seam px-2 py-2 text-ij-ink"
          >
            <p className="truncate">{event.title}</p>
            <p className="text-ij-ink-info" data-filing-urgent-reason>
              {event.reason}
            </p>
          </li>
        ))}
      </ul>
    </Frame>
  );
}
