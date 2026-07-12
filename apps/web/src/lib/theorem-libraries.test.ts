import { describe, expect, it } from 'vitest';
import { libraryRecords, unwrapGraphqlField } from './theorem-libraries';

describe('theorem libraries client', () => {
  it('normalizes MCP structured content into operator records', () => {
    const payload = {
      result: { structuredContent: { data: { libraries: { libraries: [{ properties: {
        library_id: 'docs', name: 'Docs', root_url: 'https://example.com/', max_pages: 25,
        max_depth: 2, refresh_policy: 'cron', refresh_schedule: 'daily', updated_at_ms: 42,
      } }] } } } },
    };

    expect(libraryRecords(payload)).toEqual([{
      id: 'docs', name: 'Docs', rootUrl: 'https://example.com/', maxPages: 25, maxDepth: 2,
      refreshPolicy: 'cron', refreshSchedule: 'daily', updatedAtMs: 42,
    }]);
  });

  it('unwraps a queried JSON scalar', () => {
    const value = { result: { structuredContent: { data: { libraryQuery: { result: { count: 2 } } } } } };
    expect(unwrapGraphqlField(value, 'libraryQuery')).toEqual({ result: { count: 2 } });
  });
});
