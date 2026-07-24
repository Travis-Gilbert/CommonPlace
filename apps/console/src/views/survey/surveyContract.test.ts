import { describe, expect, it } from 'vitest';
import type { ObjectRef } from '@commonplace/block-view/types';
import { seedSurveyObjects } from '@/lib/surveySeed';
import {
  budgetSurveyEdges,
  excerptSegments,
  layoutSurveyGalaxy,
  normalizeMatchedSpans,
  surveyModelFromObjects,
} from './surveyContract';

describe('Survey contract', () => {
  it('keeps persisted matched spans and feature attribution attached to excerpt text', () => {
    const model = surveyModelFromObjects(seedSurveyObjects());
    const capture = model.captures.find((candidate) => candidate.id === 'capture-survey-brief');

    expect(capture).toBeDefined();
    expect(capture?.matchedSpans).toEqual(expect.arrayContaining([
      expect.objectContaining({ feature: 'semantic scope', attribution: 'topic relevance gate' }),
      expect.objectContaining({ feature: 'persisted salience', attribution: 'topic relevance gate' }),
    ]));
    expect(capture).toMatchObject({
      sourceKind: 'document',
      sourceAspectRatio: 2,
      sourceSnapshotUrl: '/survey/github-commonplace-survey-commit-og.png',
      sourcePreviewKind: 'open_graph',
      sourcePreviewOriginUrl: expect.stringContaining('opengraph.githubassets.com'),
      sourcePreviewTitle: expect.stringContaining('DESIGN-SURVEY-SURFACE'),
      tags: ['survey', 'product thesis'],
    });
    const highlighted = excerptSegments(capture?.excerpt ?? '', capture?.matchedSpans ?? [])
      .filter((segment) => segment.matched)
      .map((segment) => segment.text);
    expect(highlighted).toEqual(['scoped to why it was captured', 'spans matched']);
  });

  it('rejects malformed and overlapping span claims instead of highlighting guessed text', () => {
    const excerpt = 'alpha beta gamma';
    const spans = normalizeMatchedSpans(excerpt, [
      { start: 0, end: 5, feature: 'valid' },
      { start: 2, end: 8, feature: 'overlap' },
      { start: 11, end: 99, feature: 'out of bounds' },
      { start: -1, end: 2, feature: 'negative' },
    ]);

    expect(spans).toEqual([
      { start: 0, end: 5, feature: 'valid', attribution: 'topic relevance gate' },
    ]);
  });

  it('admits safe provenance links and held media while rejecting executable or remote image URLs', () => {
    const capture = (sourceUrl: string, heroImage: string, sourceSnapshotUrl: string): ObjectRef => ({
      id: `capture-${sourceUrl}`,
      type: 'capture',
      properties: {
        topic_id: 'topic-safe-links',
        excerpt: 'Evidence with a source.',
        source_url: sourceUrl,
        hero_image: heroImage,
        source_snapshot_url: sourceSnapshotUrl,
      },
    });
    const objects: ObjectRef[] = [
      { id: 'topic-safe-links', type: 'topic', properties: { title: 'Safe links' } },
      capture('https://example.com/evidence', '/api/blobs/held-image', '/api/blobs/source-snapshot'),
      capture('javascript:alert(document.domain)', 'https://tracker.example/pixel.gif', 'data:image/svg+xml,bad'),
      capture('https://user:password@example.com/private', '//tracker.example/pixel.gif', 'https://tracker.example/page.png'),
    ];

    const model = surveyModelFromObjects(objects);
    expect(model.captures[0]).toMatchObject({
      sourceUrl: 'https://example.com/evidence',
      heroImage: '/api/blobs/held-image',
      sourceSnapshotUrl: '/api/blobs/source-snapshot',
    });
    expect(model.captures[1]).toMatchObject({ sourceUrl: '' });
    expect(model.captures[1]?.heroImage).toBeUndefined();
    expect(model.captures[1]?.sourceSnapshotUrl).toBeUndefined();
    expect(model.captures[2]).toMatchObject({ sourceUrl: '' });
    expect(model.captures[2]?.heroImage).toBeUndefined();
    expect(model.captures[2]?.sourceSnapshotUrl).toBeUndefined();
  });

  it('settles identical capture inputs into identical cluster geometry', () => {
    const model = surveyModelFromObjects(seedSurveyObjects());
    const first = layoutSurveyGalaxy(model.clusters);
    const second = layoutSurveyGalaxy(model.clusters);

    expect(first).toEqual(second);
    expect(first).toHaveLength(model.captures.length);
    expect(new Set(first.map((item) => `${item.x}:${item.y}:${item.z}`)).size)
      .toBe(first.length);
  });

  it('keeps source-authored preview provenance separate from the held render asset', () => {
    const model = surveyModelFromObjects(seedSurveyObjects());
    const capture = model.captures.find((candidate) => candidate.id === 'capture-survey-brief');

    expect(capture).toMatchObject({
      sourceUrl: 'https://github.com/Travis-Gilbert/CommonPlace/commit/b66beba0bf58b6c93d599748edba3f3c799765b1',
      sourceSnapshotUrl: '/survey/github-commonplace-survey-commit-og.png',
      sourcePreviewKind: 'open_graph',
      sourceSnapshotAlt: 'GitHub preview for the CommonPlace Survey design commit',
    });
    expect(capture?.sourcePreviewOriginUrl).toMatch(/^https:\/\/opengraph\.githubassets\.com\//);
    expect(capture?.sourceSnapshotUrl).not.toBe(capture?.sourcePreviewOriginUrl);
    expect(model.captures.every((candidate) => (
      Boolean(candidate.sourceSnapshotUrl) && Boolean(candidate.sourcePreviewKind)
    ))).toBe(true);
    expect(model.captures.filter((candidate) => candidate.sourcePreviewKind === 'screenshot')).toHaveLength(12);
    expect(model.captures.filter((candidate) => candidate.sourcePreviewKind === 'open_graph')).toHaveLength(3);
  });

  it('preserves source-owned tall and wide aspect ratios without narrowing them to card defaults', () => {
    const objects: ObjectRef[] = [
      { id: 'topic-aspect', type: 'topic', properties: { title: 'Aspect ratios' } },
      {
        id: 'capture-tall',
        type: 'capture',
        properties: { topic_id: 'topic-aspect', excerpt: 'Tall source', source_aspect_ratio: 0.32 },
      },
      {
        id: 'capture-wide',
        type: 'capture',
        properties: { topic_id: 'topic-aspect', excerpt: 'Wide source', source_aspect_ratio: 3.6 },
      },
      {
        id: 'capture-invalid',
        type: 'capture',
        properties: { topic_id: 'topic-aspect', excerpt: 'Invalid source', source_aspect_ratio: 0 },
      },
    ];

    const model = surveyModelFromObjects(objects);
    expect(model.captures.map((capture) => capture.sourceAspectRatio)).toEqual([0.82, 0.32, 3.6]);
  });

  it('budgets connection density to the strongest two edges per clipping', () => {
    const model = surveyModelFromObjects(seedSurveyObjects());
    const selected = budgetSurveyEdges(model.edges, 2);
    const degree = new Map<string, number>();
    for (const edge of selected) {
      degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
      degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
    }

    expect(selected.length).toBeGreaterThan(0);
    expect(Math.max(...degree.values())).toBeLessThanOrEqual(2);
    expect(selected[0]?.strength).toBeGreaterThanOrEqual(selected.at(-1)?.strength ?? 0);
  });

  it('preserves valid cyclic relation claims without imposing a DAG', () => {
    const capture = (id: string): ObjectRef => ({
      id,
      type: 'capture',
      properties: { topic_id: 'topic-cycle', excerpt: `${id} evidence` },
    });
    const edge = (id: string, from: string, to: string): ObjectRef => ({
      id,
      type: 'survey-edge',
      properties: { from, to, reason: `${from} relates to ${to}`, strength: 0.8 },
    });
    const model = surveyModelFromObjects([
      { id: 'topic-cycle', type: 'topic', properties: { title: 'Cyclic relations' } },
      capture('a'),
      capture('b'),
      capture('c'),
      edge('edge-a-b', 'a', 'b'),
      edge('edge-b-c', 'b', 'c'),
      edge('edge-c-a', 'c', 'a'),
    ]);

    expect(model.edges.map((candidate) => candidate.id)).toEqual([
      'edge-a-b',
      'edge-b-c',
      'edge-c-a',
    ]);
  });
});
