'use client';

// SOURCING: twenty-ui SegmentedControl / Toggle / Button / Tag / Pill / Card +
// cmdk SearchInput pattern for D31 four-screen metadata settings register
// (ARD Part 1 + SPEC-COMMONPLACE-META-MODEL). Facet conformance has no Twenty
// analog: Card + mapping rows on twenty-ui primitives.

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ViewRenderProps } from '@commonplace/block-view/types';
import {
  fieldTypeFromEditor,
  type FacetDefWire,
  type IndexPolicyWire,
  type ObjectMetadataWire,
  type PromotionCandidateWire,
  type TwentyFieldTypeToken,
} from '@commonplace/data-model-contracts';
import { Button, SearchInput, SegmentedControl } from 'twenty-ui/input';
import { Pill, Tag } from 'twenty-ui/data-display';
import { Card, CardContent } from 'twenty-ui/surfaces';
import {
  createConformance,
  deleteConformance,
  demoteFieldIndex,
  listFacets,
  listMetadataObjects,
  listPromotionCandidates,
  patchMetadataField,
  patchMetadataObject,
  promoteFieldIndex,
} from './metadataClient';
import { FacetsScreen, FieldsScreen, IndexesScreen } from './FieldSettingsPanels';

type Screen = 'objects' | 'fields' | 'indexes' | 'facets';

const SCREENS: Array<{ value: Screen; label: string }> = [
  { value: 'objects', label: 'Object types' },
  { value: 'fields', label: 'Fields' },
  { value: 'indexes', label: 'Indexes' },
  { value: 'facets', label: 'Facets' },
];

