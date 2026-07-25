// SOURCING: RustyRed /v1/rustyweb/search via loadWebResearch. Indexer search
// acquires live candidates and projects them as SurveyCapture cards. Standing
// harvest / DATAWAVE still owns durable ingest; this path is the interactive
// projection into the Indexer board.

import 'server-only';

import type { HarnessPrincipal } from '@/lib/harness-principal-core';
import {
  INDEXER_SEARCH_LIMIT,
  projectRustyWebSourcesToCaptures,
} from '@/lib/indexer-search-projection';
import { loadWebResearch } from '@/lib/server/web-research';
import type { SurveyCapture } from '@/views/survey/surveyContract';

export type IndexerLiveSearch =
  | { readonly ok: true; readonly captures: readonly SurveyCapture[]; readonly query: string }
  | { readonly ok: false; readonly status: number; readonly error: string; readonly message: string };

export async function searchIndexerLive(
  query: string,
  topicId: string,
  principal: HarnessPrincipal,
  request: Request,
): Promise<IndexerLiveSearch> {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      ok: false,
      status: 400,
      error: 'missing_query',
      message: 'Indexer search requires a non-empty query.',
    };
  }
  if (!topicId.trim()) {
    return {
      ok: false,
      status: 400,
      error: 'missing_topic',
      message: 'Indexer search requires an open topic.',
    };
  }

  const research = await loadWebResearch(trimmed, principal, request, {
    limit: INDEXER_SEARCH_LIMIT,
    emptyOk: true,
  });
  if (!research.ok) {
    const body = await research.response.json().catch(() => null) as {
      error?: unknown;
      message?: unknown;
    } | null;
    return {
      ok: false,
      status: research.response.status,
      error: typeof body?.error === 'string' ? body.error : 'indexer_search_failed',
      message: typeof body?.message === 'string'
        ? body.message
        : 'RustyWeb search could not complete for Indexer.',
    };
  }

  return {
    ok: true,
    query: trimmed,
    captures: projectRustyWebSourcesToCaptures(research.sources, {
      topicId: topicId.trim(),
      query: trimmed,
    }),
  };
}
