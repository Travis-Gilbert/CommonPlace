'use client';

import SceneHost from '@/components/commonplace/scene-host/SceneHost';
import { patentCpuPayload } from '@/lib/scene-fixtures/patent-cpu';

export default function ScenePreviewPage() {
  return (
    <main
      className="commonplace-theme"
      style={{ maxWidth: 1120, margin: '0 auto', padding: '48px 24px 80px', display: 'grid', gap: 20 }}
    >
      <div style={{ display: 'grid', gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>Scene Preview: Patent Diagram</h1>
        <p style={{ margin: 0, color: 'var(--cp-text-muted)' }}>
          The &quot;how does a CPU work&quot; five-minute test (PT-033). Click a rubricated numeral to open its evidence
          panel, then Go deeper.
        </p>
      </div>
      <SceneHost payload={patentCpuPayload()} />
    </main>
  );
}
