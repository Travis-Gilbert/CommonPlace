// SOURCING: SPEC-THEOREM-CONTROL-PRIMITIVES-1.0 CP3 acceptance.
import { describe, expect, it } from 'vitest';
import {
  deriveLabel,
  NavigationError,
  NavigationRegistry,
  navObjectId,
} from './navigationRegistry';

describe('navigationRegistry', () => {
  it('schema_declare creates a workspace Object item', () => {
    const registry = new NavigationRegistry();
    const item = registry.onSchemaDeclare('gclba_property', 'Properties', 10);
    expect(item.id).toBe(navObjectId('gclba_property'));
    expect(item.itemKind).toEqual({
      kind: 'object',
      objectTypeId: 'gclba_property',
      name: 'Properties',
    });
    expect(item.scope).toEqual({ kind: 'workspace' });
    expect(registry.listFor('user-a', true)).toHaveLength(1);
  });

  it('schema_retire removes the Object item', () => {
    const registry = new NavigationRegistry();
    registry.onSchemaDeclare('task', 'Tasks', 1);
    registry.onSchemaRetire('task');
    expect(registry.listFor('user-a', true)).toHaveLength(0);
  });

  it('user-scoped item is invisible to another member', () => {
    const registry = new NavigationRegistry();
    registry.insert(
      {
        id: 'nav.link.private',
        itemKind: { kind: 'link', name: 'Private', url: '/private' },
        scope: { kind: 'user', userId: 'alice' },
        position: 0,
        parentId: null,
      },
      false,
    );
    expect(registry.listFor('alice', true)).toHaveLength(1);
    expect(registry.listFor('bob', true)).toHaveLength(0);
  });

  it('reordering persists by position', () => {
    const registry = new NavigationRegistry();
    registry.onSchemaDeclare('a', 'As', 2);
    registry.onSchemaDeclare('b', 'Bs', 1);
    const listed = registry.listFor('u', true);
    expect(listed.map((item) => item.id)).toEqual([
      navObjectId('b'),
      navObjectId('a'),
    ]);
    registry.updatePosition(navObjectId('a'), 0, true);
    expect(registry.listFor('u', true).map((item) => item.id)).toEqual([
      navObjectId('a'),
      navObjectId('b'),
    ]);
  });

  it('deleting a folder deletes its contents', () => {
    const registry = new NavigationRegistry();
    registry.insert(
      {
        id: 'folder',
        itemKind: { kind: 'folder', name: 'Folder' },
        scope: { kind: 'workspace' },
        position: 0,
        parentId: null,
      },
      true,
    );
    registry.insert(
      {
        id: 'child',
        itemKind: { kind: 'link', name: 'Child', url: '/c' },
        scope: { kind: 'workspace' },
        position: 1,
        parentId: 'folder',
      },
      true,
    );
    registry.delete('folder', true);
    expect(registry.listFor('u', true)).toHaveLength(0);
  });

  it('workspace scope requires the layout capability', () => {
    const registry = new NavigationRegistry();
    expect(() =>
      registry.insert(
        {
          id: 'ws',
          itemKind: { kind: 'folder', name: 'Workspace' },
          scope: { kind: 'workspace' },
          position: 0,
          parentId: null,
        },
        false,
      ),
    ).toThrow(NavigationError);
  });

  it('deriveLabel prefers override then plural then id', () => {
    expect(deriveLabel({ kind: 'object', objectTypeId: 'task', name: 'Work' })).toBe('Work');
    expect(deriveLabel({ kind: 'object', objectTypeId: 'task' }, 'Tasks')).toBe('Tasks');
    expect(deriveLabel({ kind: 'object', objectTypeId: 'task' })).toBe('tasks');
  });
});
