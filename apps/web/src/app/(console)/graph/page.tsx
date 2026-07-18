'use client';

// The Graph surface (spec PT-007 V2 graph layered + PT-008 V3 vector space).
// One rail entry, four layered views over the same items: Network (cosmos.gl),
// Ego (D3), Models (React Flow), and Vector Space (Embedding Atlas). The first
// three share one useV2GraphData() binding so they render the same community
// and centrality fields; a shared focusId threads a selection across them (the
// PT-011 cross-filter seam). Data degrades honestly through the source chip.

import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Share2, Target, Workflow, Grid2x2 } from '@/lib/icons';
import { communityCss, useV2GraphData } from '@/lib/commonplace/v2-graph';
import styles from './graph.module.css';

function ViewLoading({ label }: { label: string }) {
  return <div className={styles.viewLoading}>Loading {label}…</div>;
}

const NetworkView = dynamic(() => import('./NetworkView'), { ssr: false, loading: () => <ViewLoading label="the network" /> });
const EgoView = dynamic(() => import('./EgoView'), { ssr: false, loading: () => <ViewLoading label="the ego graph" /> });
const ModelsView = dynamic(() => import('./ModelsView'), { ssr: false, loading: () => <ViewLoading label="the modeling canvas" /> });
const VectorSpaceView = dynamic(() => import('@/components/commonplace/views/VectorSpaceView'), {
  ssr: false,
  loading: () => <ViewLoading label="the vector space" />,
});

const TABS = [
  { id: 'network', label: 'Network', hint: 'Global graph', icon: Share2 },
  { id: 'ego', label: 'Ego', hint: 'Focused neighborhood', icon: Target },
  { id: 'models', label: 'Models', hint: 'Modeling canvas', icon: Workflow },
  { id: 'vector', label: 'Vector Space', hint: 'Embedding atlas', icon: Grid2x2 },
] as const;
type TabId = (typeof TABS)[number]['id'];

const SOURCE_LABEL: Record<string, string> = {
  live: 'Live · RustyRed',
  fixture: 'Fixture data',
  error: 'Backend unreachable',
};

export default function GraphPage() {
  const data = useV2GraphData();
  const [active, setActive] = useState<TabId>('network');
  const [focusId, setFocusId] = useState<string | null>(null);
  const [selectedCommunities, setSelectedCommunities] = useState<number[] | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusedNode = focusId ? data.byId.get(focusId) : undefined;
  const showLegend = active !== 'vector' && data.communityCount > 1;

  const toggleCommunity = (c: number) => {
    setSelectedCommunities((prev) => {
      const set = new Set(prev ?? []);
      if (set.has(c)) set.delete(c);
      else set.add(c);
      const next = [...set];
      return next.length === 0 ? null : next;
    });
  };

  const onTabKeyDown = (event: React.KeyboardEvent) => {
    const current = TABS.findIndex((t) => t.id === active);
    let next = current;
    if (event.key === 'ArrowRight') next = (current + 1) % TABS.length;
    else if (event.key === 'ArrowLeft') next = (current - 1 + TABS.length) % TABS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TABS.length - 1;
    else return;
    event.preventDefault();
    setActive(TABS[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className={styles.shell}>
      {/* Secondary "Graph" rail: the screen-specific options that appear while the
          app rail is collapsed (shadcn Mail pattern). Holds the view switcher,
          the community cross-filter, and the focus/source status. */}
      <aside className={styles.graphRail} aria-label="Graph">
        <div role="tablist" aria-label="Graph views" className={styles.viewList} onKeyDown={onTabKeyDown}>
          {TABS.map((tab, i) => {
            const selected = tab.id === active;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`graphtab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`graphpanel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                className={styles.viewItem}
                data-selected={selected || undefined}
                onClick={() => setActive(tab.id)}
              >
                <Icon className={styles.viewGlyph} />
                <span className={styles.viewText}>
                  <span className={styles.viewLabel}>{tab.label}</span>
                  <span className={styles.viewHint}>{tab.hint}</span>
                </span>
              </button>
            );
          })}
        </div>

        {showLegend && (
          <div className={styles.railSection}>
            <div className={styles.railSectionLabel}>Communities</div>
            <div className={styles.legend} role="group" aria-label="Filter by community">
              {Array.from({ length: data.communityCount }, (_, c) => {
                const pressed = selectedCommunities?.includes(c) ?? false;
                const activeC = !selectedCommunities || pressed;
                return (
                  <button
                    key={c}
                    type="button"
                    className={styles.legendItem}
                    data-active={activeC || undefined}
                    aria-pressed={pressed}
                    onClick={() => toggleCommunity(c)}
                  >
                    <span className={styles.legendSwatch} style={{ background: communityCss(c) }} aria-hidden="true" />
                    Cluster {c + 1}
                  </button>
                );
              })}
              {selectedCommunities && (
                <button type="button" className={styles.legendReset} onClick={() => setSelectedCommunities(null)}>
                  Show all
                </button>
              )}
            </div>
          </div>
        )}

        <div className={styles.graphRailFoot}>
          {focusedNode && (
            <button type="button" className={styles.focusChip} onClick={() => setFocusId(null)}>
              Focused: <strong>{focusedNode.label}</strong>
              <span className={styles.focusClear} aria-hidden="true">
                ✕
              </span>
              <span className="sr-only">, clear focus</span>
            </button>
          )}
          <span className={styles.srcChip} data-mode={data.source.mode} title={data.source.message ?? undefined}>
            <span className={styles.srcDot} aria-hidden="true" />
            {SOURCE_LABEL[data.source.mode] ?? data.source.mode}
          </span>
        </div>
      </aside>

      <div className={styles.surface}>
        <div
          role="tabpanel"
          id={`graphpanel-${active}`}
          aria-labelledby={`graphtab-${active}`}
          tabIndex={-1}
          className={styles.panel}
          data-register={active === 'network' ? 'umber' : undefined}
        >
          {active === 'network' && (
            <NetworkView data={data} focusId={focusId} onFocus={setFocusId} selectedCommunities={selectedCommunities} />
          )}
          {active === 'ego' && (
            <EgoView data={data} focusId={focusId} onFocus={setFocusId} selectedCommunities={selectedCommunities} />
          )}
          {active === 'models' && (
            <ModelsView data={data} focusId={focusId} onFocus={setFocusId} selectedCommunities={selectedCommunities} />
          )}
          {active === 'vector' && <VectorSpaceView />}
        </div>
      </div>
    </div>
  );
}
