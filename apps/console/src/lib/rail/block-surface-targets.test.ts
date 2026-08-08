// SOURCING: none. Palette → surface route resolution.

import { describe, expect, it } from 'vitest';
import { resolveBlockSurfaceTarget } from './block-surface-targets';

describe('resolveBlockSurfaceTarget', () => {
  it('maps Records palette rows to the Records surface route', () => {
    expect(
      resolveBlockSurfaceTarget({
        id: 'records',
        kind: 'records',
        descriptorId: 'record.table',
      }),
    ).toEqual({ path: '/records', surfaceId: 'console-records' });
  });

  it('maps Models palette rows to /Data-model', () => {
    expect(
      resolveBlockSurfaceTarget({
        id: 'model',
        kind: 'model',
        descriptorId: 'model.studio',
      }),
    ).toEqual({ path: '/Data-model', surfaceId: 'console-models' });
  });

  it('returns null for embed-only descriptors without a surface', () => {
    expect(
      resolveBlockSurfaceTarget({
        id: 'unknown-widget',
        kind: 'unknown-widget',
        descriptorId: 'custom.orphan',
      }),
    ).toBeNull();
  });
});
