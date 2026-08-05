// SOURCING: none. SPEC-THEOREM-CHAT-REGISTER-1.0 §2 / §6 CR-004 oracle.
import { describe, expect, it, vi } from 'vitest';
import { createChatSessionController } from './session.js';
import type { ChatTransport } from './transport.js';
import { REGISTER_IMPL } from './register-impl.js';

function fakeTransport(replies: Record<string, string> = { hi: 'hello' }): ChatTransport {
  let sessionId = '';
  return {
    async openSession() {
      sessionId = 'sess-1';
      return sessionId;
    },
    async prompt(_sessionId, text, onDelta) {
      const reply = replies[text] ?? `echo:${text}`;
      onDelta(reply);
    },
    dispose() {},
  };
}

describe('theorem.chat register', () => {
  it('stamps register_impl theorem.chat', () => {
    expect(REGISTER_IMPL).toBe('theorem.chat');
  });

  it('opens a session and completes one turn', async () => {
    const transport = fakeTransport({ ping: 'pong' });
    const openSpy = vi.spyOn(transport, 'openSession');
    const promptSpy = vi.spyOn(transport, 'prompt');
    const controller = createChatSessionController(transport);

    const id = await controller.open();
    expect(id).toBe('sess-1');
    expect(openSpy).toHaveBeenCalledOnce();

    await controller.prompt('ping');
    expect(promptSpy).toHaveBeenCalledOnce();
    expect(promptSpy.mock.calls[0]?.[0]).toBe('sess-1');
    expect(promptSpy.mock.calls[0]?.[1]).toBe('ping');

    const snap = controller.getSnapshot();
    expect(snap.sessionId).toBe('sess-1');
    expect(snap.running).toBe(false);
    expect(snap.messages.some((m) => m.role === 'user' && m.text === 'ping')).toBe(true);
    expect(snap.messages.some((m) => m.role === 'assistant' && m.text === 'pong')).toBe(true);

    controller.dispose();
  });

  it('auto-opens on first prompt', async () => {
    const transport = fakeTransport();
    const controller = createChatSessionController(transport);
    await controller.prompt('hi');
    expect(controller.getSnapshot().sessionId).toBe('sess-1');
    expect(controller.getSnapshot().messages.some((m) => m.text === 'hello')).toBe(true);
    controller.dispose();
  });
});
