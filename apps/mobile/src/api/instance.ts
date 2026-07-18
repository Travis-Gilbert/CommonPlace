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
export const DEPLOYED_CHAT_URL = 'https://v2.theoremharness.com/api/chat/stream';
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
  chatUrl: string | null;
  webSearch: boolean;
  pushRegistrationUrl: string | null;
  expoProjectId: string | null;
  capabilityCatalog: boolean;
};

export type CapabilityCatalogEntry = {
  id: string;
  kind: 'plugin' | 'skill';
  name: string;
  description?: string;
};

export type CapabilityCatalog = {
  plugins: CapabilityCatalogEntry[];
  skills: CapabilityCatalogEntry[];
};

export const NO_CAPABILITIES: InstanceCapabilities = {
  voiceCapture: false,
  voiceReadback: false,
  chatAttachments: false,
  chatUrl: null,
  webSearch: false,
  pushRegistrationUrl: null,
  expoProjectId: null,
  capabilityCatalog: false,
};

export const EMPTY_CAPABILITY_CATALOG: CapabilityCatalog = { plugins: [], skills: [] };

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

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
      chat_url?: string | null;
      web_search?: boolean;
      push_registration_url?: string | null;
      expo_project_id?: string | null;
      capability_catalog?: boolean;
    };
    return {
      voiceCapture: body.voice_capture === true,
      voiceReadback: body.voice_readback === true,
      chatAttachments: body.chat_attachments === true,
      chatUrl: optionalString(body.chat_url),
      webSearch: body.web_search === true,
      pushRegistrationUrl: optionalString(body.push_registration_url),
      expoProjectId: optionalString(body.expo_project_id),
      capabilityCatalog: body.capability_catalog === true,
    };
  } catch {
    return NO_CAPABILITIES;
  }
}

export async function fetchCapabilityCatalog(): Promise<CapabilityCatalog> {
  const settings = await readInstanceSettings();
  try {
    const response = await fetch(`${settings.url.replace(/\/$/, '')}/mobile/catalog`, {
      headers: settings.apiKey ? { 'x-api-key': settings.apiKey } : undefined,
    });
    if (!response.ok) return EMPTY_CAPABILITY_CATALOG;
    const body = await response.json() as Partial<CapabilityCatalog>;
    const entries = (value: unknown, kind: CapabilityCatalogEntry['kind']) =>
      Array.isArray(value)
        ? value.filter((entry): entry is CapabilityCatalogEntry => {
          if (!entry || typeof entry !== 'object') return false;
          const candidate = entry as Partial<CapabilityCatalogEntry>;
          return candidate.kind === kind
            && typeof candidate.id === 'string'
            && typeof candidate.name === 'string';
        })
        : [];
    return {
      plugins: entries(body.plugins, 'plugin'),
      skills: entries(body.skills, 'skill'),
    };
  } catch {
    return EMPTY_CAPABILITY_CATALOG;
  }
}

/** Manual/build configuration wins, then node discovery, then the v2 product route. */
export async function resolveHostedChatUrl(): Promise<string> {
  const settings = await readInstanceSettings();
  const configured = settings.chatUrl?.trim();
  if (configured) return configured;
  const capabilities = await fetchInstanceCapabilities();
  return capabilities.chatUrl ?? DEPLOYED_CHAT_URL;
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
