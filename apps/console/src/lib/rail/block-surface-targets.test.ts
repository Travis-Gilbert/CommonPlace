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

  it('maps Models settings descriptor to /Data-model/settings', () => {
    expect(
      resolveBlockSurfaceTarget({
        id: 'settings',
        kind: 'model',
        descriptorId: 'model.settings',
      }),
    ).toEqual({ path: '/Data-model/settings', surfaceId: 'console-model-settings' });
  });

  it('resolves using palette-kind or item-ID fallback', () => {
    expect(
      resolveBlockSurfaceTarget({
        id: 'canvas',
        kind: 'canvas',
        descriptorId: 'custom.orphan',
      }),
    ).toEqual({ path: '/canvas', surfaceId: 'console-canvas' });
  });

  it('resolves using nested route basename fallback', () => {
    expect(
      resolveBlockSurfaceTarget({
        id: 'settings',
        kind: 'custom-settings-kind',
        descriptorId: 'custom.orphan',
      }),
    ).toEqual({ path: '/Data-model/settings', surfaceId: 'console-model-settings' });
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
