import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('server-only', () => ({}));

// Client helpers under test — fetch is stubbed.
import {
  fetchCommandGallery,
  shouldBlockRunAfterValidation,
  validateProgramDefinition,
} from '../../views/program/programClient';

describe('programClient gallery + validate', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('maps gallery entries from substrate', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          result: {
            entries: [
              {
                kind: 'monitor_template',
                slug_or_name: 'Price watch',
                title: 'Price watch',
                summary: 'Watch price',
                program_id: 'cid:price',
                validation: {
                  program_id: 'cid:price',
                  checks: [{ requirement: 'program_identity', passed: true }],
                },
              },
            ],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const entries = await fetchCommandGallery();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.title).toBe('Price watch');
    expect(entries[0]?.source).toBe('substrate');
    expect(entries[0]?.validationPassed).toBe(true);
  });

  it('falls back to LocalDevCommandGallery when gallery refuses', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'console_harness_unconfigured' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const entries = await fetchCommandGallery();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((entry) => entry.source === 'LocalDevCommandGallery')).toBe(true);
  });

  it('parses validate refusal with node ids', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          refusal: {
            code: 'typed_stream_edges',
            message: 'edge mismatch',
            node_ids: ['n1', 'n2'],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const result = await validateProgramDefinition({
      tenant_id: 't',
      name: 'x',
      intent: 'y',
      trigger: { kind: 'manual' },
      budget: {},
      approval: {},
      nodes: [],
      edges: [],
      metadata: {},
    } as never);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.nodeIds).toEqual(['n1', 'n2']);
      expect(result.code).toBe('typed_stream_edges');
      expect(shouldBlockRunAfterValidation(result)).toBe(true);
    }
  });

  it('blocks run when validate checks fail', () => {
    expect(
      shouldBlockRunAfterValidation({
        ok: true,
        receipt: {
          program_id: 'p',
          checks: [{ requirement: 'cycles', passed: false }],
        },
      }),
    ).toBe(true);
    expect(
      shouldBlockRunAfterValidation({
        ok: true,
        receipt: {
          program_id: 'p',
          checks: [{ requirement: 'cycles', passed: true }],
        },
      }),
    ).toBe(false);
  });
});
