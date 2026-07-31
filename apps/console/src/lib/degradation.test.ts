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
      'mcp_authentication_failed',
      'mcp_session_uninitialized',
      'mcp_not_acceptable',
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

  it('names MCP authentication, session, and response negotiation failures', () => {
    expect(sentenceForCode('mcp_authentication_failed')).toMatch(/credential|account/i);
    expect(sentenceForCode('mcp_session_uninitialized')).toMatch(/session|expired/i);
    expect(sentenceForCode('mcp_not_acceptable')).toMatch(/response|format|protocol/i);
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
