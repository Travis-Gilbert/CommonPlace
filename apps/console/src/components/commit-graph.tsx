'use client';

// SOURCING: jalco-ui `@jalco/commit-graph` (ui.justinlevine.me, MIT), ADOPTED
// verbatim through the shadcn registry and retokened in place. Not a
// reproduction: the file below is upstream's, entered by `shadcn add`, with
// paint moved to the register and two extractions noted in the header.

/**
 * jalco-ui CommitGraph, by Justin Levine (ui.justinlevine.me), MIT.
 *
 * ADOPTED, not reproduced (31-HANDOFF-PROACTIVITY-COMMIT-LANGUAGE named choice
 * 1, decision 8's correction). The upstream file entered this tree through the
 * shadcn registry: `shadcn add @jalco/commit-graph` against the `@jalco`
 * registry declared in components.json. Provenance is recorded in NOTICE.md
 * with the license SHA. What follows is that file, retokened; the topology
 * engine and the rail geometry are upstream's, unchanged in behaviour.
 *
 * Kept verbatim from upstream:
 * - `computeLayout`: the rail-allocation engine (which rail a commit occupies,
 *   which rails pass through, where a merge lands, where a fork opens).
 * - The rail geometry: ROW_HEIGHT 40, railWidth 24, r 5 dot, strokeWidth 2,
 *   strokeOpacity 0.6, and the cubic that draws every fork and merge.
 * - `formatDate` / `formatFullDate`, `CommitDetail`'s popover anatomy, and the
 *   commit row's slot order (rails, refs, message, hash, author, time).
 *
 * Changed, and why:
 * 1. Paint. Upstream's eight-color rail cycle and every shadcn token are
 *    replaced by register tokens. Rails paint the SPEAKER REGISTER (named
 *    choice 3): your lane is human ink, the agent's lane is teal, derived
 *    lineage is gold, and the accent is reserved for selection. A rail
 *    therefore says who wrote it, which is the whole point of the mapping.
 * 2. `railPath` is extracted from the two cubic expressions upstream inlined in
 *    `RailsSVG`, so the vertical component and the React Flow rail edge draw
 *    from ONE builder and cannot drift. The axis parameter is the same cubic
 *    with the flow and cross axes swapped: upstream's graph flows down, the
 *    proactivity graph flows left to right.
 * 3. `CommitRow` is lifted out of `CommitGraph`'s map so a React Flow node can
 *    render the same row the vertical graph renders. Both hosts, one row.
 * 4. Text roles carry `data-type-role` for the typography gate (P4).
 * 5. Upstream's entrance classes are dropped: this surface is still, per the
 *    console's motion governance.
 */

import * as React from 'react';
import { Popover } from 'radix-ui';
import { cn } from '@/lib/utils';

interface CommitAuthor {
  name: string;
  avatarUrl?: string;
}

/** Which speaker a rail belongs to. Upstream cycles eight decorative colors;
 *  here the lane IS the authorship claim, so the vocabulary is closed. */
export type CommitLane = 'human' | 'agent' | 'derived' | 'selection';

interface Commit {
  /** Commit hash (full or abbreviated). */
  hash: string;
  /** Commit message (first line). */
  message: string;
  /** Commit author. */
  author: CommitAuthor;
  /** ISO date string or Date object. */
  date: string | Date;
  /** Parent commit hashes. Empty for root commits. Two parents = merge commit. */
  parents: string[];
  /** Branch or ref label (e.g. "main", "feat/auth"). */
  refs?: string[];
  /** Tag label (e.g. "v1.0.0"). */
  tag?: string;
  /** The speaker register this commit's rail paints. Defaults by rail index. */
  lane?: CommitLane;
}

interface CommitGraphProps extends Omit<React.ComponentProps<'div'>, 'children'> {
  /** Commits in topological order (newest first). Each commit includes parent hashes. */
  commits: Commit[];
  /** Number of hash characters to display. @default 7 */
  truncateHash?: number;
  /** Pixel width per rail column. @default 24 */
  railWidth?: number;
}

