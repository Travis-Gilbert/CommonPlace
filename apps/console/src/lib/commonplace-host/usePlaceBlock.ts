// SOURCING: @commonplace/host-bridge placeBlock — rail click-to-add / command
// path (SPEC F2). Animated cross-surface drag is explicitly absent.

'use client';

import { useCallback } from 'react';
import type { BlockInstance, BlockKind } from '@commonplace/host-bridge';
import { useHost } from './HostProvider';

export interface PlaceBlockOptions {
  workspaceId?: string;
  kind: BlockKind;
  id?: string;
  attrs?: Record<string, unknown>;
  grants?: string[];
}

/**
 * Rail and command-panel path into placeBlock. No drag handlers.
 */
export function usePlaceBlock(defaultWorkspaceId = 'default') {
  const host = useHost();

  const placeBlock = useCallback(
    async (opts: PlaceBlockOptions): Promise<BlockInstance> => {
      return host.placeBlock({
        workspaceId: opts.workspaceId ?? defaultWorkspaceId,
        kind: opts.kind,
        id: opts.id,
        attrs: opts.attrs,
        grants: opts.grants ?? [],
      });
    },
    [host, defaultWorkspaceId],
  );

  return { placeBlock };
}
