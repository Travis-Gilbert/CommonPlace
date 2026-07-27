// SOURCING: none. Regression coverage for SPEC-COMMONPLACE-FORK-1.0 FK6/FK11.

import { describe, expect, it } from 'vitest';
import type { ObjectRef } from '@commonplace/block-view/types';
import { normalizeConsolePagePath } from './chat/last-console-view';
import { retireSeedViewObjects } from './console-host';
import { pathForSurfaceId, surfaceIdForPath } from './surface-routes';

function object(id: string): ObjectRef {
  return { id, type: 'surface', properties: {} };
}

describe('page-owned routing', () => {
  it('maps durable surfaces directly to App Router pages', () => {
    expect(pathForSurfaceId('console-chat')).toBe('/chat');
    expect(pathForSurfaceId('console-workspace')).toBe('/workspace');
    expect(surfaceIdForPath('/models')).toBe('console-models');
  });

  it('migrates known persisted view routes and refuses unknown ones', () => {
    expect(normalizeConsolePagePath('/v/researcher')).toBe('/indexer');
    expect(normalizeConsolePagePath('/v/data-model')).toBe('/models');
    expect(normalizeConsolePagePath('/v/person-created')).toBe('/workspace');
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
});
