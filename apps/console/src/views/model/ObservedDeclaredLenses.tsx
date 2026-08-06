'use client';

// SOURCING: @xyflow/react in wrap mode for the diagram lens, tablecn structure
// on native tables for the field and record lenses.

import {
  formatCoverage,
  formatFieldType,
  isPinned,
  type DeclaredModel,
  type ObservedField,
  type ObservedModel,
  type PinKind,
} from '@commonplace/data-model-contracts';
import type { ModelSelection } from './modelQuery';
import { ForkDiagramCanvas } from './diagram/ForkDiagramCanvas';
import type { LayoutPositions } from './diagram/layout';

export interface LensProps {
  readonly observed: ObservedModel;
  readonly declared: DeclaredModel;
  readonly selection: ModelSelection | null;
  readonly pendingPins: readonly string[];
  readonly onSelect: (selection: ModelSelection | null) => void;
  readonly onPin: (observedKey: string, kind: PinKind, parentObservedKey?: string) => void;
  readonly onUnpin: (declaredId: string) => void;
  readonly layoutPositions?: LayoutPositions;
  readonly onLayoutChange?: (positions: LayoutPositions) => void;
}

export function DiagramLens(props: LensProps) {
  // MF1: the OWOX fork shell is the Data-model page body (full-bleed).
  return (
    <div className="h-full min-h-0 w-full" data-model-canvas-body>
      <ForkDiagramCanvas {...props} />
    </div>
  );
}

