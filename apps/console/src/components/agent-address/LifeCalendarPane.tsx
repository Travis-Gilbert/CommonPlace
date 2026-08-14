'use client';

// SOURCING: none — pure Index calendar window projection over GraphQL; no upstream component applies.

// A5 Index surface: today and tomorrow calendar events with overlap flags.
// Backed by lifeCalendarWindow GraphQL when the API is configured; otherwise an
// honest empty state (no mock events).

import { useCallback, useEffect, useState } from 'react';

export type CalendarWindowEvent = {
  readonly externalId: string;
  readonly title: string;
  readonly start: string;
  readonly end: string;
  readonly location: string | null;
  readonly overlaps: boolean;
};

type PaneState =
  | { readonly status: 'loading' }
  | { readonly status: 'empty'; readonly reason: string }
  | { readonly status: 'ready'; readonly events: CalendarWindowEvent[] }
  | { readonly status: 'error'; readonly message: string };

function windowBoundsIso(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 2);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function fetchCalendarWindow(
  eventsJson: string,
): Promise<{ events: CalendarWindowEvent[] } | { error: string }> {
  const response = await fetch('/api/agent-address/calendar-window', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...windowBoundsIso(), eventsJson }),
  });
  if (response.status === 404) {
    return { error: 'calendar_window_unconfigured' };
  }
  if (!response.ok) {
    return { error: `calendar_window_http_${response.status}` };
  }
  const body = (await response.json()) as { events?: CalendarWindowEvent[] };
  return { events: Array.isArray(body.events) ? body.events : [] };
}

export function LifeCalendarPane({ eventsJson }: { readonly eventsJson?: string }) {
  const [state, setState] = useState<PaneState>({ status: 'loading' });

  const refresh = useCallback(async () => {
    setState({ status: 'loading' });
    if (!eventsJson || eventsJson.trim() === '' || eventsJson.trim() === '[]') {
      setState({
        status: 'empty',
        reason:
          'No calendar events in the Index window yet. Connect Calendar under Grants to sync.',
      });
      return;
    }
    const result = await fetchCalendarWindow(eventsJson);
    if ('error' in result) {
      if (result.error === 'calendar_window_unconfigured') {
        setState({
          status: 'empty',
          reason:
            'Calendar Index surface is not wired to the GraphQL door in this environment.',
        });
        return;
      }
      setState({ status: 'error', message: result.error });
      return;
    }
    if (result.events.length === 0) {
      setState({
        status: 'empty',
        reason: 'No events for today or tomorrow.',
      });
      return;
    }
    setState({ status: 'ready', events: result.events });
  }, [eventsJson]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (state.status === 'loading') {
    return <p className="text-sm text-[var(--cp-ink-muted)]">Loading calendar window…</p>;
  }
  if (state.status === 'empty') {
    return <p className="text-sm text-[var(--cp-ink-muted)]">{state.reason}</p>;
  }
  if (state.status === 'error') {
    return <p className="text-sm text-ij-ink-danger">{state.message}</p>;
  }

  return (
    <section aria-label="Today and tomorrow calendar" className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-[var(--cp-ink)]">Today and tomorrow</h3>
      <ul className="flex flex-col gap-1">
        {state.events.map((event) => (
          <li
            key={event.externalId}
            className="flex items-baseline justify-between gap-3 text-sm text-[var(--cp-ink)]"
          >
            <span>
              {event.title}
              {event.overlaps ? (
                <span className="ml-2 text-xs text-ij-ink-warning">overlaps</span>
              ) : null}
            </span>
            <span className="shrink-0 text-xs text-[var(--cp-ink-muted)]">
              {event.start.slice(11, 16)}–{event.end.slice(11, 16)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
