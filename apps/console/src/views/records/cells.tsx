'use client';

// SOURCING: twenty-ui (packages/twenty-ui, hard fork) — Chip, LinkChip, Tag,
// Status, Checkmark, and the json-visualizer node, one per field family. TU4
// re-seat: every hand-rolled span, pill, and truncation here is replaced by the
// fork primitive that already models it.
//
// The map itself stays: every @commonplace/data-model-contracts FieldTypeKind
// still resolves to exactly one ReactNode, and the renderer table is the same
// shape RecordTableView and RecordInspector already read.

import type { ReactNode } from 'react';
import type { FieldType } from '@commonplace/data-model-contracts';
import {
  Chip,
  ChipAccent,
  ChipSize,
  ChipVariant,
  LinkChip,
  Status,
} from 'twenty-ui/data-display';
import { LightButton } from 'twenty-ui/input';
import { RecordChip } from './RecordChip';
import { hueForTag } from './tints';

export interface FieldCellContext {
  readonly label?: string;
  readonly tint?: string;
  readonly onInspectJson?: () => void;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function formatScalar(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function relationLabel(entry: unknown): string {
  if (typeof entry === 'string') return entry;
  if (typeof entry === 'object' && entry !== null && !Array.isArray(entry)) {
    const record = entry as Record<string, unknown>;
    const title = record.title ?? record.label ?? record.name ?? record.id;
    if (typeof title === 'string' && title.length > 0) return title;
  }
  return formatScalar(entry);
}

/** A url cell is a navigable chip, not a bare anchor: LinkChip carries the
 *  click-outside id and the mouse-down navigation the records surface expects. */
function renderUrlChip(value: string): ReactNode {
  return (
    <LinkChip
      to={value}
      label={value}
      size={ChipSize.Small}
      variant={ChipVariant.Highlighted}
      accent={ChipAccent.TextSecondary}
      target="_blank"
    />
  );
}

function renderEmpty(): ReactNode {
  return <Chip label="" emptyLabel="-" size={ChipSize.Small} variant={ChipVariant.Transparent} />;
}

function renderRelation(value: unknown, ctx?: FieldCellContext): ReactNode {
  const entries = Array.isArray(value) ? value : value == null ? [] : [value];
  if (entries.length === 0) return renderEmpty();
  const visible = entries.slice(0, 3);
  const overflow = entries.length - visible.length;
  return (
    <span className="flex min-w-0 items-center gap-rec-sibling-gap">
      {visible.map((entry, index) => {
        const label = relationLabel(entry);
        return (
          <RecordChip
            key={`${label}-${index}`}
            label={label}
            color={ctx?.label ? hueForTag(ctx.label) : undefined}
          />
        );
      })}
      {overflow > 0 ? (
        <Chip
          label={`+${overflow}`}
          size={ChipSize.Small}
          variant={ChipVariant.Transparent}
          accent={ChipAccent.TextSecondary}
        />
      ) : null}
    </span>
  );
}

function renderTruncatedJson(value: unknown, onInspect?: () => void): ReactNode {
  const raw = JSON.stringify(value);
  const preview = raw.length > 48 ? `${raw.slice(0, 45)}...` : raw;
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <Chip
        label={preview}
        size={ChipSize.Small}
        variant={ChipVariant.Transparent}
        accent={ChipAccent.TextSecondary}
        maxWidth={280}
      />
      {onInspect ? (
        <LightButton
          title="Inspect"
          accent="tertiary"
          onClick={(event) => {
            event.stopPropagation();
            onInspect();
          }}
        />
      ) : null}
    </span>
  );
}

function renderTextFamily(value: unknown): ReactNode {
  const text = formatScalar(value);
  if (!text) return renderEmpty();
  if (isHttpUrl(text)) return renderUrlChip(text);
  return <span className="truncate">{text}</span>;
}

function renderNumeric(value: unknown): ReactNode {
  const text = formatScalar(value);
  if (!text) return renderEmpty();
  return <span className="font-ij-mono tabular-nums text-ij-ink">{text}</span>;
}

function renderDateLike(value: unknown): ReactNode {
  if (value === null || value === undefined || value === '') return renderEmpty();
  const parsed = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    return <span className="font-ij-mono text-ij-ink-info">{formatScalar(value)}</span>;
  }
  return (
    <span className="font-ij-mono text-ij-ink-info">{parsed.toLocaleString()}</span>
  );
}

export type CellRendererMap = {
  readonly [K in FieldType['kind']]: (value: unknown, ctx?: FieldCellContext) => ReactNode;
};

const CELL_RENDERERS: CellRendererMap = {
  text: renderTextFamily,
  long_text: renderTextFamily,
  lc_text: renderTextFamily,
  uuid: renderTextFamily,
  ip: renderTextFamily,
  soundex: renderTextFamily,
  metaphone: renderTextFamily,
  number: renderNumeric,
  integer: renderNumeric,
  boolean: (value) => {
    const yes = value === true || value === 'true' || value === 1 || value === '1';
    const no = value === false || value === 'false' || value === 0 || value === '0';
    if (!yes && !no && !value && value !== 0) return renderEmpty();
    // A boolean is a state, not a label: Status is the fork's state pill.
    return <Status color={yes ? 'green' : 'gray'} text={yes ? 'Yes' : 'No'} />;
  },
  date: renderDateLike,
  timestamp: renderDateLike,
  enum: (value) => {
    const label = formatScalar(value) || '-';
    return <RecordChip label={label} />;
  },
  relation: (value, ctx) => renderRelation(value, ctx),
  json: (value, ctx) => renderTruncatedJson(value, ctx?.onInspectJson),
  geometry: (value, ctx) => renderTruncatedJson(value, ctx?.onInspectJson),
  vector: (value, ctx) => renderTruncatedJson(value, ctx?.onInspectJson),
  geo: (value, ctx) => renderTruncatedJson(value, ctx?.onInspectJson),
  // A `noop` field has no renderer, which is not the same as an empty value.
  // Rendering "-" here would read as "this record has nothing in this field",
  // so the kind stays on the face of the chip.
  noop: () => (
    <Chip
      label="noop"
      size={ChipSize.Small}
      variant={ChipVariant.Transparent}
      accent={ChipAccent.TextSecondary}
    />
  ),
};

export function renderFieldCell(
  fieldType: FieldType,
  value: unknown,
  ctx?: FieldCellContext,
): ReactNode {
  try {
    const renderer = CELL_RENDERERS[fieldType.kind];
    if (renderer) return renderer(value, ctx);
    const label = ctx?.label ?? fieldType.kind;
    const raw = JSON.stringify(value);
    return (
      <span className="truncate font-ij-mono text-xs text-ij-ink-info" title={`${label}: ${raw}`}>
        {label}: {raw}
      </span>
    );
  } catch {
    const fallback = (() => {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    })();
    return (
      <span className="truncate font-ij-mono text-xs text-ij-ink-info">
        {ctx?.label ?? fieldType.kind}: {fallback}
      </span>
    );
  }
}

export { CELL_RENDERERS };
