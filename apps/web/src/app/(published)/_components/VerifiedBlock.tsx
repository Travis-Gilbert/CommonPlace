'use client';

import { useState } from 'react';

import type {
  BlockAttestationGql,
  ConformanceReportGql,
  PublishVisibility,
} from '@/lib/commonplace-graphql';
import styles from '../published.module.css';

/**
 * Quiet provenance affordance (HANDOFF-PUBLISH D2). Receipts beneath capability:
 * a small "verified block" control that expands to identity, signature,
 * conformance, and visibility. Never the headline.
 *
 * Provenance has three honest tiers, in order of strength:
 *  1. signature verified, tenant key  : cryptographically signed and trust rooted.
 *  2. signature verified, dev key     : cryptographically valid, not trust rooted.
 *  3. identity + conformance only     : no verifiable signature (degraded).
 * The dot and headline reflect the tier the block actually reached, so a dev
 * signature never reads as a trusted one and a broken signature degrades quietly
 * rather than lying.
 */
export function VerifiedBlock({
  blockId,
  versionHash,
  visibility,
  conformance,
  attestation,
  signatureVerified,
}: {
  blockId: string;
  versionHash: string;
  visibility: PublishVisibility;
  conformance: ConformanceReportGql;
  attestation?: BlockAttestationGql | null;
  signatureVerified?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const trusted = Boolean(signatureVerified) && attestation?.signingMode === 'tenant';
  const devSigned = Boolean(signatureVerified) && attestation?.signingMode === 'dev';
  const label = trusted
    ? 'Signed block'
    : devSigned
      ? 'Signed block (dev key)'
      : 'Verified block';
  const signatureState = !attestation
    ? 'none'
    : signatureVerified
      ? `verified (${attestation.signingMode} key)`
      : 'unverified (degraded to identity + conformance)';

  return (
    <div className={styles.provenance}>
      <button
        type="button"
        className={styles.provenanceBtn}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className={`${styles.verifiedDot} ${signatureVerified ? styles.verifiedDotSigned : ''}`}
          aria-hidden
        />
        {label} {open ? '(hide)' : '(details)'}
      </button>
      {open && (
        <div className={styles.provenanceDetail}>
          <div className={styles.provenanceRow}>
            <span className={styles.provenanceKey}>identity</span>
            <span className={styles.provenanceVal}>{versionHash}</span>
          </div>
          <div className={styles.provenanceRow}>
            <span className={styles.provenanceKey}>block id</span>
            <span className={styles.provenanceVal}>{blockId}</span>
          </div>
          <div className={styles.provenanceRow}>
            <span className={styles.provenanceKey}>signature</span>
            <span
              className={`${styles.provenanceVal} ${
                signatureVerified ? styles.checkPass : styles.checkFail
              }`}
            >
              {signatureState}
              {attestation ? (
                <span className={styles.provenanceSub}>
                  {attestation.algorithm} · {attestation.publicKeyHex.slice(0, 16)}...
                </span>
              ) : null}
            </span>
          </div>
          <div className={styles.provenanceRow}>
            <span className={styles.provenanceKey}>visibility</span>
            <span className={styles.provenanceVal}>{visibility.toLowerCase()}</span>
          </div>
          <div className={styles.provenanceRow}>
            <span className={styles.provenanceKey}>conformance</span>
            <span className={styles.provenanceVal}>
              {conformance.checks.map((c) => (
                <span
                  key={`${c.level}-${c.name}`}
                  className={c.passed ? styles.checkPass : styles.checkFail}
                  style={{ display: 'block' }}
                >
                  {c.passed ? 'pass' : 'fail'} {c.level} {c.name}: {c.detail}
                </span>
              ))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
