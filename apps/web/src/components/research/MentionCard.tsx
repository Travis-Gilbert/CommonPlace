/**
 * MentionCard: External mention or Webmention for an essay/field note.
 *
 * Vellum card with 3px terracotta left border. External link card
 * showing mention type, title, excerpt, and author.
 */

import type { Mention } from '@/lib/research';

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const MENTION_LABELS: Record<string, string> = {
  citation: 'Citation',
  response: 'Response',
  mention: 'Mention',
  repost: 'Repost',
  like: 'Like',
  bookmark: 'Bookmark',
};

interface MentionCardProps {
  mention: Mention;
  index: number;
}

export default function MentionCard({ mention, index }: MentionCardProps) {
  return (
    <a
      href={mention.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block no-underline bg-surface/85 backdrop-blur-[4px] border border-black/[0.06] border-l-[3px] border-l-terracotta rounded-[10px] p-3.5 px-[18px] mb-2.5 transition-all duration-150 hover:border-terracotta/25 hover:bg-terracotta/[0.03] opacity-0 animate-[fadeInUp_0.4s_ease_forwards]"
      style={{ animationDelay: `${index * 0.06}s` }}
    >
      {/* Type label + date */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="font-mono-alt text-[10px] uppercase tracking-[0.08em] text-terracotta">
          {MENTION_LABELS[mention.mentionType] || mention.mentionType}
        </span>
        {mention.sourcePublished && (
          <span className="font-mono text-[10px] text-ink-light tracking-[0.04em]">
            {formatDate(mention.sourcePublished)}
          </span>
        )}
      </div>

      {/* Title with external arrow */}
      <p className="font-title text-[15px] font-semibold text-ink m-0 mb-1">
        {mention.sourceTitle}{' '}
        <span className="text-xs">&#8599;</span>
      </p>

      {/* Excerpt */}
      {mention.sourceExcerpt && (
        <p className="font-body-alt text-[13px] italic text-ink-muted leading-relaxed m-0 mb-1">
          &ldquo;{mention.sourceExcerpt}&rdquo;
        </p>
      )}

      {/* Author */}
      <span className="font-mono-alt text-[11px] text-ink-light">
        {mention.sourceAuthor}
      </span>
    </a>
  );
}
