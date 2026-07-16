// SOURCING: none — pure logic, no upstream component applies

'use client';

import { useMemo } from 'react';

import InquiryEvidenceLane from '@/components/inquiry/InquiryEvidenceLane';
import type { InquirySnapshot } from '@/lib/inquiry-types';
import { collectDegradationNotices } from '@/lib/inquiry-types';

interface InquiryResultViewProps {
  snapshot: InquirySnapshot;
  onPinArtifact?: (artifactId: string) => void;
  pinningArtifactId?: string | null;
}

export default function InquiryResultView({
  snapshot,
  onPinArtifact,
  pinningArtifactId,
}: InquiryResultViewProps) {
  const artifactsById = useMemo(() => {
    const map = new Map<string, (typeof snapshot.evidence)[number]>();
    for (const artifact of snapshot.evidence) {
      map.set(artifact.artifact_id, artifact);
    }
    return map;
  }, [snapshot.evidence]);

  const degradationNotices = collectDegradationNotices(snapshot);

  return (
    <div className="cp-inquiry-result-answer">
      <div className="cp-inquiry-result-label">Evidence for &ldquo;{snapshot.query}&rdquo;</div>
      <div className="cp-inquiry-result-summary">
        {snapshot.evidence.length} artifact{snapshot.evidence.length === 1 ? '' : 's'}
        {' · '}
        status {snapshot.retrieval_status}
      </div>

      {degradationNotices.length > 0 ? (
        <div className="cp-inquiry-result-gaps" style={{ marginTop: 8 }}>
          <div className="cp-inquiry-result-gaps-label">Limitations</div>
          {degradationNotices.map((reason) => (
            <div key={reason} className="cp-inquiry-result-gap-item">
              {reason}
            </div>
          ))}
        </div>
      ) : null}

      {snapshot.result_lanes.map((lane) => (
        <InquiryEvidenceLane
          key={lane.kind}
          lane={lane}
          artifactsById={artifactsById}
          onPinArtifact={onPinArtifact}
          pinningArtifactId={pinningArtifactId}
        />
      ))}
    </div>
  );
}
