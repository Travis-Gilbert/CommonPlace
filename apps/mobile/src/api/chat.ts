import { readInstanceSettings } from './instance';

type SseFrame = { event: string; data: string };

export type HostedChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'file'; data: string; mimeType: string; filename?: string }
  | { type: 'image'; image: string; filename?: string };

function framesOf(body: string): SseFrame[] {
  return body
    .replaceAll('\r\n', '\n')
    .split('\n\n')
    .map((frame) => {
      let event = 'message';
      const data: string[] = [];
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
      }
      return { event, data: data.join('\n') };
    })
    .filter((frame) => frame.data.length > 0);
}

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

export async function runHostedChat(
  input: string | readonly HostedChatContentPart[],
  signal?: AbortSignal,
): Promise<string> {
  const settings = await readInstanceSettings();
  const endpoint = settings.chatUrl?.trim();
  if (!endpoint) throw new Error('Hosted ACP chat is unavailable. Configure its URL in Account.');
  const content = typeof input === 'string' ? [{ type: 'text' as const, text: input }] : input;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content, mode: 'agent' }),
    signal,
  });
  if (!response.ok) {
    const failure = await response.text().catch(() => '');
    throw new Error(failure || `Hosted ACP chat failed with HTTP ${response.status}.`);
  }
  const frames = framesOf(await response.text());
  const error = frames.find((frame) => frame.event === 'error');
  if (error) throw new Error(textOf(error.data) || 'Hosted ACP chat stream failed.');
  const answer = frames
    .filter((frame) => frame.event === 'message' || frame.event === 'text' || frame.event.includes('delta'))
    .map((frame) => textOf(frame.data))
    .join('');
  if (!answer) throw new Error('Hosted ACP chat completed without a text answer.');
  return answer;
}

export const __chatTest = { framesOf, textOf };
