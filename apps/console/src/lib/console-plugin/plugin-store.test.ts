import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  consolePluginStatus,
  grantConsoleConsent,
  hydrateConsolePlugin,
  requestConsoleConsent,
  uninstallConsole,
} from './plugin-store';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('console plugin store', () => {
  it('uses the same-origin server door as lifecycle authority', async () => {
    const responses = [
      { state: 'available', grants: [], contributions: [] },
      {
        state: 'installed',
        grants: ['corpus:read'],
        contributions: ['pane:commonplace.console'],
      },
      { state: 'available', grants: [], contributions: [] },
    ];
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify(responses.shift()), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('window', {});
    vi.stubGlobal('fetch', fetchMock);

    await hydrateConsolePlugin('tenant-plugin-door');
    expect(consolePluginStatus('tenant-plugin-door').state).toBe('available');
    expect(requestConsoleConsent('tenant-plugin-door').state).toBe('pending_consent');
    await expect(grantConsoleConsent('tenant-plugin-door')).resolves.toMatchObject({
      state: 'installed',
      grants: ['corpus:read'],
    });
    await expect(uninstallConsole('tenant-plugin-door')).resolves.toMatchObject({
      state: 'available',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/console-plugin/state', {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    const consentRequest = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(String(consentRequest.body))).toEqual({ action: 'consent' });
    expect(String(consentRequest.body)).not.toContain('tenant-plugin-door');
  });

  it('refuses missing and default tenants before any request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('window', {});
    vi.stubGlobal('fetch', fetchMock);

    await hydrateConsolePlugin('default');
    expect(consolePluginStatus('default')).toMatchObject({
      state: 'unavailable',
      reason: 'missing_tenant',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retries hydration after a transient failure', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ state: 'available', grants: [], contributions: [] }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    vi.stubGlobal('window', {});
    vi.stubGlobal('fetch', fetchMock);

    await hydrateConsolePlugin('tenant-retry');
    expect(consolePluginStatus('tenant-retry').state).toBe('unavailable');
    await hydrateConsolePlugin('tenant-retry');

    expect(consolePluginStatus('tenant-retry').state).toBe('available');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
