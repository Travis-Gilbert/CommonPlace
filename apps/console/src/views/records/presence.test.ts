// SOURCING: rustyred-thg-mcp records_presence.rs (RT7).

import { describe, expect, it } from 'vitest';
import {
  VIEW_FOCUS_KIND,
  VIEW_LEAVE_KIND,
  VIEW_PRESENCE_KIND,
  focusedRecordIds,
  parsePresenceEvents,
} from './presence';

describe('parsePresenceEvents', () => {
  it('normalizes snake_case payloads', () => {
    const actors = parsePresenceEvents([
      {
        kind: VIEW_PRESENCE_KIND,
        actorId: 'head-1',
        payload: {
          view_id: 'view-all',
          object_type_id: 'Company',
          actor_kind: 'head',
        },
      },
    ]);
    expect(actors).toEqual([
      {
        actorId: 'head-1',
        actorKind: 'head',
        viewId: 'view-all',
      },
    ]);
  });

  it('captures focus record ids', () => {
    const actors = parsePresenceEvents([
      {
        kind: VIEW_FOCUS_KIND,
        actor_id: 'human-1',
        payload: {
          viewId: 'view-all',
          recordId: 'rec-9',
        },
      },
    ]);
    expect(actors[0]?.recordId).toBe('rec-9');
  });

  it('ignores leave events', () => {
    const actors = parsePresenceEvents([
      {
        kind: VIEW_LEAVE_KIND,
        actorId: 'human-1',
        payload: { viewId: 'view-all' },
      },
    ]);
    expect(actors).toEqual([]);
  });
});

describe('focusedRecordIds', () => {
  it('maps record ids to actors and honors exclusion', () => {
    const map = focusedRecordIds(
      [
        { actorId: 'a1', actorKind: 'human', viewId: 'v1', recordId: 'rec-1' },
        { actorId: 'a2', actorKind: 'head', viewId: 'v1', recordId: 'rec-2' },
      ],
      'a1',
    );
    expect(map.get('rec-2')).toBe('a2');
    expect(map.has('rec-1')).toBe(false);
  });
});
