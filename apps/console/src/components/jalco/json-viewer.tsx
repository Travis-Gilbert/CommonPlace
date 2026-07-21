'use client';

// SOURCING: jal-co/ui JsonViewer (ui.justinlevine.me/r/json-viewer.json).
// Structure extraction + Int UI reskin. Upstream Shiki/popular theme hex maps
// are dropped; type inks use --ij-* semantic tokens. ViewSource: package
// jal-co/ui, component JsonViewer, mode reskin, regime css-vars.

import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';

export type JsonViewerProps = {
  readonly data: unknown;
  readonly title?: string;
  readonly rootName?: string;
  readonly defaultExpanded?: boolean;
  readonly className?: string;
};

function typeInk(value: unknown): string {
  if (value === null) return 'text-ij-ink-disabled';
  switch (typeof value) {
    case 'string':
      return 'text-ij-ok';
    case 'number':
      return 'text-ij-link';
    case 'boolean':
      return 'text-ij-warn';
    case 'object':
      return 'text-ij-ink';
    default:
      return 'text-ij-ink-info';
  }
}

function preview(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (typeof value === 'object') return `Object(${Object.keys(value as object).length})`;
  if (typeof value === 'string') return JSON.stringify(value);
  return String(value);
}

function JsonNode({
  keyName,
  value,
  depth,
  defaultExpanded,
}: {
  readonly keyName: string | null;
  readonly value: unknown;
  readonly depth: number;
  readonly defaultExpanded: boolean;
}) {
  const isExpandable =
    value !== null &&
    typeof value === 'object' &&
    (Array.isArray(value) || Object.keys(value as object).length > 0);
  const [open, setOpen] = useState(defaultExpanded && depth < 2);

  const entries = useMemo(() => {
    if (!isExpandable || value === null || typeof value !== 'object') return [];
    return Array.isArray(value)
      ? value.map((item, index) => [String(index), item] as const)
      : Object.entries(value as Record<string, unknown>);
  }, [isExpandable, value]);

  return (
    <div style={{ paddingLeft: depth === 0 ? 0 : 12 }}>
      <button
        type="button"
        className={cn(
          'flex w-full items-start gap-1.5 py-0.5 text-left font-ij-mono hover:bg-ij-hover-surface',
          !isExpandable && 'cursor-default',
        )}
        onClick={() => {
          if (isExpandable) setOpen((prev) => !prev);
        }}
        disabled={!isExpandable}
      >
        <span className="w-3 shrink-0 text-ij-ink-info" aria-hidden="true">
          {isExpandable ? (open ? '▾' : '▸') : ' '}
        </span>
        {keyName !== null ? <span className="text-ij-room">{keyName}</span> : null}
        {keyName !== null ? <span className="text-ij-ink-info">: </span> : null}
        <span className={typeInk(value)}>
          {isExpandable && open ? (Array.isArray(value) ? '[' : '{') : preview(value)}
        </span>
      </button>
      {isExpandable && open ? (
        <div>
          {entries.map(([childKey, childValue]) => (
            <JsonNode
              key={childKey}
              keyName={childKey}
              value={childValue}
              depth={depth + 1}
              defaultExpanded={defaultExpanded}
            />
          ))}
          <div className="font-ij-mono text-ij-ink-info" style={{ paddingLeft: 12 }}>
            {Array.isArray(value) ? ']' : '}'}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function JsonViewer({
  data,
  title,
  rootName = 'root',
  defaultExpanded = true,
  className,
}: JsonViewerProps) {
  return (
    <div
      className={cn(
        'overflow-auto rounded-ij-arc border border-ij-seam-raised bg-ij-editor px-3 py-2',
        className,
      )}
    >
      {title ? <p className="mb-2 text-ij-island-section font-medium text-ij-ink">{title}</p> : null}
      <JsonNode keyName={rootName} value={data} depth={0} defaultExpanded={defaultExpanded} />
    </div>
  );
}
