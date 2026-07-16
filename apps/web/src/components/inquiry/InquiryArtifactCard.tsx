// SOURCING: none — pure logic, no upstream component applies

'use client';

import type { EvidenceArtifact } from '@/lib/inquiry-types';

interface InquiryArtifactCardProps {
  artifact: EvidenceArtifact;
  onPin?: (artifactId: string) => void;
  pinning?: boolean;
}

export default function InquiryArtifactCard({
  artifact,
  onPin,
  pinning = false,
}: InquiryArtifactCardProps) {
  const href = artifact.canonical_uri ?? artifact.provenance.source_uri ?? undefined;

  return (
    <article className="cp-inquiry-result-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', width: '100%' }}>
        <span className="cp-inquiry-result-dot" style={{ background: 'var(--cp-accent)' }} />
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="cp-inquiry-result-title"
            style={{ textDecoration: 'none' }}
          >
            {artifact.title}
          </a>
        ) : (
          <span className="cp-inquiry-result-title">{artifact.title}</span>
        )}
        <span className="cp-inquiry-result-type">{artifact.source_kind.replace(/_/g, ' ')}</span>
      </div>
      {artifact.snippet ? (
        <p className="cp-inquiry-suggestion-meta" style={{ margin: '6px 0 0 22px' }}>
          {artifact.snippet}
        </p>
      ) : null}
      <div className="cp-inquiry-actions" style={{ marginTop: 6, justifyContent: 'flex-start' }}>
        {onPin && artifact.lifecycle !== 'pinned' ? (
          <button
            type="button"
            className="cp-inquiry-action-btn"
            disabled={pinning}
            onClick={() => onPin(artifact.artifact_id)}
          >
            PIN
          </button>
        ) : null}
        {artifact.lifecycle === 'pinned' ? (
          <span className="cp-inquiry-result-type">pinned</span>
        ) : null}
      </div>
    </article>
  );
}
