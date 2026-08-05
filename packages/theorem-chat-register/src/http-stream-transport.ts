// SOURCING: none. Console mount uses fetch SSE to /api/chat/stream (theorem-acp
// bridge already behind that route). No OpenWork / opencode import.
import type { ChatTransport } from './transport';

export type HttpStreamTransportOptions = {
  readonly endpoint?: string;
  readonly fetchImpl?: typeof fetch;
};

/**
 * ChatTransport that POSTs the console composer shape to the Theorem stream
 * door and forwards SSE text deltas.
 */
export function createHttpStreamTransport(
  options: HttpStreamTransportOptions = {},
): ChatTransport {
  const endpoint = options.endpoint ?? '/api/chat/stream';
  const fetchImpl = options.fetchImpl ?? fetch;
  let sessionId = `http-${Date.now()}`;
  let disposed = false;

  return {
    async openSession() {
      if (disposed) throw new Error('theorem.chat: transport disposed');
      return sessionId;
    },
    async prompt(_sessionId, text, onDelta) {
      if (disposed) throw new Error('theorem.chat: transport disposed');
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: [{ type: 'text', text }] }),
      });
      if (!response.ok || !response.body) {
        throw new Error(`theorem.chat: stream failed (${response.status})`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          const dataLine = part
            .split('\n')
            .find((line) => line.startsWith('data:'));
          if (!dataLine) continue;
          const raw = dataLine.slice('data:'.length).trim();
          const chunk = textOf(raw);
          if (chunk) onDelta(chunk);
        }
      }
    },
    dispose() {
      disposed = true;
    },
  };
}

function textOf(data: string): string {
  try {
    const parsed = JSON.parse(data) as {
      text?: string;
      delta?: string;
      content?: string;
      error?: string;
    };
    return parsed.text ?? parsed.delta ?? parsed.content ?? parsed.error ?? '';
  } catch {
    return data;
  }
}
