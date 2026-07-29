'use client';

// SOURCING: Twenty field cell projections plus tablecn read-only cell pattern.
// Maps every @commonplace/data-model-contracts FieldTypeKind to a ReactNode.

import type { ReactNode } from 'react';
import type { FieldType } from '@commonplace/data-model-contracts';
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

function renderUrlPill(value: string): ReactNode {
  return (
    <a
      href={value}
      target="_blank"
      rel="noreferrer"
      className="inline-flex max-w-full truncate rounded-ij-arc border border-ij-control-border px-2 py-0.5 font-ij-mono text-xs text-ij-link hover:bg-ij-hover-surface"
      onClick={(event) => event.stopPropagation()}
    >
      {value}
    </a>
  );
}

function renderRelation(value: unknown, ctx?: FieldCellContext): ReactNode {
  const entries = Array.isArray(value) ? value : value == null ? [] : [value];
  if (entries.length === 0) {
    return <span className="text-ij-ink-disabled">-</span>;
  }
  const visible = entries.slice(0, 3);
  const overflow = entries.length - visible.length;
  return (
    <span className="flex min-w-0 items-center gap-rec-sibling-gap">
      {visible.map((entry, index) => {
        const label = relationLabel(entry);
        const hue = ctx?.tint ? { tint: ctx.tint, ink: 'var(--ij-ink)' } : hueForTag(label);
        return (
          <RecordChip
            key={`${label}-${index}`}
            label={label}
            tint={hue.tint}
            ink={hue.ink}
          />
        );
      })}
      {overflow > 0 ? (
        <span className="font-ij-mono text-xs text-ij-ink-info">+{overflow}</span>
      ) : null}
    </span>
  );
}

function renderTruncatedJson(value: unknown, onInspect?: () => void): ReactNode {
  const raw = JSON.stringify(value);
  const preview = raw.length > 48 ? `${raw.slice(0, 45)}...` : raw;
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <span className="truncate font-ij-mono text-xs text-ij-ink-info" title={raw}>
        {preview}
      </span>
      {onInspect ? (
        <button
          type="button"
          className="shrink-0 rounded-ij-arc border border-ij-control-border px-1.5 text-xs text-ij-ink-info hover:bg-ij-hover-surface"
          onClick={(event) => {
            event.stopPropagation();
            onInspect();
          }}
        >
          Inspect
        </button>
      ) : null}
    </span>
  );
}

function renderTextFamily(value: unknown): ReactNode {
  const text = formatScalar(value);
  if (!text) return <span className="text-ij-ink-disabled">-</span>;
  if (isHttpUrl(text)) return renderUrlPill(text);
  return <span className="truncate">{text}</span>;
}

function renderDateLike(value: unknown): ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span className="text-ij-ink-disabled">-</span>;
  }
  const parsed = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    return <span className="font-ij-mono text-ij-ink-info">{formatScalar(value)}</span>;
  }
  return (
    <span className="font-ij-mono text-ij-ink-info">
      {parsed.toLocaleString()}
    </span>
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
  number: (value) => (
    <span className="font-ij-mono tabular-nums text-ij-ink">{formatScalar(value) || '-'}</span>
  ),
  integer: (value) => (
    <span className="font-ij-mono tabular-nums text-ij-ink">{formatScalar(value) || '-'}</span>
  ),
  boolean: (value) => {
    const yes = value === true || value === 'true' || value === 1 || value === '1';
    const no = value === false || value === 'false' || value === 0 || value === '0';
    const label = yes ? 'Yes' : no ? 'No' : formatScalar(value) || '-';
    if (!yes && !no && !value && value !== 0) {
      return <span className="text-ij-ink-disabled">-</span>;
    }
    return <RecordChip label={label} tint={yes ? 'var(--ij-ok-bg)' : 'var(--ij-row-gray)'} ink={yes ? 'var(--ij-ok)' : 'var(--ij-ink-info)'} />;
  },
  date: renderDateLike,
  timestamp: renderDateLike,
  enum: (value) => {
    const label = formatScalar(value) || '-';
    const hue = hueForTag(label);
    return <RecordChip label={label} tint={hue.tint} ink={hue.ink} />;
  },
  relation: (value, ctx) => renderRelation(value, ctx),
  json: (value, ctx) => renderTruncatedJson(value, ctx?.onInspectJson),
  geometry: (value, ctx) => renderTruncatedJson(value, ctx?.onInspectJson),
  vector: (value, ctx) => renderTruncatedJson(value, ctx?.onInspectJson),
  geo: (value, ctx) => renderTruncatedJson(value, ctx?.onInspectJson),
  noop: () => <span className="text-ij-ink-disabled">noop</span>,
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
