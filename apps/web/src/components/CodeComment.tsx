/**
 * CodeComment: Static code-style annotation for card margins.
 * Renders as `# comment text` in JetBrains Mono with a dimmed hash prefix.
 *
 * Server Component (no canvas, no rough.js, pure CSS positioning).
 * Replaces RoughCallout/RoughPivotCallout for homepage cards where the
 * "workbench" aesthetic calls for code comments over handwritten notes.
 *
 * Desktop (lg+): absolute positioned in the margin beside the card.
 * Mobile: inline block below card content.
 */

import type { ReactNode } from 'react';

type CommentSide = 'left' | 'right';
type CommentTint = 'terracotta' | 'teal' | 'gold' | 'neutral';

const TINT_COLORS: Record<CommentTint, string> = {
  terracotta: 'var(--color-terracotta)',
  teal: 'var(--color-teal)',
  gold: 'var(--color-gold)',
  neutral: 'var(--color-ink-muted)',
};

interface CodeCommentProps {
  children: ReactNode;
  /** Which side of the card the comment appears on (desktop only) */
  side?: CommentSide;
  /** Brand color matching the parent card */
  tint?: CommentTint;
  /** Vertical offset from the positioned parent (px) */
  offsetY?: number;
}

export default function CodeComment({
  children,
  side = 'right',
  tint = 'neutral',
  offsetY = 16,
}: CodeCommentProps) {
  const color = TINT_COLORS[tint];

  const sideClasses =
    side === 'right'
      ? 'lg:left-full lg:ml-8'
      : 'lg:right-full lg:mr-8';

  const textAlign = side === 'left' ? 'text-right' : 'text-left';

  return (
    <>
      {/* Desktop: absolute-positioned in margin */}
      <div
        className={`hidden lg:block absolute ${sideClasses} z-20`}
        style={{
          top: `${offsetY}px`,
          width: 450,
          maxWidth: 'calc((100vw - 896px) / 2 - 1.5rem)',
          fontFamily: 'var(--font-code)',
        }}
      >
        <p
          className={`m-0 leading-snug select-none ${textAlign}`}
          style={{ fontSize: 12, color, opacity: 0.7 }}
        >
          <span
            style={{ fontSize: 14, opacity: 0.5, marginRight: 8 }}
            aria-hidden="true"
          >
            #
          </span>
          {children}
        </p>
      </div>

      {/* Mobile: inline annotation */}
      <div
        className="lg:hidden mt-2 select-none"
        style={{
          fontFamily: 'var(--font-code)',
          fontSize: 12,
          color,
          opacity: 0.7,
        }}
      >
        <span
          style={{ fontSize: 14, opacity: 0.5, marginRight: 8 }}
          aria-hidden="true"
        >
          #
        </span>
        {children}
      </div>
    </>
  );
}
