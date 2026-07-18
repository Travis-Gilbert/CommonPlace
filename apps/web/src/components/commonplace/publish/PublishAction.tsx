'use client';

/**
 * The publish moment in-product (HANDOFF-PUBLISH D4). One PublishAction that
 * lives wherever an artifact appears: an inline visibility choice (default
 * unlisted), oxblood register, one action to a working public URL, and a quiet
 * confirmation with one-press copy (P4.1/P4.2). After publishing, the artifact
 * shows its published state (link glyph + visibility) on revisit (P4.3), and the
 * publish event lands on the session rail with the receipt (P4.4).
 *
 * Every control is wired: publish calls the real mutation, copy writes the real
 * URL, and the published state reflects a real publish.
 */

import { useEffect, useState } from 'react';

import { appendRailEntry } from '@/lib/carry/session-rail';
import {
  gqlPublish,
  type PublishOutcomeGql,
  type PublishVisibility,
} from '@/lib/commonplace-graphql';
import styles from './publish-action.module.css';

const VISIBILITIES: PublishVisibility[] = ['UNLISTED', 'PUBLIC', 'PRIVATE'];
const VIS_LABEL: Record<PublishVisibility, string> = {
  UNLISTED: 'Unlisted',
  PUBLIC: 'Public',
  PRIVATE: 'Private',
};

interface PersistedPublish {
  url: string;
  alias: string;
  visibility: PublishVisibility;
}

const STORE_PREFIX = 'cp-published:';

function loadPersisted(originId: string): PersistedPublish | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${STORE_PREFIX}${originId}`);
    return raw ? (JSON.parse(raw) as PersistedPublish) : null;
  } catch {
    return null;
  }
}

function savePersisted(originId: string, value: PersistedPublish): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(`${STORE_PREFIX}${originId}`, JSON.stringify(value));
  } catch {
    // storage full or unavailable: the backend remains the source of truth.
  }
}

export function PublishAction({
  originId,
  sessionId,
  artifactTitle,
  defaultVisibility = 'UNLISTED',
}: {
  originId: string;
  /** Session whose rail records the publish event (P4.4), when in a session. */
  sessionId?: string | null;
  artifactTitle?: string;
  defaultVisibility?: PublishVisibility;
}) {
  const [visibility, setVisibility] = useState<PublishVisibility>(defaultVisibility);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<PersistedPublish | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  // Show the published state on revisit (P4.3).
  useEffect(() => {
    setPublished(loadPersisted(originId));
  }, [originId]);

  const publicUrl = (alias: string) =>
    typeof window !== 'undefined' ? `${window.location.origin}/p/${alias}` : `/p/${alias}`;

  const doPublish = async () => {
    setPublishing(true);
    setError(null);
    try {
      const outcome: PublishOutcomeGql = await gqlPublish(originId, visibility);
      if (!outcome.ok || !outcome.receipt) {
        setError(outcome.error ?? 'Publish was refused.');
        return;
      }
      const receipt = outcome.receipt;
      const record: PersistedPublish = {
        url: publicUrl(receipt.alias),
        alias: receipt.alias,
        visibility,
      };
      savePersisted(originId, record);
      setPublished(record);
      // The publish event lands on the session rail with its receipt (P4.4).
      if (sessionId) {
        await appendRailEntry(sessionId, {
          kind: 'publish',
          summary: `Published ${artifactTitle ? `"${artifactTitle}"` : 'an artifact'} (${VIS_LABEL[visibility].toLowerCase()})`,
          receipt: {
            url: record.url,
            alias: receipt.alias,
            visibility,
            versionHash: receipt.versionHash,
            signature: receipt.attestation?.signingMode ?? 'none',
          },
        });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Publish failed.');
    } finally {
      setPublishing(false);
    }
  };

  const copyUrl = async () => {
    if (!published) return;
    try {
      await navigator.clipboard.writeText(published.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Could not copy to clipboard.');
    }
  };

  // Published state: a quiet link glyph + visibility, expandable to the URL + copy.
  if (published) {
    return (
      <div className={styles.publish}>
        <button
          type="button"
          className={styles.publishedChip}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          title={published.url}
        >
          <span className={styles.linkGlyph} aria-hidden>
            &#128279;
          </span>
          <span>Published</span>
          <span className={styles.visTag}>{VIS_LABEL[published.visibility].toLowerCase()}</span>
        </button>
        {open ? (
          <div className={styles.confirm}>
            <a className={styles.url} href={published.url} target="_blank" rel="noreferrer">
              {published.url}
            </a>
            <button type="button" className={styles.copyButton} onClick={() => void copyUrl()}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.publish}>
      <div className={styles.controls}>
        <select
          className={styles.visSelect}
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as PublishVisibility)}
          aria-label="Visibility"
          disabled={publishing}
        >
          {VISIBILITIES.map((v) => (
            <option key={v} value={v}>
              {VIS_LABEL[v]}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={styles.publishButton}
          onClick={() => void doPublish()}
          disabled={publishing}
        >
          {publishing ? 'Publishing' : 'Publish'}
        </button>
      </div>
      {error ? <div className={styles.error}>{error}</div> : null}
    </div>
  );
}