export function ModelSettingsView(_props: ViewRenderProps) {
  const [screen, setScreen] = useState<Screen>('objects');
  const [objects, setObjects] = useState<ObjectMetadataWire[]>([]);
  const [facets, setFacets] = useState<FacetDefWire[]>([]);
  const [candidates, setCandidates] = useState<PromotionCandidateWire[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sourceNote, setSourceNote] = useState<string | null>(null);

  const selected = useMemo(
    () => objects.find((row) => row.nameSingular === selectedName) ?? null,
    [objects, selectedName],
  );

  const selectedFieldMeta = useMemo(() => {
    if (!selected || !selectedField) return null;
    return selected.fields.find((row) => row.name === selectedField) ?? null;
  }, [selected, selectedField]);

  const reload = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [nextObjects, nextFacets, nextCandidates] = await Promise.all([
        listMetadataObjects(),
        listFacets(),
        listPromotionCandidates(),
      ]);
      setObjects(nextObjects);
      setFacets(nextFacets);
      setCandidates(nextCandidates);
      setSelectedName((prev) => prev ?? nextObjects[0]?.nameSingular ?? null);
      const standIn = nextObjects.length > 0;
      setSourceNote(
        standIn
          ? 'Loaded via /api/rest/metadata (harness or LocalDevMetadataStore).'
          : 'No object types returned.',
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filteredObjects = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return objects;
    return objects.filter((row) =>
      [row.nameSingular, row.labelSingular, row.namePlural]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [objects, query]);

  async function saveObjectLabels(labelSingular: string, labelPlural: string): Promise<void> {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await patchMetadataObject(selected.nameSingular, {
        labelSingular,
        labelPlural,
      });
      setObjects((prev) =>
        prev.map((row) => (row.nameSingular === updated.nameSingular ? updated : row)),
      );
      setNotice('Object labels saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setBusy(false);
    }
  }

  async function saveField(patch: {
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
  }): Promise<void> {
    if (!selected || !selectedFieldMeta) return;
    setBusy(true);
    setError(null);
    try {
      const fieldType = fieldTypeFromEditor({
        token: patch.type,
        variants: patch.variants,
        vectorDim: patch.vectorDim,
        relationTarget: patch.relationTarget,
        relationCardinality: patch.relationCardinality,
      });
      const updated = await patchMetadataField(selected.nameSingular, selectedFieldMeta.name, {
        label: patch.label,
        type: patch.type,
        isNullable: patch.isNullable,
        settings: {
          isFilterable: patch.isFilterable,
          isSortable: patch.isSortable,
          raw: {
            ...(selectedFieldMeta.settings.raw ?? {}),
            fieldType,
            indexPolicy: patch.indexPolicy,
          },
        },
      });
      setObjects((prev) =>
        prev.map((row) => (row.nameSingular === updated.nameSingular ? updated : row)),
      );
      setNotice(`Field ${selectedFieldMeta.name} saved.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setBusy(false);
    }
  }

  async function promote(fieldName: string): Promise<void> {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await promoteFieldIndex(selected.nameSingular, fieldName);
      await reload();
      setNotice(`Promoted index on ${selected.nameSingular}.${fieldName}.`);
    } catch (promoteError) {
      setError(promoteError instanceof Error ? promoteError.message : String(promoteError));
    } finally {
      setBusy(false);
    }
  }

  async function demote(fieldName: string): Promise<void> {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await demoteFieldIndex(selected.nameSingular, fieldName);
      await reload();
      setNotice(`Demoted user-mark index on ${selected.nameSingular}.${fieldName}.`);
    } catch (demoteError) {
      setError(demoteError instanceof Error ? demoteError.message : String(demoteError));
    } finally {
      setBusy(false);
    }
  }

  async function mapFacet(
    facetName: string,
    propertyMap: Record<string, string>,
    relationMap?: Record<string, string>,
  ): Promise<void> {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await createConformance(selected.nameSingular, {
        facet: facetName,
        propertyMap,
        relationMap,
      });
      await reload();
      setNotice(`Conformance ${facetName} applied to ${selected.nameSingular}.`);
    } catch (mapError) {
      setError(mapError instanceof Error ? mapError.message : String(mapError));
    } finally {
      setBusy(false);
    }
  }

  async function revokeFacet(facetName: string): Promise<void> {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await deleteConformance(selected.nameSingular, facetName);
      await reload();
      setNotice(`Revoked conformance ${facetName}.`);
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : String(revokeError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col" data-model-settings>
      <header className="flex h-ij-toolbar shrink-0 items-center gap-3 border-b border-ij-seam px-3">
        <Link
          href="/Data-model"
          className="text-sm text-ij-ink-info underline-offset-2 hover:text-ij-ink hover:underline"
        >
          ← Models canvas
        </Link>
        <h1 className="text-sm" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
          Data model settings
        </h1>
        <Tag text="L0 substrate" color="gray" />
        <Tag text="L1 kernel" color="gray" />
        <Tag text="L2 user types" color="blue" />
        <div className="ml-auto">
          <Button
            title={busy ? 'Loading…' : 'Refresh'}
            onClick={() => void reload()}
            disabled={busy}
            variant="secondary"
            size="small"
          />
        </div>
      </header>

      {(error || notice || sourceNote) && (
        <div className="shrink-0 space-y-1 border-b border-ij-seam px-3 py-2 text-sm">
          {error ? (
            <p className="text-ij-danger" role="alert">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="text-ij-ink" role="status">
              {notice}
            </p>
          ) : null}
          {sourceNote ? <p className="text-ij-ink-info">{sourceNote}</p> : null}
        </div>
      )}

      <div className="shrink-0 border-b border-ij-seam px-3 py-2">
        <SegmentedControl
          ariaLabel="Data model settings screens"
          value={screen}
          onChange={(value) => setScreen(value)}
          options={SCREENS}
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 rec-grid-model-settings">
        <aside className="min-h-0 overflow-auto border-b border-ij-seam lg:border-b-0 lg:border-r">
          <div className="border-b border-ij-seam p-2">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Filter Layer 2 types…"
              aria-label="Filter object types"
            />
            <p className="mt-2 text-xs text-ij-ink-info">
              Layer 0/1 are system-owned. This register edits Layer 2 user types.
            </p>
          </div>
          <ul className="p-1" role="listbox" aria-label="Object types">
            {filteredObjects.map((row) => {
              const active = row.nameSingular === selectedName;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`flex w-full items-center justify-between rounded-ij-arc px-2 py-2 text-left text-sm ${
                      active ? 'bg-ij-selection text-ij-ink' : 'hover:bg-ij-hover-surface'
                    }`}
                    onClick={() => {
                      setSelectedName(row.nameSingular);
                      setSelectedField(row.fields[0]?.name ?? null);
                    }}
                  >
                    <span>{row.labelSingular}</span>
                    <Pill label={String(row.fields.length)} />
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <main className="min-h-0 overflow-auto p-3">
          {!selected ? (
            <p className="text-ij-ink-info">Select an object type.</p>
          ) : screen === 'objects' ? (
            <ObjectDetailScreen
              object={selected}
              busy={busy}
              onSave={saveObjectLabels}
            />
          ) : screen === 'fields' ? (
            <FieldsScreen
              object={selected}
              selectedField={selectedFieldMeta}
              busy={busy}
              onSelectField={setSelectedField}
              onSave={saveField}
            />
          ) : screen === 'indexes' ? (
            <IndexesScreen
              object={selected}
              candidates={candidates.filter(
                (row) => row.objectNameSingular === selected.nameSingular,
              )}
              busy={busy}
              onPromote={promote}
              onDemote={demote}
            />
          ) : (
            <FacetsScreen
              object={selected}
              facets={facets}
              busy={busy}
              onMap={mapFacet}
              onRevoke={revokeFacet}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function ObjectDetailScreen({
  object,
  busy,
  onSave,
}: {
  object: ObjectMetadataWire;
  busy: boolean;
  onSave: (labelSingular: string, labelPlural: string) => Promise<void>;
}) {
  const [labelSingular, setLabelSingular] = useState(object.labelSingular);
  const [labelPlural, setLabelPlural] = useState(object.labelPlural);
  useEffect(() => {
    setLabelSingular(object.labelSingular);
    setLabelPlural(object.labelPlural);
  }, [object]);

  return (
    <Card>
      <CardContent className="grid gap-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 style={{ fontWeight: 'var(--rec-weight-cap)' }}>{object.nameSingular}</h2>
          {object.isSystem ? <Tag text="Layer 1 / system" color="gray" /> : <Tag text="Layer 2 user type" color="blue" />}
          {object.isActive ? <Tag text="active" color="green" /> : <Tag text="inactive" color="orange" />}
        </div>
        <p className="font-ij-mono text-xs text-ij-ink-info" data-mono-ok>
          {object.universalIdentifier}
        </p>
        <label className="grid gap-1 text-xs text-ij-ink-info">
          Label singular
          <input
            value={labelSingular}
            onChange={(event) => setLabelSingular(event.target.value)}
            className="h-ij-control rounded-ij-arc border border-ij-control-border bg-ij-chrome px-2 text-sm text-ij-ink"
          />
        </label>
        <label className="grid gap-1 text-xs text-ij-ink-info">
          Label plural
          <input
            value={labelPlural}
            onChange={(event) => setLabelPlural(event.target.value)}
            className="h-ij-control rounded-ij-arc border border-ij-control-border bg-ij-chrome px-2 text-sm text-ij-ink"
          />
        </label>
        <div>
          <Button
            title="Save labels"
            disabled={busy}
            onClick={() => void onSave(labelSingular, labelPlural)}
          />
        </div>
        <section>
          <h3 className="mb-2 text-xs uppercase tracking-wider text-ij-ink-info">
            Conformances
          </h3>
          <div className="flex flex-wrap gap-2">
            {(object.conformances ?? []).length === 0 ? (
              <span className="text-sm text-ij-ink-info">None yet. Map on the Facets screen.</span>
            ) : (
              (object.conformances ?? []).map((row) => (
                <Tag key={row.facet} text={row.facet} color="purple" />
              ))
            )}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
