'use client';

// SOURCING: none. CH7: artifacts as message parts with open-in-canvas.

import { useMemo, useState } from 'react';
import type { BlockHost, ObjectQuery, ObjectRef, ObjectSet } from '@commonplace/block-view/types';
import { CONTAINS_EDGE } from '@commonplace/block-view/surface-tree';
import { createViewInstanceAction } from '@commonplace/block-view/surface-actions';
import { placeBlockAction } from '@/lib/block-placement';
import type { ChatArtifactPayload } from '@/lib/chat/project-types';
import { readLastConsoleViewPath } from '@/lib/chat/last-console-view';
import { cn } from '@/lib/cn';

export interface ArtifactPartProps {
  readonly host: BlockHost;
  readonly artifact: ChatArtifactPayload;
  readonly onPromoted?: (path: string) => void;
}

function descriptorFor(artifact: ChatArtifactPayload): { descriptorId: string; kind: string; title: string; query: ObjectQuery } {
  switch (artifact.kind) {
    case 'code':
      return {
        descriptorId: 'markdown.doc',
        kind: 'documents',
        title: `Code · ${artifact.language}`,
        query: { types: ['doc'] },
      };
    case 'records':
      return {
        descriptorId: 'record.table',
        kind: 'records',
        title: 'Records',
        query: { types: [...artifact.queryTypes] },
      };
    case 'plan':
      return {
        descriptorId: 'goal.stack',
        kind: 'plan',
        title: 'Plan',
        query: { types: ['goal'] },
      };
    case 'data-model':
      return {
        descriptorId: 'index.rail',
        kind: 'data-model',
        title: artifact.title || 'Data model',
        query: { types: ['model-scope'] },
      };
    case 'markdown':
    default:
      return {
        descriptorId: 'markdown.doc',
        kind: 'documents',
        title: 'Markdown',
        query: { types: ['doc'] },
      };
  }
}

export function ArtifactPart({ host, artifact, onPromoted }: ArtifactPartProps) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const codeText = artifact.kind === 'code' ? artifact.code : artifact.kind === 'markdown' ? artifact.markdown : '';

  const recordsPreview = useMemo(() => {
    if (artifact.kind !== 'records') return null;
    return artifact.queryTypes.join(', ');
  }, [artifact]);

  const openInCanvas = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const target = descriptorFor(artifact);
      const layoutHost = host as BlockHost & { queryLayout?: (query: ObjectQuery) => ObjectSet };
      const layout: ObjectSet = layoutHost.queryLayout
        ? layoutHost.queryLayout({ types: ['surface', 'region', 'view-instance'], live: true })
        : await host.query({ types: ['surface', 'region', 'view-instance'], live: true });
      const lastPath = readLastConsoleViewPath();
      const slug = lastPath.replace(/^\/v\//, '').replace(/^\//, '') || 'workspace';
      const surfaces = layout.objects.filter((object: ObjectRef) => object.type === 'surface');
      const surface =
        surfaces.find((candidate: ObjectRef) => candidate.id === slug || candidate.id === `view-${slug}` || candidate.id === `console-${slug}`)
        ?? surfaces.find((candidate: ObjectRef) => candidate.properties.active === true)
        ?? surfaces[0];
      if (!surface) return;
      const regions = layout.objects.filter(
        (object: ObjectRef) =>
          object.type === 'region'
          && (surface.relations?.[CONTAINS_EDGE] ?? []).includes(object.id),
      );
      const editor =
        regions.find((region: ObjectRef) => region.properties.kind === 'editor')
        ?? regions[0];
      if (!editor) return;
      const id = `chat.promote.${Date.now()}`;
      const created = await host.emit(
        createViewInstanceAction({
          id,
          descriptorId: target.descriptorId,
          title: target.title,
          query: target.query,
        }),
      );
      if (!created.ok) return;
      for (const action of placeBlockAction(id, {
        placement: 'ground',
        regionId: editor.id,
        order: (editor.relations?.[CONTAINS_EDGE] ?? []).length,
      })) {
        await host.emit(action);
      }
      const path = `/v/${encodeURIComponent(String(surface.properties.slug ?? surface.id.replace(/^view-/, '').replace(/^console-/, '')))}`;
      onPromoted?.(path);
      if (typeof window !== 'undefined') window.location.assign(path);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      data-chat-artifact={artifact.kind}
      className="my-3 overflow-hidden rounded-[var(--radius-control)] border border-ij-control-border bg-ij-raised"
    >
      <header className="flex items-center gap-2 border-b border-ij-seam px-3 py-1.5 text-ij-ink">
        <span className="flex-1" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
          {artifact.kind === 'code'
            ? artifact.language
            : artifact.kind === 'data-model'
              ? artifact.title
              : artifact.kind}
        </span>
        {codeText ? (
          <button
            type="button"
            className="h-ij-control rounded-[var(--radius-control)] border border-ij-control-border px-2 text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink"
            onClick={async () => {
              await navigator.clipboard.writeText(codeText);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1200);
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void openInCanvas()}
          className="h-ij-control rounded-[var(--radius-control)] border border-ij-control-border px-2 text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink disabled:opacity-50"
        >
          Open in canvas
        </button>
      </header>
      <div className={cn('px-3 py-2', artifact.kind === 'code' && 'font-ij-mono text-ij-ink')}>
        {artifact.kind === 'code' ? (
          <pre className="overflow-x-auto whitespace-pre-wrap text-ij-ink">{artifact.code}</pre>
        ) : null}
        {artifact.kind === 'markdown' ? (
          <div className="prose prose-invert max-w-none whitespace-pre-wrap text-ij-ink">{artifact.markdown}</div>
        ) : null}
        {artifact.kind === 'records' ? (
          <p className="text-ij-ink-info">
            Records table bound to query types: {recordsPreview}. Opens the live table on canvas.
          </p>
        ) : null}
        {artifact.kind === 'plan' ? (
          <ol className="grid gap-1">
            {artifact.steps.map((step) => (
              <li key={step.id} data-plan-status={step.status} className="text-ij-ink">
                {step.label}
              </li>
            ))}
          </ol>
        ) : null}
        {artifact.kind === 'data-model' ? (
          <p className="text-ij-ink-info">Data model diagram: {artifact.title}</p>
        ) : null}
      </div>
    </section>
  );
}
