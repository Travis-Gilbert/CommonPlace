// SOURCING: none. Configuration and transport tests for the identity proxy.

import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));

import {
  ForkIdentityProxyError,
  readJsonObject,
  requestForkDocumentIngest,
  requestForkIdentity,
  resolveForkServerConfig,
} from './fork-identity';

const INTERNAL_KEY = 'internal-test-key-that-is-longer-than-thirty-two-characters';

describe('fork identity server configuration', () => {
  it('admits local HTTP only outside production and preserves no path', () => {
    expect(
      resolveForkServerConfig({
        COMMONPLACE_FORK_SERVER_URL: 'http://127.0.0.1:3001/a/path?secret=no',
        COMMONPLACE_FORK_SERVER_INTERNAL_KEY: INTERNAL_KEY,
        NODE_ENV: 'development',
      }),
    ).toEqual({
      origin: 'http://127.0.0.1:3001',
      internalKey: INTERNAL_KEY,
    });
  });

  it('refuses missing, placeholder, insecure production, and RustyRed targets', () => {
    const cases = [
      {},
      {
        COMMONPLACE_FORK_SERVER_URL: 'https://identity.example.test',
        COMMONPLACE_FORK_SERVER_INTERNAL_KEY: 'change-me',
      },
      {
        COMMONPLACE_FORK_SERVER_URL: 'http://identity.example.test',
        COMMONPLACE_FORK_SERVER_INTERNAL_KEY: INTERNAL_KEY,
        NODE_ENV: 'production',
      },
      {
        COMMONPLACE_FORK_SERVER_URL: 'https://rustyred.internal',
        COMMONPLACE_FORK_SERVER_INTERNAL_KEY: INTERNAL_KEY,
        NODE_ENV: 'production',
      },
    ];
    for (const environment of cases) {
      expect(() => resolveForkServerConfig(environment)).toThrow(ForkIdentityProxyError);
    }
  });
});

