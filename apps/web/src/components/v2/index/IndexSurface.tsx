'use client';

import { useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import {
  allRows,
  indexRowKey,
  submitRefile,
  useIndexData,
  type IndexRow,
  type IndexRowDestination,
} from '@/lib/commonplace/index-queries';
import { IndexList } from './IndexList';
import { IndexDetail } from './IndexDetail';
import styles from './index.module.css';

/* Index chassis (HANDOFF-INDEX-SURFACE D1): the list|detail split. The app rail
   is pane 1 (V2Shell, collapsible); this owns panes 2 and 3. Pane sizes persist
   across reload via react-resizable-panels' native autoSaveId (localStorage) --
   no separate store needed. Focus order is rail -> list -> detail by DOM order.

   This island also owns selection and the refile overrides (D5): a correction
   updates the list and detail immediately and emits a feedback signal, with the
   prior destination retained so Undo restores it. */

interface RefileOverride {
  destination: IndexRowDestination;
  receipt: string;
  collectionId?: string;
}

function eventTimestamp(): number {
  return Date.now();
}

export function IndexSurface() {
  const data = useIndexData();
  const rows = allRows(data);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, RefileOverride>>({});

  const selected = rows.find((r) => indexRowKey(r) === selectedKey) ?? null;
  const destinationFor = (row: IndexRow): IndexRowDestination | null =>
    overrides[row.id]?.destination ?? row.destination;

  const handleRefile = (label: string) => {
    if (!selected) return;
    const prev = destinationFor(selected);
    const verb = prev?.verb ?? 'filed to';
    setOverrides((current) => ({
      ...current,
      [selected.id]: { destination: { verb, label }, receipt: `Refiled to ${label}.` },
    }));
    void submitRefile(selected.id, label, selected.title, selected.destinationId).then(
      (collectionId) => {
        if (!collectionId) return;
        setOverrides((current) => {
          const currentOverride = current[selected.id];
          if (!currentOverride || currentOverride.destination.label !== label) return current;
          return {
            ...current,
            [selected.id]: { ...currentOverride, collectionId },
          };
        });
      },
    );
  };

  const handleUndo = () => {
    if (!selected) return;
    const original = selected.destination; // the pre-refile destination
    const current = destinationFor(selected);
    const currentOverride = overrides[selected.id];
    setOverrides((current) => {
      const next = { ...current };
      delete next[selected.id];
      return next;
    });
    // Restore the prior edge everywhere: refile back to the original destination
    // so peer surfaces (and the session override) revert too.
    if (original) {
      void submitRefile(
        selected.id,
        original.label,
        selected.title,
        currentOverride?.collectionId,
        current?.label,
      );
    }
  };

  // Toolbar actions and composer are observable signals today; the durable
  // handlers (open, ask, resolve, agent turn) are Codex's backend seam. Fire a
  // CustomEvent so the dispatch is real and other surfaces can bind it.
  const emit = (type: string, extra: Record<string, unknown>) => {
    if (!selected || typeof window === 'undefined') return;
    try {
      window.dispatchEvent(
        new CustomEvent(type, { detail: { id: selected.id, at: eventTimestamp(), ...extra } }),
      );
    } catch {
      /* best-effort */
    }
  };
  const handleAction = (action: string) => emit('commonplace:action', { action });
  const handleCompose = (text: string) => emit('commonplace:compose', { text });

  const selectedReceipt = selected ? overrides[selected.id]?.receipt ?? null : null;

  return (
    <PanelGroup direction="horizontal" autoSaveId="v2-index-panes" className={styles.group}>
      <Panel order={1} defaultSize={62} minSize={42} className={styles.listPanel}>
        <IndexList
          data={data}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
          destinationFor={destinationFor}
        />
      </Panel>
      <PanelResizeHandle className={styles.handle} aria-label="Resize the detail pane" />
      <Panel order={2} defaultSize={38} minSize={26} className={styles.detailPanel}>
        <IndexDetail
          row={selected}
          destination={selected ? destinationFor(selected) : null}
          receipt={selectedReceipt}
          onRefile={handleRefile}
          onUndo={handleUndo}
          onAction={handleAction}
          onCompose={handleCompose}
        />
      </Panel>
    </PanelGroup>
  );
}