/** The register value each lane paints. Upstream's RAIL_COLORS, retargeted:
 *  every entry is a register token, so the contrast gate governs them and the
 *  theme engine repaints them in light without touching this file. */
const LANE_INK: Record<CommitLane, string> = {
  human: 'var(--cp-human)',
  agent: 'var(--cp-agent)',
  derived: 'var(--ij-gold)',
  selection: 'var(--ij-accent)',
};

/** The fallback cycle for a commit that names no lane. Selection is excluded:
 *  it is a state, never an authorship claim. */
const LANE_CYCLE: readonly CommitLane[] = ['human', 'agent', 'derived'];

export function laneColor(lane: CommitLane): string {
  return LANE_INK[lane];
}

function color(rail: number, lane?: CommitLane): string {
  return laneColor(lane ?? LANE_CYCLE[rail % LANE_CYCLE.length]);
}

// Graph layout computation

interface GraphRow {
  commit: Commit;
  rail: number;
  rails: (string | null)[]; // hash occupying each rail at this row
  railLanes: (CommitLane | undefined)[]; // the lane each rail paints
  edges: Edge[];
}

interface Edge {
  fromRail: number;
  toRail: number;
  lane?: CommitLane;
  type: 'straight' | 'merge-in' | 'fork-out';
}

/**
 * Upstream's rail allocator, unchanged in behaviour. The only addition is
 * `railLanes`, a parallel array recording which speaker owns each rail so the
 * renderer paints a pass-through rail in its owner's register rather than in a
 * color derived from its column index.
 */
function computeLayout(commits: Commit[]): GraphRow[] {
  const rows: GraphRow[] = [];
  // Active rails: each slot holds the hash of the commit it's "waiting for"
  const rails: (string | null)[] = [];
  const railLanes: (CommitLane | undefined)[] = [];

  for (const commit of commits) {
    const hash = commit.hash;

    // Find which rail this commit occupies (if any rail is waiting for it)
    let commitRail = rails.indexOf(hash);

    if (commitRail === -1) {
      // New branch: find first empty slot or append
      const emptySlot = rails.indexOf(null);
      if (emptySlot !== -1) {
        commitRail = emptySlot;
        rails[commitRail] = hash;
      } else {
        commitRail = rails.length;
        rails.push(hash);
      }
    }
    railLanes[commitRail] = commit.lane;

    const commitLane = commit.lane;
    const edges: Edge[] = [];

    // Draw straight lines for all other active rails (pass-through)
    for (let r = 0; r < rails.length; r++) {
      if (r !== commitRail && rails[r] !== null) {
        edges.push({ fromRail: r, toRail: r, lane: railLanes[r], type: 'straight' });
      }
    }

    // Clear this rail: the commit has been rendered
    rails[commitRail] = null;

    // Process parents
    const parents = commit.parents;
    if (parents.length >= 1) {
      const firstParent = parents[0];
      // First parent continues on the same rail
      const existingRail = rails.indexOf(firstParent);
      if (existingRail !== -1) {
        // Parent already expected on another rail: merge line
        edges.push({ fromRail: commitRail, toRail: existingRail, lane: commitLane, type: 'merge-in' });
      } else {
        // Parent takes this commit's rail
        rails[commitRail] = firstParent;
        railLanes[commitRail] = commitLane;
        edges.push({ fromRail: commitRail, toRail: commitRail, lane: commitLane, type: 'straight' });
      }
    }

    // Second+ parents (merge sources)
    for (let p = 1; p < parents.length; p++) {
      const parentHash = parents[p];
      const existingRail = rails.indexOf(parentHash);
      if (existingRail !== -1) {
        // Already on a rail: draw merge line from that rail
        edges.push({ fromRail: existingRail, toRail: commitRail, lane: railLanes[existingRail], type: 'merge-in' });
      } else {
        // Needs a new rail: fork out
        const emptySlot = rails.indexOf(null);
        const newRail = emptySlot !== -1 ? emptySlot : rails.length;
        if (newRail >= rails.length) rails.push(null);
        rails[newRail] = parentHash;
        railLanes[newRail] = commitLane;
        edges.push({ fromRail: commitRail, toRail: newRail, lane: commitLane, type: 'fork-out' });
      }
    }

    // Trim trailing nulls
    while (rails.length > 0 && rails[rails.length - 1] === null) {
      rails.pop();
      railLanes.pop();
    }

    rows.push({
      commit,
      rail: commitRail,
      rails: [...rails],
      railLanes: [...railLanes],
      edges,
    });
  }

  return rows;
}

