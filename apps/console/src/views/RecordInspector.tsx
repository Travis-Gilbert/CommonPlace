'use client';

// SOURCING: @commonplace/block-view (host query/emit). The record.inspector
// descriptor (G6): a 500px right tool window (--rec-side-panel) that opens on
// selection and closes without stealing focus. Structure at Twenty metrics,
// paint from the Int UI register.

import { useCallback, useEffect, useState } from 'react';
import type { BlockHost, ObjectRef } from '@commonplace/block-view/types';
import { useShellStore } from '@/lib/shell-store';
import { ViewState } from './ViewStates';

export function RecordInspector({ host }: { host: BlockHost }) {
  const selectedRecordId = useShellStore((state) => state.selectedRecordId);
  const selectRecord = useShellStore((state) => state.selectRecord);
  const [record, setRecord] = useState<ObjectRef | null>(null);

  // Closing returns focus to the stream row that opened the inspector (R4
  // punch list). The row may have virtualized away; the record scroller is
  // the fallback focus target so keyboard flow never dead-ends.
  const close = useCallback(() => {
    const id = selectedRecordId;
    selectRecord(null);
    requestAnimationFrame(() => {
      const row = id
        ? document.querySelector<HTMLElement>(`[data-record-id="${CSS.escape(id)}"]`)
        : null;
      (row ?? document.querySelector<HTMLElement>('[data-records-state]'))?.focus();
    });
  }, [selectedRecordId, selectRecord]);

  useEffect(() => {
    let active = true;
    if (!selectedRecordId) return;
    Promise.resolve(
      host.query({ types: ['record'], where: { kind: 'eq', field: 'id', value: selectedRecordId } }),
    ).then((set) => {
      if (!active) return;
      // The fixture host filters on properties; fall back to scanning by id.
      const match =
        set.objects.find((object) => object.id === selectedRecordId) ??
        null;
      if (match) {
        setRecord(match);
        return;
      }
      Promise.resolve(host.query({ types: ['record'] })).then((all) => {
        if (active) setRecord(all.objects.find((object) => object.id === selectedRecordId) ?? null);
      });
    });
    return () => {
      active = false;
    };
  }, [host, selectedRecordId]);

  if (!selectedRecordId) return null;

  return (
    <aside
      aria-label="Record inspector"
      className="flex h-full shrink-0 flex-col border-l border-ij-seam bg-ij-chrome"
      style={{ width: 'var(--rec-side-panel)' }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          close();
        }
      }}
    >
      <div className="flex h-ij-toolbar shrink-0 items-center border-b border-ij-seam px-3">
        <span className="text-ij-ink" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
          Inspector
        </span>
        <button
          type="button"
          onClick={close}
          aria-label="Close inspector"
          className="ml-auto h-6 w-6 rounded-ij-arc text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink"
          style={{ transition: 'var(--rec-clickable-transition)' }}
        >
          ×
        </button>
      </div>
      {record && record.id === selectedRecordId ? (
        <dl className="min-h-0 flex-1 overflow-y-auto p-4">
          {Object.entries(record.properties).map(([key, value]) => (
            <div key={key} className="mb-rec-grid border-b border-ij-divider pb-rec-grid">
              <dt className="text-ij-ink-info" style={{ fontWeight: 'var(--rec-weight-medium)' }}>
                {key}
              </dt>
              <dd className="text-ij-ink">
                {Array.isArray(value) ? value.join(', ') : String(value)}
              </dd>
            </div>
          ))}
          <div className="mt-2 font-ij-mono text-ij-ink-disabled">{record.id}</div>
        </dl>
      ) : (
        <ViewState state="loading" />
      )}
    </aside>
  );
}
