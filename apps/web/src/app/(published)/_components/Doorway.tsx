'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import { gqlReferenceBlock } from '@/lib/commonplace-graphql';
import styles from '../published.module.css';

/**
 * The doorway (HANDOFF-PUBLISH D5): every published page carries an Open in
 * CommonPlace action. Signed-in visitors get the block referenced into their
 * space with origin provenance (not a silent copy, P5.1). Signed-out visitors
 * are sent to sign in; the intent rides through the auth return URL so the block
 * resolves immediately when they come back, without a second click (P5.2). Fork
 * (an owned divergent copy) rides the same action where the Grant permits it,
 * labeled distinctly, and is hidden where the Grant forbids it (P5.3).
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

  const act = useCallback(
    async (fork: boolean) => {
      if (!signedIn) {
        // Carry the intent through the auth round trip (P5.2): the block
        // resolves immediately on return.
        const returnTo = `/p/${alias}?carry=${fork ? 'fork' : 'reference'}`;
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
    },
    [alias, signedIn],
  );

  // On return from sign-in, complete the carried intent once, then clean the URL
  // so a refresh does not re-carry (P5.2).
  useEffect(() => {
    if (!signedIn || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const carry = params.get('carry');
    if (carry !== 'reference' && carry !== 'fork') return;
    params.delete('carry');
    const clean = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    window.history.replaceState(null, '', clean);
    void act(carry === 'fork');
  }, [signedIn, act]);

  if (done) {
    return (
      <div className={styles.doorway}>
        <span>
          {done.fork ? 'Forked into your CommonPlace.' : 'Referenced into your CommonPlace.'}
        </span>
        <Link className={styles.doorwaySecondary} href="/">
          Go to CommonPlace
        </Link>
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
