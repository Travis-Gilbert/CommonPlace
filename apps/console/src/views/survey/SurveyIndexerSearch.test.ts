import { describe, expect, it } from 'vitest';
import {
  filterSurveyCaptures,
  suggestIndexerCaptures,
} from './SurveyIndexerSearch';
import type { SurveyCapture } from './surveyContract';

function capture(partial: Partial<SurveyCapture> & Pick<SurveyCapture, 'id' | 'title'>): SurveyCapture {
  return {
    topicId: 'topic-1',
    domain: 'example.com',
    sourceUrl: 'https://example.com',
    capturedAt: '2026-07-22',
    kind: 'capture',
    clusterId: 'unclustered',
    clusterLabel: 'Unclustered',
    excerpt: 'An excerpt about durable storage.',
    contentMarkdown: 'An excerpt about durable storage.',
    sourceKind: 'article',
    sourceAspectRatio: 0.82,
    sourceLines: [],
    tags: [],
    matchedSpans: [],
    mentions: [],
    entities: [],
    ...partial,
  };
}

const CAPTURES = [
  capture({
    id: 'a',
    title: 'Rust database release',
    tags: ['rust', 'database'],
    entities: ['DataWave', 'RustyRed'],
    mentions: ['@indexer'],
  }),
  capture({
    id: 'b',
    title: 'Margin recall highlights',
    domain: 'github.com',
    tags: ['survey'],
    excerpt: 'Matched spans stay with the capture.',
    mentions: ['@indexer'],
  }),
] as const;

describe('SurveyIndexerSearch helpers', () => {
  it('returns the full harvest for an empty query', () => {
    expect(filterSurveyCaptures(CAPTURES, '   ')).toHaveLength(2);
  });

  it('filters captures by title, tags, domain, entities, mentions, and excerpt', () => {
    expect(filterSurveyCaptures(CAPTURES, 'rust').map((item) => item.id)).toEqual(['a']);
    expect(filterSurveyCaptures(CAPTURES, 'github').map((item) => item.id)).toEqual(['b']);
    expect(filterSurveyCaptures(CAPTURES, 'datawave').map((item) => item.id)).toEqual(['a']);
    expect(filterSurveyCaptures(CAPTURES, 'matched spans').map((item) => item.id)).toEqual(['b']);
    expect(filterSurveyCaptures(CAPTURES, '@indexer').map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('suggests harvest-derived terms only', () => {
    const suggestions = suggestIndexerCaptures(CAPTURES, 'rus');
    expect(suggestions.some((item) => item.value.toLowerCase().includes('rust'))).toBe(true);
    expect(suggestions.every((item) => !/react|vue|angular/i.test(item.value))).toBe(true);
  });
});
