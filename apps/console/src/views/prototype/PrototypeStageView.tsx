'use client';

// SOURCING: @rerun-io/web-viewer 0.35.0. Rerun owns the canvas, timeline
// scrub, and entity selection; this view only mounts into a measured
// parentElement and posts explicit ViewSelectionEvent payloads upstream.
// SPEC-THEOREM-PROTOTYPE-PIPELINE-1.0 C1 / C1-COMMONPLACE-BOUNDARY.

import { useEffect, useRef, useState } from 'react';
import type { JsonValue, ViewRenderProps } from '@commonplace/block-view/types';
import type { ProgramDefinition } from '@commonplace/program-contracts';
import { postViewSelection } from '@/views/program/programClient';
import { prototypeRecordingUrl } from './recordingUrl';
import {
  buildExplicitViewSelection,
  pickPrimaryEntitySelection,
  type ViewerSelectionChange,
} from './resolveSelectionExprId';

type WebViewerHandle = {
  start: (
    rrd: string | string[] | null,
    parent: HTMLElement,
    options?: { width?: string; height?: string },
  ) => Promise<void>;
  stop: () => void;
  on: (
    event: 'selection_change' | 'ready',
    callback: ((event: ViewerSelectionChange) => void) | (() => void),
  ) => void;
};

/** Rerun needs real CSS size at start(); a 0×0 flex slot paints a blank canvas. */
async function waitForViewerSlot(
  container: HTMLElement,
  signal: { disposed: boolean },
): Promise<{ width: string; height: string }> {
  const MIN = 64;
  for (let attempt = 0; attempt < 90; attempt += 1) {
    if (signal.disposed) return { width: '100%', height: '100%' };
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width >= MIN && height >= MIN) {
      return { width: `${width}px`, height: `${height}px` };
    }
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
  // Last resort: force a visible slot so start() is not 1×1.
  container.style.minHeight = '480px';
  return {
    width: `${Math.max(container.clientWidth, 640)}px`,
    height: `${Math.max(container.clientHeight, 480)}px`,
  };
}

function asStringRecord(value: JsonValue | undefined): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string' && entry.trim()) out[key] = entry;
  }
  return out;
}

function readProps(instance: ViewRenderProps['instance']): {
  recordingId: string | null;
  recordingUrl: string | null;
  gatewayBase: string | null;
  pathToExpr: Record<string, string>;
  viewNodeId: string | null;
  programId: string | null;
  definition: ProgramDefinition | null;
} {
  const properties = instance?.properties ?? {};
  const configRaw = properties.config;
  const config =
    configRaw && typeof configRaw === 'object' && !Array.isArray(configRaw)
      ? (configRaw as Record<string, JsonValue>)
      : properties;

  const recordingId =
    typeof config.recording_id === 'string' ? config.recording_id : null;
  const recordingUrl =
    typeof config.recording_url === 'string' ? config.recording_url : null;
  const gatewayBase =
    typeof config.gateway_base === 'string' ? config.gateway_base : null;
  const viewNodeId =
    typeof config.view_node_id === 'string' ? config.view_node_id : null;
  const programId =
    typeof config.program_id === 'string' ? config.program_id : null;
  const pathToExpr = asStringRecord(
    (config.path_to_expr ?? config.pathToExpr) as JsonValue | undefined,
  );
  const definitionRaw = config.definition;
  const definition =
    definitionRaw && typeof definitionRaw === 'object' && !Array.isArray(definitionRaw)
      ? (definitionRaw as unknown as ProgramDefinition)
      : null;

  return {
    recordingId,
    recordingUrl,
    gatewayBase,
    pathToExpr,
    viewNodeId,
    programId,
    definition,
  };
}