// SVG rendering for rails

export const ROW_HEIGHT = 40;

/** Which axis the rails run along. Upstream's graph is vertical (rails are
 *  columns, commits stack downward); the proactivity graph is horizontal (rails
 *  are rows, commits advance rightward). Same cubic, axes swapped. */
export type RailAxis = 'vertical' | 'horizontal';

export interface RailPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * The rail cubic, extracted from upstream's `RailsSVG`. Upstream inlined it
 * twice, as
 *   fork-out / outgoing merge:  M x1,cy C x1,h  x2,cy  x2,h
 *   incoming merge:             M x1,0  C x1,cy x2,0   x2,cy
 * which are one curve: the control points are the two diagonal corners of the
 * box the curve crosses. Written once, both call sites and the React Flow rail
 * edge share it, so the vertical component and the canvas cannot drift.
 *
 * On a vertical axis the cross axis is x and the flow axis is y; on a
 * horizontal axis they swap. When the two points share a rail the controls fall
 * on the line and the cubic degenerates to straight, which is exactly how
 * upstream draws a pass-through.
 */
export function railPath(from: RailPoint, to: RailPoint, axis: RailAxis = 'vertical'): string {
  return axis === 'vertical'
    ? `M${from.x},${from.y} C${from.x},${to.y} ${to.x},${from.y} ${to.x},${to.y}`
    : `M${from.x},${from.y} C${to.x},${from.y} ${from.x},${to.y} ${to.x},${to.y}`;
}

