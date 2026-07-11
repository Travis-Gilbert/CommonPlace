'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { BadgeCheck, Fingerprint, RotateCcw } from 'lucide-react';
import type { GrowthSnapshot } from '@/lib/growth';
import styles from './growth.module.css';

export function GrowthCard({ card }: { readonly card: GrowthSnapshot['card'] }) {
  const [side, setSide] = useState<'face' | 'back'>('face');
  const { manifest, faceSvg } = card.bundle;
  const faceUrl = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(faceSvg)}`,
    [faceSvg],
  );

  return (
    <section className={styles.cardShell} aria-label="Signed harness card">
      <div className={styles.panelHeader}>
        <span className={styles.eyebrow}><BadgeCheck aria-hidden="true" /> Signed card</span>
        <button
          className={styles.quietButton}
          type="button"
          aria-pressed={side === 'back'}
          onClick={() => setSide((current) => current === 'face' ? 'back' : 'face')}
        >
          <RotateCcw aria-hidden="true" /> Show {side === 'face' ? 'provenance' : 'face'}
        </button>
      </div>
      <div className={styles.cardStage} data-side={side}>
        {side === 'face' ? (
          <Image
            className={styles.cardFace}
            src={faceUrl}
            alt={`${card.stats.form} harness card face`}
            width={600}
            height={840}
            unoptimized
          />
        ) : (
          <div className={styles.cardBack}>
            <div className={styles.cardSeal} aria-hidden="true">G{manifest.epochNumber}</div>
            <span className={styles.eyebrow}>Genesis cohort</span>
            <strong>{manifest.epochNumber} · {manifest.epochDate}</strong>
            <dl>
              <div><dt>Commit</dt><dd>{manifest.initialCommit.slice(0, 12)}</dd></div>
              <div><dt>Key</dt><dd>{manifest.ownerPublicFingerprint}</dd></div>
              <div><dt>Head</dt><dd>{manifest.lineageHead.slice(0, 12)}</dd></div>
            </dl>
            <blockquote>“{manifest.initialMessage}”</blockquote>
            <small><Fingerprint aria-hidden="true" /> Public material only</small>
          </div>
        )}
      </div>
    </section>
  );
}
