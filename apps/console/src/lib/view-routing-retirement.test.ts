// SOURCING: none. Regression coverage for SPEC-COMMONPLACE-FORK-1.0 FK6/FK11.

import { describe, expect, it } from 'vitest';
import type { ObjectRef } from '@commonplace/block-view/types';
import { CONTAINS_EDGE } from '@commonplace/block-view/surface-tree';
import { normalizeConsolePagePath } from './chat/last-console-view';
import { retireSeedViewObjects } from './console-host';
import { pathForSurfaceId, surfaceIdForPath } from './surface-routes';

function object(id: string, children?: readonly string[]): ObjectRef {
  return {
    id,
    type: 'surface',
    properties: {},
    ...(children ? { relations: { [CONTAINS_EDGE]: children } } : {}),
  };
}

describe('page-owned routing', () => {
  it('maps durable surfaces directly to App Router pages', () => {
    expect(pathForSurfaceId('console-chat')).toBe('/chat');
    expect(pathForSurfaceId('console-workspace')).toBe('/workspace');
    expect(pathForSurfaceId('console-appearance')).toBe('/appearance');
    expect(pathForSurfaceId('console-models')).toBe('/Data-model');
    expect(pathForSurfaceId('console-ide')).toBe('/IDE');
    expect(pathForSurfaceId('console-program')).toBe('/program');
    expect(surfaceIdForPath('/Data-model')).toBe('console-models');
    expect(surfaceIdForPath('/IDE')).toBe('console-ide');
    expect(surfaceIdForPath('/program')).toBe('console-program');
    expect(surfaceIdForPath('/appearance')).toBe('console-appearance');
  });

  it('migrates known persisted view routes and refuses unknown ones', () => {
    expect(normalizeConsolePagePath('/v/researcher')).toBe('/indexer');
    expect(normalizeConsolePagePath('/v/data-model')).toBe('/Data-model');
    expect(normalizeConsolePagePath('/models')).toBe('/Data-model');
    expect(normalizeConsolePagePath('/v/person-created')).toBe('/workspace');
  });

  it('rejects protocol-relative, backslash, and control-character paths', () => {
    expect(normalizeConsolePagePath('//attacker.example/path')).toBe('/workspace');
    expect(normalizeConsolePagePath('/\\attacker.example/path')).toBe('/workspace');
    expect(normalizeConsolePagePath('/workspace\\settings')).toBe('/workspace');
    expect(normalizeConsolePagePath('/\n//attacker.example/path')).toBe('/workspace');
  });

  it('removes only the retired seeded view trees from persisted layouts', () => {
    expect(
      retireSeedViewObjects([
        object('view-chat'),
        object('view-chat.well'),
        object('view-person-created'),
        object('console-chat'),
      ]).map((entry) => entry.id),
    ).toEqual(['view-person-created', 'console-chat']);
  });

  it('prunes retired view references from surviving contains edges', () => {
    const [survivor] = retireSeedViewObjects([
      object('console-workspace', [
        'view-chat',
        'view-person-created',
        'view-data-model.well',
      ]),
    ]);

    expect(survivor?.relations?.[CONTAINS_EDGE]).toEqual([
      'view-person-created',
    ]);
  });
});
