import EventSource from 'react-native-sse';

import { readInstanceSettings, resolveHostedChatUrl } from './instance';

export type HostedChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'file'; data: string; mimeType: string; filename?: string }
  | { type: 'image'; image: string; filename?: string };

export type HostedChatCapability =
  | { kind: 'plugin' | 'skill'; id: string; name: string }
  | { kind: 'web' | 'object' };

export type HostedChatOptions = {
  capability?: HostedChatCapability;
};

type HostedChatEvent = 'text' | 'delta' | 'done';
type StreamQueueItem =
  | { type: 'snapshot'; text: string }
  | { type: 'done' }
  | { type: 'error'; error: Error };

function textOf(data: string): string {
  try {
    const parsed = JSON.parse(data) as {
      text?: string;
      delta?: string;
      content?: string;
      error?: string;
      message?: string;
    };
    return parsed.text ?? parsed.delta ?? parsed.content ?? parsed.error ?? parsed.message ?? '';
  } catch {
    return data;
  }
}

function abortError(): Error {
  const error = new Error('Hosted ACP chat was cancelled.');
  error.name = 'AbortError';
  return error;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function isHostedChatCapability(value: unknown): value is HostedChatCapability {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<HostedChatCapability>;
  if (candidate.kind === 'web' || candidate.kind === 'object') return true;
  return (candidate.kind === 'plugin' || candidate.kind === 'skill')
    && typeof candidate.id === 'string'
    && Boolean(candidate.id.trim())
    && typeof candidate.name === 'string'
    && Boolean(candidate.name.trim());
}

function requestBody(
  input: string | readonly HostedChatContentPart[],
  options?: HostedChatOptions,
) {
  const content = typeof input === 'string' ? [{ type: 'text' as const, text: input }] : input;
  return {
    content,
    mode: 'agent' as const,
    ...(isHostedChatCapability(options?.capability) ? { capability: options.capability } : {}),
  };
}

/** Streams cumulative text snapshots for assistant-ui's async adapter. */
export async function* streamHostedChat(
  input: string | readonly HostedChatContentPart[],
  signal?: AbortSignal,
  options?: HostedChatOptions,
): AsyncGenerator<string, void> {
  const settings = await readInstanceSettings();
  const endpoint = await resolveHostedChatUrl();
  if (!endpoint) throw new Error('Hosted ACP chat is unavailable. Connect a node in Account.');
  if (signal?.aborted) throw abortError();

  const queue: StreamQueueItem[] = [];
  let resume: (() => void) | null = null;
  let terminalQueued = false;
  let answer = '';

  const wake = () => {
    const pending = resume;
    resume = null;
    pending?.();
  };
  const pushSnapshot = (chunk: string) => {
    if (terminalQueued || !chunk) return;
    answer += chunk;
    queue.push({ type: 'snapshot', text: answer });
    wake();
  };
  const finish = (item: Extract<StreamQueueItem, { type: 'done' | 'error' }>) => {
    if (terminalQueued) return;
    terminalQueued = true;
    queue.push(item);
    wake();
  };
  const acceptData = (data: string | null) => {
    if (!data) return;
    if (data === '[DONE]') {
      finish({ type: 'done' });
      return;
    }
    pushSnapshot(textOf(data));
  };

  const source = new EventSource<HostedChatEvent>(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(settings.apiKey ? { 'X-API-Key': settings.apiKey } : {}),
    },
    body: JSON.stringify(requestBody(input, options)),
    pollingInterval: 0,
    timeoutBeforeConnection: 0,
    lineEndingCharacter: '\n',
  });

  source.addEventListener('message', (event) => acceptData(event.data));
  source.addEventListener('text', (event) => acceptData(event.data));
  source.addEventListener('delta', (event) => acceptData(event.data));
  source.addEventListener('done', () => finish({ type: 'done' }));
  source.addEventListener('close', () => finish({ type: 'done' }));
  source.addEventListener('error', (event) => {
    const data = 'data' in event && typeof event.data === 'string' ? event.data : null;
    const message = data ? textOf(data) : 'message' in event ? event.message : '';
    finish({ type: 'error', error: new Error(message || 'Hosted ACP chat stream failed.') });
  });

  const abort = () => finish({ type: 'error', error: abortError() });
  signal?.addEventListener('abort', abort, { once: true });

  try {
    for (;;) {
      if (queue.length === 0) {
        await new Promise<void>((resolve) => {
          resume = resolve;
        });
      }
      const item = queue.shift();
      if (!item) continue;
      if (item.type === 'snapshot') {
        yield item.text;
        continue;
      }
      if (item.type === 'error') throw item.error;
      break;
    }
  } finally {
    signal?.removeEventListener('abort', abort);
    source.removeAllEventListeners();
    source.close();
  }

  if (!answer) throw new Error('Hosted ACP chat completed without a text answer.');
}

export async function runHostedChat(
  input: string | readonly HostedChatContentPart[],
  signal?: AbortSignal,
  options?: HostedChatOptions,
): Promise<string> {
  let answer = '';
  for await (const snapshot of streamHostedChat(input, signal, options)) answer = snapshot;
  return answer;
}

export const __chatTest = { textOf, abortError, isHostedChatCapability, requestBody };
