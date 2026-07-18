/**
 * Instance seam: which CommonPlace node this phone talks to.
 * Port of apps/web src/lib/commonplace-instance.ts to expo-secure-store.
 */
import * as SecureStore from 'expo-secure-store';

export type InstanceMode = 'cloud' | 'self-hosted';

export type InstanceSettings = {
  mode: InstanceMode;
  /** commonplace-api base, e.g. http://127.0.0.1:50090 */
  url: string;
  apiKey: string;
  /** theorem-gateway base for scenes (optional). */
  gatewayUrl?: string;
  /** theorem-harness-server base for rooms (optional). */
  harnessUrl?: string;
  /** Hosted Console ACP POST/SSE route. No compatibility fallback is implied. */
  chatUrl?: string;
  /** coordination tenant slug for rooms. */
  tenant?: string;
  /** actor id this phone posts as in rooms. */
  actorId?: string;
  /** Device-bound reference used by the agency kernel for exact approval. */
  userSignatureRef?: string;
};

const KEY = 'commonplace.instance.v1';

export const DEFAULT_LOCAL_URL = 'http://127.0.0.1:50090';
export const DEFAULT_CLOUD_URL = process.env.EXPO_PUBLIC_COMMONPLACE_CLOUD_URL ?? '';
export const DEFAULT_CHAT_URL = process.env.EXPO_PUBLIC_COMMONPLACE_CHAT_URL ?? '';
export const DEFAULT_TENANT = 'Travis-Gilbert';
export const DEFAULT_ACTOR = 'mobile';

export const DEFAULT_SETTINGS: InstanceSettings = {
  mode: DEFAULT_CLOUD_URL ? 'cloud' : 'self-hosted',
  url: DEFAULT_CLOUD_URL || DEFAULT_LOCAL_URL,
  apiKey: '',
  chatUrl: DEFAULT_CHAT_URL,
  tenant: DEFAULT_TENANT,
  actorId: DEFAULT_ACTOR,
};

let cached: InstanceSettings | null = null;

export async function readInstanceSettings(): Promise<InstanceSettings> {
  if (cached) return cached;
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    cached = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    cached = DEFAULT_SETTINGS;
  }
  return cached ?? DEFAULT_SETTINGS;
}

export async function saveInstanceSettings(settings: InstanceSettings): Promise<void> {
  cached = settings;
  await SecureStore.setItemAsync(KEY, JSON.stringify(settings));
}

export function invalidateInstanceCache() {
  cached = null;
}

export type ProbeResult = { ok: true } | { ok: false; error: string };
export type InstanceCapabilities = {
  voiceCapture: boolean;
  voiceReadback: boolean;
  chatAttachments: boolean;
};

const NO_CAPABILITIES: InstanceCapabilities = {
  voiceCapture: false,
  voiceReadback: false,
  chatAttachments: false,
};

export async function fetchInstanceCapabilities(): Promise<InstanceCapabilities> {
  const settings = await readInstanceSettings();
  try {
    const response = await fetch(`${settings.url.replace(/\/$/, '')}/capabilities`, {
      headers: settings.apiKey ? { 'x-api-key': settings.apiKey } : undefined,
    });
    if (!response.ok) return NO_CAPABILITIES;
    const body = await response.json() as {
      voice_capture?: boolean;
      voice_readback?: boolean;
      chat_attachments?: boolean;
    };
    return {
      voiceCapture: body.voice_capture === true,
      voiceReadback: body.voice_readback === true,
      chatAttachments: body.chat_attachments === true,
    };
  } catch {
    return NO_CAPABILITIES;
  }
}

/** Same probe the web shell uses: a `{ __typename }` round-trip. */
export async function probeInstance(url: string, apiKey: string): Promise<ProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ query: '{ __typename }' }),
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const json = await res.json();
    if (json?.data?.__typename) return { ok: true };
    return { ok: false, error: 'unexpected response shape' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}
