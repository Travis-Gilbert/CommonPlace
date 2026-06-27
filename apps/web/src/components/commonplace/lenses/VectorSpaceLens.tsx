'use client';

import { useEffect, useState } from 'react';
import { gqlVectorNeighbors, stableNumId, type VectorNeighborGql } from '@/lib/commonplace-graphql';
import { useLayout } from '@/lib/providers/layout-provider';
import type { LensViewProps } from './lens-types';

function titleFromText(text: string, fallback: string): string {
  const title = text.split(/\s+/).slice(0, 7).join(' ');
  return title || fallback;
}

export default function VectorSpaceLens({ ctx }: LensViewProps) {
  const { launchView } = useLayout();
  const [result, setResult] = useState<{
    key: string;
    status: 'ready' | 'error';
    neighbors: VectorNeighborGql[];
  }>({ key: '', status: 'ready', neighbors: [] });

  const status = result.key === ctx.objectSlug ? result.status : 'loading';
  const neighbors = result.key === ctx.objectSlug ? result.neighbors : [];

  useEffect(() => {
    let cancelled = false;
    gqlVectorNeighbors(ctx.objectSlug, 12)
      .then((hits) => {
        if (cancelled) return;
        setResult({ key: ctx.objectSlug, status: 'ready', neighbors: hits });
      })
      .catch(() => {
        if (!cancelled) {
          setResult({ key: ctx.objectSlug, status: 'error', neighbors: [] });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ctx.objectSlug]);

  const openObject = (hit: VectorNeighborGql) => {
    launchView(
      'object-detail',
      { objectRef: stableNumId(hit.row.identifier) },
      true,
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'var(--cp-font-body)' }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--cp-border-faint)', display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12, color: 'var(--cp-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ctx.objectTitle}
          </div>
          <div style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--cp-text-muted)' }}>
            semantic neighborhood
          </div>
        </div>
        <button
          type="button"
          onClick={() => launchView('vector-space', undefined, true)}
          style={{
            height: 28,
            padding: '0 10px',
            borderRadius: 7,
            border: '1px solid var(--cp-border-faint)',
            background: 'var(--cp-surface)',
            color: 'var(--cp-text)',
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 9,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            cursor: 'pointer',
          }}
        >
          Atlas
        </button>
      </div>

      <div className="cp-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 12 }}>
        {status === 'loading' && (
          <div style={{ color: 'var(--cp-text-muted)', fontSize: 12, fontStyle: 'italic' }}>
            Finding nearest embedded items...
          </div>
        )}
        {status === 'error' && (
          <div style={{ color: 'var(--cp-text-muted)', fontSize: 12 }}>
            Could not reach the vector index.
          </div>
        )}
        {status === 'ready' && neighbors.length === 0 && (
          <div style={{ color: 'var(--cp-text-muted)', fontSize: 12 }}>
            No vector neighbors yet. Re-ingest this item after embeddings are available.
          </div>
        )}
        {status === 'ready' && neighbors.length > 0 && neighbors.map((hit) => (
          <button
            key={hit.row.identifier}
            type="button"
            onClick={() => openObject(hit)}
            style={{
              width: '100%',
              display: 'block',
              textAlign: 'left',
              border: '1px solid var(--cp-border-faint)',
              borderRadius: 8,
              background: 'var(--cp-bg)',
              color: 'var(--cp-text)',
              padding: '9px 10px',
              marginBottom: 8,
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <strong style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {titleFromText(hit.row.text, hit.row.identifier)}
              </strong>
              <span style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 9, color: '#2D5F6B' }}>
                {Math.round(hit.score * 100)}%
              </span>
            </div>
            <div style={{ marginTop: 4, color: 'var(--cp-text-muted)', fontSize: 11, lineHeight: 1.35 }}>
              {hit.row.text}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
