// SOURCING: vitest + @commonplace/host-bridge — host factory unit tests.

import { describe, expect, it } from 'vitest';
import { createHost } from './createHost';
import { hostPresenceToMarkState } from './presenceMap';
import type { HostPresence } from '@commonplace/host-bridge';
import { LoopbackHost } from '@commonplace/host-bridge';

describe('createHost', () => {
  it('builds a gpui-loopback host that placeBlock round-trips', async () => {
    const host = createHost({ kind: 'gpui-loopback' });
    const block = await host.placeBlock({
      workspaceId: 'default',
      kind: 'note',
      id: 'block_console_1',
      grants: ['read'],
    });
    expect(block.id).toBe('block_console_1');
    await host.openTarget({ kind: 'ask', query: 'hello' });
  });

  it('builds a web host that openTarget delegates', async () => {
    const seen: string[] = [];
    const host = createHost({
      kind: 'web',
      queryObjects: async () => ({ objects: [], total: 0 }),
      onOpenTarget: async (t) => {
        if (t.kind === 'find') seen.push(t.query);
      },
    });
    await host.openTarget({ kind: 'find', query: 'substrate' });
    expect(seen).toEqual(['substrate']);
  });
});

describe('hostPresenceToMarkState', () => {
  it('maps frozen/acting/handoff onto PresenceMark states', () => {
    const frozen: HostPresence = {
      surface: 'commonplace',
      state: 'frozen',
      frozen: true,
    };
    expect(hostPresenceToMarkState(frozen)).toBe('interrupted');
    expect(
      hostPresenceToMarkState({
        surface: 'commonplace',
        state: 'acting',
        frozen: false,
      }),
    ).toBe('acting');
    expect(
      hostPresenceToMarkState({
        surface: 'commonplace',
        state: 'handoff',
        frozen: false,
      }),
    ).toBe('composing');
  });
});

describe('LoopbackHost presence publish', () => {
  it('delivers presence events to subscribers', () => {
    const host = new LoopbackHost();
    const events: string[] = [];
    const unsub = host.subscribeWorkspace('default', (e) => {
      if (e.type === 'presence') events.push(e.presence.state);
    });
    host.publishPresence('default', {
      surface: 'commonplace',
      state: 'acting',
      frozen: false,
      anchor: { x: 10, y: 20 },
    });
    unsub();
    expect(events).toContain('acting');
  });
});
