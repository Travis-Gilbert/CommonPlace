'use client';

// SOURCING: none — Index calendar window for owned-inbox life_event overlap
// flags. No upstream component models this surface.

import { useCallback, useEffect, useState } from 'react';

export type CalendarWindowRow = {
  readonly externalId: string;
  readonly title: string;
  readonly start: string;
  readonly end: string;
  readonly overlaps: boolean;
};

type PaneState =
  | { readonly status: 'loading' }
  | { readonly status: 'unconfigured' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly events: CalendarWindowRow[] };

const DEFAULT_EVENTS = [
  {
    external_id: 'standup',
    title: 'Standup',
    start: '2026-08-18T10:00:00Z',
    end: '2026-08-18T10:30:00Z',
  },
  {
    external_id: 'overlap',
    title: 'Conflict',
    start: '2026-08-18T10:15:00Z',
    end: '2026-08-18T10:45:00Z',
  },
];

async function fetchWindow(): Promise<CalendarWindowRow[] | null> {
  const response = await fetch('/api/agent-address/calendar-window', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({
      windowStart: '2026-08-18T00:00:00Z',
      windowEnd: '2026-08-19T00:00:00Z',
      events: DEFAULT_EVENTS,
    }),
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`calendar-window ${response.status}`);
  }
  const data = (await response.json()) as { events: CalendarWindowRow[] };
  return data.events;
}

export function LifeCalendarPane() {
  const [state, setState] = useState<PaneState>({ status: 'loading' });

  const refresh = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const events = await fetchWindow();
      if (!events) {
        setState({ status: 'unconfigured' });
        return;
      }
      setState({ status: 'ready', events });
    } catch (error) {
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'calendar load failed',
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section
      data-life-calendar
      className="border-t border-ij-seam bg-ij-editor px-2 py-3 font-ij-ui text-ij-ink"
    >
      <h2 className="mb-2 text-ij-ink">Today and tomorrow</h2>
      {state.status === 'loading' ? <p className="text-ij-ink-info">Loading events…</p> : null}
      {state.status === 'unconfigured' ? (
        <p className="text-ij-ink-info" data-life-calendar-unconfigured>
          Connect CONSOLE_HARNESS_URL to render owned-inbox calendar events.
        </p>
      ) : null}
      {state.status === 'error' ? (
        <p className="text-ij-warn" data-life-calendar-error>
          {state.message}
        </p>
      ) : null}
      {state.status === 'ready' ? (
        state.events.length === 0 ? (
          <p className="text-ij-ink-info" data-life-calendar-empty>
            No events in this window.
          </p>
        ) : (
          <ul data-life-calendar-list>
            {state.events.map((row) => (
              <li
                key={row.externalId}
                data-life-calendar-event={row.externalId}
                data-life-calendar-overlap={row.overlaps ? 'true' : 'false'}
                className="border-b border-ij-seam py-1"
              >
                <span>{row.title}</span>
                <span className="ml-2 text-ij-ink-info">
                  {row.start} → {row.end}
                </span>
                {row.overlaps ? (
                  <span className="ml-2 text-ij-warn" data-life-calendar-flag>
                    overlaps
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}