function RailsSVG({
  row,
  prevRow,
  railWidth,
  maxRails,
}: {
  row: GraphRow;
  prevRow: GraphRow | null;
  railWidth: number;
  maxRails: number;
}) {
  const w = maxRails * railWidth;
  const h = ROW_HEIGHT;
  const cy = h / 2;

  function rx(rail: number) {
    return rail * railWidth + railWidth / 2;
  }

  const commitX = rx(row.rail);

  // Collect which rails are active above this row (from previous row's post-state)
  const activeAbove = new Set<number>();
  if (prevRow) {
    for (let r = 0; r < prevRow.rails.length; r++) {
      if (prevRow.rails[r] !== null) activeAbove.add(r);
    }
  }

  // Collect which rails are active below this row
  const activeBelow = new Set<number>();
  for (let r = 0; r < row.rails.length; r++) {
    if (row.rails[r] !== null) activeBelow.add(r);
  }

  const railInk = (r: number) => color(r, row.railLanes[r] ?? prevRow?.railLanes[r]);
  const commitInk = color(row.rail, row.commit.lane);

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" aria-hidden="true">
      {/* Pass-through rails: any rail active both above and below that isn't the commit rail */}
      {Array.from(activeAbove).map((r) => {
        if (r === row.rail) return null;
        if (!activeBelow.has(r)) return null;
        const x = rx(r);
        return <line key={`pt-${r}`} x1={x} y1={0} x2={x} y2={h} stroke={railInk(r)} strokeWidth={2} strokeOpacity={0.6} />;
      })}

      {/* Commit rail: incoming line (top to dot) */}
      {activeAbove.has(row.rail) && (
        <line x1={commitX} y1={0} x2={commitX} y2={cy} stroke={commitInk} strokeWidth={2} strokeOpacity={0.6} />
      )}

      {/* Commit rail: outgoing line (dot to bottom) */}
      {activeBelow.has(row.rail) && (
        <line x1={commitX} y1={cy} x2={commitX} y2={h} stroke={commitInk} strokeWidth={2} strokeOpacity={0.6} />
      )}

      {/* Fork-out curves: commit rail to a new rail below */}
      {row.edges
        .filter((e) => e.type === 'fork-out')
        .map((edge, i) => (
          <path
            key={`f-${i}`}
            d={railPath({ x: rx(edge.fromRail), y: cy }, { x: rx(edge.toRail), y: h })}
            stroke={color(edge.toRail, edge.lane)}
            strokeWidth={2}
            strokeOpacity={0.6}
            fill="none"
          />
        ))}

      {/* Merge curves */}
      {row.edges
        .filter((e) => e.type === 'merge-in')
        .map((edge, i) => {
          const isOutgoing = edge.fromRail === row.rail;
          const x1 = rx(edge.fromRail);
          const x2 = rx(edge.toRail);
          // Outgoing: this commit's parent is on another rail, so the curve runs
          // from the dot down to the target. Incoming: another rail merges into
          // this commit, so the curve runs from the top of the source rail to
          // the dot. Both are the same cubic through railPath.
          const d = isOutgoing
            ? railPath({ x: x1, y: cy }, { x: x2, y: h })
            : railPath({ x: x1, y: 0 }, { x: x2, y: cy });
          return (
            <path
              key={`m-${i}`}
              d={d}
              stroke={color(edge.fromRail, edge.lane)}
              strokeWidth={2}
              strokeOpacity={0.6}
              fill="none"
            />
          );
        })}

      {/* Rails that were active above but terminate here (not the commit rail, not continuing) */}
      {Array.from(activeAbove).map((r) => {
        if (r === row.rail) return null;
        if (activeBelow.has(r)) return null;
        // This rail ends: draw line from top to center height then stop
        const x = rx(r);
        return <line key={`end-${r}`} x1={x} y1={0} x2={x} y2={cy} stroke={railInk(r)} strokeWidth={2} strokeOpacity={0.6} />;
      })}

      {/* Commit dot (drawn last, on top) */}
      <circle cx={commitX} cy={cy} r={5} fill={commitInk} stroke="var(--ij-editor)" strokeWidth={2} />
    </svg>
  );
}

/** The rail dot on its own, for a host that owns its own rail geometry (the
 *  React Flow commit node). Same radius and ring as the dot `RailsSVG` draws. */
export function CommitDot({ lane, lit }: { readonly lane: CommitLane; readonly lit?: boolean }) {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" className="shrink-0" aria-hidden="true">
      <circle cx={6} cy={6} r={5} fill={laneColor(lane)} stroke="var(--ij-editor)" strokeWidth={2} />
      {lit ? <circle cx={6} cy={6} r={5} fill="none" stroke={laneColor(lane)} strokeWidth={2} strokeOpacity={0.5} /> : null}
    </svg>
  );
}

// Commit popover

/** The face a lane speaks in. The lane IS the authorship claim, so the face
 *  follows it: this is the typography law (named choice 4) applied at the one
 *  place inside the adopted component that renders authored prose. */
function laneFaces(lane: CommitLane): { title: string; body: string; speaker: 'human' | 'agent' } {
  return lane === 'human'
    ? { title: 'font-cp-title', body: 'font-cp-human', speaker: 'human' }
    : { title: 'font-cp-agent', body: 'font-cp-agent', speaker: 'agent' };
}

