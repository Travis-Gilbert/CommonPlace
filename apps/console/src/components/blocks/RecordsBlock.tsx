'use client';

// SOURCING: @tanstack/react-table structure extraction (tablecn) plus Twenty
// record index layout (copy the layout, not the code). SPEC CS9: view picker,
// filter/sort chip bar, table. Named view is the subject.

import { useMemo, useState } from 'react';
import type { ViewRenderProps } from '@commonplace/block-view/types';
import { BlockShell } from '@/components/block/BlockShell';
import { RecordTableView } from '@/views/RecordTableView';

export function RecordsBlock(props: ViewRenderProps & { readonly objectType?: string }) {
  const [viewName, setViewName] = useState('All');
  const views = useMemo(() => ['All', 'Open', 'Recently updated'], []);

  return (
    <BlockShell material="sunken" title="Records" identityHue={props.objectType ? 'var(--ij-accent)' : null}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-ij-seam px-2 py-2">
          <label className="flex items-center gap-2 text-ij-ink-info">
            View
            <select
              aria-label="Records view"
              value={viewName}
              onChange={(event) => setViewName(event.currentTarget.value)}
              className="h-ij-control rounded-[var(--radius-control)] border border-ij-control-border bg-ij-editor px-2 text-ij-ink"
            >
              {views.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <span className="rounded-[var(--radius-chip)] bg-ij-selection-inactive px-2 text-ij-ink-info">Filter</span>
          <span className="rounded-[var(--radius-chip)] bg-ij-selection-inactive px-2 text-ij-ink-info">Sort</span>
          {props.objectType ? (
            <span className="font-ij-mono text-ij-ink-info">{props.objectType}</span>
          ) : null}
        </div>
        <div className="min-h-0 flex-1">
          <RecordTableView {...props} />
        </div>
      </div>
    </BlockShell>
  );
}
