import { describe, expect, it } from 'vitest';

import {
  collectDegradationNotices,
  WEB_SEARCH_DISABLED_MESSAGE,
  type InquirySnapshot,
} from '@/lib/inquiry-types';

function minimalSnapshot(overrides: Partial<InquirySnapshot> = {}): InquirySnapshot {
  return {
    snapshot_id: 'snap:1',
    thread_id: 'thread:1',
    parent_snapshot_id: null,
    query: 'test',
    surface: 'index',
    scope_refs: [],
    effective_web_policy: 'enabled',
    query_variants: [],
    evidence: [],
    result_lanes: [],
    retrieval_status: 'ready',
    degradation_reasons: [],
    state_hash: 'hash',
    created_at: 't0',
    ...overrides,
  };
}

describe('collectDegradationNotices', () => {
  it('adds settings copy when web policy is disabled by user', () => {
    const notices = collectDegradationNotices(
      minimalSnapshot({ effective_web_policy: 'disabled_by_user' }),
    );
    expect(notices[0]).toBe(WEB_SEARCH_DISABLED_MESSAGE);
  });
});
