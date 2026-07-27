// SOURCING: none. Browser client for Indexer live RustyWeb search BFF.

import type { SurveyCapture } from '@/views/survey/surveyContract';

export type IndexerLiveSearchClientResult =
  | { readonly ok: true; readonly query: string; readonly captures: readonly SurveyCapture[] }
  | { readonly ok: false; readonly error: string; readonly message: string };

function isSurveyCapture(value: unknown): value is SurveyCapture {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string'
    && typeof candidate.topicId === 'string'
    && typeof candidate.title === 'string'
    && typeof candidate.excerpt === 'string'
    && typeof candidate.sourceUrl === 'string'
  );
}

/** POST /api/indexer/search and return projected captures for the board. */
export async function fetchIndexerLiveSearch(input: {
  readonly query: string;
  readonly topicId: string;
  readonly signal?: AbortSignal;
}): Promise<IndexerLiveSearchClientResult> {
  try {
    const response = await fetch('/api/indexer/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: input.query,
        topicId: input.topicId,
      }),
      cache: 'no-store',
      signal: input.signal,
    });
    const payload = await response.json().catch(() => null) as {
      query?: unknown;
      captures?: unknown;
      error?: unknown;
      message?: unknown;
    } | null;
    if (!response.ok) {
      return {
        ok: false,
        error: typeof payload?.error === 'string' ? payload.error : 'indexer_search_failed',
        message: typeof payload?.message === 'string'
          ? payload.message
          : 'Live Indexer search failed.',
      };
    }
    const captures = Array.isArray(payload?.captures)
      ? payload.captures.filter(isSurveyCapture)
      : [];
    return {
      ok: true,
      query: typeof payload?.query === 'string' ? payload.query : input.query,
      captures,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, error: 'aborted', message: 'Live Indexer search was cancelled.' };
    }
    return {
      ok: false,
      error: 'indexer_search_unreachable',
      message: 'Live Indexer search could not reach the console BFF.',
    };
  }
}
