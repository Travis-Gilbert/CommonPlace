'use client';

// SOURCING: @commonplace/block-view (host query/emit). The record.inspector
// descriptor (G6): a 500px right tool window (--rec-side-panel) that opens on
// selection and closes without stealing focus. Structure at Twenty metrics,
// paint from the Int UI register. K2: the inspector leads with the object's
// compact card above the raw field table; relation chips there navigate the
// inspector to the related object.

import { useCallback, useEffect, useState } from 'react';
import type { BlockHost, ObjectRef } from '@commonplace/block-view/types';
import { objectChip, useShellStore } from '@/lib/shell-store';
import { RecordCard } from './CardView';
import { ViewState } from './ViewStates';

export function RecordInspector({ host }: { host: BlockHost }) {
  const selectedRecordId = useShellStore((state) => state.selectedRecordId);
  const selectedRecordObject = useShellStore((state) => state.selectedRecordObject);
  const selectedTypeHint = useShellStore((state) => state.selectedTypeHint);
  const selectRecord = useShellStore((state) => state.selectRecord);
  const openActionSheet = useShellStore((state) => state.openActionSheet);
  const [fetched, setFetched] = useState<ObjectRef | null>(null);
  // The opener may have handed us the object (a grid cell, a chip with a
  // resolved target); deriving at render time keeps the effect fetch-only
  // (no sync setState in effects, the react-hooks v6 rule).
  const record =
    selectedRecordObject && selectedRecordObject.id === selectedRecordId
      ? selectedRecordObject
      : fetched;

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
    // A stashed object needs no wire: the render derives it directly, and
    // the effect stays fetch-only (no sync setState in effects).
    if (
      !selectedRecordId ||
      (selectedRecordObject && selectedRecordObject.id === selectedRecordId)
    ) {
      return;
    }
    // Cross-kind fetch: a chip's target kind rides along as the hint; the
    // record wire stays the default so table selections resolve as before.
    const types = selectedTypeHint && selectedTypeHint !== 'record'
      ? [selectedTypeHint, 'record']
      : ['record'];
    Promise.resolve(
      host.query({ types, where: { kind: 'eq', field: 'id', value: selectedRecordId } }),
    ).then((set) => {
      if (!active) return;
      // The fixture host filters on properties; fall back to scanning by id.
      const match =
        set.objects.find((object) => object.id === selectedRecordId) ??
        null;
      if (match) {
        setFetched(match);
        return;
      }
      Promise.resolve(host.query({ types })).then((all) => {
        if (active) setFetched(all.objects.find((object) => object.id === selectedRecordId) ?? null);
      });
    });
    return () => {
      active = false;
    };
  }, [host, selectedRecordId, selectedRecordObject, selectedTypeHint]);

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
        {record ? (
          <button
            type="button"
            data-inspector-action
            onClick={() =>
              // The Action verb on the inspector (K3): same sheet, this
              // object pre-staged as the originating chip.
              openActionSheet({
                chips: [
                  objectChip(
                    record.id,
                    record.type,
                    String(record.properties.title ?? record.id),
                  ),
                ],
              })
            }
            className="ml-auto h-6 rounded-ij-arc border border-ij-control-border bg-ij-editor px-2 text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink focus:outline-2 focus:outline-ij-accent"
            style={{ transition: 'var(--rec-clickable-transition)' }}
          >
            Action
          </button>
        ) : null}
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
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="border-b border-ij-seam p-3" data-inspector-card>
            <RecordCard object={record} host={host} size="compact" />
          </div>
          <dl className="p-4">
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
        </div>
      ) : (
        <ViewState state="loading" />
      )}
    </aside>
  );
}
