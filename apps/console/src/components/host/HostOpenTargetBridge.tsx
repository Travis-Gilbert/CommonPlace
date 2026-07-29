'use client';

// SOURCING: @commonplace/host-bridge workspace events. Native chrome publishes
// typed open_target intents; the hosted Console remains the UI owner.

import { useEffect } from 'react';
import type { OpenTarget } from '@commonplace/host-bridge';
import { useHost } from '@/lib/commonplace-host/HostProvider';

export function HostOpenTargetBridge({
  onOpenTarget,
  workspaceId = 'default',
}: {
  onOpenTarget(target: OpenTarget): void | Promise<void>;
  workspaceId?: string;
}) {
  const host = useHost();

  useEffect(
    () =>
      host.subscribeWorkspace(workspaceId, (event) => {
        if (event.type !== 'open_target') return;
        void Promise.resolve(onOpenTarget(event.target)).catch(() => undefined);
      }),
    [host, onOpenTarget, workspaceId],
  );

  return null;
}
