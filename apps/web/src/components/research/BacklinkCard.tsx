/**
 * BacklinkCard: Connected content card showing shared sources.
 *
 * Vellum card with no colored left border (teal-tinted border instead).
 * Links to related essays or field notes that share research sources.
 */

import Link from 'next/link';
import type { Backlink } from '@/lib/research';

interface BacklinkCardProps {
  backlink: Backlink;
}

export default function BacklinkCard({ backlink }: BacklinkCardProps) {
  const typeLabel = backlink.contentType === 'essay' ? 'Essay' : 'Field Note';
  const href = backlink.contentType === 'essay'
    ? `/essays/${backlink.contentSlug}`
    : `/field-notes/${backlink.contentSlug}`;

  const sharedCount = Array.isArray(backlink.sharedSources)
    ? backlink.sharedSources.length
    : (backlink.sharedSources as unknown as number) || 0;

  return (
    <Link
      href={href}
      className="block no-underline bg-surface/85 border border-teal/[0.12] rounded-[10px] p-3 px-4 transition-all duration-150 hover:border-teal/30 hover:bg-teal/[0.04]"
    >
      <span className="block font-mono-alt text-[10px] uppercase tracking-[0.08em] text-teal">
        {typeLabel}
      </span>
      <span className="block font-title text-[15px] font-semibold text-ink mt-0.5">
        {backlink.contentTitle}
      </span>
      <span className="block font-mono text-[10px] text-ink-light uppercase tracking-[0.06em] mt-0.5">
        {sharedCount} shared source{sharedCount !== 1 ? 's' : ''}
      </span>
    </Link>
  );
}
