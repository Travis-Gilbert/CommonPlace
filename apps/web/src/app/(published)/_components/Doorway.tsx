'use client';

import { useState } from 'react';

import { gqlReferenceBlock } from '@/lib/commonplace-graphql';
import styles from '../published.module.css';

/**
 * The doorway (HANDOFF-PUBLISH D5): every published page carries an Open in
 * CommonPlace action. Signed-in visitors get the block referenced into their
 * space with origin provenance (not a silent copy). Signed-out visitors are sent
 * to sign-in and return here. Fork (an owned divergent copy) rides the same
 * action where the Grant permits it, labeled distinctly.
 */
export function Doorway({
  alias,
  signedIn,
  canFork,
}: {
  alias: string;
  signedIn: boolean;
  canFork: boolean;
}) {
  const [pending, setPending] = useState<'reference' | 'fork' | null>(null);
  const [done, setDone] = useState<{ id: string; fork: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const returnTo = `/p/${alias}`;

  async function act(fork: boolean) {
    if (!signedIn) {
      window.location.href = `/api/auth/signin?callbackUrl=${encodeURIComponent(returnTo)}`;
      return;
    }
    setError(null);
    setPending(fork ? 'fork' : 'reference');
    try {
      const id = await gqlReferenceBlock(alias, fork);
      setDone({ id, fork });
    } catch {
      setError('Could not open this in CommonPlace. Please try again.');
    } finally {
      setPending(null);
    }
  }

  if (done) {
    return (
      <div className={styles.doorway}>
        <span>
          {done.fork ? 'Forked into your CommonPlace.' : 'Referenced into your CommonPlace.'}
        </span>
        <a className={styles.doorwaySecondary} href="/">
          Go to CommonPlace
        </a>
      </div>
    );
  }

  return (
    <div className={styles.doorway}>
      <button
        type="button"
        className={styles.doorwayPrimary}
        disabled={pending !== null}
        onClick={() => act(false)}
      >
        {pending === 'reference' ? 'Opening...' : 'Open in CommonPlace'}
      </button>
      {canFork && (
        <button
          type="button"
          className={styles.doorwaySecondary}
          disabled={pending !== null}
          onClick={() => act(true)}
        >
          {pending === 'fork' ? 'Forking...' : 'Fork a copy'}
        </button>
      )}
      {!signedIn && (
        <span className={styles.doorwayNote}>
          Sign in to keep this block. It will be waiting after you sign in.
        </span>
      )}
      {error && <span className={styles.doorwayNote}>{error}</span>}
    </div>
  );
}
