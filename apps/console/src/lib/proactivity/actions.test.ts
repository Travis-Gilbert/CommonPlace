// SOURCING: vitest. The action vocabulary is a security boundary: only named
// reversible edits pass, while tenant and generic grant-shaped payloads fail.

import { describe, expect, it } from 'vitest';
import { proactivityActionSchema } from './actions';

describe('proactivity action boundary', () => {
  it('accepts an explicit reversible edit', () => {
    expect(proactivityActionSchema.safeParse({
      kind: 'set-node-enabled',
      nodeId: 'tenant:Travis-Gilbert:watch:deadline',
      enabled: false,
    }).success).toBe(true);
  });

  it('refuses client tenant, generic patch, grant, and effect-contract fields', () => {
    for (const input of [
      {
        kind: 'set-node-enabled',
        nodeId: 'tenant:Travis-Gilbert:watch:deadline',
        enabled: true,
        tenant: 'Travis-Gilbert',
      },
      {
        kind: 'patch',
        nodeId: 'tenant:Travis-Gilbert:watch:deadline',
        patch: { enabled: true },
      },
      {
        kind: 'set-response-action-class',
        nodeId: 'tenant:Travis-Gilbert:response:prepare-draft',
        actionClass: 'email.prepare_draft',
        grantId: 'grant:forged',
      },
      {
        kind: 'set-response-action-class',
        nodeId: 'tenant:Travis-Gilbert:response:prepare-draft',
        actionClass: 'email.prepare_draft',
        effectContractId: 'effect:forged',
      },
    ]) {
      expect(proactivityActionSchema.safeParse(input).success).toBe(false);
    }
  });
});
