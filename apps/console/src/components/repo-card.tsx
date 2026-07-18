'use client';

// SOURCING: jalco-ui RepoCard (ui.justinlevine.me), structure extraction. The
// jalco card's layout is reproduced here: a bordered card with a header row (a
// leading dot and kind chip, the title, and right-aligned badges) over a body a
// caller composes (a muted description, a meta row, expandable content). Every
// shadcn token from the original (border-border, bg-card, text-primary, the
// arbitrary text sizes, the raw hex language dot) maps to an Int UI register
// token, so it clears the register, contrast, and fence gates. The sentence
// altitude renders each stake and program through it.

import type { ReactNode } from 'react';

export interface RepoCardProps {
  /** The leading domain dot color (a register var), the kind marker. */
  readonly dot?: string;
  /** The kind chip, like a repo card's fork/archived badge. */
  readonly kind?: string;
  readonly kindTint?: string;
  readonly kindInk?: string;
  /** The card title (the repo name slot). Wraps rather than truncates, because a
   *  stake or watch statement is a sentence, not a short name. */
  readonly title?: ReactNode;
  /** Right-aligned header content (author tag, disable control). */
  readonly badges?: ReactNode;
  /** For e2e and inspector targeting. */
  readonly dataNode?: string;
  /** Extra classes on the card root, e.g. the flex sizing that keeps a card
   *  card-sized and never full-width (grow basis-80 max-w-md). */
  readonly className?: string;
  /** The card body: description, tokens, meta, and expandable panels. */
  readonly children?: ReactNode;
}

/** The muted description slot (a repo card's description line), clamped to two
 *  lines so cards stay card-sized and read at a glance. */
export function RepoCardDescription({ children }: { readonly children: ReactNode }) {
  return <p className="line-clamp-2 text-sm text-ij-ink-info">{children}</p>;
}

/** The muted meta row (a repo card's stars/forks/updated row). */
export function RepoCardMeta({ children }: { readonly children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3 text-xs text-ij-ink-info">{children}</div>;
}

export function RepoCard({
  dot,
  kind,
  kindTint = 'bg-ij-chrome',
  kindInk = 'text-ij-ink-info',
  title,
  badges,
  dataNode,
  className,
  children,
}: RepoCardProps) {
  return (
    <div
      data-node={dataNode}
      className={`flex flex-col gap-3 rounded-ij-arc border border-ij-seam-raised bg-ij-editor p-4 hover:border-ij-control-border ${className ?? ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {dot ? <span className="size-2.5 shrink-0 rounded-full" style={{ background: dot }} aria-hidden="true" /> : null}
          {kind ? (
            <span className={`shrink-0 rounded-ij-arc px-1.5 text-xs font-medium ${kindTint} ${kindInk}`}>{kind}</span>
          ) : null}
          {title ? <span className="min-w-0 font-semibold text-ij-ink">{title}</span> : null}
        </div>
        {badges ? <div className="flex shrink-0 items-center gap-2">{badges}</div> : null}
      </div>
      {children}
    </div>
  );
}
