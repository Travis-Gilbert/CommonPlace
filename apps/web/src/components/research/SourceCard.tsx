/**
 * SourceCard: Individual research source with badges, annotation, key findings.
 *
 * Vellum card with 3px teal left border. Uses the Editor typography system:
 * Vollkorn for title, IBM Plex Sans for body, Space Mono for metadata.
 */

import type { TrailSource } from '@/lib/research';
import TypeBadge from './TypeBadge';
import RoleBadge from './RoleBadge';

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface SourceCardProps {
  source: TrailSource;
  index: number;
}

export default function SourceCard({ source, index }: SourceCardProps) {
  return (
    <div
      className="bg-surface/85 backdrop-blur-[4px] border border-black/[0.06] border-l-[3px] border-l-teal rounded-[10px] p-4 px-5 mb-3 opacity-0 animate-[fadeInUp_0.4s_ease_forwards]"
      style={{ animationDelay: `${index * 0.06}s` }}
    >
      {/* Top row: badges + date */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex gap-1.5 mb-2 flex-wrap">
            <TypeBadge type={source.sourceType} />
            <RoleBadge role={source.role} />
          </div>

          {/* Title */}
          <h4 className="font-title text-lg font-bold text-ink m-0 leading-snug">
            {source.url ? (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink no-underline hover:text-terracotta transition-colors"
              >
                {source.title}{' '}
                <span className="text-xs">&#8599;</span>
              </a>
            ) : (
              source.title
            )}
          </h4>

          {/* Creator / publication / year */}
          <p className="font-mono-alt text-[11px] text-ink-light m-0 tracking-[0.02em]">
            {source.creator}
            {source.publication ? ` · ${source.publication}` : ''}
            {source.datePublished
              ? ` · ${new Date(source.datePublished + 'T00:00:00').getFullYear()}`
              : ''}
          </p>
        </div>

        {/* Date encountered */}
        {source.dateEncountered && (
          <span className="font-mono text-[10px] text-ink-light uppercase tracking-[0.08em] whitespace-nowrap shrink-0 mt-1">
            Found {formatDate(source.dateEncountered)}
          </span>
        )}
      </div>

      {/* Public annotation */}
      {source.publicAnnotation && (
        <p className="font-body-alt text-sm leading-[1.7] text-ink-muted mt-3 mb-0">
          {source.publicAnnotation}
        </p>
      )}

      {/* Key findings (gold diamond bullets) */}
      {source.keyFindings && source.keyFindings.length > 0 && (
        <div className="mt-2.5">
          {source.keyFindings.map((finding, i) => (
            <div key={i} className="flex gap-2 items-start mt-1">
              <span className="text-gold text-xs leading-5 shrink-0">
                &#9670;
              </span>
              <span className="font-body-alt text-[13px] text-ink-muted leading-5">
                {finding}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Key quote */}
      {source.keyQuote && (
        <p className="font-body-alt text-[13px] italic text-ink-muted leading-relaxed mt-3 mb-0 pl-3 border-l-2 border-l-terracotta">
          &ldquo;{source.keyQuote}&rdquo;
        </p>
      )}
    </div>
  );
}