describe('fork identity transport', () => {
  it('accepts a small JSON object request', async () => {
    await expect(
      readJsonObject(
        new Request('https://console.example.test/api/identity/workspaces', {
          method: 'POST',
          body: JSON.stringify({ name: 'Research' }),
          headers: { 'content-type': 'application/json' },
        }),
      ),
    ).resolves.toEqual({ name: 'Research' });
  });

  it('bounds a streamed JSON request without trusting content-length', async () => {
    let cancelled = false;
    const request = new Request(
      'https://console.example.test/api/identity/workspaces',
      {
        method: 'POST',
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array(64 * 1024));
            controller.enqueue(new Uint8Array([1]));
          },
          cancel() {
            cancelled = true;
          },
        }),
        duplex: 'half',
        headers: { 'content-type': 'application/json' },
      } as RequestInit,
    );

    await expect(readJsonObject(request)).rejects.toMatchObject({
      status: 413,
      code: 'identity_request_too_large',
    });
    expect(cancelled).toBe(true);
  });

  it('refuses malformed JSON and non-object envelopes', async () => {
    for (const body of ['{', '[]', 'null']) {
      await expect(
        readJsonObject(
          new Request('https://console.example.test/api/identity/workspaces', {
            method: 'POST',
            body,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      ).rejects.toMatchObject({
        status: 400,
        code: 'identity_request_invalid',
      });
    }
  });

  it('keeps the internal key in the server authorization header', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({
        authorization: `Bearer ${INTERNAL_KEY}`,
      });
      expect(String(init?.body)).not.toContain(INTERNAL_KEY);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    await expect(
      requestForkIdentity('/v1/principals/reconcile', {
        body: { principal: { subject: 'github:1' } },
        fetchImpl,
        environment: {
          COMMONPLACE_FORK_SERVER_URL: 'https://identity.example.test',
          COMMONPLACE_FORK_SERVER_INTERNAL_KEY: INTERNAL_KEY,
          NODE_ENV: 'production',
        },
      }),
    ).resolves.toEqual({ status: 200, body: { ok: true } });
  });

  it('does not attach the service credential to public invite inspection', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.headers).not.toHaveProperty('authorization');
      return new Response(JSON.stringify({ invite: { id: 'invite-1' } }));
    });
    await requestForkIdentity('/v1/invites/code', {
      method: 'GET',
      publicRoute: true,
      fetchImpl,
      environment: {
        COMMONPLACE_FORK_SERVER_URL: 'https://identity.example.test',
        COMMONPLACE_FORK_SERVER_INTERNAL_KEY: INTERNAL_KEY,
        NODE_ENV: 'production',
      },
    });
  });

  it('refuses path traversal before network access', async () => {
    const fetchImpl = vi.fn();
    await expect(
      requestForkIdentity('/v1/workspaces/%2e%2e/admin', {
        fetchImpl,
        environment: {
          COMMONPLACE_FORK_SERVER_URL: 'https://identity.example.test',
          COMMONPLACE_FORK_SERVER_INTERNAL_KEY: INTERNAL_KEY,
          NODE_ENV: 'production',
        },
      }),
    ).rejects.toThrow(TypeError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('bounds streamed peer responses before retaining the whole payload', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array(512 * 1024));
            controller.enqueue(new Uint8Array([1]));
            controller.close();
          },
        }),
      ));
    await expect(
      requestForkIdentity('/v1/workspaces/list', {
        fetchImpl,
        environment: {
          COMMONPLACE_FORK_SERVER_URL: 'https://identity.example.test',
          COMMONPLACE_FORK_SERVER_INTERNAL_KEY: INTERNAL_KEY,
          NODE_ENV: 'production',
        },
      }),
    ).rejects.toMatchObject({
      code: 'identity_response_too_large',
    });
  });

  it('forwards document bytes with encoded server identity and no browser scope', async () => {
    const principal = {
      subject: 'github:42',
      username: 'Travis-Gilbert',
      displayName: 'Travis Gilbert',
      email: 'travis@example.test',
    };
    const bytes = await new Blob(['graph-native passage']).arrayBuffer();
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const endpoint = new URL(String(url));
      expect(endpoint.pathname).toBe('/v1/workspaces/workspace-42/documents');
      expect(endpoint.searchParams.get('filename')).toBe('research.txt');
      expect(init?.headers).toMatchObject({
        authorization: `Bearer ${INTERNAL_KEY}`,
        'content-type': 'text/plain',
      });
      const headers = init?.headers as Record<string, string>;
      expect(
        JSON.parse(Buffer.from(headers['x-commonplace-principal'], 'base64url').toString('utf8')),
      ).toEqual(principal);
      expect(
        JSON.parse(Buffer.from(headers['x-commonplace-tags'], 'base64url').toString('utf8')),
      ).toEqual({ tags: ['research'] });
      expect(init?.body).toBe(bytes);
      expect(headers).not.toHaveProperty('x-commonplace-tenant');
      expect(headers).not.toHaveProperty('x-commonplace-scope-ref');
      return new Response(JSON.stringify({
        correlationId: 'express-document-request-0001',
        idempotencyKey: 'collector:sha256:batch',
        scopeRef: 'workspace:workspace-42',
        receipts: [],
      }), { status: 201 });
    });

    await expect(
      requestForkDocumentIngest({
        workspaceId: 'workspace-42',
        principal,
        filename: 'research.txt',
        mediaType: 'text/plain',
        bytes,
        tags: ['research'],
        fetchImpl,
        environment: {
          COMMONPLACE_FORK_SERVER_URL: 'https://identity.example.test',
          COMMONPLACE_FORK_SERVER_INTERNAL_KEY: INTERNAL_KEY,
          NODE_ENV: 'production',
        },
      }),
    ).resolves.toMatchObject({ status: 201 });
  });

  it('refuses a malformed document media type before network access', async () => {
    const fetchImpl = vi.fn();
    await expect(
      requestForkDocumentIngest({
        workspaceId: 'workspace-42',
        principal: {
          subject: 'github:42',
          username: 'Travis-Gilbert',
          displayName: null,
          email: null,
        },
        filename: 'research.txt',
        mediaType: 'text/plain\r\nx-forged: yes',
        bytes: new ArrayBuffer(1),
        fetchImpl,
        environment: {
          COMMONPLACE_FORK_SERVER_URL: 'https://identity.example.test',
          COMMONPLACE_FORK_SERVER_INTERNAL_KEY: INTERNAL_KEY,
          NODE_ENV: 'production',
        },
      }),
    ).rejects.toMatchObject({
      status: 415,
      code: 'content_media_type_invalid',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
