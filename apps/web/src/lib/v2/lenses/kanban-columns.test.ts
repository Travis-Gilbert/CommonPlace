import { describe, it, expect } from 'vitest';
import type { IndexRow, IndexRowDestination } from '@/lib/commonplace/index-queries';
import {
  UNFILED_KEY,
  UNFILED_LABEL,
  groupRowsByDestination,
  refileTargetForColumn,
} from './kanban-columns';

function row(id: string, dest: string | null): IndexRow {
  return {
    id,
    band: 'landed',
    kind: 'note',
    title: id,
    destination: dest ? { verb: 'filed to', label: dest } : null,
    tags: [],
  };
}

const destinationFor = (r: IndexRow): IndexRowDestination | null => r.destination;

describe('kanban-columns', () => {
  it('groups rows by destination, preserving first-appearance order', () => {
    const cols = groupRowsByDestination(
      [row('a', 'Inbox'), row('b', 'Archive'), row('c', 'Inbox')],
      destinationFor,
    );
    expect(cols.map((c) => c.key)).toEqual(['Inbox', 'Archive']);
    expect(cols[0].rows.map((r) => r.id)).toEqual(['a', 'c']);
    expect(cols[1].rows.map((r) => r.id)).toEqual(['b']);
  });

  it('collects rows with no destination into a trailing Unfiled column', () => {
    const cols = groupRowsByDestination(
      [row('a', null), row('b', 'Inbox'), row('c', null)],
      destinationFor,
    );
    expect(cols.map((c) => c.key)).toEqual(['Inbox', UNFILED_KEY]);
    const unfiled = cols.find((c) => c.key === UNFILED_KEY)!;
    expect(unfiled.label).toBe(UNFILED_LABEL);
    expect(unfiled.rows.map((r) => r.id)).toEqual(['a', 'c']);
  });

  it('honors the override function, not the raw destination', () => {
    const override = (r: IndexRow): IndexRowDestination | null =>
      r.id === 'a' ? { verb: 'filed to', label: 'Moved' } : r.destination;
    const cols = groupRowsByDestination([row('a', 'Inbox'), row('b', 'Inbox')], override);
    expect(cols.map((c) => c.key).sort()).toEqual(['Inbox', 'Moved']);
  });

  it('refile target: a different filed column is the destination label', () => {
    expect(refileTargetForColumn('Archive', 'Inbox')).toBe('Archive');
  });

  it('refile target: same column and Unfiled are no-ops', () => {
    expect(refileTargetForColumn('Inbox', 'Inbox')).toBeNull();
    expect(refileTargetForColumn(UNFILED_KEY, 'Inbox')).toBeNull();
  });
});
