// K7 (HANDOFF-CARDS-ACTIONS-MENTIONS): template render-model tests across the
// three seeds plus the malformed-template fixture (degrades to generic with a
// note, never an error).

import { describe, expect, it } from 'vitest';
import type { ObjectRef } from '@commonplace/block-view/types';
import {
  dynamicFactRows,
  parseCardTemplate,
  resolveCardTemplate,
  seedCardTemplates,
} from './card-templates';

const MALFORMED: ObjectRef = {
  id: 'card-template-broken',
  type: 'card_template',
  properties: { kind: 'person', template: { kind: 'person', identity: {} } },
};

describe('card templates', () => {
  it('parses the three seeded templates', () => {
    for (const seed of seedCardTemplates()) {
      const parsed = parseCardTemplate(seed);
      expect(parsed.spec, `seed ${seed.id}`).not.toBeNull();
      expect(parsed.note).toBeUndefined();
    }
  });

  it('the person template binds identity, facts, chips', () => {
    const templates = seedCardTemplates();
    const person = resolveCardTemplate(templates, 'person');
    expect(person.fallbackNote).toBeUndefined();
    expect(person.spec.identity.titleField).toBe('title');
    expect(person.spec.chips.map((chip) => chip.edge)).toEqual([
      'WORKS_AT',
      'HAS_SKILL',
      'IN_PROJECT',
    ]);
  });

  it('the task template carries the progress gauge', () => {
    const task = resolveCardTemplate(seedCardTemplates(), 'task');
    expect(task.spec.gauges).toEqual([
      { kind: 'progress', field: 'progress', max: 100, label: 'Progress' },
    ]);
  });

  it('an unknown kind resolves to the generic card, never an error', () => {
    const resolved = resolveCardTemplate(seedCardTemplates(), 'squirrel');
    expect(resolved.spec.kind).toBe('generic');
    expect(resolved.fallbackNote).toBeUndefined();
  });

  it('a malformed template degrades to generic with a note', () => {
    const templates = [MALFORMED, ...seedCardTemplates().filter((t) => t.properties.kind !== 'person')];
    const resolved = resolveCardTemplate(templates, 'person');
    expect(resolved.spec.kind).toBe('generic');
    expect(resolved.fallbackNote).toMatch(/identity\.titleField/);
  });

  it('generic dynamic facts skip identity fields and non-scalars', () => {
    const generic = resolveCardTemplate(seedCardTemplates(), 'anything').spec;
    const object: ObjectRef = {
      id: 'x1',
      type: 'anything',
      properties: {
        title: 'A thing',
        status: 'open',
        nested: { deep: true },
        count: 3,
        gone: null,
      },
    };
    const rows = dynamicFactRows(object, generic);
    expect(rows.map((row) => row.field)).toEqual(['status', 'count']);
  });
});
