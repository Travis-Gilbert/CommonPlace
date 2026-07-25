// SOURCING: none. Pure ACP boot brief shaping and fetch seam.

export type BootPayload = {
  brief?: string | null;
  markdown?: string | null;
  status?: unknown;
  context?: unknown;
  degradation?: { degraded?: boolean; missing?: unknown };
  generation?: number;
};

export type BootPayloadProvider = () => Promise<BootPayload | null>;

export type SessionBootOptions = {
  provider?: BootPayloadProvider | null;
  tokenCap?: number;
};

export async function loadSessionBootBrief(options: SessionBootOptions = {}): Promise<string | null> {
  if (!options.provider) return null;
  const payload = await options.provider();
  if (!payload) return null;
  return renderBootBrief(payload, options.tokenCap);
}

export function createEndpointBootProvider(
  endpoint: string,
  fetchImpl: typeof fetch = fetch,
): BootPayloadProvider {
  return async () => {
    const response = await fetchImpl(endpoint, { cache: 'no-store' });
    if (!response.ok) return null;
    return await response.json().catch(() => null) as BootPayload | null;
  };
}

export function renderBootBrief(payload: BootPayload, tokenCap = 2000): string | null {
  const explicit = cleanText(payload.markdown) ?? cleanText(payload.brief);
  const body = explicit ?? briefFromPayload(payload);
  if (!body) return null;
  return capBootBrief(body, tokenCap);
}

export function capBootBrief(markdown: string, tokenCap = 2000): string {
  const safeCap = Number.isFinite(tokenCap) && tokenCap > 0 ? Math.floor(tokenCap) : 2000;
  const maxChars = safeCap * 4;
  if (markdown.length <= maxChars) return markdown;
  const suffix = `\n\n[Boot brief truncated to ${safeCap} token cap.]`;
  if (suffix.length >= maxChars) return suffix.slice(0, maxChars);
  return `${markdown.slice(0, maxChars - suffix.length).trimEnd()}${suffix}`;
}

export function estimateBootTokens(markdown: string): number {
  return Math.ceil(markdown.length / 4);
}

function briefFromPayload(payload: BootPayload): string | null {
  const lines: string[] = ['## Harness boot'];
  const generation = typeof payload.generation === 'number' ? payload.generation : null;
  if (generation !== null) lines.push(`Generation: ${generation}`);
  const degradation = payload.degradation;
  const missing = Array.isArray(degradation?.missing)
    ? degradation.missing.filter((item): item is string => typeof item === 'string')
    : [];
  if (degradation?.degraded || missing.length) lines.push(`Degraded: ${missing.length ? missing.join(', ') : 'true'}`);
  if (payload.status !== undefined) {
    lines.push('', 'Status:', '```json', JSON.stringify(payload.status, null, 2), '```');
  }
  if (payload.context !== undefined) {
    lines.push('', 'Context:', '```json', JSON.stringify(payload.context, null, 2), '```');
  }
  return lines.length > 1 ? lines.join('\n') : null;
}

function cleanText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
