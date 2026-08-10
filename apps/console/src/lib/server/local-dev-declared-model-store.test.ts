// @vitest-environment node
// SOURCING: none. LocalDevDeclaredModelStore stand-in tests.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  declareLocalDevSchema,
  readLocalDevModels,
  resetLocalDevDeclaredModelStore,
  unpinLocalDevDeclared,
} from './local-dev-declared-model-store';

describe('LocalDevDeclaredModelStore', () => {
  beforeEach(() => {
    resetLocalDevDeclaredModelStore();
  });

  it('seeds a starter Customer / Order / Order line model on first read', () => {
    const { declared } = readLocalDevModels('topic-fixture');
    expect(declared.objectTypes.map((type) => type.key)).toEqual([
      'customer',
      'order',
      'order_line',
    ]);
    expect(declared.relations).toHaveLength(2);
    expect(declared.fields.length).toBeGreaterThan(5);
  });

  it('declares a new object type onto the local store', () => {
    readLocalDevModels('topic-fixture');
    const result = declareLocalDevSchema('topic-fixture', {
      nameSingular: 'shipment',
      namePlural: 'shipments',
      labelSingular: 'Shipment',
      labelPlural: 'Shipments',
      nodeLabel: 'Shipment',
      labelIdentifierField: 'id',
      fields: [
        { key: 'id', label: 'Id', fieldType: { kind: 'uuid' }, required: true, system: true },
        { key: 'carrier', label: 'Carrier', fieldType: { kind: 'text' }, required: false, system: false },
      ],
      enforcement: 'warn',
      system: false,
    });
    expect(result.receipt.status).toBe('declared');
    expect(result.declared.objectTypes.some((type) => type.key === 'shipment')).toBe(true);
    expect(result.declared.fields.some((field) => field.key === 'carrier')).toBe(true);
  });

  it('unpins a declared object type', () => {
    const { declared } = readLocalDevModels('topic-fixture');
    const customer = declared.objectTypes.find((type) => type.key === 'customer');
    expect(customer).toBeTruthy();
    const next = unpinLocalDevDeclared('topic-fixture', customer!.id);
    expect(next.declared.objectTypes.some((type) => type.key === 'customer')).toBe(false);
    expect(next.declared.fields.some((field) => field.objectTypeId === customer!.id)).toBe(false);
  });

  it('isolates buckets by authenticated tenant and topic', () => {
    const first = readLocalDevModels('shared-topic', 'tenant-one');
    const customer = first.declared.objectTypes.find((type) => type.key === 'customer');
    expect(customer).toBeTruthy();
    unpinLocalDevDeclared('shared-topic', customer!.id, 'tenant-one');

    const firstAfter = readLocalDevModels('shared-topic', 'tenant-one');
    const second = readLocalDevModels('shared-topic', 'tenant-two');

    expect(firstAfter.declared.scope.tenant).toBe('tenant-one');
    expect(firstAfter.declared.objectTypes.some((type) => type.key === 'customer')).toBe(false);
    expect(second.declared.scope.tenant).toBe('tenant-two');
    expect(second.declared.objectTypes.some((type) => type.key === 'customer')).toBe(true);
  });
});
