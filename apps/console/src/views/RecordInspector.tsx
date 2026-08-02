'use client';

// SOURCING: @commonplace/block-view (host query/emit). The record.inspector
// descriptor (G6): a 500px right tool window (--rec-side-panel) that opens on
// selection and closes without stealing focus. Structure at Twenty metrics,
// paint from the Int UI register. K2: the inspector leads with the object's
// compact card above the raw field table; relation chips there navigate the
// inspector to the related object.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BlockHost, JsonValue, ObjectRef } from '@commonplace/block-view/types';
import type { FieldMetadata } from '@commonplace/data-model-contracts';
import { parseFieldType } from '@commonplace/data-model-contracts';
import { CopyAddressButton } from '@/components/shell/CopyAddressButton';
import { objectAddress } from '@/lib/object-address';
import { objectChip, useShellStore } from '@/lib/shell-store';
import { RecordCard } from './CardView';
import { ViewState } from './ViewStates';
import { renderFieldCell } from './records/cells';
import { FieldEditor } from './records/editors';
import { RecordChip } from './records/RecordChip';
import { hueForObjectKey } from './records/tints';

function parseDeclaredFields(record: ObjectRef): FieldMetadata[] {
  const raw = record.properties.declaredFields
    ?? record.properties.fields
    ?? record.properties.schemaFields;
  if (!Array.isArray(raw)) return [];
  const objectTypeId = String(record.properties.objectTypeKey ?? record.type ?? 'record');
  return raw
    .map((entry): FieldMetadata | null => {
      if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return null;
      const source = entry as Record<string, unknown>;
      const key = typeof source.key === 'string' ? source.key : '';
      if (!key) return null;
      return {
        id: typeof source.id === 'string' ? source.id : `${objectTypeId}:${key}`,
        objectTypeId,
        key,
        label: typeof source.label === 'string' ? source.label : key,
        fieldType: parseFieldType(source.fieldType ?? source.field_type),
        required: Boolean(source.required),
      };
    })
    .filter((entry): entry is FieldMetadata => entry !== null);
}

function readProvenance(record: ObjectRef): { eventIds: string[]; sourceRefs: string[] } {
  const provenance = record.properties.provenance;
  if (typeof provenance !== 'object' || provenance === null || Array.isArray(provenance)) {
    return { eventIds: [], sourceRefs: [] };
  }
  const source = provenance as Record<string, unknown>;
  const eventIds = Array.isArray(source.eventIds)
    ? source.eventIds.filter((item): item is string => typeof item === 'string')
    : Array.isArray(source.event_ids)
      ? source.event_ids.filter((item): item is string => typeof item === 'string')
      : [];
  const sourceRefs = Array.isArray(source.sourceRefs)
    ? source.sourceRefs.filter((item): item is string => typeof item === 'string')
    : Array.isArray(source.source_refs)
      ? source.source_refs.filter((item): item is string => typeof item === 'string')
      : [];
  return { eventIds, sourceRefs };
}

function relationEntries(record: ObjectRef, fields: readonly FieldMetadata[]): Array<{ key: string; value: unknown }> {
  const relationKeys = new Set(
    fields.filter((field) => field.fieldType.kind === 'relation').map((field) => field.key),
  );
  const entries: Array<{ key: string; value: unknown }> = [];
  for (const [key, value] of Object.entries(record.properties)) {
    if (relationKeys.has(key) || key.endsWith('_id') || key.endsWith('Ids')) {
      entries.push({ key, value });
    }
  }
  const explicit = record.properties.relations;
  if (Array.isArray(explicit)) {
    for (const item of explicit) entries.push({ key: 'relations', value: item });
  }
  return entries;
}

