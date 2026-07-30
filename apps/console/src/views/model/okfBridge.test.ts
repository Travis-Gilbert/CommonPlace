import { describe, expect, it } from 'vitest';
import { INDEX_POLICY_NONE, type DeclaredModel, type ObservedModel } from '@commonplace/data-model-contracts';
import {
  declaredToModelGraph,
  parseOkfBundle,
  planOkfImport,
  serializeOkfBundle,
} from './okfBridge';

const scope = { kind: 'topic' as const, topicId: 'topic-okf' };

const declared: DeclaredModel = {
  scope,
  objectTypes: [{
    id: 'customer',
    key: 'customer',
    label: 'Customer',
    enforcement: 'observe',
    nameSingular: 'Customer',
    namePlural: 'Customers',
    labelIdentifierField: 'email',
    system: false,
    contentAnchor: 'customer',
  }],
  fields: [{
    id: 'customer-email',
    objectTypeId: 'customer',
    key: 'email',
    label: 'Email',
    fieldType: { kind: 'text' },
    required: true,
  }],
  relations: [],
  views: [],
  versions: [],
  divergences: [],
};

const observed: ObservedModel = {
  scope,
  eventCount: 1,
  sources: ['fixture'],
  types: [{
    observedKey: 'observed:customer',
    dataType: 'Customer',
    eventCount: 1,
    edges: [],
    fields: [{
      observedKey: 'observed:customer.email',
      key: 'email',
      fieldType: { kind: 'text' },
      indexPolicy: INDEX_POLICY_NONE,
      origin: 'fixture',
      occurrences: 1,
      coverage: 1,
      sampleValues: ['hello@example.com'],
    }],
  }],
};

describe('OKF model bridge', () => {
  it('round-trips declared model graphs through the shared OKF serializer', () => {
    const graph = declaredToModelGraph(declared);
    const bundle = serializeOkfBundle(graph, 'Customer model');
    expect(parseOkfBundle(JSON.stringify(bundle), 'customer.okf.json')).toEqual(graph);
  });

  it('plans evidence-bound declarations from the round-tripped graph', () => {
    const graph = declaredToModelGraph(declared);
    expect(planOkfImport(graph, observed, scope).pins).toEqual([
      { scope, observedKey: 'observed:customer', kind: 'type' },
      {
        scope,
        observedKey: 'observed:customer.email',
        kind: 'field',
        parentObservedKey: 'observed:customer',
      },
    ]);
  });

  it('builds a historical graph from the version projection, not current heads', () => {
    const version = {
      id: 'version-one',
      scope,
      version: 1,
      status: 'superseded' as const,
      objectTypeIds: ['customer'],
      fieldIds: ['customer-name'],
      relationIds: [],
      viewIds: [],
      objectTypes: declared.objectTypes,
      fields: [{
        ...declared.fields[0],
        id: 'customer-name',
        key: 'name',
        label: 'Name',
      }],
      relations: [],
    };

    expect(declaredToModelGraph(declared, version).nodes[0]?.schema).toEqual([{
      name: 'name',
      type: 'text',
      pk: false,
      description: 'Name',
    }]);
  });
});
