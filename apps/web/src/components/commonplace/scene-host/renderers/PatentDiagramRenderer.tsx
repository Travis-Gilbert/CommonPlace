'use client';

// Patent diagram renderer (SPEC-SCENE-OS-WOW D3 / PT-031).
//
// Renders the first-class patent atoms emitted by scene-os-core/patent.rs:
//   - `patent-node`   -> a component box (self-laid-out; backend leaves position None)
//   - `patent-edge`   -> a connector between two node boxes
//   - `patent-callout`-> a rubricated numeral (label) anchored near its node
//   - `patent-callout-leader` (relation) -> the leader line numeral -> node
//
// Callouts are interactive: click a numeral to open a detail panel populated
// from the atom's own evidence (sourceRefs) + description; "Go deeper"
// dispatches a scoped follow-up over the scene-action seam (PT-052 wires it to
// ACP). Strokes draw in, then callouts settle; prefers-reduced-motion collapses
// the reveal to a plain fade. Layout math lives in ./patentLayout (unit-tested).

import { useEffect, useMemo, useState } from 'react';
import type { SceneRendererProps } from '../types';
import { buildPatentLayout, NODE_H, NODE_W, type PlacedCallout } from './patentLayout';

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

export default function PatentDiagramRenderer({ scenePackage, expanded }: SceneRendererProps) {
  const reduced = useReducedMotion();
  const layout = useMemo(
    () => buildPatentLayout(scenePackage.atoms, scenePackage.relations),
    [scenePackage.atoms, scenePackage.relations],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dispatched, setDispatched] = useState<string | null>(null);

  const selected = selectedId ? layout.callouts.find((callout) => callout.id === selectedId) ?? null : null;

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  const dispatchGoDeeper = (callout: PlacedCallout) => {
    const detail = {
      packageId: scenePackage.id,
      atomId: callout.id,
      numeral: callout.numeral,
      actionType: 'go_deeper',
      evidenceRefs: callout.evidence.map((ref) => ref.id),
      prompt: `Go deeper on callout ${callout.numeral} (${callout.nodeLabel}): ${callout.description}`,
    };
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('commonplace:scene-action', { detail }));
    }
    setDispatched(callout.id);
  };

  const revealDelay = (base: number, index: number, step: number) => (reduced ? '0ms' : `${base + index * step}ms`);

  return (
    <div className={`cp-patent${reduced ? ' is-static' : ''}${expanded ? ' is-expanded' : ''}`}>
      <div className="cp-patent-figure-wrap">
        <svg
          className="cp-patent-figure"
          viewBox={layout.viewBox}
          width={800}
          height={520}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Patent-style diagram"
        >
          <defs>
            <marker
              id="cp-patent-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" className="cp-patent-arrowhead" />
            </marker>
          </defs>

          <g className="cp-patent-edges">
            {layout.edges.map((edge, index) => (
              <path
                key={edge.id}
                className="cp-patent-edge"
                pathLength={1}
                markerEnd="url(#cp-patent-arrow)"
                style={{ animationDelay: revealDelay(0, index, 40) }}
                d={`M ${edge.x1} ${edge.y1} L ${edge.x2} ${edge.y2}`}
              />
            ))}
          </g>

          <g className="cp-patent-nodes">
            {layout.nodes.map((node, index) => (
              <g key={node.id} className="cp-patent-node" style={{ animationDelay: revealDelay(280, index, 40) }}>
                <rect x={node.x} y={node.y} width={NODE_W} height={NODE_H} rx={4} />
                <text x={node.cx} y={node.cy} textAnchor="middle" dominantBaseline="central">
                  {wrapLabel(node.label).map((line, lineIndex, lines) => (
                    <tspan key={line} x={node.cx} dy={lineIndex === 0 ? `${-(lines.length - 1) * 0.6}em` : '1.2em'}>
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            ))}
          </g>

          <g className="cp-patent-callouts">
            {layout.callouts.map((callout, index) => {
              const isSelected = callout.id === selectedId;
              return (
                <g
                  key={callout.id}
                  className={`cp-patent-callout${isSelected ? ' is-selected' : ''}`}
                  style={{ animationDelay: revealDelay(560, index, 60) }}
                  onClick={() => setSelectedId(isSelected ? null : callout.id)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Callout ${callout.numeral}: ${callout.nodeLabel}`}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedId(isSelected ? null : callout.id);
                    }
                  }}
                >
                  <line
                    className="cp-patent-leader"
                    x1={callout.anchorX}
                    y1={callout.anchorY}
                    x2={callout.x}
                    y2={callout.y}
                  />
                  <circle className="cp-patent-leader-dot" cx={callout.anchorX} cy={callout.anchorY} r={2.5} />
                  <circle className="cp-patent-callout-hit" cx={callout.x} cy={callout.y} r={14} />
                  <text
                    className="cp-patent-callout-num"
                    x={callout.x}
                    y={callout.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {callout.numeral}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        <span className="cp-patent-figtag">FIG. 1</span>
      </div>

      {selected && (
        <aside className="cp-patent-panel" aria-live="polite">
          <header>
            <span className="cp-patent-panel-num">{selected.numeral}</span>
            <div>
              <strong>{selected.nodeLabel}</strong>
              <span className="cp-patent-panel-kicker">Callout {selected.numeral}</span>
            </div>
            <button type="button" onClick={() => setSelectedId(null)} aria-label="Close callout detail">
              Close
            </button>
          </header>
          {selected.description && <p className="cp-patent-panel-body">{selected.description}</p>}
          {selected.evidence.length > 0 && (
            <div className="cp-patent-panel-evidence">
              <div className="cp-patent-panel-kicker">Evidence</div>
              <ul>
                {selected.evidence.map((ref) => (
                  <li key={`${ref.kind}:${ref.id}`}>
                    <span className="cp-patent-evidence-kind">{ref.kind}</span>
                    {ref.label ?? ref.id}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <footer>
            <button type="button" className="cp-patent-godeeper" onClick={() => dispatchGoDeeper(selected)}>
              Go deeper
            </button>
            {dispatched === selected.id && <span className="cp-patent-dispatched">Scoped follow-up dispatched</span>}
          </footer>
        </aside>
      )}
    </div>
  );
}

function wrapLabel(label: string): string[] {
  const words = label.split(/\s+/);
  if (words.length <= 2) return [label];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}
