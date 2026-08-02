'use client';

// SOURCING: HANDOFF-CONSOLE-CHAT-SURFACE choice 5 object pull-in through the
// BlockHost seam. Read-only body; Open action navigates via shell selection.

import { useEffect, useState } from 'react';
import type { BlockHost, ObjectRef } from '@commonplace/block-view/types';
import { parseTheoremUri } from '@commonplace/block-view/addressing';
import { ReceiptJson } from '@/components/receipt-json';
import { ThreadExcerpt } from './ThreadExcerpt';
import { useShellStore } from '@/lib/shell-store';

export function ObjectExcerpt({
  host,
  address,
  excerptId,
}: {
  readonly host: BlockHost;
  readonly address: string;
  readonly excerptId: string;
}) {
  const selectRecord = useShellStore((state) => state.selectRecord);
  const [object, setObject] = useState<ObjectRef | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedOnce, setExpandedOnce] = useState(false);

  const parsed = parseTheoremUri(address);
  const objectId = parsed && parsed.ok ? parsed.address.id : null;
  const kind = parsed && parsed.ok ? parsed.address.kind : 'object';

  useEffect(() => {
    if (!expandedOnce || !objectId) return;
    let active = true;
    void Promise.resolve(
      host.query({
        types: [kind],
        where: { kind: 'eq', field: 'id', value: objectId },
        page: { limit: 1 },
      }),
    )
      .then((set) => {
        if (!active) return;
        const hit = set.objects[0] ?? null;
        setObject(hit);
        setError(hit ? null : 'Object not found on the seam');
      })
      .catch(() => {
        if (active) setError('Object seam refused the load');
      });
    return () => {
      active = false;
    };
  }, [expandedOnce, host, kind, objectId]);

  const title = object
    ? String(object.properties.title ?? object.properties.name ?? object.id)
    : address;

  return (
    <ThreadExcerpt
      kind="object"
      excerptId={excerptId}
      speaker={`object · ${kind}`}
      summary={title}
      defaultCollapsed
      actions={
        objectId ? (
          <button
            type="button"
            data-excerpt-open-object
            className="shrink-0 px-1 text-ij-ink hover:underline"
            onClick={() => selectRecord(objectId, object, kind)}
          >
            Open
          </button>
        ) : null
      }
    >
      <div
        data-object-excerpt-body
        onFocus={() => setExpandedOnce(true)}
        ref={(node) => {
          if (node && !expandedOnce) setExpandedOnce(true);
        }}
      >
        {error ? (
          <p className="text-ij-error">{error}</p>
        ) : object ? (
          <ReceiptJson data={object.properties} defaultExpanded={1} />
        ) : (
          <p className="text-ij-ink-info">Loading through the object seam…</p>
        )}
      </div>
    </ThreadExcerpt>
  );
}
