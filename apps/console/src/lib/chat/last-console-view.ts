// SOURCING: none. Pure logic. Chat mode switcher returns here (CH3).

export const LAST_CONSOLE_VIEW_KEY = 'commonplace.console.last-view.v1';

const RETIRED_VIEW_PATHS: Readonly<Record<string, string>> = {
  '/v/chat': '/chat',
  '/v/researcher': '/indexer',
  '/v/index': '/filing',
  '/v/editor': '/workspace',
  '/v/data-model': '/models',
};

const UNSAFE_CONSOLE_PATH_CHARACTER = /[\u0000-\u001F\u007F\\]/;

export function normalizeConsolePagePath(path: string | null): string {
  if (
    !path?.startsWith('/')
    || path.startsWith('//')
    || UNSAFE_CONSOLE_PATH_CHARACTER.test(path)
  ) {
    return '/workspace';
  }
  if (path.startsWith('/v/')) return RETIRED_VIEW_PATHS[path] ?? '/workspace';
  return path;
}

export function readLastConsoleViewPath(): string {
  if (typeof window === 'undefined') return '/workspace';
  try {
    // persistence-preference: key=commonplace.console.last-view.v1; preference=last console view; reason=returns from Chat to the person's prior view
    const raw = window.localStorage.getItem(LAST_CONSOLE_VIEW_KEY);
    const normalized = normalizeConsolePagePath(raw);
    if (raw && normalized !== raw) {
      // persistence-preference: key=commonplace.console.last-view.v1; preference=last console view; reason=migrates retired view routes to page-owned routes
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
    // persistence-preference: key=commonplace.console.last-view.v1; preference=last console view; reason=returns from Chat to the person's prior view
    window.localStorage.setItem(LAST_CONSOLE_VIEW_KEY, normalized);
  } catch {
    // Best-effort.
  }
}
