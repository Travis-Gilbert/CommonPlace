'use client';

// SOURCING: jal-co/ui DiffViewer (ui.justinlevine.me/r/diff-viewer.json) on the
// `diff` package. Structure extraction + Int UI reskin. Added/removed lines
// use --ij-ok-bg / --ij-error-bg surfaces with matching inks. ViewSource:
// package jal-co/ui, component DiffViewer, mode reskin, regime css-vars.

import { diffLines } from 'diff';
import { cn } from '@/lib/cn';

export type DiffViewerProps = {
  readonly oldValue: string;
  readonly newValue: string;
  readonly oldTitle?: string;
  readonly newTitle?: string;
  readonly layout?: 'unified' | 'split';
  readonly className?: string;
};

type DiffRow = {
  readonly kind: 'added' | 'removed' | 'unchanged';
  readonly text: string;
};

function toRows(oldValue: string, newValue: string): DiffRow[] {
  const parts = diffLines(oldValue, newValue);
  const rows: DiffRow[] = [];
  for (const part of parts) {
    const kind: DiffRow['kind'] = part.added
      ? 'added'
      : part.removed
        ? 'removed'
        : 'unchanged';
    const lines = part.value.replace(/\n$/, '').split('\n');
    for (const line of lines) {
      rows.push({ kind, text: line });
    }
  }
  return rows;
}

const ROW_CLASS: Record<DiffRow['kind'], string> = {
  added: 'bg-ij-ok-bg text-ij-ok',
  removed: 'bg-ij-error-bg text-ij-error',
  unchanged: 'text-ij-ink',
};

const MARK: Record<DiffRow['kind'], string> = {
  added: '+',
  removed: '-',
  unchanged: ' ',
};

export function DiffViewer({
  oldValue,
  newValue,
  oldTitle = 'Before',
  newTitle = 'After',
  layout = 'unified',
  className,
}: DiffViewerProps) {
  const rows = toRows(oldValue, newValue);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-ij-arc border border-ij-seam-raised bg-ij-editor',
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-ij-seam px-3 py-2">
        <span className="text-ij-island-section font-medium text-ij-ink">{oldTitle}</span>
        <span className="font-ij-mono text-ij-ink-info" aria-hidden="true">
          →
        </span>
        <span className="text-ij-island-section font-medium text-ij-ink">{newTitle}</span>
        <span className="ml-auto font-ij-mono text-ij-ink-info">{layout}</span>
      </div>
      <pre className="overflow-auto font-ij-mono">
        {rows.map((row, index) => (
          <div key={`${index}-${row.kind}`} className={cn('flex px-3 py-0.5', ROW_CLASS[row.kind])}>
            <span className="w-4 shrink-0 select-none" aria-hidden="true">
              {MARK[row.kind]}
            </span>
            <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{row.text || ' '}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}
