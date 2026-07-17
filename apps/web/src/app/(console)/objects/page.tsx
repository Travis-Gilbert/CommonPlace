'use client';

/* SPEC-OBJECT-CONTRACT-V2: a live object surface over the Rust commonplace-api.
 *
 * The arrangement is local objects; the data is a live query against the
 * substrate through HttpBlockHost -> POST /objects/query. Nothing above the
 * BlockHost seam differs from the in-memory surfaces. Point it at a running
 * commonplace-api with NEXT_PUBLIC_BLOCKVIEW_API_BASE (and _API_KEY if gated). */

import { useMemo } from 'react';
import SurfaceRenderer from '@/components/commonplace/surface/SurfaceRenderer';
import { HttpBlockHost } from '@/lib/block-view/host/HttpBlockHost';
import type { JsonValue, ObjectRef } from '@/lib/block-view/types';

const BASE = process.env.NEXT_PUBLIC_BLOCKVIEW_API_BASE;
const KEY = process.env.NEXT_PUBLIC_BLOCKVIEW_API_KEY;

function liveSurface(): ObjectRef[] {
  return [
    {
      id: 'live',
      type: 'surface',
      properties: { name: 'Live Objects', kind: 'page' },
      relations: { CONTAINS: ['live-main'] },
    },
    {
      id: 'live-main',
      type: 'region',
      properties: { layout: 'stack' },
      relations: { CONTAINS: ['live-table'] },
    },
    {
      id: 'live-table',
      type: 'view-instance',
      properties: {
        descriptor_id: 'table',
        title: 'All objects',
        query: { types: [], live: true } as unknown as JsonValue,
      },
    },
  ];
}

export default function LiveObjectsPage() {
  const host = useMemo(
    () => (BASE ? new HttpBlockHost({ baseUrl: BASE, apiKey: KEY }, liveSurface()) : null),
    [],
  );

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
          if the API is gated: to a running <code>commonplace-api</code> to go live. The arrangement
          and renderers above the BlockHost seam are identical to the in-memory surfaces.
        </p>
      </div>
    );
  }

  return <SurfaceRenderer surfaceId="live" host={host} chrome={false} />;
}
