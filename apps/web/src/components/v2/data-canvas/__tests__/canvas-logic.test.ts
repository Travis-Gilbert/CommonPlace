import { describe, it, expect } from 'vitest';
import {
  deriveCanvas,
  buildFieldIndex,
  deriveCardinality,
  typesSignature,
} from '../canvas-logic';
import type { PropType, RelationDef, TypeDef } from '@/lib/block-view/types';

// ── Test factories ──

interface LooseProp {
  name: string;
  type: string;
}

interface LooseRelation {
  edge: string;
  dir: string;
  target: string;
}

interface LooseType {
  name?: string;
  properties?: LooseProp[];
  relations?: LooseRelation[];
  axes?: object;
}

function makeType(overrides: LooseType = {}): TypeDef {
  return {
    name: overrides.name ?? 'TestType',
    properties: (overrides.properties ?? []) as TypeDef['properties'],
    relations: (overrides.relations ?? []) as readonly RelationDef[],
    axes: (overrides.axes ?? {}) as TypeDef['axes'],
  };
}

// ── deriveCanvas ──

describe('deriveCanvas', () => {
  it('produces empty nodes/edges for empty input', () => {
    const { nodes, edges } = deriveCanvas([]);
    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });

  it('creates one node per TypeDef', () => {
    const types: TypeDef[] = [
      makeType({ name: 'User', properties: [{ name: 'name', type: 'string' }] }),
      makeType({ name: 'Post', properties: [{ name: 'title', type: 'string' }] }),
    ];
    const { nodes } = deriveCanvas(types);
    expect(nodes).toHaveLength(2);
    expect(nodes.map((n) => n.id)).toEqual(['User', 'Post']);
  });

  it('sets node type to typeNode', () => {
    const { nodes } = deriveCanvas([makeType({ name: 'Foo' })]);
    expect(nodes[0].type).toBe('typeNode');
  });

  it('copies label, typeId, and fields to node data', () => {
    const fields = [
      { name: 'email', type: 'string' },
      { name: 'age', type: 'number' },
    ];
    const { nodes } = deriveCanvas([
      makeType({ name: 'User', properties: fields }),
    ]);
    expect(nodes[0].data.label).toBe('User');
    expect(nodes[0].data.typeId).toBe('User');
    expect(nodes[0].data.fields).toEqual(fields);
  });

  it('creates edges from relation definitions', () => {
    const types: TypeDef[] = [
      makeType({
        name: 'User',
        relations: [{ edge: 'posts', dir: 'out', target: 'Post' }],
      }),
      makeType({ name: 'Post' }),
    ];
    const { edges } = deriveCanvas(types);
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe('User');
    expect(edges[0].target).toBe('Post');
    expect(edges[0].data?.label).toBe('posts');
    expect(edges[0].data?.dir).toBe('out');
  });

  it('stamps a derived cardinality on each edge from direction', () => {
    const types: TypeDef[] = [
      makeType({
        name: 'User',
        relations: [
          { edge: 'posts', dir: 'out', target: 'Post' },
          { edge: 'org', dir: 'in', target: 'Org' },
        ],
      }),
      makeType({ name: 'Post' }),
      makeType({ name: 'Org' }),
    ];
    const { edges } = deriveCanvas(types);
    const byLabel = new Map(edges.map((e) => [e.data?.label, e.data?.cardinality]));
    expect(byLabel.get('posts')).toBe('one-to-many');
    expect(byLabel.get('org')).toBe('many-to-one');
  });

  it('skips edges where target type is not in the set', () => {
    const types: TypeDef[] = [
      makeType({
        name: 'User',
        relations: [{ edge: 'org', dir: 'out', target: 'Organization' }],
      }),
    ];
    const { edges } = deriveCanvas(types);
    expect(edges).toHaveLength(0);
  });

  it('stamps edge type as relation', () => {
    const types: TypeDef[] = [
      makeType({
        name: 'A',
        relations: [{ edge: 'ref', dir: 'out', target: 'B' }],
      }),
      makeType({ name: 'B' }),
    ];
    const { edges } = deriveCanvas(types);
    expect(edges[0].type).toBe('relation');
  });

  it('generates unique edge ids', () => {
    const types: TypeDef[] = [
      makeType({
        name: 'A',
        properties: [],
        relations: [
          { edge: 'x', dir: 'out', target: 'B' },
          { edge: 'y', dir: 'out', target: 'C' },
        ],
      }),
      makeType({ name: 'B' }),
      makeType({ name: 'C' }),
    ];
    const { edges } = deriveCanvas(types);
    const ids = edges.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('assigns numeric positions via dagre layout', () => {
    const types: TypeDef[] = [
      makeType({ name: 'X' }),
      makeType({ name: 'Y' }),
      makeType({ name: 'Z' }),
    ];
    const { nodes } = deriveCanvas(types);
    for (const n of nodes) {
      expect(typeof n.position.x).toBe('number');
      expect(typeof n.position.y).toBe('number');
    }
    // With 3 unconnected nodes, dagre staggers vertically (LR dir)
    const yVals = nodes.map((n) => n.position.y);
    expect(new Set(yVals).size).toBeGreaterThan(1);
  });

  it('handles types with many fields', () => {
    const fields = Array.from({ length: 20 }, (_, i) => ({
      name: `field${i}`,
      type: 'string',
    }));
    const { nodes } = deriveCanvas([makeType({ name: 'Big', properties: fields })]);
    expect(nodes[0].data.fields).toHaveLength(20);
  });
});

// ── buildFieldIndex ──

describe('buildFieldIndex', () => {
  it('returns empty for empty types', () => {
    expect(buildFieldIndex([])).toEqual([]);
  });

  it('lists every field with owning type and prop type', () => {
    const types: TypeDef[] = [
      makeType({
        name: 'User',
        properties: [
          { name: 'name', type: 'string' },
          { name: 'age', type: 'number' },
        ],
      }),
      makeType({
        name: 'Post',
        properties: [{ name: 'body', type: 'text' }],
      }),
    ];
    const refs = buildFieldIndex(types);
    expect(refs).toHaveLength(3);
    expect(refs).toContainEqual({
      typeId: 'User',
      field: 'name',
      propType: 'string',
    });
    expect(refs).toContainEqual({
      typeId: 'Post',
      field: 'body',
      propType: 'text',
    });
  });
});

// ── deriveCardinality ──

describe('deriveCardinality', () => {
  it('reads an outgoing relation as one-to-many', () => {
    const rel: RelationDef = { edge: 'posts', dir: 'out', target: 'Post' };
    expect(deriveCardinality(rel)).toBe('one-to-many');
  });

  it('reads an incoming relation as many-to-one', () => {
    const rel: RelationDef = { edge: 'author', dir: 'in', target: 'User' };
    expect(deriveCardinality(rel)).toBe('many-to-one');
  });
});

// ── typesSignature ──

describe('typesSignature', () => {
  it('is empty for empty input', () => {
    expect(typesSignature([])).toBe('');
  });

  it('is identical for distinct arrays carrying the same content', () => {
    const a = [
      makeType({ name: 'User', properties: [{ name: 'name', type: 'string' }] }),
    ];
    const b = [
      makeType({ name: 'User', properties: [{ name: 'name', type: 'string' }] }),
    ];
    expect(a).not.toBe(b);
    expect(typesSignature(a)).toBe(typesSignature(b));
  });

  it('changes when a field is added even though length is unchanged', () => {
    const before = [
      makeType({ name: 'User', properties: [{ name: 'name', type: 'string' }] }),
    ];
    const after = [
      makeType({
        name: 'User',
        properties: [
          { name: 'name', type: 'string' },
          { name: 'email', type: 'string' },
        ],
      }),
    ];
    expect(before).toHaveLength(after.length);
    expect(typesSignature(before)).not.toBe(typesSignature(after));
  });

  it('changes when a field type is edited', () => {
    const before = [
      makeType({ name: 'Post', properties: [{ name: 'views', type: 'string' }] }),
    ];
    const after = [
      makeType({ name: 'Post', properties: [{ name: 'views', type: 'number' }] }),
    ];
    expect(typesSignature(before)).not.toBe(typesSignature(after));
  });

  it('changes when a relation is linked even though length is unchanged', () => {
    const before = [
      makeType({ name: 'User' }),
      makeType({ name: 'Post' }),
    ];
    const after = [
      makeType({
        name: 'User',
        relations: [{ edge: 'posts', dir: 'out', target: 'Post' }],
      }),
      makeType({ name: 'Post' }),
    ];
    expect(before).toHaveLength(after.length);
    expect(typesSignature(before)).not.toBe(typesSignature(after));
  });

  it('changes when a type is added', () => {
    const before = [makeType({ name: 'User' })];
    const after = [makeType({ name: 'User' }), makeType({ name: 'Post' })];
    expect(typesSignature(before)).not.toBe(typesSignature(after));
  });
});
