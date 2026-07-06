'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SceneRendererProps } from '../types';
import { validateVegaLiteChartSpec } from '../chartGate';

export default function ChartRenderer({ scenePackage }: SceneRendererProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const spec = useMemo(() => scenePackage.projection.params?.spec, [scenePackage]);
  const gate = useMemo(() => validateVegaLiteChartSpec(spec), [spec]);

  useEffect(() => {
    let cancelled = false;
    if (!ref.current || !gate.ok || !spec) return undefined;
    import('vega-embed')
      .then(({ default: vegaEmbed }) =>
        vegaEmbed(ref.current as HTMLDivElement, spec, {
          actions: false,
          config: {
            background: 'transparent',
            axis: {
              labelColor: 'var(--cp-text-muted)',
              titleColor: 'var(--cp-text)',
              gridColor: 'var(--cp-border-faint)',
            },
            view: {
              stroke: 'transparent',
            },
          },
        }),
      )
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [gate.ok, spec]);

  if (!gate.ok) {
    return <div className="cp-scene-validation-reason">{gate.reason}</div>;
  }
  if (error) return <div className="cp-scene-validation-reason">{error}</div>;
  return <div ref={ref} className="cp-scene-chart" />;
}
