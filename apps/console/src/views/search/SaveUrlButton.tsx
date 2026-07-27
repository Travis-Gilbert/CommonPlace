'use client';

// SOURCING: @commonplace/search-stack save transport. Confirmation is rendered
// inline so it remains in the console surface and names the receipt exactly.

import { useCallback, useEffect, useState } from 'react';
import type {
  SaveUrlReceipt,
  SearchStackClient,
} from '@commonplace/search-stack';
import { IconCheck, IconMemory } from '@/components/shell/icons';
import { consoleSearchClient } from './search-client';

export function savedConfirmation(receipt: SaveUrlReceipt): string {
  return `Saved to ${receipt.collectionName}`;
}

export function SaveUrlButton({
  url,
  client = consoleSearchClient,
  onSaved,
}: {
  readonly url: string | null | undefined;
  readonly client?: SearchStackClient;
  readonly onSaved?: (receipt: SaveUrlReceipt) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    readonly kind: 'success' | 'error';
    readonly text: string;
  } | null>(null);
  const trimmed = url?.trim() ?? '';
  const canSave = trimmed.length > 0 && trimmed !== 'https://';

  const save = useCallback(async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const receipt = await client.saveUrl(trimmed);
      if (!receipt.collectionName) {
        throw new Error('ingest returned no collection');
      }
      setMessage({ kind: 'success', text: savedConfirmation(receipt) });
      onSaved?.(receipt);
    } catch (error) {
      setMessage({
        kind: 'error',
        text: `Save failed: ${errorMessage(error)}`,
      });
    } finally {
      setSaving(false);
    }
  }, [canSave, client, onSaved, saving, trimmed]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void save();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [save]);

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => void save()}
        disabled={!canSave || saving}
        aria-label="Save this page"
        title="Save this page"
        className="inline-flex h-ij-control items-center gap-2 rounded-ij-arc border border-ij-control-border bg-ij-raised px-3 text-ij-ink hover:bg-ij-hover-surface disabled:text-ij-ink-disabled"
      >
        <IconMemory size={14} />
        {saving ? 'Saving' : 'Save'}
      </button>
      {message ? (
        <span
          role={message.kind === 'error' ? 'alert' : 'status'}
          className={message.kind === 'error' ? 'text-ij-error' : 'text-ij-ok'}
        >
          {message.kind === 'success' ? (
            <span className="mr-1 inline-flex"><IconCheck size={14} /></span>
          ) : null}
          {message.text}
        </span>
      ) : null}
    </span>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
