// SOURCING: none — pure logic, no upstream component applies
import { describe, expect, it } from 'vitest';

import {
  buildCompatibilityStates,
  firstUserPrompt,
  isAcpSpawnUnavailable,
} from './compatibility';

describe('chat stream ACP compatibility', () => {
  it('detects local theorem spawn ENOENT', () => {
    const error = Object.assign(new Error('spawn theorem ENOENT'), { code: 'ENOENT' });
    expect(isAcpSpawnUnavailable(error)).toBe(true);
  });

  it('reads the first add-message prompt', () => {
    expect(
      firstUserPrompt([
        {
          type: 'add-message',
          message: { role: 'user', parts: [{ type: 'text', text: 'hello theorem' }] },
          parentId: null,
          sourceId: null,
        },
      ]),
    ).toBe('hello theorem');
  });

  it('builds running then complete states for a compatibility answer', () => {
    const [running, complete] = buildCompatibilityStates(
      { mode: 'composed', bindingId: 'agent:theorem' },
      'ping',
      { ok: true, answer: 'pong', headId: 'mistral' },
    );
    expect(running.turnStatus).toBe('running');
    expect(running.messages[0]?.text).toBe('ping');
    expect(complete.turnStatus).toBe('complete');
    expect(complete.messages[1]?.text).toBe('pong');
    expect(complete.messages[1]?.contributions[0]?.headId).toBe('mistral');
  });
});
