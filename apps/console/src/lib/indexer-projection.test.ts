import { describe, expect, it } from 'vitest';
import type { ObjectRef } from '@commonplace/block-view/types';
import {
  filterIndexerObjects,
  indexerProjectionIsReadable,
  parseIndexerObjectsPayload,
} from './indexer-projection';

const projected: ObjectRef[] = [
  {
    id: 'rust-databases',
    type: 'topic',
    properties: {
      topic_id: 'rust-databases',
      title: 'Rust databases',
      description: 'Track rust database releases',
      updated: '2026-07-22T00:00:00Z',
      capture_count: 1,
      status: 'active',
    },
  },
  {
    id: 'topic_document:abc',
    type: 'capture',
    properties: {
      topic_id: 'rust-databases',
      title: 'Rust database release',
      domain: 'example.com',
      source_url: 'https://example.com/rust-one',
      captured_at: '2026-07-22T00:00:00Z',
      kind: 'capture',
      excerpt: 'Rust database releases keep the graph current.',
      content_markdown: 'Rust database releases keep the graph current.',
      source_kind: 'article',
      source_aspect_ratio: 0.82,
      source_lines: ['Rust database releases keep the graph current.'],
      tags: ['topic-harvest', 'rust'],
      matched_spans: [
        { start: 0, end: 4, feature: 'topic term `rust`', attribution: 'topic relevance gate' },
      ],
      entities: [],
      mentions: [],
    },
  },
];

describe('indexer-projection', () => {
  it('parses Theorem topicIndexerObjects payloads into ObjectRefs', () => {
    const objects = parseIndexerObjectsPayload({ objects: projected });
    expect(objects).toHaveLength(2);
    expect(indexerProjectionIsReadable(objects)).toBe(true);
  });

  it('filters by survey query types and topic_id', () => {
    const filtered = filterIndexerObjects(
      projected,
      {
        types: ['capture'],
        where: { kind: 'eq', field: 'topic_id', value: 'rust-databases' },
      },
      (object, predicate) => {
        if (!predicate || predicate.kind !== 'eq') return true;
        return object.properties[predicate.field] === predicate.value;
      },
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.type).toBe('capture');
  });
});
