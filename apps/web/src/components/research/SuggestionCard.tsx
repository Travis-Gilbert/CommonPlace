/**
 * SuggestionCard: Community-suggested source for a research trail.
 *
 * Vellum card with 3px success/olive left border (#5A7A4A).
 * Shows TypeBadge, "Community" label, title link, relevance note,
 * and contributor attribution.
 */

import type { ApprovedSuggestion } from '@/lib/research';
import TypeBadge from './TypeBadge';

interface SuggestionCardProps {
  suggestion: ApprovedSuggestion;
  index: number;
}

export default function SuggestionCard({ suggestion, index }: SuggestionCardProps) {
  return (
    <div
      className="bg-surface/85 border border-success/[0.15] border-l-[3px] border-l-success rounded-[10px] p-3 px-4 mb-2.5 opacity-0 animate-[fadeInUp_0.4s_ease_forwards]"
      style={{ animationDelay: `${index * 0.06}s` }}
    >
      {/* Badges row */}
      <div className="flex items-center gap-2 mb-1">
        <TypeBadge type={suggestion.sourceType} />
        <span className="font-mono text-[10px] text-success uppercase tracking-[0.06em]">
          Community
        </span>
      </div>

      {/* Title with external link */}
      <a
        href={suggestion.url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-title text-[15px] font-semibold text-ink no-underline hover:text-terracotta transition-colors"
      >
        {suggestion.title}{' '}
        <span className="text-xs">&#8599;</span>
      </a>

      {/* Relevance note */}
      {suggestion.relevanceNote && (
        <p className="font-body-alt text-[13px] text-ink-muted leading-snug mt-1.5 mb-0">
          {suggestion.relevanceNote}
        </p>
      )}

      {/* Contributor */}
      <span className="block font-mono-alt text-[10px] text-ink-light tracking-[0.04em] mt-1.5">
        Suggested by {suggestion.contributorName}
      </span>
    </div>
  );
}
