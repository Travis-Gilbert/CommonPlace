// SOURCING: none — pure logic, no upstream component applies

'use client';

import type { EvidenceArtifact, ResultLane } from '@/lib/inquiry-types';
import { resultLaneTitle } from '@/lib/inquiry-types';
import InquiryArtifactCard from '@/components/inquiry/InquiryArtifactCard';

interface InquiryEvidenceLaneProps {
  lane: ResultLane;
  artifactsById: Map<string, EvidenceArtifact>;
  onPinArtifact?: (artifactId: string) => void;
  pinningArtifactId?: string | null;
}

export default function InquiryEvidenceLane({
  lane,
  artifactsById,
  onPinArtifact,
  pinningArtifactId,
}: InquiryEvidenceLaneProps) {
  const artifacts = lane.artifact_ids
    .map((id) => artifactsById.get(id))
    .filter((artifact): artifact is EvidenceArtifact => Boolean(artifact));

  if (!artifacts.length) return null;

  return (
    <section style={{ marginTop: 10 }}>
      <div className="cp-inquiry-group-label">{resultLaneTitle(lane.kind)}</div>
      {artifacts.map((artifact) => (
        <InquiryArtifactCard
          key={artifact.artifact_id}
          artifact={artifact}
          onPin={onPinArtifact}
          pinning={pinningArtifactId === artifact.artifact_id}
        />
      ))}
    </section>
  );
}
