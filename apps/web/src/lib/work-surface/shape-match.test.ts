import { describe, expect, it } from 'vitest';
import { matchesShape, pickView } from './shape-match';
import type { ObjectShape, ObjectShapeMatch, ViewDescriptor } from '@/lib/block-view/types';

function shape(overrides: Partial<ObjectShape> = {}): ObjectShape {
  return {
    types: ['task'],
    fields: ['title'],
    relations: [],
    axes: {},
    cardinality: 'many',
    ...overrides,
  };
}

describe('matchesShape', () => {
  it('accepts an empty match clause unconditionally', () => {
    expect(matchesShape({}, shape())).toBe(true);
  });

  it('treats cardinality "any" as a wildcard', () => {
    expect(matchesShape({ cardinality: 'any' }, shape({ cardinality: 'one' }))).toBe(true);
    expect(matchesShape({ cardinality: 'any' }, shape({ cardinality: 'empty' }))).toBe(true);
  });

  it('requires an exact cardinality match when one is specified', () => {
    expect(matchesShape({ cardinality: 'one' }, shape({ cardinality: 'one' }))).toBe(true);
    expect(matchesShape({ cardinality: 'one' }, shape({ cardinality: 'many' }))).toBe(false);
  });

  it('requires every listed type to be present in the shape', () => {
    const match: ObjectShapeMatch = { required_types: ['task', 'project'] };
    expect(matchesShape(match, shape({ types: ['task', 'project', 'note'] }))).toBe(true);
    expect(matchesShape(match, shape({ types: ['task'] }))).toBe(false);
  });

  it('requires every listed field to be present in the shape', () => {
    const match: ObjectShapeMatch = { required_fields: ['title', 'due_at'] };
    expect(matchesShape(match, shape({ fields: ['title', 'due_at', 'status'] }))).toBe(true);
    expect(matchesShape(match, shape({ fields: ['title'] }))).toBe(false);
  });

  it('requires true axes flags to be satisfied by the shape', () => {
    const match: ObjectShapeMatch = { required_axes: { temporal: true } };
    expect(matchesShape(match, shape({ axes: { temporal: true } }))).toBe(true);
    expect(matchesShape(match, shape({ axes: { temporal: false } }))).toBe(false);
    expect(matchesShape(match, shape({ axes: {} }))).toBe(false);
  });

  it('ignores axes flags explicitly set to false in the match clause', () => {
    const match: ObjectShapeMatch = { required_axes: { spatial: false, temporal: true } };
    expect(matchesShape(match, shape({ axes: { temporal: true } }))).toBe(true);
  });

  it('requires at least one relation when requires_relation is set', () => {
    expect(matchesShape({ requires_relation: true }, shape({ relations: [] }))).toBe(false);
    expect(
      matchesShape(
        { requires_relation: true },
        shape({ relations: [{ edge: 'CONTAINS', dir: 'out' }] }),
      ),
    ).toBe(true);
  });

  it('matches required_edge against edge, direction, and target when specified', () => {
    const match: ObjectShapeMatch = {
      required_edge: { edge: 'CONTAINS', dir: 'out', target: 'view-instance' },
    };
    expect(
      matchesShape(match, shape({ relations: [{ edge: 'CONTAINS', dir: 'out', target: 'view-instance' }] })),
    ).toBe(true);
    expect(
      matchesShape(match, shape({ relations: [{ edge: 'CONTAINS', dir: 'in', target: 'view-instance' }] })),
    ).toBe(false);
    expect(matchesShape(match, shape({ relations: [{ edge: 'LINKS', dir: 'out' }] }))).toBe(false);
  });

  it('matches required_edge partially specified (edge only)', () => {
    const match: ObjectShapeMatch = { required_edge: { edge: 'CONTAINS' } };
    expect(matchesShape(match, shape({ relations: [{ edge: 'CONTAINS', dir: 'in' }] }))).toBe(true);
  });

  it('combines multiple clauses with AND semantics', () => {
    const match: ObjectShapeMatch = {
      required_types: ['task'],
      cardinality: 'many',
      requires_relation: true,
    };
    expect(
      matchesShape(match, shape({ types: ['task'], cardinality: 'many', relations: [] })),
    ).toBe(false);
    expect(
      matchesShape(
        match,
        shape({ types: ['task'], cardinality: 'many', relations: [{ edge: 'CONTAINS', dir: 'out' }] }),
      ),
    ).toBe(true);
  });
});

function view(id: string, accepts: ObjectShapeMatch): ViewDescriptor {
  return {
    id,
    name: id,
    accepts,
    emits: [],
    renderer: id,
    source: { package: 'test', component: id, mode: 'wrap', regime: 'css-vars' },
    render: (() => null) as unknown as ViewDescriptor['render'],
  };
}

describe('pickView', () => {
  it('returns the first matching view in catalog order', () => {
    const views = [
      view('table', { required_types: ['project'] }),
      view('board', { required_types: ['task'] }),
      view('list', {}),
    ];
    expect(pickView(views, shape())?.id).toBe('board');
  });

  it('returns null when nothing in the catalog matches', () => {
    const views = [view('table', { required_types: ['project'] })];
    expect(pickView(views, shape())).toBeNull();
  });

  it('returns null for an empty catalog', () => {
    expect(pickView([], shape())).toBeNull();
  });
});
