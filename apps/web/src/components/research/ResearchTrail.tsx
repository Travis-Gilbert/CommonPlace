'use client';

/**
 * ResearchTrail: Main wrapper with Radix Tabs for the research trail section.
 *
 * Fetches trail data from the research API and renders three tabs:
 * Sources (default), Research Thread, and Conversation.
 * Renders nothing if the API returns empty data or fails.
 */

import { useState, useEffect } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { fetchResearchTrail } from '@/lib/research';
import type { TrailResponse } from '@/lib/research';
import SectionLabel from '@/components/SectionLabel';
import SourceCard from './SourceCard';
import BacklinkCard from './BacklinkCard';
import ThreadTimeline from './ThreadTimeline';
import MentionCard from './MentionCard';
import SuggestionCard from './SuggestionCard';
import SuggestSourceForm from './SuggestSourceForm';

interface ResearchTrailProps {
  slug: string;
}

function hasContent(trail: TrailResponse): boolean {
  return (
    trail.sources.length > 0 ||
    trail.thread !== null ||
    trail.mentions.length > 0 ||
    (trail.approvedSuggestions ?? []).length > 0
  );
}

export default function ResearchTrail({ slug }: ResearchTrailProps) {
  const [trail, setTrail] = useState<TrailResponse | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetchResearchTrail(slug).then((data) => {
      if (cancelled) return;
      setTrail(data);
      setLoaded(true);
    });

    return () => { cancelled = true; };
  }, [slug]);

  // Don't render anything until loaded, and don't render if no data
  if (!loaded || !trail || !hasContent(trail)) return null;

  const suggestions = trail.approvedSuggestions ?? [];
  const conversationCount = trail.mentions.length + suggestions.length;

  // Build tabs array (only show tabs with content)
  const tabs: Array<{ id: string; label: string; count: number }> = [];

  if (trail.sources.length > 0) {
    tabs.push({ id: 'sources', label: 'Sources', count: trail.sources.length });
  }
  if (trail.thread) {
    tabs.push({ id: 'thread', label: 'Research Thread', count: trail.thread.entries.length });
  }
  // Always show Conversation tab (for the suggest form even if no mentions yet)
  tabs.push({ id: 'conversation', label: 'Conversation', count: conversationCount });

  const defaultTab = tabs[0]?.id ?? 'sources';

  return (
    <section className="py-4">
      {/* Section header */}
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-7 h-7 rounded-full bg-teal flex items-center justify-center text-sm text-surface shrink-0">
          &#9678;
        </div>
        <div>
          <h2 className="font-title text-[22px] font-bold text-ink m-0">
            Paper Trail
          </h2>
          <p className="font-body-alt text-[13px] text-ink-light m-0 mt-0.5">
            {trail.sources.length} source{trail.sources.length !== 1 ? 's' : ''}
            {trail.backlinks.length > 0 && (
              <> · {trail.backlinks.length} connected piece{trail.backlinks.length !== 1 ? 's' : ''}</>
            )}
            {trail.thread?.durationDays != null && (
              <> · {trail.thread.durationDays} days of research</>
            )}
          </p>
        </div>
      </div>

      <Tabs.Root defaultValue={defaultTab}>
        {/* Tab navigation */}
        <Tabs.List className="flex border-b border-border mb-6">
          {tabs.map((tab) => (
            <Tabs.Trigger
              key={tab.id}
              value={tab.id}
              className="font-mono-alt text-[11px] uppercase tracking-[0.08em] text-ink-light bg-transparent border-none border-b-2 border-b-transparent px-4 py-2 -mb-px cursor-pointer transition-all duration-150 data-[state=active]:text-terracotta data-[state=active]:border-b-terracotta hover:text-ink-muted"
            >
              {tab.label}{' '}
              <span className="font-mono text-[10px] opacity-70">
                ({tab.count})
              </span>
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {/* Sources tab */}
        {trail.sources.length > 0 && (
          <Tabs.Content value="sources">
            {trail.sources.map((source, i) => (
              <SourceCard key={source.slug || i} source={source} index={i} />
            ))}

            {/* Backlinks section within Sources tab */}
            {trail.backlinks.length > 0 && (
              <div className="mt-8">
                <SectionLabel color="teal">Connected through research</SectionLabel>
                <p className="font-body-alt text-[13px] text-ink-light -mt-2 mb-4 leading-snug">
                  Other pieces that share sources with this essay
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {trail.backlinks.map((bl) => (
                    <BacklinkCard key={bl.contentSlug} backlink={bl} />
                  ))}
                </div>
              </div>
            )}
          </Tabs.Content>
        )}

        {/* Research Thread tab */}
        {trail.thread && (
          <Tabs.Content value="thread">
            <ThreadTimeline thread={trail.thread} />
          </Tabs.Content>
        )}

        {/* Conversation tab */}
        <Tabs.Content value="conversation">
          {trail.mentions.length > 0 && (
            <div>
              <SectionLabel color="terracotta">External mentions</SectionLabel>
              {trail.mentions.map((m, i) => (
                <MentionCard key={i} mention={m} index={i} />
              ))}
            </div>
          )}

          {suggestions.length > 0 && (
            <div className={trail.mentions.length > 0 ? 'mt-7' : ''}>
              <SectionLabel color="teal">Community suggestions</SectionLabel>
              {suggestions.map((s, i) => (
                <SuggestionCard key={i} suggestion={s} index={i} />
              ))}
            </div>
          )}

          <SuggestSourceForm slug={slug} contentType={trail.contentType} />
        </Tabs.Content>
      </Tabs.Root>
    </section>
  );
}
