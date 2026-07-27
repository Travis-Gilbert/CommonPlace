// SOURCING: none. Pure logic. Chat mode switcher returns here (CH3).

export const LAST_CONSOLE_VIEW_KEY = 'commonplace.console.last-view.v1';

const RETIRED_VIEW_PATHS: Readonly<Record<string, string>> = {
  '/v/chat': '/chat',
  '/v/researcher': '/indexer',
  '/v/index': '/filing',
  '/v/editor': '/workspace',
  '/v/data-model': '/models',
};

export function normalizeConsolePagePath(path: string | null): string {
  if (!path?.startsWith('/')) return '/workspace';
  if (path.startsWith('/v/')) return RETIRED_VIEW_PATHS[path] ?? '/workspace';
  return path;
}

export function readLastConsoleViewPath(): string {
  if (typeof window === 'undefined') return '/workspace';
  try {
    const raw = window.localStorage.getItem(LAST_CONSOLE_VIEW_KEY);
    const normalized = normalizeConsolePagePath(raw);
    if (raw && normalized !== raw) {
      window.localStorage.setItem(LAST_CONSOLE_VIEW_KEY, normalized);
    }
    return normalized;
  } catch {
    // Storage may be unavailable.
  }
  return '/workspace';
}

export function writeLastConsoleViewPath(path: string): void {
  if (typeof window === 'undefined') return;
  const normalized = normalizeConsolePagePath(path);
  if (normalized.startsWith('/chat')) return;
  try {
    window.localStorage.setItem(LAST_CONSOLE_VIEW_KEY, normalized);
  } catch {
    // Best-effort.
  }
}
