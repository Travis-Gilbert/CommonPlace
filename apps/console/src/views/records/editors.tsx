'use client';

// SOURCING: Twenty inline field editors (structure only, register controls).
// Esc cancels, Enter commits except in textarea/json editors.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FieldType } from '@commonplace/data-model-contracts';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface FieldEditorProps {
  readonly fieldType: FieldType;
  readonly value: unknown;
  readonly onCommit: (next: unknown) => void;
  readonly onCancel: () => void;
  readonly autoFocus?: boolean;
}

function parseNumberInput(raw: string): number | null {
  if (!raw.trim()) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function FieldEditor({
  fieldType,
  value,
  onCommit,
  onCancel,
  autoFocus = true,
}: FieldEditorProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState(() => formatDraft(fieldType, value));

  useEffect(() => {
    if (!autoFocus) return;
    const node = rootRef.current?.querySelector<HTMLElement>('input, textarea, button[role="combobox"]');
    node?.focus();
  }, [autoFocus, fieldType.kind]);

  const commitDraft = useCallback(() => {
    onCommit(parseDraft(fieldType, draft));
  }, [draft, fieldType, onCommit]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCancel();
        return;
      }
      if (event.key === 'Enter' && fieldType.kind !== 'long_text' && fieldType.kind !== 'json') {
        if ((event.target as HTMLElement).tagName === 'TEXTAREA') return;
        event.preventDefault();
        event.stopPropagation();
        commitDraft();
      }
    },
    [commitDraft, fieldType.kind, onCancel],
  );

  switch (fieldType.kind) {
    case 'boolean':
      return (
        <div ref={rootRef} onKeyDown={onKeyDown}>
          <label className="inline-flex items-center gap-2 text-ij-ink">
            <Checkbox
              checked={draft === 'true'}
              onCheckedChange={(checked) => {
                const next = checked === true ? 'true' : 'false';
                setDraft(next);
                onCommit(parseDraft(fieldType, next));
              }}
            />
            {draft === 'true' ? 'Yes' : 'No'}
          </label>
        </div>
      );
    case 'integer':
    case 'number':
      return (
        <div ref={rootRef} onKeyDown={onKeyDown}>
          <Input
            type="number"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitDraft}
            className="h-ij-control font-ij-mono tabular-nums"
          />
        </div>
      );
    case 'date':
      return (
        <div ref={rootRef} onKeyDown={onKeyDown}>
          <Input
            type="date"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitDraft}
            className="h-ij-control font-ij-mono"
          />
        </div>
      );
    case 'timestamp':
      return (
        <div ref={rootRef} onKeyDown={onKeyDown}>
          <Input
            type="datetime-local"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitDraft}
            className="h-ij-control font-ij-mono"
          />
        </div>
      );
    case 'enum':
      return (
        <div ref={rootRef} onKeyDown={onKeyDown}>
          <Select
            value={draft || undefined}
            onValueChange={(next) => {
              setDraft(next);
              onCommit(next);
            }}
          >
            <SelectTrigger className="h-ij-control w-full">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {fieldType.variants.map((variant) => (
                <SelectItem key={variant} value={variant}>
                  {variant}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    case 'json':
    case 'geometry':
    case 'vector':
    case 'geo':
    case 'long_text':
      return (
        <div ref={rootRef} onKeyDown={onKeyDown}>
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitDraft}
            rows={4}
            className="font-ij-mono text-xs"
          />
        </div>
      );
    default:
      return (
        <div ref={rootRef} onKeyDown={onKeyDown}>
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitDraft}
            className="h-ij-control"
          />
        </div>
      );
  }
}

function formatDraft(fieldType: FieldType, value: unknown): string {
  if (value === null || value === undefined) return '';
  if (fieldType.kind === 'boolean') {
    return value === true || value === 'true' ? 'true' : 'false';
  }
  if (fieldType.kind === 'json' || fieldType.kind === 'geometry' || fieldType.kind === 'vector' || fieldType.kind === 'geo') {
    try {
      return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  if (fieldType.kind === 'timestamp' && value) {
    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime())) {
      const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
      return local.toISOString().slice(0, 16);
    }
  }
  if (fieldType.kind === 'date' && value) {
    const text = String(value);
    return text.length >= 10 ? text.slice(0, 10) : text;
  }
  return String(value);
}

function parseDraft(fieldType: FieldType, draft: string): unknown {
  switch (fieldType.kind) {
    case 'boolean':
      return draft === 'true';
    case 'integer':
    case 'number':
      // `?? 0` here turned "cleared" into a real zero, changing aggregates and
      // record semantics. An empty numeric field is absent, not zero; a
      // required-field constraint is the server's to enforce.
      return parseNumberInput(draft);
    case 'json':
    case 'geometry':
    case 'vector':
    case 'geo':
      try {
        return JSON.parse(draft);
      } catch {
        return draft;
      }
    default:
      return draft;
  }
}
