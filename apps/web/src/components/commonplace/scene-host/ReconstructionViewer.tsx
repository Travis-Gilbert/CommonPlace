'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  gqlReconstructionRun,
  type ReconstructionRunGql,
} from '@/lib/commonplace-graphql';
import SceneHost from './SceneHost';
import {
  hasMixedProvenance,
  provenanceClass,
  RECONSTRUCTION_PROVENANCE,
  scenePackageForReconstruction,
  type ReconstructionProvenance,
} from './reconstruction-viewer';

interface ReconstructionViewerProps {
  runId: string;
  initialRun?: ReconstructionRunGql | null;
}

export default function ReconstructionViewer({ runId, initialRun = null }: ReconstructionViewerProps) {
  const [run, setRun] = useState<ReconstructionRunGql | null>(initialRun);
  const [loadedRunId, setLoadedRunId] = useState<string | null>(initialRun ? runId : null);
  const [error, setError] = useState<string | null>(null);
  const [visibleProvenance, setVisibleProvenance] = useState<Set<ReconstructionProvenance>>(
    () => new Set(RECONSTRUCTION_PROVENANCE),
  );

  useEffect(() => {
    const controller = new AbortController();
    gqlReconstructionRun(runId, controller.signal)
      .then((nextRun) => {
        if (!controller.signal.aborted) {
          setRun(nextRun);
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setRun(null);
          setError(reason instanceof Error ? reason.message : 'Unable to load reconstruction run.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedRunId(runId);
      });
    return () => controller.abort();
  }, [runId]);

  const visibleRun = loadedRunId === runId ? run : null;
  const loading = loadedRunId !== runId;
  const visibleError = loadedRunId === runId ? error : null;

  const provenanceCounts = useMemo(() => {
    const counts = new Map<ReconstructionProvenance, number>();
    for (const classification of RECONSTRUCTION_PROVENANCE) counts.set(classification, 0);
    for (const atom of visibleRun?.atoms ?? []) {
      const classification = provenanceClass(atom.provenance);
      counts.set(classification, (counts.get(classification) ?? 0) + 1);
    }
    return counts;
  }, [visibleRun]);
  const scenePackage = useMemo(
    () => (visibleRun ? scenePackageForReconstruction(visibleRun, visibleProvenance) : null),
    [visibleRun, visibleProvenance],
  );
  const showProvenanceLegend = visibleRun ? hasMixedProvenance(visibleRun) : false;

  const toggleProvenance = (classification: ReconstructionProvenance) => {
    setVisibleProvenance((current) => {
      const next = new Set(current);
      if (next.has(classification)) next.delete(classification);
      else next.add(classification);
      return next;
    });
  };

  if (loading && !visibleRun) return <div className="cp-reconstruction-viewer-state">Loading reconstruction run…</div>;
  if (visibleError && !visibleRun) return <div className="cp-reconstruction-viewer-state is-error">{visibleError}</div>;
  if (!visibleRun || !scenePackage) return <div className="cp-reconstruction-viewer-state">Reconstruction run not found.</div>;

  return (
    <section className="cp-reconstruction-viewer" aria-label={`Reconstruction run ${visibleRun.id}`}>
      <header className="cp-reconstruction-viewer-header">
        <div>
          <span className="cp-reconstruction-viewer-kicker">{visibleRun.domain || 'reconstruction'}</span>
          <h2>{visibleRun.subjectId || visibleRun.id}</h2>
          <p>{visibleRun.atoms.length} atoms · {visibleRun.stageReceipts.length} stage receipts</p>
        </div>
        {visibleError ? <p className="cp-reconstruction-viewer-error">{visibleError}</p> : null}
      </header>

      {showProvenanceLegend ? (
        <div className="cp-reconstruction-provenance" aria-label="Atom provenance filters">
          {RECONSTRUCTION_PROVENANCE.map((classification) => (
            <button
              key={classification}
              type="button"
              className={visibleProvenance.has(classification) ? 'is-active' : ''}
              aria-pressed={visibleProvenance.has(classification)}
              onClick={() => toggleProvenance(classification)}
            >
              <span className={`cp-reconstruction-provenance-swatch is-${classification.toLowerCase()}`} />
              {classification} ({provenanceCounts.get(classification) ?? 0})
            </button>
          ))}
        </div>
      ) : null}

      <SceneHost
        payload={{
          type: 'scene_package',
          tool: 'render_scene',
          scene_package: scenePackage,
          fallback_summary: 'The reconstruction scene could not be rendered.',
          validation: { ok: true },
        }}
      />

      <details className="cp-reconstruction-receipts">
        <summary>Stage receipts ({visibleRun.stageReceipts.length})</summary>
        <ol>
          {visibleRun.stageReceipts.map((receipt) => (
            <li key={receipt.id}>
              <strong>{receipt.stage}</strong>
              <span>{receipt.generationStamp}</span>
              <pre>{JSON.stringify(receipt.payload, null, 2)}</pre>
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}
