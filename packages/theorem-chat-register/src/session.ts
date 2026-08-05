// SOURCING: none. SPEC-THEOREM-CHAT-REGISTER-1.0 §2 session controller.
import type { ChatTransport } from './transport';

export type ChatMessage = {
  readonly id: string;
  readonly role: 'user' | 'assistant' | 'system';
  readonly text: string;
};

export type ChatSessionSnapshot = {
  readonly sessionId: string;
  readonly messages: readonly ChatMessage[];
  readonly running: boolean;
  readonly error: string | null;
};

export type ChatSessionController = {
  open(): Promise<string>;
  prompt(text: string): Promise<void>;
  getSnapshot(): ChatSessionSnapshot;
  subscribe(listener: (snapshot: ChatSessionSnapshot) => void): () => void;
  dispose(): void;
};

/**
 * Thin controller over a ChatTransport. Owns local message projection so both
 * mounts share one open+turn contract in tests.
 */
export function createChatSessionController(transport: ChatTransport): ChatSessionController {
  let sessionId: string | null = null;
  let messages: ChatMessage[] = [];
  let running = false;
  let error: string | null = null;
  const listeners = new Set<(snapshot: ChatSessionSnapshot) => void>();
  let seq = 0;

  const nextId = () => `tcr-${Date.now()}-${++seq}`;

  const snapshot = (): ChatSessionSnapshot => ({
    sessionId: sessionId ?? '',
    messages,
    running,
    error,
  });

  const emit = () => {
    const snap = snapshot();
    for (const listener of listeners) listener(snap);
  };

  return {
    async open() {
      error = null;
      sessionId = await transport.openSession();
      emit();
      return sessionId;
    },
    async prompt(text: string) {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (!sessionId) await this.open();
      if (!sessionId) throw new Error('theorem.chat: session failed to open');
      const user: ChatMessage = { id: nextId(), role: 'user', text: trimmed };
      const assistantId = nextId();
      const assistant: ChatMessage = { id: assistantId, role: 'assistant', text: '' };
      messages = [...messages, user, assistant];
      running = true;
      error = null;
      emit();
      try {
        await transport.prompt(sessionId, trimmed, (chunk) => {
          messages = messages.map((message) =>
            message.id === assistantId
              ? { ...message, text: message.text + chunk }
              : message,
          );
          emit();
        });
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        throw err;
      } finally {
        running = false;
        emit();
      }
    },
    getSnapshot: snapshot,
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot());
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      listeners.clear();
      transport.dispose();
    },
  };
}
