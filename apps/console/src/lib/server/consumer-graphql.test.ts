import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { consumerGraphqlUrl } from './consumer-graphql';

describe('consumerGraphqlUrl', () => {
  it('uses the explicit CommonPlace consumer GraphQL endpoint', () => {
    expect(
      consumerGraphqlUrl({
        THEOREM_GRAPHQL_URL: ' https://commonplace.example/graphql/ ',
      }),
    ).toBe('https://commonplace.example/graphql');
  });

  it('accepts the existing CommonPlace base URL contract', () => {
    expect(
      consumerGraphqlUrl({
        THEOREM_GRAPHQL_URL: 'https://commonplace.example/',
      }),
    ).toBe('https://commonplace.example/graphql');
  });

  it('does not fall back to the Harness MCP host', () => {
    expect(
      consumerGraphqlUrl({
        CONSOLE_HARNESS_URL: 'https://api.theoremharness.com',
      }),
    ).toBeNull();
  });
});
