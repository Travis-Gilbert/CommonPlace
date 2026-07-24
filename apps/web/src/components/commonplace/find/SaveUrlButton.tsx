'use client';

// SOURCING: sonner (toast) for the confirmation, the app-wide notification binding
// already mounted by the (commonplace) layout; react-hotkeys-hook for the keystroke,
// lucide-react for the button mark. The button is a plain element in the existing
// co-browse chrome row, so no upstream button component is introduced.

/**
 * One-click save (SPEC F4). A toolbar button plus a keystroke, both calling
 * `saveUrl` on the page the co-browse stage currently shows.
 *
 * The confirmation names the collection the ingest actually filed the page into,
 * read from `SaveUrlReceipt.collectionName`. There is no fallback string: a save
 * that returns no receipt renders an explicit error, because a placeholder
 * collection name would be a lie about where the page went.
 */

import { useCallback, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { toast } from 'sonner';
import { BookmarkPlus } from 'lucide-react';
import type { SaveUrlReceipt } from '@commonplace/block-view-contracts/search-stack';
import { saveUrl as saveUrlRequest } from '@/lib/search-stack/client';
import styles from './find.module.css';

export interface SaveUrlButtonProps {
  /** The page currently on the stage. Empty means there is nothing to save. */
  url: string | null | undefined;
  /** Called with the receipt on success, so the caller can log it in its rail. */
  onSaved?: (receipt: SaveUrlReceipt) => void;
}

/** The confirmation body, exported so its wording is testable without a toast host. */
export function savedConfirmation(receipt: SaveUrlReceipt): string {
  return `Saved to ${receipt.collectionName}`;
}

export function SaveUrlButton({ url, onSaved }: SaveUrlButtonProps) {
  const [saving, setSaving] = useState(false);
  const trimmed = url?.trim() ?? '';
  const canSave = trimmed.length > 0 && trimmed !== 'https://';

  const save = useCallback(async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const receipt = await saveUrlRequest(trimmed);
      if (!receipt?.collectionName) {
        // A receipt without a real collection name cannot be confirmed honestly.
        throw new Error('ingest returned no collection');
      }
      toast.success(savedConfirmation(receipt), { description: receipt.title || trimmed });
      onSaved?.(receipt);
    } catch (error) {
      toast.error(`Save failed: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  }, [canSave, saving, trimmed, onSaved]);

  useHotkeys(
    'mod+s',
    (event) => {
      event.preventDefault();
      void save();
    },
    { enableOnFormTags: true },
    [save],
  );

  return (
    <button
      type="button"
      className={styles.saveButton}
      onClick={() => void save()}
      disabled={!canSave || saving}
      aria-label="Save this page"
      title="Save this page"
    >
      <BookmarkPlus size={14} strokeWidth={1.75} aria-hidden="true" />
      {saving ? 'Saving' : 'Save'}
    </button>
  );
}
