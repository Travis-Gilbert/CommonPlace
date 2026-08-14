'use client';

// SOURCING: twenty-ui Toggle / Button / Tag / Card for D31 field/index/facet panels.

import { useEffect, useMemo, useState } from 'react';
import {
  EDITOR_TWENTY_FIELD_TYPES,
  editorStateFromField,
  fieldTypeFromEditor,
  fieldTypeToTwentyToken,
  formatFieldType,
  type FacetDefWire,
  type FieldMetadataWire,
  type IndexPolicyWire,
  type ObjectMetadataWire,
  type PromotionCandidateWire,
  type TwentyFieldTypeToken,
} from '@commonplace/data-model-contracts';
import { Button, Toggle } from 'twenty-ui/input';
import { Tag } from 'twenty-ui/data-display';
import { Card, CardContent } from 'twenty-ui/surfaces';

const inputClass =
  'h-ij-control rounded-ij-arc border border-ij-control-border bg-ij-chrome px-2 text-sm text-ij-ink disabled:opacity-50';

export function FieldsScreen({
  object,
  selectedField,
  busy,
  onSelectField,
  onSave,
}: {
  object: ObjectMetadataWire;
  selectedField: FieldMetadataWire | null;
  busy: boolean;
  onSelectField: (name: string) => void;
  onSave: (patch: {
    label: string;
    type: TwentyFieldTypeToken;
    isNullable: boolean;
    isFilterable: boolean;
    isSortable: boolean;
    variants: readonly string[];
    vectorDim: number;
    relationTarget: string;
    relationCardinality: 'one' | 'many';
    indexPolicy: IndexPolicyWire;
  }) => Promise<void>;
}) {
  const initial = selectedField ? editorStateFromField(selectedField) : null;
  const [label, setLabel] = useState(selectedField?.label ?? '');
  const [type, setType] = useState<TwentyFieldTypeToken>(initial?.token ?? 'TEXT');
  const [isNullable, setIsNullable] = useState(selectedField?.isNullable ?? true);
  const [isFilterable, setIsFilterable] = useState(
    selectedField?.settings.isFilterable ?? false,
  );
  const [isSortable, setIsSortable] = useState(selectedField?.settings.isSortable ?? false);
  const [variantsText, setVariantsText] = useState((initial?.variants ?? []).join(', '));
  const [vectorDim, setVectorDim] = useState(initial?.vectorDim ?? 0);
  const [relationTarget, setRelationTarget] = useState(initial?.relationTarget ?? '*');
  const [relationCardinality, setRelationCardinality] = useState<'one' | 'many'>(
    initial?.relationCardinality ?? 'many',
  );
  const [indexPolicy, setIndexPolicy] = useState<IndexPolicyWire>(
    initial?.indexPolicy ?? {
      indexed: false,
      reverseIndexed: false,
      tokenized: false,
      indexOnly: false,
    },
  );

  useEffect(() => {
    if (!selectedField) return;
    const next = editorStateFromField(selectedField);
    setLabel(selectedField.label);
    setType(next.token);
    setIsNullable(selectedField.isNullable);
    setIsFilterable(selectedField.settings.isFilterable);
    setIsSortable(selectedField.settings.isSortable);
    setVariantsText(next.variants.join(', '));
    setVectorDim(next.vectorDim);
    setRelationTarget(next.relationTarget);
    setRelationCardinality(next.relationCardinality);
    setIndexPolicy(next.indexPolicy);
  }, [selectedField]);

  const canonical = useMemo(
    () =>
      formatFieldType(
        fieldTypeFromEditor({
          token: type,
          variants: variantsText.split(',').map((value) => value.trim()).filter(Boolean),
          vectorDim,
          relationTarget,
          relationCardinality,
        }),
      ),
    [type, variantsText, vectorDim, relationTarget, relationCardinality],
  );

  const showEnum = type === 'SELECT';
  const showVector = type === 'RAW_JSON';
  const showRelation = type === 'RELATION' || type === 'MORPH_RELATION';

  return (
    <div className="grid gap-3 rec-grid-field-settings-lg">
      <ul className="rounded-ij-arc border border-ij-seam p-1">
        {object.fields.map((field) => (
          <li key={field.id}>
            <button
              type="button"
              className={`flex w-full items-center justify-between rounded-ij-arc px-2 py-2 text-left text-sm ${
                field.name === selectedField?.name
                  ? 'bg-ij-selection'
                  : 'hover:bg-ij-hover-surface'
              }`}
              onClick={() => onSelectField(field.name)}
            >
              <span>{field.name}</span>
              <Tag text={field.type} color="gray" />
            </button>
          </li>
        ))}
      </ul>
      {!selectedField ? (
        <p className="text-ij-ink-info">Select a field.</p>
      ) : (
        <Card>
          <CardContent className="grid gap-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 style={{ fontWeight: 'var(--rec-weight-cap)' }}>{selectedField.name}</h2>
              {selectedField.isSystem ? <Tag text="Layer 1 / system" color="gray" /> : (
                <Tag text="Layer 2" color="blue" />
              )}
            </div>
            <p className="text-xs text-ij-ink-info">
              Twenty presentation: <span className="font-ij-mono" data-mono-ok>{type}</span>
              {' · '}
              Canonical FieldType: <span className="font-ij-mono" data-mono-ok>{canonical}</span>
              {' · '}
              round-trip:{' '}
              <span className="font-ij-mono" data-mono-ok>
                {fieldTypeToTwentyToken(
                  fieldTypeFromEditor({
                    token: type,
                    variants: variantsText.split(',').map((value) => value.trim()).filter(Boolean),
                    vectorDim,
                    relationTarget,
                    relationCardinality,
                  }),
                )}
              </span>
            </p>
            <label className="grid gap-1 text-xs text-ij-ink-info">
              Label
              <input
                value={label}
                disabled={selectedField.isSystem || busy}
                onChange={(event) => setLabel(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="grid gap-1 text-xs text-ij-ink-info">
              Field type (Twenty presentation)
              <select
                value={type}
                disabled={selectedField.isSystem || busy}
                onChange={(event) => setType(event.target.value as TwentyFieldTypeToken)}
                className={inputClass}
              >
                {EDITOR_TWENTY_FIELD_TYPES.map((token) => (
                  <option key={token} value={token}>
                    {token}
                  </option>
                ))}
              </select>
            </label>
            {showEnum ? (
              <label className="grid gap-1 text-xs text-ij-ink-info">
                Enum variants (comma-separated)
                <input
                  value={variantsText}
                  disabled={selectedField.isSystem || busy}
                  onChange={(event) => setVariantsText(event.target.value)}
                  className={inputClass}
                  placeholder="open, closed"
                />
              </label>
            ) : null}
            {showVector ? (
              <label className="grid gap-1 text-xs text-ij-ink-info">
                Vector dim (canonical vector FieldType; 0 = plain JSON)
                <input
                  type="number"
                  min={0}
                  value={vectorDim}
                  disabled={selectedField.isSystem || busy}
                  onChange={(event) => setVectorDim(Number(event.target.value) || 0)}
                  className={inputClass}
                />
              </label>
            ) : null}
            {showRelation ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs text-ij-ink-info">
                  Relation target object
                  <input
                    value={relationTarget}
                    disabled={selectedField.isSystem || busy}
                    onChange={(event) => setRelationTarget(event.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="grid gap-1 text-xs text-ij-ink-info">
                  Cardinality
                  <select
                    value={relationCardinality}
                    disabled={selectedField.isSystem || busy}
                    onChange={(event) =>
                      setRelationCardinality(event.target.value === 'one' ? 'one' : 'many')
                    }
                    className={inputClass}
                  >
                    <option value="one">one</option>
                    <option value="many">many</option>
                  </select>
                </label>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-ij-ink">
                <Toggle
                  value={isNullable}
                  onChange={setIsNullable}
                  disabled={selectedField.isSystem || busy}
                />
                Nullable
              </label>
              <label className="flex items-center gap-2 text-sm text-ij-ink">
                <Toggle
                  value={isFilterable}
                  onChange={setIsFilterable}
                  disabled={selectedField.isSystem || busy}
                />
                Filterable
              </label>
              <label className="flex items-center gap-2 text-sm text-ij-ink">
                <Toggle
                  value={isSortable}
                  onChange={setIsSortable}
                  disabled={selectedField.isSystem || busy}
                />
                Sortable
              </label>
            </div>
            <div className="grid gap-2 rounded-ij-arc border border-ij-seam p-3">
              <p className="text-xs text-ij-ink-info">IndexPolicy (four flags)</p>
              <div className="flex flex-wrap gap-4">
                {(
                  [
                    ['indexed', 'indexed'],
                    ['reverseIndexed', 'reverse'],
                    ['tokenized', 'tokenized'],
                    ['indexOnly', 'indexOnly'],
                  ] as const
                ).map(([key, labelText]) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-ij-ink">
                    <Toggle
                      value={indexPolicy[key]}
                      onChange={(value) =>
                        setIndexPolicy((current) => ({ ...current, [key]: value }))
                      }
                      disabled={selectedField.isSystem || busy}
                    />
                    {labelText}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Button
                title="Save field"
                disabled={selectedField.isSystem || busy}
                onClick={() =>
                  void onSave({
                    label,
                    type,
                    isNullable,
                    isFilterable,
                    isSortable,
                    variants: variantsText.split(',').map((value) => value.trim()).filter(Boolean),
                    vectorDim,
                    relationTarget,
                    relationCardinality,
                    indexPolicy,
                  })
                }
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function IndexesScreen({
  object,
  candidates,
  busy,
  onPromote,
  onDemote,
}: {
  object: ObjectMetadataWire;
  candidates: PromotionCandidateWire[];
  busy: boolean;
  onPromote: (fieldName: string) => Promise<void>;
  onDemote: (fieldName: string) => Promise<void>;
}) {
  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="grid gap-3 p-4">
          <h2 style={{ fontWeight: 'var(--rec-weight-cap)' }}>Promoted indexes</h2>
          {object.indexMetadataList.length === 0 ? (
            <p className="text-sm text-ij-ink-info">No indexes yet.</p>
          ) : (
            <ul className="grid gap-2">
              {object.indexMetadataList.map((index) => {
                const fieldId = index.indexFieldMetadataList[0]?.fieldMetadataId;
                const field = object.fields.find((row) => row.id === fieldId);
                return (
                  <li
                    key={index.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-ij-arc border border-ij-seam px-3 py-2"
                  >
                    <div>
                      <p className="font-ij-mono text-sm" data-mono-ok>
                        {index.name}
                      </p>
                      <p className="text-xs text-ij-ink-info">
                        {index.indexType} · trigger {index.trigger.kind}
                        {index.trigger.kind === 'facet_required'
                          ? ` (${index.trigger.facet})`
                          : ''}
                        {index.trigger.kind === 'observed'
                          ? ` (queries ${index.trigger.query_count})`
                          : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Tag text={index.isCustom ? 'custom' : 'system'} color="gray" />
                      {index.trigger.kind === 'user_marked' && field ? (
                        <Button
                          title="Demote"
                          size="small"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => void onDemote(field.name)}
                        />
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="grid gap-3 p-4">
          <h2 style={{ fontWeight: 'var(--rec-weight-cap)' }}>Promotion candidates</h2>
          {candidates.length === 0 ? (
            <p className="text-sm text-ij-ink-info">No candidates for this type.</p>
          ) : (
            <ul className="grid gap-2">
              {candidates.map((candidate) => (
                <li
                  key={`${candidate.objectNameSingular}.${candidate.fieldName}`}
                  className="flex items-center justify-between gap-2 rounded-ij-arc border border-ij-seam px-3 py-2"
                >
                  <span className="font-ij-mono text-sm" data-mono-ok>
                    {candidate.fieldName}
                  </span>
                  <Button
                    title="Promote"
                    size="small"
                    disabled={busy}
                    onClick={() => void onPromote(candidate.fieldName)}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function FacetsScreen({
  object,
  facets,
  busy,
  onMap,
  onRevoke,
}: {
  object: ObjectMetadataWire;
  facets: FacetDefWire[];
  busy: boolean;
  onMap: (
    facet: string,
    propertyMap: Record<string, string>,
    relationMap?: Record<string, string>,
  ) => Promise<void>;
  onRevoke: (facet: string) => Promise<void>;
}) {
  const active = new Set((object.conformances ?? []).map((row) => row.facet));
  const [draftMaps, setDraftMaps] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    const next: Record<string, Record<string, string>> = {};
    for (const facet of facets) {
      const existing = (object.conformances ?? []).find((row) => row.facet === facet.name);
      const propertyMap: Record<string, string> = { ...(existing?.propertyMap ?? {}) };
      for (const property of facet.properties) {
        if (propertyMap[property.name]) continue;
        const match = object.fields.find((field) => field.name === property.name);
        if (match) propertyMap[property.name] = match.name;
      }
      next[facet.name] = propertyMap;
    }
    setDraftMaps(next);
  }, [facets, object]);

  return (
    <div className="grid gap-3">
      <p className="text-sm text-ij-ink-info">
        Facet conformance maps object fields onto declared capability contracts
        (CONFORMS_TO). Pick local fields explicitly. Auto-suggestions are only a starting point.
      </p>
      {facets.map((facet) => {
        const isActive = active.has(facet.name);
        const propertyMap = draftMaps[facet.name] ?? {};
        const existing = (object.conformances ?? []).find((row) => row.facet === facet.name);
        const relationMap = existing?.relationMap ?? {};
        const missingRequired = facet.properties.some(
          (property) => property.required && !propertyMap[property.name],
        );
        return (
          <Card key={facet.name}>
            <CardContent className="grid gap-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 style={{ fontWeight: 'var(--rec-weight-cap)' }}>{facet.label}</h2>
                <Tag text={facet.name} color="purple" />
                {facet.isSystem ? <Tag text="system" color="gray" /> : null}
                {isActive ? <Tag text="conforms" color="green" /> : <Tag text="unmapped" color="orange" />}
              </div>
              {facet.description ? (
                <p className="text-sm text-ij-ink-info">{facet.description}</p>
              ) : null}
              <ul className="grid gap-2 text-sm">
                {facet.properties.map((property) => (
                  <li key={property.name} className="grid gap-1 rec-grid-field-settings-sm sm:items-center">
                    <span className="font-ij-mono text-xs" data-mono-ok>
                      {property.name}
                      {property.required ? ' · required' : ''}
                      {!propertyMap[property.name] && property.required ? (
                        <span className="text-ij-danger"> · unmapped</span>
                      ) : null}
                    </span>
                    <select
                      className={inputClass}
                      disabled={busy || isActive}
                      value={propertyMap[property.name] ?? ''}
                      onChange={(event) => {
                        const value = event.target.value;
                        setDraftMaps((current) => ({
                          ...current,
                          [facet.name]: {
                            ...(current[facet.name] ?? {}),
                            [property.name]: value,
                          },
                        }));
                      }}
                    >
                      <option value="">(unmapped)</option>
                      {object.fields.map((field) => (
                        <option key={field.id} value={field.name}>
                          {field.name} · {field.type}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
              {Object.keys(relationMap).length > 0 ? (
                <div className="rounded-ij-arc border border-ij-seam p-2 text-xs text-ij-ink-info">
                  Relation map:{' '}
                  {Object.entries(relationMap)
                    .map(([from, to]) => `${from}→${to}`)
                    .join(', ')}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {isActive ? (
                  <Button
                    title="Revoke"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void onRevoke(facet.name)}
                  />
                ) : (
                  <Button
                    title="Apply conformance"
                    disabled={busy || missingRequired}
                    onClick={() => void onMap(facet.name, propertyMap, { ...relationMap })}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
