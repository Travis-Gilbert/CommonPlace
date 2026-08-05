'use client';

// SOURCING: none. SPEC-THEOREM-CHAT-REGISTER-1.0 TheoremChatRegister.
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { REGISTER_IMPL } from './register-impl.js';
import {
  createChatSessionController,
  type ChatSessionController,
  type ChatSessionSnapshot,
} from './session.js';
import type { ChatTransport } from './transport.js';

export type TheoremChatRegisterProps = {
  readonly transport: ChatTransport;
  /** Optional reason shown above the composer (fallback / degradation copy). */
  readonly reason?: string;
  readonly className?: string;
  /** When true, open the ACP/stream session on mount. */
  readonly autoOpen?: boolean;
};

/**
 * Shared register body for console `/chat` and Studio webview hosts.
 * Stamps `data-register-impl="theorem.chat"`.
 */
export function TheoremChatRegister({
  transport,
  reason,
  className,
  autoOpen = true,
}: TheoremChatRegisterProps) {
  const controller = useMemo(
    () => createChatSessionController(transport),
    [transport],
  );
  const [snap, setSnap] = useState<ChatSessionSnapshot>(() => controller.getSnapshot());
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const unsub = controller.subscribe(setSnap);
    if (autoOpen) {
      void controller.open().catch((err) => {
        setSnap({
          ...controller.getSnapshot(),
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }
    return () => {
      unsub();
      controller.dispose();
    };
  }, [controller, autoOpen]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || snap.running) return;
    setDraft('');
    try {
      await controller.prompt(text);
    } catch {
      // Error is on the snapshot.
    }
  }

  return (
    <div
      className={className}
      data-register-impl={REGISTER_IMPL}
      data-theorem-chat-register
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        gap: '0.75rem',
        padding: '1rem',
        boxSizing: 'border-box',
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <strong>Theorem chat</strong>
        {reason ? <p style={{ margin: 0, opacity: 0.75, fontSize: '0.875rem' }}>{reason}</p> : null}
        {snap.sessionId ? (
          <p style={{ margin: 0, opacity: 0.55, fontSize: '0.75rem' }}>
            session {snap.sessionId}
          </p>
        ) : null}
      </header>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
        data-theorem-chat-messages
      >
        {snap.messages.length === 0 ? (
          <p style={{ opacity: 0.6, margin: 0 }}>Start a turn. Transport is Theorem ACP.</p>
        ) : (
          snap.messages.map((message) => (
            <div
              key={message.id}
              data-role={message.role}
              style={{
                alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.5rem',
                background: message.role === 'user' ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.04)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {message.text || (message.role === 'assistant' && snap.running ? '…' : '')}
            </div>
          ))
        )}
      </div>

      {snap.error ? (
        <p role="alert" style={{ color: 'crimson', margin: 0, fontSize: '0.875rem' }}>
          {snap.error}
        </p>
      ) : null}

      <form onSubmit={onSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          aria-label="Message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={snap.running}
          placeholder="Message Theorem…"
          style={{ flex: 1, minWidth: 0, padding: '0.5rem 0.75rem' }}
        />
        <button type="submit" disabled={snap.running || !draft.trim()}>
          {snap.running ? 'Sending…' : 'Send'}
        </button>
      </form>
    </div>
  );
}

export type { ChatSessionController };
