import { describe, expect, it } from 'vitest';
import type { DeclaredModel, FieldMetadata } from '@commonplace/data-model-contracts';
import { schemaDeclareInputForField, schemaDeclareInputForNewObject } from './schemaDeclare';

const field: FieldMetadata = {
  id: 'field:customer:name',
  objectTypeId: 'type:customer',
  key: 'name',
  label: 'Name',
  fieldType: { kind: 'text' },
  required: false,
  system: false,
};

const declared: DeclaredModel = {
  scope: { kind: 'topic', topicId: 'customers' },
  objectTypes: [{
    id: 'type:customer',
    key: 'Customer',
    label: 'Customer',
    nodeLabel: 'Customer',
    enforcement: 'warn',
    nameSingular: 'Customer',
    namePlural: 'Customers',
    labelIdentifierField: 'name',
    system: false,
    contentAnchor: 'anchor:one',
  }],
  fields: [field],
  relations: [],
  views: [],
  versions: [],
  divergences: [],
};

describe('schemaDeclareInputForField', () => {
  it('rebuilds the parent contract and replaces only the selected field', () => {
    const input = schemaDeclareInputForField(declared, field.id, {
      ...field,
      key: 'display_name',
      label: 'Display name',
      required: true,
    });

    expect(input.nameSingular).toBe('Customer');
    expect(input.nodeLabel).toBe('Customer');
    expect(input.labelIdentifierField).toBe('display_name');
    expect(input.expectedContentAnchor).toBe('anchor:one');
    expect(input.fields).toEqual([{
      key: 'display_name',
      label: 'Display name',
      fieldType: { kind: 'text' },
      required: true,
      system: false,
    }]);
  });

  it('refuses a stale field selection before sending a partial declaration', () => {
    expect(() => schemaDeclareInputForField(declared, 'missing', field))
      .toThrow('Declared field missing is no longer available.');
  });

  it('builds a spawn input for a new canvas object type', () => {
    const input = schemaDeclareInputForNewObject(2);
    expect(input.nameSingular).toBe('object_2');
    expect(input.labelSingular).toBe('New object 2');
    expect(input.fields.map((row) => row.key)).toEqual(['id', 'name']);
  });
});
