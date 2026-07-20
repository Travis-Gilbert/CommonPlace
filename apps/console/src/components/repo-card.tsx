'use client';

// SOURCING: jalco-ui `@jalco/repo-card` (ui.justinlevine.me, MIT), ADOPTED
// through the shadcn registry and retokened in place. The CVA variant matrix,
// the slot anatomy, and the meta-row order are upstream's; only the paint and
// the data binding change.

/**
 * jalco-ui RepoCard, by Justin Levine (ui.justinlevine.me), MIT.
 *
 * ADOPTED, not reproduced (31-HANDOFF-PROACTIVITY-COMMIT-LANGUAGE named choice
 * 1). Entered this tree as `shadcn add @jalco/repo-card` against the `@jalco`
 * registry in components.json; provenance and license SHA are in NOTICE.md.
 *
 * The mapping this card carries (named choice 5): a stake IS the repository.
 * Every slot upstream built for GitHub carries a proactivity fact instead, and
 * the slot geometry is why the mapping reads without a caption:
 *
 *   repo full name  -> the stake statement, in its author's face
 *   description     -> "rests on N assumptions"
 *   topic chips     -> the source chips
 *   language dot    -> the author dot, in the speaker-register lane color
 *   star / fork     -> fire count and last fired
 *   license         -> the standing budget
 *   updated (clock) -> the permission clause
 *   archived badge  -> disabled, on upstream's amber pattern + muted variant
 *   fork badge      -> derived lineage
 *
 * Kept verbatim from upstream: `repoCardVariants` (four variants, three sizes,
 * and the data-slot size selectors), the header/description/topics/meta block
 * order, the `data-archived` and `data-fork` attributes, `formatCount`, and
 * `formatRelativeDate`.
 *
 * Changed, and why:
 * 1. Paint. Every shadcn token maps to a register token. Upstream's archived
 *    badge painted `amber-500` directly; the register's warn family is the
 *    console's amber, so the badge keeps its pattern and loses its raw palette.
 *    Upstream's `dark:` variant pairs are dropped because the register already
 *    swaps by theme, so a `dark:` override would fight the theme engine.
 * 2. No glyphs. Upstream ships six GitHub-semantic inline SVGs (mark, star,
 *    fork, license, clock, archive). Decision 12 holds this surface to no new
 *    glyphs, and those six carry GitHub's meanings, not ours. The slots keep
 *    their geometry and read in machinery mono instead. The language dot is not
 *    a glyph and stays.
 * 3. Data. Upstream is an async server component that fetches api.github.com.
 *    Upstream already supports skipping that with its `data` prop, and that is
 *    the path taken here: the fetch and its `lib/github` module are dropped
 *    (there is no GitHub repository behind a stake), the two pure formatters
 *    move into this file, and the props become the typed local shape above.
 * 4. Root element. Upstream's root is an `<a>` to github.com. A stake is not a
 *    link, so the root is a `div` unless an `href` is supplied, and a
 *    `children` slot is added below the meta row for the inline editors the
 *    card altitude composes into it.
 * 5. Shadows dropped: depth on this surface is value, seam, and header, never
 *    shadow (HANDOFF-CONSOLE-DIMENSIONALITY named choice 3).
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Upstream's abbreviating count formatter, verbatim. A fire count is exactly
 * the quantity it was written for.
 */
export function formatCount(count: number): string {
  if (count >= 1_000_000) {
    const value = count / 1_000_000;
    return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}m`;
  }
  if (count >= 1_000) {
    const value = count / 1_000;
    return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}k`;
  }
  return count.toLocaleString('en-US');
}

/** Upstream's relative date formatter, verbatim. */
export function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  const months = Math.floor(diffDays / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(diffDays / 365);
  return `${years}y ago`;
}

/**
 * Upstream's variant matrix, structurally verbatim. `muted` is the variant
 * named choice 5 pairs with the archived badge for a disabled stake, which is
 * why all four variants are kept rather than trimmed to the two in use.
 */
