import { describe, expect, it } from 'vitest';
import { projectRustyWebSourcesToCaptures } from '@/lib/indexer-search-projection';

describe('indexer search projection', () => {
  it('projects RustyWeb sources into SurveyCapture cards for the open topic', () => {
    const captures = projectRustyWebSourcesToCaptures(
      [
        {
          title: 'DATAWAVE field facts',
          url: 'https://docs.example.test/datawave',
          snippet: 'Field-facts plus declared edges.',
          provider: 'searxng',
        },
        {
          title: 'RustyWeb acquisition',
          url: 'https://docs.example.test/rustyweb',
          snippet: 'Tenant-scoped web acquisition.',
          provider: 'RustyWeb',
        },
      ],
      {
        topicId: 'topic.fixture',
        query: 'datawave edges',
        capturedAt: '2026-07-24T16:00:00.000Z',
      },
    );

    expect(captures).toHaveLength(2);
    expect(captures[0]?.topicId).toBe('topic.fixture');
    expect(captures[0]?.clusterId).toBe('live-search');
    expect(captures[0]?.domain).toBe('docs.example.test');
    expect(captures[0]?.sourceUrl).toBe('https://docs.example.test/datawave');
    expect(captures[0]?.excerpt).toContain('Field-facts');
    expect(captures[0]?.tags).toEqual(expect.arrayContaining(['live-search', 'rustyweb', 'datawave edges']));
    expect(captures[0]?.id).toMatch(/^capture\.live-rustyweb-/);
    expect(captures[1]?.title).toBe('RustyWeb acquisition');
  });

  it('falls back to title or URL when snippet is empty', () => {
    const [capture] = projectRustyWebSourcesToCaptures(
      [{
        title: 'Bare title',
        url: 'https://example.test/bare',
        snippet: '   ',
        provider: 'RustyWeb',
      }],
      { topicId: 'topic.fixture', query: 'bare' },
    );
    expect(capture?.excerpt).toBe('Bare title');
  });
});
