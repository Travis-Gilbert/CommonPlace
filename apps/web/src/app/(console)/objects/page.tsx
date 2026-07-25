'use client';

/* SPEC-OBJECT-CONTRACT-V2: a live object surface over the Rust commonplace-api.
 *
 * B6: arrangement and domain data both travel through HttpBlockHost ->
 * POST /objects/query|action. This page seeds a stable surface tree once, then
 * renders it. Point it at a running commonplace-api with
 * NEXT_PUBLIC_BLOCKVIEW_API_BASE (and _API_KEY if gated). */

import { useEffect, useMemo, useState } from 'react';
import SurfaceRenderer from '@/components/commonplace/surface/SurfaceRenderer';
import { HttpBlockHost } from '@/lib/block-view/host/HttpBlockHost';
import type { JsonValue } from '@/lib/block-view/types';

const BASE = process.env.NEXT_PUBLIC_BLOCKVIEW_API_BASE;
const KEY = process.env.NEXT_PUBLIC_BLOCKVIEW_API_KEY;

async function ensureLiveLayout(host: HttpBlockHost): Promise<void> {
  const existing = await host.query({
    types: ['surface', 'region', 'view-instance'],
    traverse: [{ edge: 'CONTAINS', dir: 'out' }],
  });
  if (existing.objects.some((object) => object.id === 'live')) return;

  const creates: Array<{ type: string; props: Record<string, JsonValue> }> = [
    {
      type: 'surface',
      props: { id: 'live', name: 'Live Objects', kind: 'page', title: 'Live Objects' },
    },
    {
      type: 'region',
      props: { id: 'live-main', layout: 'stack', title: 'Main' },
    },
    {
      type: 'view-instance',
      props: {
        id: 'live-table',
        title: 'All objects',
        descriptor_id: 'table',
        query: { types: [], live: true } as unknown as JsonValue,
      },
    },
  ];
  for (const create of creates) {
    await host.emit({ kind: 'create', type: create.type, props: create.props });
  }
  await host.emit({ kind: 'move', id: 'live-main', new_parent: 'live', order: 1 });
  await host.emit({ kind: 'move', id: 'live-table', new_parent: 'live-main', order: 1 });
}

export default function LiveObjectsPage() {
  const host = useMemo(
    () => (BASE ? new HttpBlockHost({ baseUrl: BASE, apiKey: KEY }) : null),
    [],
  );
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!host) return;
    let cancelled = false;
    void ensureLiveLayout(host)
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'layout seed failed');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [host]);

  if (!host) {
    return (
      <div style={{ padding: 'calc(var(--u) * 4)', maxWidth: '62ch', lineHeight: 1.6 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', marginBottom: 'var(--u)' }}>
          Live Objects
        </h1>
        <p style={{ color: 'var(--ink-dim)' }}>
          This surface renders live from the substrate through <code>HttpBlockHost</code> over{' '}
          <code>commonplace-api</code> (<code>POST /objects/query</code>). Set{' '}
          <code>NEXT_PUBLIC_BLOCKVIEW_API_BASE</code>: and <code>NEXT_PUBLIC_BLOCKVIEW_API_KEY</code>{' '}
          if the API is gated: to a running <code>commonplace-api</code> to go live. Arrangement and
          domain objects share the same /objects wire (B6).
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 'calc(var(--u) * 4)', color: 'var(--ink-dim)' }}>
        Could not seed layout: {error}
      </div>
    );
  }

  if (!ready) {
    return <div style={{ padding: 'calc(var(--u) * 4)' }} aria-busy="true">Loading arrangement...</div>;
  }

  return <SurfaceRenderer surfaceId="live" host={host} chrome={false} />;
}
