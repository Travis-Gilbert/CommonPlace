// SOURCING: hand-roll — Path lens ViewDescriptor over cosmos.gl; no upstream library models ancestor-chain selection on ObjectSet
'use client';

/**
 * PL2 Path view: registers against graph-shaped ObjectSets and renders the
 * canonical cosmos.gl canvas with Path lens dimming. Scope changes only the
 * pathTo resolver and readout label.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ViewRenderProps } from '@/lib/block-view/types';
import {
  formatPathReadout,
  isPathScope,
  PATH_SCOPES,
  type PathResult,
  type PathScope,
} from '@/lib/path/pathTo';
import {
  proposalSignalIds,
  type PathProposalReview,
} from '@/lib/path/proposal';
import {
  CosmosGraphCanvas,
  type CosmosGraphCanvasHandle,
} from '@/components/theseus/explorer/CosmosGraphCanvas';
import type { CosmoLink, CosmoPoint } from '@/components/theseus/explorer/useGraphData';

async function fetchPath(nodeId: string, scope: PathScope): Promise<PathResult> {
  const res = await fetch('/api/theorem/path', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nodeId, scope }),
  });
  const payload = (await res.json().catch(() => null)) as {
    ok?: boolean;
    result?: PathResult;
    error?: string;
  } | null;
  if (!res.ok || !payload?.ok || !payload.result) {
    throw new Error(payload?.error || `path ${res.status}`);
  }
  return payload.result;
}

function objectsToGraph(set: ViewRenderProps['set']): {
  points: CosmoPoint[];
  links: CosmoLink[];
} {
  const degree = new Map<string, number>();
  for (const obj of set.objects) {
    const relations = obj.relations ?? {};
    for (const targets of Object.values(relations)) {
      degree.set(obj.id, (degree.get(obj.id) ?? 0) + targets.length);
      for (const target of targets) {
        degree.set(target, (degree.get(target) ?? 0) + 1);
      }
    }
  }
  const points: CosmoPoint[] = set.objects.map((obj) => ({
    id: obj.id,
    label: typeof obj.properties.title === 'string' ? obj.properties.title : obj.id,
    type: obj.type,
    colorHex: '__missing__',
    degree: degree.get(obj.id) ?? 0,
  }));
  const links: CosmoLink[] = [];
  for (const obj of set.objects) {
    const relations = obj.relations ?? {};
    for (const [edge, targets] of Object.entries(relations)) {
      for (const target of targets) {
        links.push({ source: obj.id, target, weight: 1, edge_type: edge });
      }
    }
  }
  return { points, links };
}

export function PathGraphView({ set }: ViewRenderProps) {
  const canvasRef = useRef<CosmosGraphCanvasHandle | null>(null);
  const [scope, setScope] = useState<PathScope>('derivation');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [path, setPath] = useState<PathResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proposalStatus, setProposalStatus] = useState<string | null>(null);
  const [review, setReview] = useState<PathProposalReview | null>(null);
  const [lastCommit, setLastCommit] = useState<{
    commitId: string;
    parentCommitId?: string;
    repository?: Record<string, unknown>;
  } | null>(null);
  const { points, links } = useMemo(() => objectsToGraph(set), [set]);

  const applyPath = useCallback((nodeId: string | null, result: PathResult | null) => {
    const handle = canvasRef.current;
    if (!handle) return;
    if (!nodeId || !result) {
      handle.setPathChain(null);
      handle.setFocusedId(null);
      return;
    }
    handle.setFocusedId(nodeId);
    handle.setPathChain(result.chain.map((n) => n.id));
    handle.setLens('path');
  }, []);

  const loadPath = useCallback(
    async (nodeId: string, nextScope: PathScope) => {
      setError(null);
      try {
        const result = await fetchPath(nodeId, nextScope);
        setPath(result);
        applyPath(nodeId, result);
      } catch (err) {
        setPath(null);
        applyPath(null, null);
        setError(err instanceof Error ? err.message : 'path failed');
      }
    },
    [applyPath],
  );

  useEffect(() => {
    if (!selectedId) {
      setPath(null);
      applyPath(null, null);
      return;
    }
    void loadPath(selectedId, scope);
  }, [selectedId, scope, loadPath, applyPath]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedId(null);
        setPath(null);
        applyPath(null, null);
        setProposalStatus(null);
        setReview(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [applyPath]);

  const draftFromPath = useCallback(async () => {
    if (!path) return;
    setProposalStatus('drafting…');
    setReview(null);
    try {
      const res = await fetch('/api/theorem/path/proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'draft',
          draft: {
            title: `Path ${path.scope} ${selectedId ?? ''}`.trim(),
            nodes: path.chain,
            edges: path.chain.slice(0, -1).map((n, i) => ({
              source: n.id,
              target: path.chain[i + 1]!.id,
              kind: 'PREREQUISITE',
            })),
          },
          existingNodeIds: points.map((p) => p.id),
          existingEdges: links.map((l) => ({
            source: l.source,
            target: l.target,
            kind: l.edge_type,
          })),
        }),
      });
      const payload = (await res.json()) as {
        ok?: boolean;
        review?: PathProposalReview;
        error?: string;
      };
      if (!res.ok || !payload.ok || !payload.review) {
        throw new Error(payload.error || 'draft failed');
      }
      const nextReview = payload.review;
      setReview(nextReview);
      setProposalStatus(
        nextReview.validated
          ? `review ready · +${nextReview.diff.addedNodes.length} / -${nextReview.diff.removedNodes.length} nodes (signal = proposed)`
          : `draft invalid · ${nextReview.validationError ?? 'unknown'}`,
      );
      // Proposed nodes in signal (path chain + added); existing ancestry stays lit via setPathChain.
      const handle = canvasRef.current;
      if (handle && selectedId) {
        const { signalNodeIds } = proposalSignalIds(nextReview.diff);
        const signal = [
          ...path.chain.map((n) => n.id),
          ...signalNodeIds,
        ];
        handle.setFocusedId(selectedId);
        handle.setPathChain([...new Set(signal)]);
        handle.setLens('path');
      }
    } catch (err) {
      setProposalStatus(err instanceof Error ? err.message : 'draft failed');
    }
  }, [path, selectedId, points, links]);

  const applyDraft = useCallback(async () => {
    if (!review) {
      setProposalStatus('draft a proposal first');
      return;
    }
    setProposalStatus('applying…');
    try {
      const res = await fetch('/api/theorem/path/proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply',
          review,
          parentCommits: lastCommit ? [lastCommit.commitId] : undefined,
        }),
      });
      const payload = (await res.json()) as {
        ok?: boolean;
        result?: {
          commitId: string;
          parentCommitId?: string;
          repository?: Record<string, unknown>;
        };
        error?: string;
      };
      if (!res.ok || !payload.ok || !payload.result) {
        throw new Error(payload.error || 'apply failed');
      }
      setLastCommit(payload.result);
      setReview(null);
      setProposalStatus(`applied · commit ${payload.result.commitId}`);
    } catch (err) {
      setProposalStatus(err instanceof Error ? err.message : 'apply failed');
    }
  }, [lastCommit, review]);

  const scrubBack = useCallback(async () => {
    if (!lastCommit?.repository || !lastCommit.parentCommitId) {
      setProposalStatus('no prior commit to scrub');
      return;
    }
    setProposalStatus('scrubbing…');
    try {
      const res = await fetch('/api/theorem/path/proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rollback',
          repository: lastCommit.repository,
          targetCommit: lastCommit.parentCommitId,
        }),
      });
      const payload = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !payload.ok) throw new Error(payload.error || 'rollback failed');
      setProposalStatus(`restored · ${lastCommit.parentCommitId}`);
      setLastCommit(null);
    } catch (err) {
      setProposalStatus(err instanceof Error ? err.message : 'rollback failed');
    }
  }, [lastCommit]);

  const readout = path ? formatPathReadout(path) : 'select a node · Escape clears';

  return (
    <div className="flex h-full min-h-[28rem] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(PATH_SCOPES) as PathScope[]).map((id) => (
          <button
            key={id}
            type="button"
            className={`rounded-sm border px-2 py-1 text-xs ${
              scope === id
                ? 'border-foreground bg-foreground text-background'
                : 'border-border text-muted-foreground'
            }`}
            onClick={() => {
              if (!isPathScope(id)) return;
              setScope(id);
            }}
          >
            {PATH_SCOPES[id].label}
          </button>
        ))}
        <button
          type="button"
          className="rounded-sm border border-border px-2 py-1 text-xs"
          onClick={() => void draftFromPath()}
          disabled={!path}
        >
          Draft proposal
        </button>
        <button
          type="button"
          className="rounded-sm border border-border px-2 py-1 text-xs"
          onClick={() => void applyDraft()}
        >
          Apply
        </button>
        <button
          type="button"
          className="rounded-sm border border-border px-2 py-1 text-xs"
          onClick={() => void scrubBack()}
        >
          Scrub back
        </button>
      </div>
      <p className="font-mono text-xs text-muted-foreground" aria-live="polite">
        {error ? `path error: ${error}` : readout}
      </p>
      {proposalStatus ? (
        <p className="font-mono text-xs text-muted-foreground" aria-live="polite">
          {proposalStatus}
        </p>
      ) : null}
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-sm border border-border">
        <CosmosGraphCanvas
          ref={canvasRef}
          points={points}
          links={links}
          onPointClick={(id) => setSelectedId(id)}
        />
      </div>
    </div>
  );
}
