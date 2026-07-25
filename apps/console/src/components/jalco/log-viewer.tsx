'use client';

// SOURCING: jal-co/ui LogViewer (ui.justinlevine.me/r/log-viewer.json). Structure
// extraction + Int UI reskin. Level color scales use --ij-* semantic inks;
// lucide icons replaced with text affordances. Sample-log generators omitted
// (no mock data in shipped surfaces). ViewSource: package jal-co/ui,
// component LogViewer, mode reskin, regime css-vars.

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export type LogEntry = {
  readonly id: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp?: string;
  readonly source?: string;
};

const LEVEL_INK: Record<LogLevel, string> = {
  debug: 'text-ij-ink-info',
  info: 'text-ij-ink',
  warn: 'text-ij-warn',
  error: 'text-ij-error',
  fatal: 'text-ij-error',
};

export type LogViewerProps = {
  readonly entries: readonly LogEntry[];
  readonly title?: string;
  readonly maxHeight?: number;
  readonly lineNumbers?: boolean;
  readonly timestamps?: boolean;
  readonly autoScroll?: boolean;
  readonly onClear?: () => void;
  readonly className?: string;
};

export function LogViewer({
  entries,
  title = 'Logs',
  maxHeight = 320,
  lineNumbers = true,
  timestamps = true,
  autoScroll = true,
  onClear,
  className,
}: LogViewerProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoScroll || !scrollerRef.current) return;
    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [entries, autoScroll]);

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-ij-arc border border-ij-seam-raised bg-ij-editor',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-ij-seam px-3 py-2">
        <p className="text-ij-island-section font-medium text-ij-ink">{title}</p>
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="font-ij-mono text-ij-ink-info hover:text-ij-ink"
          >
            clear
          </button>
        ) : null}
      </div>
      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 overflow-auto font-ij-mono"
        style={{ maxHeight }}
      >
        {entries.length === 0 ? (
          <p className="px-3 py-3 text-ij-ink-info">No log entries.</p>
        ) : (
          <ul className="flex flex-col">
            {entries.map((entry, index) => (
              <li
                key={entry.id}
                className="flex gap-2 border-b border-ij-seam px-3 py-1 hover:bg-ij-hover-surface"
              >
                {lineNumbers ? (
                  <span className="w-8 shrink-0 tabular-nums text-ij-ink-disabled">
                    {index + 1}
                  </span>
                ) : null}
                {timestamps && entry.timestamp ? (
                  <span className="w-24 shrink-0 tabular-nums text-ij-ink-info">
                    {entry.timestamp}
                  </span>
                ) : null}
                <span className={cn('w-12 shrink-0 uppercase', LEVEL_INK[entry.level])}>
                  {entry.level}
                </span>
                <span className={cn('min-w-0 flex-1 break-words', LEVEL_INK[entry.level])}>
                  {entry.source ? `[${entry.source}] ` : null}
                  {entry.message}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
