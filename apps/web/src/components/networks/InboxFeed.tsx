'use client';

/* Screen archetype: activity feed (SPEC-UX-PHYSICS D8, see
   docs/plans/ux-physics-accent/archetypes.md). A reverse-chronological stream of
   uniform node rows, newest at top, windowed for length. */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import CaptureBar from './CaptureBar';
import NodeCard from './NodeCard';
import QuickFilterPills from './QuickFilterPills';
import type { FilterValue } from './QuickFilterPills';
import { fetchNodes } from '@/lib/networks';
import type { NodeListItem } from '@/lib/networks';
import { deriveViewState } from '@/lib/commonplace-view-state';
import { narrationFor } from '@/lib/commonplace-wait-narration';
import { ViewStateView } from '@/components/commonplace/shared/ViewStateView';

/**
 * InboxFeed: the main content area of the Networks home page.
 *
 * Composes: CaptureBar (top), QuickFilterPills (below), and a grid of
 * NodeCards. Fetches nodes client-side with the active filter applied.
 */
/* Above this row count the feed windows itself: only the rows near the viewport
   mount, so a 10k-node inbox scrolls at a steady frame rate with flat memory.
   Shorter feeds keep the plain grid so nothing about their layout changes. */
const VIRTUALIZE_THRESHOLD = 60;

export default function InboxFeed({ compactMobile = false }: { compactMobile?: boolean }) {
  const [nodes, setNodes] = useState<NodeListItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterValue>('inbox');

  const loadNodes = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const params: {
      status?: string;
      type?: string;
      starred?: boolean;
    } = {};

    if (activeFilter === 'inbox') {
      params.status = 'inbox';
    } else if (activeFilter === 'starred') {
      params.starred = true;
    } else if (typeof activeFilter === 'object') {
      params.type = activeFilter.type;
    }
    // 'all' sends no filters

    try {
      const result = await fetchNodes(params);
      setNodes(result.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the Networks API.');
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    loadNodes();
  }, [loadNodes]);

  const handleCapture = useCallback(() => {
    // After a successful capture, reload the inbox
    loadNodes();
  }, [loadNodes]);

  // Five-state discipline (SPEC-UX-PHYSICS D4): the node read resolves through
  // ViewStateView, which wraps AROUND the virtualized list so windowing is
  // preserved. nodes stays null until the first load settles so the loading
  // branch is distinct from a genuinely empty inbox; a background refetch keeps
  // the cached list visible as `partial` while revalidating.
  const feedCount = nodes?.length ?? 0;
  const state = deriveViewState<NodeListItem[]>({
    data: nodes,
    loading: isLoading,
    error,
    retry: loadNodes,
    isEmpty: (list) => list.length === 0,
  });

  return (
    <div
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: compactMobile ? '16px 14px 24px' : '32px 24px',
      }}
    >
      {/* CaptureBar */}
      <div style={{ marginBottom: 24 }}>
        <CaptureBar onCapture={handleCapture} />
      </div>

      {/* Filter pills */}
      <div style={{ marginBottom: 20 }}>
        <QuickFilterPills
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />
      </div>

      {/* Feed header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--nw-font-mono)',
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--nw-text-faint)',
          }}
        >
          {isLoading && !nodes
            ? 'Loading...'
            : `${feedCount} node${feedCount !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Node grid: five-state wrapper around the virtualized list */}
      <ViewStateView
        state={state}
        label="inbox nodes"
        narration={narrationFor('searching', 0)}
        skeleton={
          <div style={{ display: 'grid', gap: 12 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        }
        empty={<EmptyState activeFilter={activeFilter} />}
      >
        {(resolvedNodes) =>
          resolvedNodes.length > VIRTUALIZE_THRESHOLD ? (
            <VirtualizedNodeFeed nodes={resolvedNodes} />
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {resolvedNodes.map((node) => (
                <NodeCard key={node.id} node={node} />
              ))}
            </div>
          )
        }
      </ViewStateView>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Virtualized feed (windowed for long node lists)
   ───────────────────────────────────────────────── */

/**
 * Windowed node feed. Mirrors the studio ContentList idiom: a bounded
 * scroll parent, a spacer sized to the full list, and absolutely positioned
 * rows offset by virtualRow.start. measureElement handles the variable card
 * height; the 12px bottom padding on each row preserves the grid gap.
 */
function VirtualizedNodeFeed({ nodes }: { nodes: NodeListItem[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: nodes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 84,
    overscan: 8,
  });

  return (
    <div
      ref={parentRef}
      style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const node = nodes[virtualRow.index];
          return (
            <div
              key={node.id}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
                paddingBottom: 12,
              }}
            >
              <NodeCard node={node} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Loading skeleton
   ───────────────────────────────────────────────── */

function SkeletonCard() {
  return (
    <div
      className="nw-node-card"
      style={{ minHeight: 72, opacity: 0.4 }}
    >
      <div
        style={{
          width: '40%',
          height: 12,
          backgroundColor: 'var(--nw-surface-hover)',
          borderRadius: 4,
          marginBottom: 8,
        }}
      />
      <div
        style={{
          width: '70%',
          height: 10,
          backgroundColor: 'var(--nw-surface-hover)',
          borderRadius: 4,
        }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Empty state
   ───────────────────────────────────────────────── */

function EmptyState({ activeFilter }: { activeFilter: FilterValue }) {
  let message = 'No nodes yet. Use the capture bar above to add your first thought.';

  if (activeFilter === 'starred') {
    message = 'No starred nodes. Star a node to see it here.';
  } else if (activeFilter === 'inbox') {
    message = 'Inbox is empty. Capture a URL or thought above.';
  } else if (typeof activeFilter === 'object') {
    message = `No ${activeFilter.type} nodes found.`;
  }

  return (
    <div
      style={{
        textAlign: 'center',
        padding: '48px 24px',
        color: 'var(--nw-text-faint)',
        fontFamily: 'var(--nw-font-body)',
        fontSize: 14,
      }}
    >
      {message}
    </div>
  );
}
