import { describe, expect, it } from 'vitest';
import { libraryReceipt, libraryRecords, unwrapGraphqlField } from './theorem-libraries';

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

  it('normalizes a direct RustyWeb crawl receipt', () => {
    const value = { result: { structuredContent: { receipt: {
      receipt_id: 'receipt-1', operation: 'live_crawl', pages_fetched: 4,
      changed_pages: 2, facts_deposited: 6, metered_cost: { unit: 'input_byte', quantity: 1024 },
    } } } };
    expect(libraryReceipt(value)).toEqual({
      receiptId: 'receipt-1', operation: 'live_crawl', pagesFetched: 4,
      changedPages: 2, factsDeposited: 6, meteredCost: { unit: 'input_byte', quantity: 1024 },
    });
  });
});
