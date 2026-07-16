// SOURCING: none — pure logic, no upstream component applies

'use client';

interface InquiryProgressProps {
  query: string;
  status?: string;
}

export default function InquiryProgress({ query, status = 'running' }: InquiryProgressProps) {
  return (
    <div className="cp-inquiry-phase-row" style={{ marginTop: 10, flexDirection: 'column', alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
        <span className="cp-inquiry-phase-icon cp-inquiry-phase-icon--active">●</span>
        <span className="cp-inquiry-phase-label">Retrieving evidence</span>
        <span className="cp-inquiry-phase-detail">{status}</span>
      </div>
      <div className="cp-inquiry-searching" style={{ marginLeft: 22 }}>
        {query}
      </div>
    </div>
  );
}
