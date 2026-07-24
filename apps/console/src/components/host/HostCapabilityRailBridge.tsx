// SOURCING: @commonplace/host-bridge placeBlock — rail contribution click-to-add
// (SPEC F2). No cross-surface drag handlers. Int UI chrome tokens only.

'use client';

import { useEffect, useState } from 'react';
import type { ExtensionContribution } from '@commonplace/host-bridge';
import { useHost } from '@/lib/commonplace-host/HostProvider';
import { usePlaceBlock } from '@/lib/commonplace-host/usePlaceBlock';

/**
 * Subscribes to extension_points and renders click-to-add actions for
 * contributions that declare a paneKind. Command-to-add uses the same
 * placeBlock path.
 */
export function HostCapabilityRailBridge({
  workspaceId = 'default',
}: {
  workspaceId?: string;
}) {
  const host = useHost();
  const { placeBlock } = usePlaceBlock(workspaceId);
  const [items, setItems] = useState<ExtensionContribution[]>([]);
  const [lastId, setLastId] = useState<string | null>(null);

  useEffect(() => {
    return host.subscribeWorkspace(workspaceId, (e) => {
      if (e.type === 'extension_points') setItems(e.contributions);
    });
  }, [host, workspaceId]);

  if (items.length === 0) return null;

  return (
    <div
      data-host-rail="1"
      aria-label="Capability rail placements"
      className="pointer-events-auto absolute bottom-3 right-3 z-[15] flex flex-col gap-1.5"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          data-rail-id={item.id}
          onClick={async () => {
            const block = await placeBlock({
              kind: item.paneKind ?? item.composerVerb ?? 'note',
              attrs: { fromRail: item.id },
            });
            setLastId(block.id);
          }}
          className="rounded-ij-arc border border-ij-control-border bg-ij-chrome px-2.5 py-1.5 text-left text-ij-ink hover:bg-ij-hover-surface"
          style={{
            fontFamily: 'var(--ij-font-ui)',
            fontSize: 11,
            transition: 'var(--rec-clickable-transition)',
          }}
        >
          Add {item.label}
        </button>
      ))}
      {lastId ? (
        <span
          data-last-placed={lastId}
          className="text-ij-ink-info"
          style={{ fontSize: 10 }}
        >
          placed {lastId}
        </span>
      ) : null}
    </div>
  );
}