export function PrototypeStageView(props: ViewRenderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<WebViewerHandle | null>(null);
  const pathToExprRef = useRef<Record<string, string>>({});
  const [status, setStatus] = useState<string>('Mounting viewer…');
  const [error, setError] = useState<string | null>(null);
  const [lastExprId, setLastExprId] = useState<string | null>(null);

  const attrs = readProps(props.instance);
  pathToExprRef.current = attrs.pathToExpr;

  const rrdUrl = prototypeRecordingUrl({
    recordingId: attrs.recordingId,
    recordingUrl: attrs.recordingUrl,
    gatewayBase: attrs.gatewayBase,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!rrdUrl) {
      setError(
        'prototype.stage needs recording_url or recording_id plus NEXT_PUBLIC_THEOREM_GATEWAY_URL / gateway_base.',
      );
      setStatus('Unavailable');
      return;
    }

    const signal = { disposed: false };
    let resizeObserver: ResizeObserver | null = null;

    setError(null);
    setStatus('Loading recording…');

    void import('@rerun-io/web-viewer')
      .then(async ({ WebViewer }) => {
        if (signal.disposed) return;
        const viewer = new WebViewer() as WebViewerHandle;
        viewerRef.current = viewer;

        const size = await waitForViewerSlot(container, signal);
        if (signal.disposed) {
          viewer.stop();
          return;
        }

        await viewer.start(rrdUrl, container, size);
        if (signal.disposed) {
          viewer.stop();
          return;
        }

        viewer.on('selection_change', (event) => {
          void handleSelectionChange(event as ViewerSelectionChange);
        });
        viewer.on('ready', () => {
          if (!signal.disposed) setStatus('Ready');
        });

        resizeObserver = new ResizeObserver(() => {
          // WebViewer sizes from start options; restart is heavy. Keep the
          // measured slot full-bleed and let the canvas CSS fill it.
          container.style.width = '100%';
          container.style.height = '100%';
        });
        resizeObserver.observe(container);
        // start() resolved; ready may already have fired or fire next.
        setStatus((current) => (current === 'Loading recording…' ? 'Ready' : current));
      })
      .catch((cause: unknown) => {
        if (!signal.disposed) {
          setError(cause instanceof Error ? cause.message : 'Web viewer unavailable');
          setStatus('Unavailable');
        }
      });

    async function handleSelectionChange(event: ViewerSelectionChange) {
      const primary = pickPrimaryEntitySelection(event);
      if (!primary) {
        setLastExprId(null);
        return;
      }
      const selection = buildExplicitViewSelection(primary, pathToExprRef.current);
      if (!selection) {
        setError(
          `Selection at ${primary.entity_path ?? '(unknown)'} has no expr_id. Supply path_to_expr on the view-instance or a payload expr_id.`,
        );
        setLastExprId(null);
        return;
      }

      setError(null);
      setLastExprId(selection.expr_id);
      void props.host.emit({ kind: 'select', ids: [selection.expr_id] });

      if (!attrs.definition || !attrs.viewNodeId) {
        setStatus('Selected (graph post skipped: missing definition / view_node_id)');
        return;
      }

      try {
        await postViewSelection({
          definition: attrs.definition,
          viewNodeId: attrs.viewNodeId,
          selection,
          programId: attrs.programId,
        });
        setStatus(`Posted selection → ${selection.expr_id}`);
      } catch (cause: unknown) {
        setError(cause instanceof Error ? cause.message : String(cause));
        setStatus('Selection post failed');
      }
    }

    return () => {
      signal.disposed = true;
      resizeObserver?.disconnect();
      viewerRef.current?.stop();
      viewerRef.current = null;
    };
    // Re-mount when the recording identity changes; host/definition identity
    // is read through refs/closures refreshed by attrs above.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rrdUrl is the mount key
  }, [rrdUrl, props.host, attrs.definition, attrs.viewNodeId, attrs.programId]);

  return (
    <div
      className="relative flex h-full min-h-[480px] flex-col bg-ij-editor text-ij-ink"
      data-prototype-stage
      data-prototype-status={status}
      data-prototype-expr-id={lastExprId ?? ''}
    >
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-ij-seam-raised px-3 py-2 text-ij-ink-info">
        <span className="font-ij-mono text-xs" data-prototype-status-label>{status}</span>
        {rrdUrl ? (
          <span className="max-w-[40ch] truncate font-ij-mono text-[10px] text-ij-ink-info" title={rrdUrl}>
            {rrdUrl}
          </span>
        ) : null}
        {lastExprId ? (
          <span className="font-ij-mono text-xs text-ij-ink" data-prototype-expr>
            expr_id={lastExprId}
          </span>
        ) : null}
        {error ? <span className="text-xs text-ij-error" data-prototype-error>{error}</span> : null}
      </div>
      <div
        ref={containerRef}
        className="relative min-h-[420px] w-full flex-1 overflow-hidden"
        data-prototype-viewer
      />
    </div>
  );
}