const repoCardVariants = cva('flex flex-col gap-2 rounded-ij-arc border transition-colors', {
  variants: {
    variant: {
      default: 'border-ij-seam-raised bg-ij-editor hover:border-ij-control-border hover:bg-ij-hover-surface',
      outline: 'border-ij-seam-raised bg-ij-chrome hover:bg-ij-hover-surface',
      ghost: 'border-transparent hover:bg-ij-hover-surface',
      muted: 'border-ij-seam bg-ij-chrome opacity-60 hover:opacity-100',
    },
    size: {
      sm: 'p-2 [&_[data-slot=repo-name]]:text-rec-body [&_[data-slot=repo-description]]:text-rec-body [&_[data-slot=repo-meta]]:text-rec-machine',
      default: 'p-3 [&_[data-slot=repo-name]]:text-rec-body [&_[data-slot=repo-description]]:text-rec-body [&_[data-slot=repo-meta]]:text-rec-machine',
      lg: 'p-3 [&_[data-slot=repo-name]]:text-rec-title [&_[data-slot=repo-description]]:text-rec-body [&_[data-slot=repo-meta]]:text-rec-machine',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

/** The tone a meta entry carries. The accent grammar: a pending ask sits on the
 *  accent, learned autonomy on gold, a refusal on error, everything else on the
 *  informational ink. */
export type RepoCardTone = 'info' | 'accent' | 'gold' | 'warn' | 'error';

const TONE_INK: Record<RepoCardTone, string> = {
  info: 'text-ij-ink-info',
  accent: 'text-ij-accent',
  gold: 'text-ij-gold',
  warn: 'text-ij-warn',
  error: 'text-ij-error',
};

/**
 * One entry in upstream's star / fork stat run.
 *
 * `mark` is where the anchors go. Upstream's stat run is a glyph beside a
 * number, and the version without the glyph is a wireframe of a card rather
 * than a card: 32's cause 3, "the grammar arrived as skeleton, not material".
 * A mark can be a stroke primitive, a canvas meter, or a sparkline.
 */
export interface RepoCardStat {
  readonly label: string;
  readonly value: string;
  readonly mark?: React.ReactNode;
  readonly tone?: RepoCardTone;
}

/** What the card renders. Upstream's `GitHubRepoData`, rebound to the mapping
 *  in the header comment. Every field is optional except the name, so a
 *  compact row and a full stake card are the same component. */
export interface RepoCardData {
  /** The repo-name slot: a stake statement, a watch sentence, a step. */
  readonly name: React.ReactNode;
  /** The description slot. */
  readonly description?: React.ReactNode;
  /** The topics slot: source chips. */
  readonly topics?: readonly string[];
  /** How many topic chips before the overflow chip. @default 4 */
  readonly maxTopics?: number;
  /** The language dot: a register value naming the author's lane. */
  readonly laneInk?: string;
  /** The language label beside the dot. */
  readonly laneLabel?: string;
  /** The star / fork stat run. */
  readonly stats?: readonly RepoCardStat[];
  /** The license slot: the standing budget. */
  readonly license?: string;
  readonly licenseTone?: RepoCardTone;
  /** The updated slot, right-aligned: the permission clause. */
  readonly updated?: string;
  readonly updatedTone?: RepoCardTone;
  /** Upstream's archived state: a disabled node. Renders the amber badge. */
  readonly archived?: boolean;
  readonly archivedLabel?: string;
  /** Upstream's fork state: derived lineage. */
  readonly fork?: boolean;
  readonly forkLabel?: string;
}

interface RepoCardProps extends Omit<React.ComponentProps<'div'>, 'children' | 'title'>, VariantProps<typeof repoCardVariants> {
  readonly data: RepoCardData;
  /** Show the language dot. @default true */
  readonly showLanguage?: boolean;
  /** Show topic chips. @default true */
  readonly showTopics?: boolean;
  /** Show the license slot. @default true */
  readonly showLicense?: boolean;
  /** Show the updated slot. @default true */
  readonly showUpdated?: boolean;
  /** The face the name slot resolves to (the typography law, named choice 4). */
  readonly titleClass?: string;
  /** The face the description slot resolves to. Declared rather than inherited:
   *  the chrome's UI face and the agent's speaking face are different stacks,
   *  so an element that only inherits is wearing an ungoverned face. */
  readonly bodyClass?: string;
  /** Who these faces claim is speaking, for the P4 gate. */
  readonly speaker?: 'human' | 'agent';
  /** State badges. They wrap on their own line beneath the title. */
  readonly badges?: React.ReactNode;
  /** The pinned top-right affordance: the card's overflow. */
  readonly action?: React.ReactNode;
  /** Composed body below the meta row: the inline editors, panels, sub-rows. */
  readonly children?: React.ReactNode;
  /** The anchor before the name: the kind tile. Upstream leads with the GitHub
   *  mark, which is the same job (say what kind of object this is before the
   *  reader parses a word of it). */
  readonly leading?: React.ReactNode;
}

/** Upstream's badge shape, with the register's warn family standing in for its
 *  raw amber. Used for archived (disabled) and fork (derived). */
function StateBadge({ label, tone }: { readonly label: string; readonly tone: 'warn' | 'muted' }) {
  return (
    <span
      data-type-role="machine"
      className={cn(
        'inline-flex items-center rounded-ij-arc border px-1.5 py-0.5 font-ij-mono text-rec-machine font-medium leading-none',
        tone === 'warn' ? 'border-ij-warn bg-ij-warn-bg text-ij-warn' : 'border-ij-seam-raised bg-ij-chrome text-ij-ink-info',
      )}
    >
      {label}
    </span>
  );
}

function RepoCard({
  data,
  variant,
  size,
  showLanguage = true,
  showTopics = true,
  showLicense = true,
  showUpdated = true,
  titleClass,
  bodyClass = 'font-cp-agent',
  speaker = 'agent',
  badges,
  action,
  children,
  leading,
  className,
  ...props
}: RepoCardProps) {
  const maxTopics = data.maxTopics ?? 4;
  const allTopics = data.topics ?? [];
  const topics = allTopics.slice(0, maxTopics);
  const hasMoreTopics = allTopics.length > maxTopics;
  const stats = data.stats ?? [];

  return (
    <div
      data-slot="repo-card"
      data-archived={data.archived || undefined}
      data-fork={data.fork || undefined}
      className={cn(repoCardVariants({ variant: data.archived ? 'muted' : variant, size, className }))}
      {...props}
    >
      {/* DEVIATION from upstream's header row, and the reason for it: upstream
          names a repository ("owner/repo"), which is short enough to share a
          line with its badges. A stake names itself in a sentence. Keeping
          upstream's geometry crushed the title to a couple of words per line,
          so the title takes the row and the state badges wrap beneath it. The
          badge SLOT is unchanged; only its line is. */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-2">
          {leading ??
            (showLanguage && data.laneInk ? (
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: data.laneInk }}
                aria-hidden="true"
              />
            ) : null)}
          <span
            data-slot="repo-name"
            style={{ fontWeight: 'var(--rec-weight-cap)' }}
            data-type-role="title"
            data-type-speaker={speaker}
            className={cn('min-w-0 flex-1 font-semibold text-ij-ink', titleClass)}
          >
            {data.name}
          </span>
          {action ? <div className="flex shrink-0 items-center">{action}</div> : null}
        </div>
        {(data.archived || data.fork || badges) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {data.archived && <StateBadge label={data.archivedLabel ?? 'Disabled'} tone="warn" />}
            {data.fork && <StateBadge label={data.forkLabel ?? 'Derived'} tone="muted" />}
            {badges}
          </div>
        )}
      </div>

      {data.description && (
        <p
          data-slot="repo-description"
          data-type-role="body"
          data-type-speaker={speaker}
          className={cn('line-clamp-2 text-ij-ink-info', bodyClass)}
        >
          {data.description}
        </p>
      )}

      {showTopics && topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {topics.map((topic) => (
            <span
              key={topic}
              data-slot="repo-topic"
              data-type-role="machine"
              className="inline-flex items-center rounded-full bg-ij-chrome px-1.5 font-ij-mono text-rec-machine font-medium text-ij-ink-info"
            >
              {topic}
            </span>
          ))}
          {hasMoreTopics && (
            <span
              data-type-role="machine"
              className="inline-flex items-center rounded-full bg-ij-chrome px-1.5 font-ij-mono text-rec-machine font-medium text-ij-ink-info"
            >
              +{allTopics.length - maxTopics}
            </span>
          )}
        </div>
      )}

      <div data-slot="repo-meta" data-type-role="machine" className="flex flex-wrap items-center gap-3 font-ij-mono text-ij-ink-info">
        {showLanguage && data.laneLabel && (
          <span className="inline-flex items-center gap-1.5" style={{ color: data.laneInk }}>
            {data.laneLabel}
          </span>
        )}

        {stats.map((stat) => (
          <span
            key={stat.label}
            data-stat={stat.label}
            className={cn('inline-flex items-center gap-1 tabular-nums', TONE_INK[stat.tone ?? 'info'])}
          >
            {stat.mark}
            {stat.label}
            {stat.value ? ` ${stat.value}` : null}
          </span>
        ))}

        {showLicense && data.license && (
          <span className={cn('inline-flex items-center gap-1', TONE_INK[data.licenseTone ?? 'info'])}>{data.license}</span>
        )}

        {showUpdated && data.updated && (
          <span className={cn('ml-auto inline-flex items-center gap-1', TONE_INK[data.updatedTone ?? 'info'])}>
            {data.updated}
          </span>
        )}
      </div>

      {children}
    </div>
  );
}

export { RepoCard, repoCardVariants };
export type { RepoCardProps };
