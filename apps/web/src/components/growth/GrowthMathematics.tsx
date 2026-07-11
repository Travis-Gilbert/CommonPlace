'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { GrowthSnapshot } from '@/lib/growth';
import styles from './growth.module.css';

const GrowthGraphCanvas = dynamic(
  () => import('./GrowthGraphCanvas').then((module) => module.GrowthGraphCanvas),
  { ssr: false },
);

export function GrowthMathematics({ snapshot }: { readonly snapshot: GrowthSnapshot }) {
  const [rendererAvailable, setRendererAvailable] = useState<boolean | null>(null);
  const positions = useMemo(() => {
    const total = Math.max(snapshot.graphNodes.length, 1);
    return new Map(snapshot.graphNodes.map((node, index) => {
      const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
      const radius = index === 0 ? 0 : 34;
      return [node.id, { x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius }];
    }));
  }, [snapshot.graphNodes]);

  return (
    <section className={styles.panel} aria-labelledby="growth-math-title">
      <div className={styles.panelHeader}>
        <div>
          <span className={styles.eyebrow}>Live mathematics</span>
          <h2 id="growth-math-title">Watch the fold</h2>
        </div>
        <small>{snapshot.graphNodes.filter((node) => node.ready).length} ready</small>
      </div>
      <div className={styles.mathGrid}>
        <div className={styles.graphFrame} data-renderer={rendererAvailable === false ? 'fallback' : 'cosmos'}>
          <GrowthGraphCanvas
            nodes={snapshot.graphNodes}
            edges={snapshot.graphEdges}
            onStatusChange={setRendererAvailable}
          />
          {rendererAvailable !== true ? (
            <svg className={styles.graphFallback} viewBox="0 0 100 100" role="img" aria-labelledby="growth-graph-fallback-title">
              <title id="growth-graph-fallback-title">Static map of harness learning contexts</title>
              {snapshot.graphEdges.map((edge) => {
                const source = positions.get(edge.source);
                const target = positions.get(edge.target);
                if (!source || !target) return null;
                return <line key={`${edge.source}-${edge.target}`} x1={source.x} y1={source.y} x2={target.x} y2={target.y} />;
              })}
              {snapshot.graphNodes.map((node) => {
                const point = positions.get(node.id);
                if (!point) return null;
                return <circle key={node.id} cx={point.x} cy={point.y} r={node.ready ? 4 : 3} data-ready={node.ready || undefined} />;
              })}
            </svg>
          ) : null}
          {rendererAvailable === null ? <span className={styles.graphStatus}>Starting graph renderer</span> : null}
          {rendererAvailable === false ? <span className={styles.graphStatus}>Static graph fallback</span> : null}
        </div>
        <div className={styles.graphTableWrap}>
          <table className={styles.graphTable}>
            <caption>Current posterior mass, uncertainty, level, and readiness for every displayed context.</caption>
            <thead><tr><th>Context</th><th>Mass</th><th>Width</th><th>Level</th><th>Status</th></tr></thead>
            <tbody>
              {snapshot.graphNodes.map((node) => (
                <tr key={node.id}>
                  <th scope="row">{node.label}</th>
                  <td>{node.posteriorMass.toFixed(0)}</td>
                  <td>{node.uncertaintyWidth.toFixed(3)}</td>
                  <td>L{node.level}</td>
                  <td>{node.ready ? 'Ready' : 'Learning'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
