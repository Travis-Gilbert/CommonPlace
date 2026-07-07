'use client';

import { useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import {
  allRows,
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
}

export function IndexSurface() {
  const data = useIndexData();
  const rows = allRows(data);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, RefileOverride>>({});

  const selected = rows.find((r) => r.id === selectedId) ?? null;
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
    submitRefile(selected.id, label, selected.title, selected.destinationId);
  };

  const handleUndo = () => {
    if (!selected) return;
    const original = selected.destination; // the pre-refile destination
    setOverrides((current) => {
      const next = { ...current };
      delete next[selected.id];
      return next;
    });
    // Restore the prior edge everywhere: refile back to the original destination
    // so peer surfaces (and the session override) revert too.
    if (original) submitRefile(selected.id, original.label, selected.title);
  };

  // Toolbar actions and composer are observable signals today; the durable
  // handlers (open, ask, resolve, agent turn) are Codex's backend seam. Fire a
  // CustomEvent so the dispatch is real and other surfaces can bind it.
  const emit = (type: string, extra: Record<string, unknown>) => {
    if (!selected || typeof window === 'undefined') return;
    try {
      window.dispatchEvent(
        new CustomEvent(type, { detail: { id: selected.id, at: Date.now(), ...extra } }),
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
          selectedId={selectedId}
          onSelect={setSelectedId}
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
