import { describe, expect, it } from 'vitest';
import { agentProcessCacheKey } from './session-manager';
import type { AgentProcessKey } from './state';

function key(overrides: Partial<AgentProcessKey> = {}): AgentProcessKey {
  return {
    mount: '/workspace',
    mode: 'composed',
    bindingId: 'agent:theorem',
    tenant: 'Travis-Gilbert',
    authToken: 'thk_owner_secret-material',
    ...overrides,
  };
}

describe('ACP process isolation', () => {
  it('separates tenants and credentials without rendering bearer material', () => {
    const owner = agentProcessCacheKey(key());
    const anotherTenant = agentProcessCacheKey(key({ tenant: 'Another-Tenant' }));
    const rotatedCredential = agentProcessCacheKey(key({
      authToken: 'thk_owner_rotated-secret',
    }));

    expect(owner).not.toBe(anotherTenant);
    expect(owner).not.toBe(rotatedCredential);
    expect(owner).not.toContain('thk_owner_secret-material');
    expect(owner).not.toContain('rotated-secret');
  });

  it('is stable for the same canonical process identity', () => {
    expect(agentProcessCacheKey(key())).toBe(agentProcessCacheKey(key()));
  });
});
