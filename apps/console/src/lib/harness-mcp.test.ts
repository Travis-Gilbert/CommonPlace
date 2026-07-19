import { describe, expect, it } from 'vitest';
import { identityBoundArguments } from '@/lib/harness-mcp-core';

describe('identity-bound Harness MCP calls', () => {
  it('overwrites browser-supplied tenant and actor with the admitted principal', () => {
    expect(identityBoundArguments({
      action: 'inspect',
      actor: 'attacker',
      tenant: 'Other',
      tenant_slug: 'Other',
    }, {
      tenant: 'Travis-Gilbert',
      githubLogin: 'Travis-Gilbert',
      harnessIdentity: 'github:owner',
    })).toMatchObject({
      tenant: 'Travis-Gilbert',
      tenant_slug: 'Travis-Gilbert',
      actor: 'github:owner',
    });
  });
});
