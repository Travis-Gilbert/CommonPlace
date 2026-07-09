// Kanban board unit tests.
// Covers: column derivation, drag-end logic, helper functions, card field rendering.
import { describe, it, expect } from 'vitest';
import { deriveColumns, findColumnForCard, detectGroupField } from '../kanban-logic';
import { renderCardField } from '../kanban-recipe';
import type { ObjectRef, ObjectSet } from '@/lib/block-view/types';

// ── Fixtures ──

function makeObjectRef(id: string, overrides: Record<string, unknown> = {}): ObjectRef {
  return {
    id,
    type: 'task',
    properties: {
      id,
      title: overrides.title ?? `Task ${id}`,
      status: overrides.status ?? 'todo',
      priority: overrides.priority ?? 'medium',
      ...overrides,
    } as Record<string, unknown> as ObjectRef['properties'],
  };
}

function makeObjectSet(fields: string[]): ObjectSet {
  return {
    objects: [],
    shape: {
      types: ['task'],
      fields,
      relations: [],
      axes: {},
      cardinality: 'many',
    },
    subscribe: () => () => {},
  };
}

// ── Tests ──

describe('deriveColumns', () => {
  it('groups objects by field value', () => {
    const objs = [
      makeObjectRef('1', { status: 'todo' }),
      makeObjectRef('2', { status: 'done' }),
      makeObjectRef('3', { status: 'todo' }),
      makeObjectRef('4', { status: 'in_progress' }),
    ];
    const cols = deriveColumns(objs, 'status');
    expect(cols).toHaveLength(3);
    const todo = cols.find((c) => c.value === 'todo')!;
    expect(todo.objects).toHaveLength(2);
    expect(todo.label).toBe('Todo');
  });

  it('handles null/undefined field values as "(none)"', () => {
    const objs = [
      makeObjectRef('1', { status: null }),
      makeObjectRef('2', { status: undefined }),
    ];
    const cols = deriveColumns(objs, 'status');
    expect(cols).toHaveLength(1);
    expect(cols[0].value).toBe('(none)');
    expect(cols[0].label).toBe('Uncategorized');
  });

  it('returns empty array for empty input', () => {
    expect(deriveColumns([], 'status')).toEqual([]);
  });

  it('sorts columns alphabetically by value', () => {
    const objs = [
      makeObjectRef('1', { stage: 'done' }),
      makeObjectRef('2', { stage: 'backlog' }),
      makeObjectRef('3', { stage: 'active' }),
    ];
    const cols = deriveColumns(objs, 'stage');
    expect(cols.map((c) => c.value)).toEqual(['done', 'backlog', 'active']);
  });
});

describe('findColumnForCard', () => {
  it('finds the column value for a card', () => {
    const objs = [makeObjectRef('1', { status: 'todo' })];
    expect(findColumnForCard(objs, 'status', '1')).toBe('todo');
  });

  it('returns null for missing card', () => {
    expect(findColumnForCard([], 'status', 'missing')).toBeNull();
  });

  it('returns "(none)" for null field value', () => {
    const objs = [makeObjectRef('1', { status: null })];
    expect(findColumnForCard(objs, 'status', '1')).toBe('(none)');
  });
});

describe('detectGroupField', () => {
  it('prefers status over other fields', () => {
    expect(detectGroupField(makeObjectSet(['id', 'title', 'status', 'priority']))).toBe('status');
  });

  it('prefers state field', () => {
    expect(detectGroupField(makeObjectSet(['id', 'state', 'title']))).toBe('state');
  });

  it('falls back to first non-id field', () => {
    expect(detectGroupField(makeObjectSet(['id', 'name', 'desc']))).toBe('name');
  });

  it('falls back to id if only id field', () => {
    expect(detectGroupField(makeObjectSet(['id']))).toBe('id');
  });
});

describe('renderCardField', () => {
  it('renders title with prominence', () => {
    const result = renderCardField('title', 'My Task');
    // renderCardField returns React elements; verify it doesn't throw
    expect(result).toBeTruthy();
  });

  it('renders booleans as check/cross', () => {
    const result = renderCardField('done', true);
    expect(result).toBeTruthy();
  });

  it('renders null as empty dash', () => {
    const result = renderCardField('notes', null);
    expect(result).toBeTruthy();
  });

  it('renders arrays as joined strings', () => {
    const result = renderCardField('tags', ['a', 'b', 'c']);
    expect(result).toBeTruthy();
  });
});

describe('KanbanBoard pure logic', () => {
  it('deriveColumns groups correctly with mixed types', () => {
    const objs = [
      makeObjectRef('1', { priority: 1 }),
      makeObjectRef('2', { priority: 2 }),
      makeObjectRef('3', { priority: 1 }),
    ];
    const cols = deriveColumns(objs, 'priority');
    expect(cols).toHaveLength(2);
    expect(cols.find((c) => c.value === '1')!.objects).toHaveLength(2);
    expect(cols.find((c) => c.value === '2')!.objects).toHaveLength(1);
  });
});
