// SOURCING: none. Unit oracle for CS15 degradation vocabulary.
import { describe, expect, it, vi, afterEach } from 'vitest';
import { degradationFor, sentenceForCode } from './degradation';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('degradationFor', () => {
  it('maps known wire codes to prose without leaking the code', () => {
    const codes = [
      'console_data_api_unreachable',
      'harness_graphql_failed',
      'harness_graphql_timeout',
      'harness_graphql_unconfigured',
      'harness_graphql_unreachable',
      'observed_model_graphql_failed',
      'observed_model_graphql_timeout',
      'observed_model_graphql_unconfigured',
      'tenant_object_credential_unavailable',
      'console_chat_wire_failed',
      'web_search_unavailable',
      'trigram',
    ] as const;

    for (const code of codes) {
      const result = degradationFor(code);
      expect(JSON.stringify(result)).not.toContain(code);
      expect(result.cause.length).toBeGreaterThan(0);
    }
  });

  it('treats readiness gaps as reduced and usable', () => {
    const result = degradationFor('trigram');
    expect(result.level).toBe('reduced');
    expect(result.cause.toLowerCase()).toContain('trigram');
  });

  it('treats transport failures as unavailable with an action hint', () => {
    const result = degradationFor('console_data_api_unreachable');
    expect(result.level).toBe('unavailable');
    expect(result.cause.toLowerCase()).toMatch(/data|unreachable|transport|api/);
  });

  it('reports unmapped codes in development without shipping the code to the user', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = degradationFor('brand_new_wire_code_xyz');
    expect(JSON.stringify(result)).not.toContain('brand_new_wire_code_xyz');
    expect(result.cause.length).toBeGreaterThan(0);
    if (process.env.NODE_ENV !== 'production') {
      expect(warn).toHaveBeenCalled();
    }
  });

  it('exposes sentenceForCode for every known map entry', () => {
    expect(sentenceForCode('observed_model_graphql_failed')).toMatch(/model|schema|graph/i);
  });
});

// 2026-08-01: 'The data API is unreachable.' was shown for an API answering 200
// on /healthz. One sentence covered CORS, 404, 401, DNS and a dead dependency,
// so it named none of them. These pin the distinctions back down.
describe('degradationFor origin evidence', () => {
  it('does not invent a status from a bare number', () => {
    // Callers pass a synthetic 400/500 to steer the generic branch for failures
    // that never made a request. Rendering "answered 400" would be a new lie.
    const result = degradationFor('console_data_api_unreachable', 400);
    expect(result.level).toBe('unavailable');
    expect(result).not.toHaveProperty('detail', expect.stringContaining('400'));
    expect(result.detail).toBeUndefined();
  });

  it('names the door, the host, and the status code', () => {
    const result = degradationFor('console_data_api_unreachable', {
      door: '/api/objects/views',
      host: 'commonplace-api-production.up.railway.app',
      status: 404,
    });
    expect(result.detail).toContain('/api/objects/views');
    expect(result.detail).toContain('commonplace-api-production.up.railway.app');
    expect(result.detail).toContain('404');
  });

  it('separates a credential refusal from an outage', () => {
    const unauthorized = degradationFor('console_data_api_unreachable', { status: 401 });
    const missing = degradationFor('console_data_api_unreachable', { status: 404 });
    expect(unauthorized.detail).toMatch(/credential/i);
    expect(unauthorized.detail).not.toEqual(missing.detail);
  });

  it('separates a request that never landed from any answered status', () => {
    const noAnswer = degradationFor('console_data_api_unreachable', {
      door: '/api/objects/views',
    });
    const answered = degradationFor('console_data_api_unreachable', {
      door: '/api/objects/views',
      status: 502,
    });
    expect(noAnswer.detail).toMatch(/did not answer/i);
    expect(answered.detail).toContain('502');
    expect(noAnswer.detail).not.toEqual(answered.detail);
  });

  it('falls back to the door the wire code already knows', () => {
    const result = degradationFor('harness_graphql_unreachable', { status: 503 });
    expect(result.detail).toMatch(/harness/i);
    expect(result.detail).toContain('503');
  });

  it('still keeps the wire code out of what the user sees', () => {
    const result = degradationFor('console_data_api_unreachable', {
      door: '/api/objects/views',
      host: 'example.internal',
      status: 502,
    });
    expect(JSON.stringify(result)).not.toContain('console_data_api_unreachable');
  });
});
