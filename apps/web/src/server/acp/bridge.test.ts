import { describe, expect, it } from 'vitest';

import { BridgeCommandError, validateBridgeCommands, validateBridgePayload } from './bridge';

describe('ACP bridge command validation', () => {
  it('rejects a malformed batch before it can dispatch a valid command', () => {
    expect(() =>
      validateBridgeCommands([
        {
          type: 'add-message',
          message: { role: 'user', parts: [{ type: 'text', text: 'first' }] },
          parentId: null,
          sourceId: null,
        },
        { type: 'permission-response', callId: 1, decision: 'allow' },
      ]),
    ).toThrow(BridgeCommandError);
  });

  it('rejects nontext message parts before allocating a session', () => {
    expect(() =>
      validateBridgePayload({
        commands: [
          {
            type: 'add-message',
            message: { role: 'user', parts: [null] },
            parentId: null,
            sourceId: null,
          },
        ],
      }),
    ).toThrow(BridgeCommandError);
  });
});