export function FieldsTableLens({
  observed,
  declared,
  selection,
  pendingPins,
  onSelect,
  onPin,
  onUnpin,
}: LensProps) {
  const observedFields = observed.types.flatMap((type) =>
    type.fields.map((field) => ({ type, field })),
  );
  const observedEdges = observed.types.flatMap((type) =>
    type.edges.map((edge) => ({ type, edge })),
  );

  return (
    <div className="h-full overflow-auto">
      <section aria-labelledby="observed-types-heading">
        <header className="sticky top-0 z-10 flex h-ij-toolbar items-center border-b border-ij-seam bg-ij-chrome px-3">
          <h2 id="observed-types-heading" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
            Observed types
          </h2>
          <span className="ml-auto font-ij-mono text-xs text-ij-ink-info">
            {observed.types.length}
          </span>
        </header>
        {observed.types.length === 0 ? (
          <p className="p-4 text-ij-ink-info">No types have been observed in this scope.</p>
        ) : (
          <ul>
            {observed.types.map((type) => {
              const pinned = isPinned(type.observedKey, declared);
              const pending = pendingPins.includes(type.observedKey);
              return (
                <li
                  key={type.observedKey}
                  className={[
                    'flex min-h-ij-control cursor-pointer items-center gap-3 border-b border-dashed border-ij-seam px-3 py-2 text-ij-ink-info hover:bg-ij-hover-surface',
                    selection?.kind === 'observed-type' && selection.key === type.observedKey
                      ? 'bg-ij-selection'
                      : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => onSelect({ kind: 'observed-type', key: type.observedKey })}
                >
                  <span className="font-ij-mono text-ij-ink">{type.dataType}</span>
                  <span>{type.fields.length} fields</span>
                  <span className="font-ij-mono">{type.eventCount} events</span>
                  <button
                    type="button"
                    disabled={pinned || pending}
                    onClick={(event) => {
                      event.stopPropagation();
                      onPin(type.observedKey, 'type');
                    }}
                    className="ml-auto h-ij-control rounded-ij-arc border border-ij-control-border px-3 text-ij-ink hover:bg-ij-hover-surface disabled:opacity-50"
                  >
                    {pinned ? 'Declared' : pending ? 'Pinning' : 'Pin'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="observed-fields-heading">
        <header className="sticky top-0 z-10 flex h-ij-toolbar items-center border-b border-ij-seam bg-ij-chrome px-3">
          <h2 id="observed-fields-heading" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
            Observed fields
          </h2>
          <span className="ml-auto font-ij-mono text-xs text-ij-ink-info">
            {observedFields.length}
          </span>
        </header>
        {observedFields.length === 0 ? (
          <p className="p-4 text-ij-ink-info">No fields have been observed in this scope.</p>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead className="text-xs text-ij-ink-info">
              <tr className="border-b border-ij-seam">
                <th className="p-2">Type</th>
                <th className="p-2">Field</th>
                <th className="p-2">Observed type</th>
                <th className="p-2">Coverage</th>
                <th className="p-2">Evidence</th>
                <th className="w-28 p-2">Promotion</th>
              </tr>
            </thead>
            <tbody>
              {observedFields.map(({ type, field }) => {
                const pinned = isPinned(field.observedKey, declared);
                const pending = pendingPins.includes(field.observedKey);
                return (
                  <tr
                    key={field.observedKey}
                    className={[
                      'cursor-pointer border-b border-dashed border-ij-seam text-ij-ink-info hover:bg-ij-hover-surface',
                      selection?.kind === 'observed-field' && selection.key === field.observedKey
                        ? 'bg-ij-selection'
                        : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => onSelect({ kind: 'observed-field', key: field.observedKey })}
                  >
                    <td className="p-2 font-ij-mono">{type.dataType}</td>
                    <td className="p-2 font-ij-mono text-ij-ink">{field.key}</td>
                    <td className="p-2">{formatFieldType(field.fieldType)}</td>
                    <td className="p-2 font-ij-mono">{formatCoverage(field.coverage)}</td>
                    <td className="p-2 font-ij-mono">{field.occurrences}</td>
                    <td className="p-2">
                      <button
                        type="button"
                        disabled={pinned || pending}
                        onClick={(event) => {
                          event.stopPropagation();
                          onPin(field.observedKey, 'field', type.observedKey);
                        }}
                        className="h-ij-control rounded-ij-arc border border-ij-control-border px-3 text-ij-ink hover:bg-ij-hover-surface disabled:opacity-50"
                      >
                        {pinned ? 'Declared' : pending ? 'Pinning' : 'Pin'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="border-t border-ij-seam" aria-labelledby="observed-edges-heading">
        <header className="flex h-ij-toolbar items-center border-b border-ij-seam bg-ij-chrome px-3">
          <h2 id="observed-edges-heading" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
            Observed relations
          </h2>
          <span className="ml-auto font-ij-mono text-xs text-ij-ink-info">
            {observedEdges.length}
          </span>
        </header>
        {observedEdges.length === 0 ? (
          <p className="p-4 text-ij-ink-info">No relations have been observed in this scope.</p>
        ) : (
          <ul>
            {observedEdges.map(({ type, edge }) => {
              const pinned = isPinned(edge.observedKey, declared);
              const pending = pendingPins.includes(edge.observedKey);
              return (
                <li
                  key={edge.observedKey}
                  className={[
                    'flex min-h-ij-control cursor-pointer items-center gap-3 border-b border-dashed border-ij-seam px-3 py-2 text-ij-ink-info hover:bg-ij-hover-surface',
                    selection?.kind === 'observed-edge' && selection.key === edge.observedKey
                      ? 'bg-ij-selection'
                      : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => onSelect({ kind: 'observed-edge', key: edge.observedKey })}
                >
                  <span className="font-ij-mono text-ij-ink">{type.dataType}.{edge.label}</span>
                  <span>{edge.fromField} to {edge.toField}</span>
                  <span className="font-ij-mono">{edge.occurrences} events</span>
                  <button
                    type="button"
                    disabled={pinned || pending}
                    onClick={(event) => {
                      event.stopPropagation();
                      onPin(edge.observedKey, 'edge', type.observedKey);
                    }}
                    className="ml-auto h-ij-control rounded-ij-arc border border-ij-control-border px-3 text-ij-ink hover:bg-ij-hover-surface disabled:opacity-50"
                  >
                    {pinned ? 'Declared' : pending ? 'Pinning' : 'Pin'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="border-t border-ij-seam" aria-labelledby="declared-fields-heading">
        <header className="flex h-ij-toolbar items-center border-b border-ij-seam bg-ij-raised px-3">
          <h2 id="declared-fields-heading" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
            Declared metadata
          </h2>
          <span className="ml-auto font-ij-mono text-xs text-ij-ink-info">
            {declared.objectTypes.length + declared.fields.length + declared.relations.length}
          </span>
        </header>
        {declared.objectTypes.length + declared.fields.length + declared.relations.length === 0 ? (
          <p className="p-4 text-ij-ink-info">
            Nothing is declared yet. Pin observed evidence to promote it.
          </p>
        ) : (
          <ul>
            {declared.objectTypes.map((type) => (
              <li key={type.id} className="flex min-h-ij-control items-center gap-3 border-b border-ij-seam px-3 py-2">
                <button
                  type="button"
                  onClick={() => onSelect({ kind: 'declared-type', key: type.id })}
                  className="min-w-0 flex-1 text-left hover:text-ij-link"
                >
                  <span className="font-ij-mono text-ij-gold">type</span>
                  <span className="ml-3 text-ij-ink">{type.label}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onUnpin(type.id)}
                  className="h-ij-control rounded-ij-arc border border-ij-control-border px-3 hover:bg-ij-hover-surface"
                >
                  Unpin
                </button>
              </li>
            ))}
            {declared.fields.map((field) => (
              <li key={field.id} className="flex min-h-ij-control items-center gap-3 border-b border-ij-seam px-3 py-2">
                <button
                  type="button"
                  onClick={() => onSelect({ kind: 'declared-field', key: field.id })}
                  className="min-w-0 flex-1 text-left hover:text-ij-link"
                >
                  <span className="font-ij-mono text-ij-gold">field</span>
                  <span className="ml-3 text-ij-ink">{field.label}</span>
                  <span className="ml-3 text-ij-ink-info">{formatFieldType(field.fieldType)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onUnpin(field.id)}
                  className="h-ij-control rounded-ij-arc border border-ij-control-border px-3 hover:bg-ij-hover-surface"
                >
                  Unpin
                </button>
              </li>
            ))}
            {declared.relations.map((relation) => (
              <li key={relation.id} className="flex min-h-ij-control items-center gap-3 border-b border-ij-seam px-3 py-2">
                <button
                  type="button"
                  onClick={() => onSelect({ kind: 'declared-relation', key: relation.id })}
                  className="min-w-0 flex-1 text-left hover:text-ij-link"
                >
                  <span className="font-ij-mono text-ij-gold">relation</span>
                  <span className="ml-3 text-ij-ink">{relation.label}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onUnpin(relation.id)}
                  className="h-ij-control rounded-ij-arc border border-ij-control-border px-3 hover:bg-ij-hover-surface"
                >
                  Unpin
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function stringifySample(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function RecordsPreviewLens({ observed, onSelect }: LensProps) {
  const rows = observed.types.flatMap((type) =>
    type.fields
      .filter((field) => field.sampleValues.length > 0)
      .map((field) => ({ type, field })),
  );

  if (rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-ij-ink-info">
        No sample values were recorded for this topic.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-collapse text-left">
        <thead className="sticky top-0 bg-ij-chrome text-xs text-ij-ink-info">
          <tr className="border-b border-ij-seam">
            <th className="p-2">Type</th>
            <th className="p-2">Field</th>
            <th className="p-2">Observed samples</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ type, field }) => (
            <tr
              key={field.observedKey}
              className="cursor-pointer border-b border-dashed border-ij-seam hover:bg-ij-hover-surface"
              onClick={() => onSelect({ kind: 'observed-field', key: field.observedKey })}
            >
              <td className="p-2 font-ij-mono text-ij-ink-info">{type.dataType}</td>
              <td className="p-2 font-ij-mono text-ij-ink">{field.key}</td>
              <td className="p-2">
                <ul className="flex flex-wrap gap-2">
                  {field.sampleValues.map((sample, index) => (
                    <li
                      key={`${field.observedKey}:${index}`}
                      className="rounded-ij-arc-underline bg-ij-raised px-2 py-1 font-ij-mono text-xs text-ij-ink"
                    >
                      {stringifySample(sample)}
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