export function RecordInspector({ host }: { host: BlockHost }) {
  const selectedRecordId = useShellStore((state) => state.selectedRecordId);
  const selectedRecordObject = useShellStore((state) => state.selectedRecordObject);
  const selectedTypeHint = useShellStore((state) => state.selectedTypeHint);
  const selectRecord = useShellStore((state) => state.selectRecord);
  const openActionSheet = useShellStore((state) => state.openActionSheet);
  const tenant = useShellStore((state) => state.tenant);
  const [fetched, setFetched] = useState<ObjectRef | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const record =
    selectedRecordObject && selectedRecordObject.id === selectedRecordId
      ? selectedRecordObject
      : fetched;

  const declaredFields = useMemo(
    () => (record ? parseDeclaredFields(record) : []),
    [record],
  );

  const labelField = useMemo(() => {
    const fromProps = record?.properties.labelIdentifierField;
    if (typeof fromProps === 'string' && fromProps.length > 0) return fromProps;
    return declaredFields[0]?.key ?? 'title';
  }, [declaredFields, record?.properties.labelIdentifierField]);

  const headerLabel = record
    ? String(record.properties[labelField] ?? record.properties.title ?? record.id)
    : '';

  const provenance = useMemo(
    () => (record ? readProvenance(record) : { eventIds: [], sourceRefs: [] }),
    [record],
  );

  const relations = useMemo(
    () => (record ? relationEntries(record, declaredFields) : []),
    [declaredFields, record],
  );

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
    if (
      !selectedRecordId ||
      (selectedRecordObject && selectedRecordObject.id === selectedRecordId)
    ) {
      return;
    }
    const types = selectedTypeHint && selectedTypeHint !== 'record'
      ? [selectedTypeHint, 'record']
      : ['record'];
    Promise.resolve(
      host.query({ types, where: { kind: 'eq', field: 'id', value: selectedRecordId } }),
    ).then((set) => {
      if (!active) return;
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

  const commitField = useCallback(
    async (fieldKey: string, nextValue: unknown) => {
      if (!record) return;
      setEditingKey(null);
      await host.emit({
        kind: 'update',
        id: record.id,
        patch: { [fieldKey]: nextValue as JsonValue },
      });
    },
    [host, record],
  );

  if (!selectedRecordId) return null;

  const headerHue = hueForObjectKey(String(record?.type ?? 'record'));

  return (
    <aside
      aria-label="Record inspector"
      className="flex h-full shrink-0 flex-col border-l border-ij-seam bg-ij-chrome"
      style={{ width: 'var(--rec-side-panel)' }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          if (editingKey) {
            setEditingKey(null);
            return;
          }
          close();
        }
      }}
    >
      <div className="flex h-ij-toolbar shrink-0 items-center gap-2 border-b border-ij-seam px-3">
        {record ? (
          <RecordChip label={headerLabel} color={headerHue} />
        ) : (
          <span className="text-ij-ink" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
            Inspector
          </span>
        )}
        {record ? (
          <button
            type="button"
            data-inspector-action
            onClick={() =>
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
        ) : (
          <span className="ml-auto" />
        )}
        <button
          type="button"
          onClick={close}
          aria-label="Close inspector"
          className="h-6 w-6 shrink-0 rounded-ij-arc text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink"
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
          {relations.length > 0 ? (
            <section className="border-b border-ij-seam p-4" data-inspector-relations>
              <h3 className="mb-2 text-ij-ink-info" style={{ fontWeight: 'var(--rec-weight-medium)' }}>
                Relations
              </h3>
              <div className="flex flex-wrap gap-rec-sibling-gap">
                {relations.flatMap(({ key, value }) => {
                  const entries = Array.isArray(value) ? value : [value];
                  return entries.map((entry, index) => {
                    const label = typeof entry === 'string'
                      ? entry
                      : typeof entry === 'object' && entry !== null
                        ? String((entry as Record<string, unknown>).title
                          ?? (entry as Record<string, unknown>).label
                          ?? (entry as Record<string, unknown>).id
                          ?? key)
                        : String(entry);
                    return (
                      <RecordChip
                        key={`${key}-${index}`}
                        label={label}
                        color={hueForObjectKey(key)}
                      />
                    );
                  });
                })}
              </div>
            </section>
          ) : null}
          <dl className="p-4">
            {(declaredFields.length > 0
              ? declaredFields.map((field) => ({ key: field.key, field }))
              : Object.keys(record.properties).map((key) => ({ key, field: undefined }))
            ).map(({ key, field }) => {
              const value = record.properties[key];
              const isEditing = editingKey === key;
              return (
                <div key={key} className="mb-rec-grid border-b border-ij-divider pb-rec-grid">
                  <dt className="text-ij-ink-info" style={{ fontWeight: 'var(--rec-weight-medium)' }}>
                    {field?.label ?? key}
                  </dt>
                  <dd className="text-ij-ink">
                    {isEditing && field ? (
                      <FieldEditor
                        fieldType={field.fieldType}
                        value={value}
                        onCommit={(next) => void commitField(key, next)}
                        onCancel={() => setEditingKey(null)}
                        autoFocus
                      />
                    ) : field ? (
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => setEditingKey(key)}
                      >
                        {renderFieldCell(field.fieldType, value, { label: field.label })}
                      </button>
                    ) : (
                      <span>
                        {Array.isArray(value) ? value.join(', ') : String(value)}
                      </span>
                    )}
                  </dd>
                </div>
              );
            })}
            {(provenance.eventIds.length > 0 || provenance.sourceRefs.length > 0) ? (
              <div className="mt-2 border-t border-ij-divider pt-rec-grid" data-inspector-provenance>
                <h3 className="mb-1 text-ij-ink-info" style={{ fontWeight: 'var(--rec-weight-medium)' }}>
                  Provenance
                </h3>
                {provenance.eventIds.length > 0 ? (
                  <p className="font-ij-mono text-xs text-ij-ink-info">
                    Events: {provenance.eventIds.join(', ')}
                  </p>
                ) : null}
                {provenance.sourceRefs.length > 0 ? (
                  <p className="font-ij-mono text-xs text-ij-ink-info">
                    Sources: {provenance.sourceRefs.join(', ')}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="mt-2 flex items-center gap-1" data-inspector-address>
              <span
                className="min-w-0 flex-1 truncate font-ij-mono text-ij-ink-disabled"
                title={objectAddress(tenant, record)}
              >
                {objectAddress(tenant, record)}
              </span>
              <CopyAddressButton
                address={objectAddress(tenant, record)}
                name={String(record.properties.title ?? record.id)}
              />
            </div>
          </dl>
        </div>
      ) : (
        <ViewState state="loading" />
      )}
    </aside>
  );
}
