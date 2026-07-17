import { afterEach, describe, expect, it } from 'vitest';
import {
  hostedAgentIdForKey,
  resolveAcpTransport,
  resolveHostedAcpWsUrl,
} from './hosted-client';

describe('hosted ACP transport routing', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('defaults to hosted in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.THEOREM_ACP_TRANSPORT;
    delete process.env.THEOREM_ACP_BIN;
    expect(resolveAcpTransport()).toBe('hosted');
  });

  it('keeps local spawn when explicitly opted in', () => {
    process.env.THEOREM_ACP_TRANSPORT = 'local';
    expect(resolveAcpTransport()).toBe('local');
  });

  it('maps composed keys to theorem agent id', () => {
    expect(hostedAgentIdForKey('composed', 'agent:theorem')).toBe('theorem');
  });

  it('builds a wss URL from THEOREM_NODE_URL', () => {
    process.env.THEOREM_NODE_URL = 'https://api.theoremharness.com';
    delete process.env.THEOREM_ACP_WS_URL;
    delete process.env.NEXT_PUBLIC_COMMONPLACE_ACP_WS_URL;
    delete process.env.RAILWAY_ENVIRONMENT;
    process.env.NODE_ENV = 'production';
    expect(resolveHostedAcpWsUrl()).toBe(
      'wss://api.theoremharness.com/v1/commonplace/acp/ws',
    );
  });
});
