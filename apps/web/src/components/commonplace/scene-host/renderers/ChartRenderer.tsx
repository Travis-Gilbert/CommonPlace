// SOURCING: @observablehq/plot — canonical chart render (HANDOFF-CANON C3; replaces vega-embed)
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as Plot from '@observablehq/plot';
import type { SceneRendererProps } from '../types';
import { validateChartSpec } from '../chartGate';

function markName(spec: Record<string, unknown>): string {
  const mark = spec.mark;
  if (typeof mark === 'string') return mark;
  if (mark && typeof mark === 'object' && typeof (mark as { type?: string }).type === 'string') {
    return (mark as { type: string }).type;
  }
  return 'point';
}

function fieldOf(encoding: Record<string, unknown> | undefined, channel: string): string | null {
  const ch = encoding?.[channel];
  if (ch && typeof ch === 'object' && typeof (ch as { field?: string }).field === 'string') {
    return (ch as { field: string }).field;
  }
  return null;
}

function plotFromLegacySpec(spec: Record<string, unknown>): SVGSVGElement | HTMLElement | null {
  const data = (spec.data as { values?: unknown[] } | undefined)?.values;
  if (!Array.isArray(data) || data.length === 0) return null;
  const encoding = (spec.encoding ?? {}) as Record<string, unknown>;
  const x = fieldOf(encoding, 'x') ?? 'x';
  const y = fieldOf(encoding, 'y') ?? 'y';
  const color = fieldOf(encoding, 'color') ?? undefined;
  const mark = markName(spec);

  const marks: Plot.Markish[] = [];
  if (mark === 'bar' || mark === 'rect') {
    marks.push(Plot.barY(data, { x, y, fill: color ?? 'currentColor' }));
  } else if (mark === 'line' || mark === 'area') {
    marks.push(Plot.lineY(data, { x, y, stroke: color ?? 'currentColor' }));
    if (mark === 'area') marks.push(Plot.areaY(data, { x, y, fill: color ?? 'currentColor', fillOpacity: 0.2 }));
  } else {
    marks.push(Plot.dot(data, { x, y, fill: color ?? 'currentColor' }));
  }

  return Plot.plot({
    width: 640,
    height: 300,
    marks,
    style: { background: 'transparent', color: 'var(--cp-text, #222)' },
  });
}

export default function ChartRenderer({ scenePackage }: SceneRendererProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const spec = useMemo(() => scenePackage.projection.params?.spec, [scenePackage]);
  const gate = useMemo(() => validateChartSpec(spec), [spec]);

  useEffect(() => {
    const host = ref.current;
    if (!host || !gate.ok || !spec || typeof spec !== 'object') return undefined;
    host.replaceChildren();
    try {
      const node = plotFromLegacySpec(spec as Record<string, unknown>);
      if (!node) {
        setError('chart has no inline values');
        return undefined;
      }
      host.append(node);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
    return () => {
      host.replaceChildren();
    };
  }, [gate.ok, spec]);

  if (!gate.ok) {
    return <div className="cp-scene-validation-reason">{gate.reason}</div>;
  }
  if (error) return <div className="cp-scene-validation-reason">{error}</div>;
  return <div ref={ref} className="cp-scene-chart" />;
}
