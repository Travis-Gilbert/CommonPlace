'use client';

// SOURCING: jal-co/ui CommitGraph (ui.justinlevine.me/r/commit-graph.json).
// Structure extraction + Int UI reskin for the generic vertical commit rail.
// The proactivity graph at components/commit-graph.tsx remains the agent-
// programming adaptation of the same jalco pattern. ViewSource: package
// jal-co/ui, component CommitGraph, mode reskin, regime css-vars.

import { cn } from '@/lib/cn';

export type CommitGraphCommit = {
  readonly id: string;
  readonly hash: string;
  readonly message: string;
  readonly author?: string;
  readonly date?: string;
  readonly refs?: readonly string[];
};

export type CommitGraphProps = {
  readonly commits: readonly CommitGraphCommit[];
  readonly truncateHash?: number;
  readonly className?: string;
  readonly onSelect?: (commit: CommitGraphCommit) => void;
};

export function CommitGraph({
  commits,
  truncateHash = 7,
  className,
  onSelect,
}: CommitGraphProps) {
  if (commits.length === 0) {
    return (
      <div
        className={cn(
          'rounded-ij-arc border border-ij-seam-raised bg-ij-chrome px-3 py-3 text-ij-ink-info',
          className,
        )}
      >
        No commits.
      </div>
    );
  }

  return (
    <ol
      className={cn(
        'relative flex flex-col gap-0 overflow-auto rounded-ij-arc border border-ij-seam-raised bg-ij-editor',
        className,
      )}
    >
      {commits.map((commit, index) => {
        const shortHash =
          truncateHash > 0 && commit.hash.length > truncateHash
            ? commit.hash.slice(0, truncateHash)
            : commit.hash;
        const isLast = index === commits.length - 1;
        return (
          <li key={commit.id} className="relative flex gap-3 px-3 py-2">
            <div className="relative flex w-3 shrink-0 justify-center">
              {!isLast ? (
                <span
                  className="absolute top-3 w-px bg-ij-seam-raised"
                  style={{ bottom: 0, height: 'calc(100% + 0.5rem)' }}
                  aria-hidden="true"
                />
              ) : null}
              <span
                className="relative z-10 mt-1 size-2.5 rounded-full bg-ij-accent"
                aria-hidden="true"
              />
            </div>
            <button
              type="button"
              className="min-w-0 flex-1 text-left hover:bg-ij-hover-surface"
              onClick={() => onSelect?.(commit)}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-ij-mono text-ij-link">{shortHash}</span>
                {commit.refs?.map((ref) => (
                  <span
                    key={ref}
                    className="rounded-ij-arc bg-ij-selection px-1.5 font-ij-mono text-ij-ink"
                  >
                    {ref}
                  </span>
                ))}
              </div>
              <p className="truncate text-ij-ink">{commit.message}</p>
              <p className="font-ij-mono text-ij-ink-info">
                {[commit.author, commit.date].filter(Boolean).join(' · ')}
              </p>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
