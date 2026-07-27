// SOURCING: none. Pure projection from RustyWeb acquisition hits into Indexer
// SurveyCapture objects the board already renders. DATAWAVE owns later ingest;
// this seam only projects live search into the research surface.

import type { WebResearchSource } from '@/lib/web-research-contract';
import type { SurveyCapture } from '@/views/survey/surveyContract';

const INDEXER_SEARCH_LIMIT = 15;

export { INDEXER_SEARCH_LIMIT };

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '') || 'web';
  } catch {
    return 'web';
  }
}

function captureIdForSource(url: string, index: number): string {
  let hash = 0;
  for (let i = 0; i < url.length; i += 1) {
    hash = ((hash << 5) - hash + url.charCodeAt(i)) | 0;
  }
  const token = Math.abs(hash).toString(36);
  return `capture.live-rustyweb-${token}-${index}`;
}

/** Project RustyWeb candidates into Indexer capture cards for the open topic. */
export function projectRustyWebSourcesToCaptures(
  sources: readonly WebResearchSource[],
  options: {
    readonly topicId: string;
    readonly query: string;
    readonly capturedAt?: string;
  },
): SurveyCapture[] {
  const capturedAt = options.capturedAt ?? new Date().toISOString();
  const queryTag = options.query.trim().toLowerCase().slice(0, 48);
  return sources.slice(0, INDEXER_SEARCH_LIMIT).map((source, index) => {
    const excerpt = source.snippet.trim() || source.title.trim() || source.url;
    const domain = domainFromUrl(source.url);
    return {
      id: captureIdForSource(source.url, index),
      topicId: options.topicId,
      title: source.title.trim() || domain,
      domain,
      sourceUrl: source.url,
      capturedAt,
      kind: 'capture',
      clusterId: 'live-search',
      clusterLabel: 'Live search',
      excerpt,
      contentMarkdown: [
        `# ${source.title.trim() || domain}`,
        '',
        excerpt,
        '',
        `Source: ${source.url}`,
        `Provider: ${source.provider}`,
      ].join('\n'),
      sourceKind: 'article' as const,
      sourceAspectRatio: 1.6,
      sourceLines: excerpt.split(/\n+/).map((line) => line.trim()).filter(Boolean).slice(0, 12),
      tags: ['live-search', 'rustyweb', ...(queryTag ? [queryTag] : [])],
      matchedSpans: [],
      mentions: [],
      entities: [source.provider || 'RustyWeb'],
      sourcePreviewKind: 'open_graph' as const,
      sourcePreviewOriginUrl: source.url,
      sourcePreviewTitle: source.title.trim() || domain,
      sourcePreviewDescription: excerpt,
    };
  });
}