function CommitDetail({
  commit,
  hashLength,
  railColor,
  lane,
  children,
}: {
  commit: Commit;
  hashLength: number;
  railColor: string;
  lane: CommitLane;
  children: React.ReactNode;
}) {
  const faces = laneFaces(lane);
  return (
    <Popover.Root>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="right"
          sideOffset={8}
          className="z-50 w-80 rounded-ij-arc border border-ij-seam-raised bg-ij-raised p-3 text-ij-ink shadow-xl"
        >
          <div className="flex flex-col gap-2">
            <p className={cn('text-sm leading-snug', faces.title)} data-type-role="title" data-type-speaker={faces.speaker}>
              {commit.message}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-ij-ink-info">
              <span
                className={cn('inline-flex items-center gap-1.5', faces.body)}
                data-type-role="body"
                data-type-speaker={faces.speaker}
              >
                <span className="flex size-4 items-center justify-center rounded-full bg-ij-chrome font-ij-mono text-xs">
                  {commit.author.name
                    .split(/\s+/)
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                </span>
                {commit.author.name}
              </span>
              <span className="text-ij-seam-raised">·</span>
              <code className="rounded-ij-arc bg-ij-chrome px-1 py-0.5 font-ij-mono text-xs" data-type-role="machine">
                {commit.hash.slice(0, hashLength)}
              </code>
            </div>
            <div className="font-ij-mono text-xs text-ij-ink-info" data-type-role="machine">
              {formatFullDate(commit.date)}
            </div>
            {(commit.refs || commit.tag) && (
              <div className="flex flex-wrap gap-1">
                {commit.refs?.map((ref) => (
                  <RefBadge key={ref} label={ref} ink={railColor} />
                ))}
                {commit.tag && <RefBadge label={commit.tag} ink={railColor} tag />}
              </div>
            )}
            {commit.parents.length > 0 && (
              <div className="font-ij-mono text-xs text-ij-ink-info" data-type-role="machine">
                {commit.parents.length === 1 ? 'Parent' : 'Parents'}:{' '}
                {commit.parents.map((p) => p.slice(0, hashLength)).join(', ')}
              </div>
            )}
          </div>
          <Popover.Arrow className="fill-ij-raised" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/**
 * A ref or tag chip. Upstream tinted these with hex-alpha string concatenation
 * (`${color}20`), which cannot survive a CSS variable and would mint raw color
 * besides. The register form carries the lane in the border and the label while
 * the fill stays a register surface, so the chip reads as the same object in
 * both themes and clears the contrast gate.
 */
export function RefBadge({
  label,
  ink,
  tag,
  dashed,
}: {
  readonly label: string;
  readonly ink: string;
  readonly tag?: boolean;
  readonly dashed?: boolean;
}) {
  return (
    <span
      data-slot={tag ? 'commit-tag' : 'commit-ref'}
      data-type-role="machine"
      className={cn(
        'inline-flex items-center rounded-ij-arc border bg-ij-chrome px-1.5 font-ij-mono text-xs leading-none',
        tag ? 'font-semibold' : null,
        dashed ? 'border-dashed' : null,
      )}
      style={{ borderColor: ink, color: ink }}
    >
      {label}
    </span>
  );
}

function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function formatFullDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export { formatDate, formatFullDate };

/**
 * One commit row: the slots upstream renders after the rails, lifted out of
 * `CommitGraph`'s map so the React Flow commit node renders the same row the
 * vertical graph renders. Slot order is upstream's: refs, message, hash,
 * author, time.
 *
 * `titleClass` is how the typography law reaches the row: the message is a
 * title and resolves its face from the commit's author, which is the whole
 * reason the law exists (named choice 4).
 */
export function CommitRow({
  commit,
  lane,
  truncateHash = 7,
  titleClass,
  leading,
  trailing,
  dashed,
  showRefs = true,
}: {
  readonly commit: Commit;
  readonly lane: CommitLane;
  readonly truncateHash?: number;
  readonly titleClass?: string;
  readonly leading?: React.ReactNode;
  readonly trailing?: React.ReactNode;
  readonly dashed?: boolean;
  /** Whether the row carries its own ref and tag badges. Upstream renders them
   *  inline before the message, which is right for a full-width vertical graph.
   *  A host with a narrower row (a React Flow node) can carry them in its own
   *  header instead and leave the message the width it needs: the message is
   *  the sentence, and a row where the badges are legible and the sentence is
   *  not has its priorities backwards. @default true */
  readonly showRefs?: boolean;
}) {
  const ink = laneColor(lane);
  return (
    <div data-slot="commit-entry" className="flex w-full min-w-0 items-center gap-2">
      {leading}
      {showRefs && (commit.refs?.length || commit.tag) && (
        <div className="flex min-w-0 shrink items-center gap-1 overflow-hidden">
          {commit.refs?.map((ref) => (
            <RefBadge key={ref} label={ref} ink={ink} dashed={dashed} />
          ))}
          {commit.tag && <RefBadge label={commit.tag} ink={ink} tag dashed={dashed} />}
        </div>
      )}
      <p
        className={cn('min-w-24 flex-1 truncate text-left text-sm text-ij-ink', titleClass ?? laneFaces(lane).title)}
        data-type-role="title"
        data-type-speaker={laneFaces(lane).speaker}
      >
        {commit.message}
      </p>
      <div className="flex shrink-0 items-center gap-2 font-ij-mono text-xs text-ij-ink-info">
        {/* font-ij-mono on the element, not inherited: the <code> UA rule
            (font-family: monospace) overrides an inherited face, so an
            ancestor class silently loses. The P4 gate caught this. */}
        <code data-slot="commit-hash" data-type-role="machine" className="font-ij-mono">
          {commit.hash.slice(0, truncateHash)}
        </code>
        <span data-slot="commit-author" data-type-role="machine" style={{ color: ink }}>
          {commit.author.name}
        </span>
        <span data-slot="commit-time" data-type-role="machine">
          {formatDate(commit.date)}
        </span>
      </div>
      {trailing}
    </div>
  );
}

// Main component

function CommitGraph({ commits, truncateHash = 7, railWidth = 24, className, ...props }: CommitGraphProps) {
  // Simple mode: if no commit has parents, infer a linear topology
  const hasTopology = commits.some((c) => c.parents && c.parents.length > 0);
  const resolvedCommits = hasTopology
    ? commits
    : commits.map((c, i) => ({
        ...c,
        parents: i < commits.length - 1 ? [commits[i + 1].hash] : [],
      }));

  if (resolvedCommits.length === 0) {
    return (
      <div
        data-slot="commit-graph"
        className={cn(
          'flex items-center justify-center rounded-ij-arc border border-ij-seam-raised bg-ij-editor py-10 text-sm text-ij-ink-info',
          className,
        )}
        {...props}
      >
        No commits.
      </div>
    );
  }

  const rows = computeLayout(resolvedCommits);
  const maxRails = Math.max(
    ...rows.map((r) => Math.max(r.rail + 1, r.rails.length, ...r.edges.map((e) => Math.max(e.fromRail, e.toRail) + 1))),
  );
  const svgWidth = maxRails * railWidth;

  return (
    <div
      data-slot="commit-graph"
      className={cn('overflow-hidden rounded-ij-arc border border-ij-seam-raised bg-ij-editor', className)}
      {...props}
    >
      <div className="overflow-x-auto">
        {rows.map((row, i) => (
          <CommitDetail
            key={`${row.commit.hash}-${i}`}
            commit={row.commit}
            hashLength={truncateHash}
            railColor={color(row.rail, row.commit.lane)}
            lane={row.commit.lane ?? LANE_CYCLE[row.rail % LANE_CYCLE.length]}
          >
            <button
              type="button"
              data-slot="commit-button"
              className="flex w-full items-center gap-0 border-b border-ij-divider text-left last:border-b-0 hover:bg-ij-hover-surface focus-visible:bg-ij-hover-surface focus-visible:outline-none"
              style={{ height: ROW_HEIGHT }}
            >
              <div style={{ width: svgWidth }} className="shrink-0">
                <RailsSVG row={row} prevRow={i > 0 ? rows[i - 1] : null} railWidth={railWidth} maxRails={maxRails} />
              </div>
              <div className="min-w-0 flex-1 pr-3">
                <CommitRow
                  commit={row.commit}
                  lane={row.commit.lane ?? LANE_CYCLE[row.rail % LANE_CYCLE.length]}
                  truncateHash={truncateHash}
                />
              </div>
            </button>
          </CommitDetail>
        ))}
      </div>
    </div>
  );
}

export { CommitGraph, CommitDetail, computeLayout, type CommitGraphProps, type Commit, type CommitAuthor };
