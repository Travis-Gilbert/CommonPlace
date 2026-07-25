'use client';

// SOURCING: Twenty record page layout (copy the layout, not the code).
// SPEC-COMMONPLACE-CONSOLE-SHELL-1.0 CS9: identity header with one identity
// chip, tab strip, field panel left, timeline right. Divergence surfaces
// inline on the offending field.

import { useMemo, useState } from 'react';
import type { ObjectRef, ViewRenderProps } from '@commonplace/block-view/types';
import { BlockShell } from '@/components/block/BlockShell';
import { useShellStore } from '@/lib/shell-store';

type TabId = 'fields' | 'timeline';

interface FieldSpec {
  readonly name: string;
  readonly label: string;
  readonly diverged?: boolean;
  readonly divergenceNote?: string;
}

function fieldsFromRecord(record: ObjectRef | null): readonly FieldSpec[] {
  if (!record) return [];
  const divergence = record.properties.divergence;
  const divergenceMap =
    divergence && typeof divergence === 'object' && !Array.isArray(divergence)
      ? (divergence as Record<string, unknown>)
      : {};
  return Object.keys(record.properties)
    .filter((key) => key !== 'title' && key !== 'id' && key !== 'divergence')
    .slice(0, 12)
    .map((name) => ({
      name,
      label: name,
      diverged: Boolean(divergenceMap[name]),
      divergenceNote: 'Diverges from declaration',
    }));
}

export function RecordPage({ host, set }: ViewRenderProps) {
  const selectedId = useShellStore((state) => state.selectedRecordId);
  const [tab, setTab] = useState<TabId>('fields');
  const record = useMemo(() => {
    if (selectedId) {
      return set.objects.find((object) => object.id === selectedId) ?? null;
    }
    return set.objects[0] ?? null;
  }, [selectedId, set.objects]);

  const title = String(record?.properties.title ?? record?.id ?? 'Record');
  const fields = fieldsFromRecord(record);

  return (
    <BlockShell
      material="lifted"
      title={title}
      identityHue="var(--ij-accent)"
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex gap-1 border-b border-ij-seam px-2">
          {(['fields', 'timeline'] as const).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
              className="h-ij-tab px-3 text-ij-ink-info aria-pressed:text-ij-ink"
            >
              {id === 'fields' ? 'Fields' : 'Timeline'}
            </button>
          ))}
        </div>
        <div className="grid min-h-0 flex-1" data-record-page-grid>
          <div className="min-h-0 overflow-y-auto p-3">
            {tab === 'fields' ? (
              <dl className="grid gap-3">
                {fields.map((field) => (
                  <div key={field.name} className="grid gap-1">
                    <dt className="text-ij-ink-info">{field.label}</dt>
                    <dd>
                      <input
                        className="h-ij-control w-full rounded-[var(--radius-control)] border border-ij-control-border bg-ij-editor px-2 text-ij-ink"
                        defaultValue={String(record?.properties[field.name] ?? '')}
                        aria-invalid={field.diverged || undefined}
                      />
                      {field.diverged ? (
                        <p data-status-hue className="mt-1 text-[color:var(--hue-status-awaiting)]">
                          {field.divergenceNote}
                        </p>
                      ) : null}
                    </dd>
                  </div>
                ))}
                {fields.length === 0 ? (
                  <p className="text-ij-ink-info">Select a record. Field editors bind from FieldSpec when a type is declared.</p>
                ) : null}
              </dl>
            ) : (
              <p className="text-ij-ink-info">Timeline events for this record appear here.</p>
            )}
          </div>
          <aside className="hidden min-h-0 overflow-y-auto border-l border-ij-seam p-3 md:block">
            <h3 className="mb-2 text-ij-ink" style={{ fontWeight: 'var(--rec-weight-cap)' }}>Timeline</h3>
            <p className="text-ij-ink-info">Activity binds through find_one when the schema registry is live.</p>
            <p className="mt-2 font-ij-mono text-ij-ink-disabled">{host ? 'host ready' : 'host missing'}</p>
          </aside>
        </div>
      </div>
    </BlockShell>
  );
}
