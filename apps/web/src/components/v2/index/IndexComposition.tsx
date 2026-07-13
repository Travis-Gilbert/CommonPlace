'use client';

import { useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Plus, X } from 'lucide-react';
import { fieldPresenceOf, type LensProps } from '@/lib/v2/lenses/types';
import { availableLenses, getLens } from '@/lib/v2/lenses/registry';
import { useIndexLayout } from '@/lib/v2/lenses/layout-store';

/* The composition: the index as a user-assembled row of lens widgets over the
   same filtered rows. Add a view, switch a widget's lens, remove it, resize the
   split. The add-view menu only lists lenses the current data can fill. */

const WIDGET_HEADER =
  'flex items-center gap-cr-2 border-b border-cr-hairline bg-cr-surface px-cr-2 py-cr-1';

function LensHost({
  widget,
  lensProps,
  availableIds,
  canRemove,
  onSwitch,
  onRemove,
}: {
  widget: { id: string; lensId: string };
  lensProps: LensProps;
  availableIds: readonly { id: string; label: string }[];
  canRemove: boolean;
  onSwitch: (lensId: string) => void;
  onRemove: () => void;
}) {
  const lens = getLens(widget.lensId);
  // Keep the current lens selectable even if the data no longer offers it.
  const options = availableIds.some((l) => l.id === widget.lensId)
    ? availableIds
    : [...availableIds, { id: widget.lensId, label: lens?.label ?? widget.lensId }];
  const Icon = lens?.icon;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={WIDGET_HEADER}>
        {Icon && <Icon className="size-[14px] shrink-0 text-cr-ink-3" />}
        <label className="sr-only" htmlFor={`lens-${widget.id}`}>
          Lens for this view
        </label>
        <select
          id={`lens-${widget.id}`}
          value={widget.lensId}
          onChange={(e) => onSwitch(e.target.value)}
          className="cursor-pointer rounded-cr-sm bg-transparent py-[2px] pl-[2px] pr-cr-2 font-cr-mono text-cr-caption uppercase tracking-[0.06em] text-cr-ink-2 transition-colors duration-chrome hover:text-cr-ink focus-visible:[outline:2px_solid_var(--cr-signal)] focus-visible:outline-offset-1"
        >
          {options.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
        <span className="flex-1" />
        {canRemove && (
          <button
            type="button"
            aria-label="Remove this view"
            onClick={onRemove}
            className="flex size-[22px] items-center justify-center rounded-cr-sm text-cr-ink-3 transition-colors duration-chrome hover:bg-cr-ground hover:text-cr-signal focus-visible:[outline:2px_solid_var(--cr-signal)]"
          >
            <X className="size-[14px]" />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1">
        {lens ? (
          <lens.component {...lensProps} />
        ) : (
          <div className="flex h-full items-center justify-center bg-cr-surface text-cr-small text-cr-ink-3">
            Unknown lens.
          </div>
        )}
      </div>
    </div>
  );
}

export function IndexComposition(lensProps: LensProps) {
  const { widgets, addWidget, removeWidget, setWidgetLens } = useIndexLayout();
  const [addOpen, setAddOpen] = useState(false);
  const available = availableLenses(fieldPresenceOf(lensProps.rows, lensProps.destinationFor));
  const availableIds = available.map((l) => ({ id: l.id, label: l.label }));

  return (
    <div className="flex h-full min-h-0 flex-col bg-cr-ground">
      <div className="flex items-center justify-end border-b border-cr-hairline bg-cr-surface px-cr-2 py-cr-1">
        <div className="relative">
          <button
            type="button"
            onClick={() => setAddOpen((o) => !o)}
            aria-expanded={addOpen}
            className="flex items-center gap-cr-1 rounded-cr-sm px-cr-2 py-[3px] font-cr-mono text-cr-caption uppercase tracking-[0.06em] text-cr-ink-2 transition-colors duration-chrome hover:bg-cr-ground hover:text-cr-ink focus-visible:[outline:2px_solid_var(--cr-signal)] focus-visible:outline-offset-1"
          >
            <Plus className="size-[13px]" />
            Add view
          </button>
          {addOpen && (
            <>
              <div className="fixed inset-0 z-[40]" aria-hidden onClick={() => setAddOpen(false)} />
              <div className="absolute right-0 top-[calc(100%+4px)] z-[50] min-w-[9rem] rounded-cr border border-cr-hairline bg-cr-top p-cr-1 shadow-transient">
                {available.map((lens) => {
                  const Icon = lens.icon;
                  return (
                    <button
                      key={lens.id}
                      type="button"
                      onClick={() => {
                        addWidget(lens.id);
                        setAddOpen(false);
                      }}
                      className="flex w-full items-center gap-cr-2 rounded-cr-sm px-cr-2 py-cr-1 text-left text-cr-small text-cr-ink-2 transition-colors duration-chrome hover:bg-cr-surface hover:text-cr-ink"
                    >
                      <Icon className="size-[14px]" />
                      {lens.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <PanelGroup
        // Remount when the widget set changes so panel ids/order stay consistent.
        key={widgets.map((w) => w.id).join('|')}
        direction="horizontal"
        autoSaveId="v2-index-composition"
        className="min-h-0 flex-1"
      >
        {widgets.flatMap((widget, i) => {
          const panel = (
            <Panel
              key={widget.id}
              id={widget.id}
              order={i}
              defaultSize={100 / widgets.length}
              minSize={20}
              className="flex min-h-0 min-w-0 flex-col"
            >
              <LensHost
                widget={widget}
                lensProps={lensProps}
                availableIds={availableIds}
                canRemove={widgets.length > 1}
                onSwitch={(lensId) => setWidgetLens(widget.id, lensId)}
                onRemove={() => removeWidget(widget.id)}
              />
            </Panel>
          );
          if (i === 0) return [panel];
          const handle = (
            <PanelResizeHandle
              key={`${widget.id}-handle`}
              className="group/handle relative flex w-[9px] shrink-0 items-stretch justify-center outline-none"
              aria-label="Resize views"
            >
              <span className="w-px bg-cr-hairline transition-colors duration-chrome ease-cr group-hover/handle:bg-cr-ink-3 group-focus-visible/handle:bg-cr-signal group-data-[resize-handle-state=drag]/handle:bg-cr-signal" />
            </PanelResizeHandle>
          );
          return [handle, panel];
        })}
      </PanelGroup>
    </div>
  );
}
