// SOURCING: vitest; same-origin fork client boundary tests.

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createIdentityApiKey,
  revokeIdentityApiKey,
  uploadIdentityWorkspaceDocument,
} from './client';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fork identity document client', () => {
  it('sends the file as raw bytes with filename and tags outside the body', async () => {
    const fetchMock = vi.fn(async (
      _input: string | URL | Request,
      _init?: RequestInit,
    ) =>
      Response.json({
        correlationId: 'express-document-request-0001',
        idempotencyKey: 'collector:sha256:batch',
        scopeRef: 'workspace:workspace-1',
        receipts: [{
          item: { id: 'item-1' },
          correlationId: 'express-document-request-0001',
          idempotencyKey: 'collector:sha256:batch',
          documentIndex: 0,
          documentDigest: 'sha256:document',
        }],
      }));
    vi.stubGlobal('fetch', fetchMock);
    const file = new File(['hello graph'], 'research notes.md', {
      type: 'text/markdown',
    });

    await uploadIdentityWorkspaceDocument(
      'workspace-1',
      file,
      ['research', 'graph'],
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(
      '/api/identity/workspaces/workspace-1/documents'
      + '?filename=research+notes.md&tag=research&tag=graph',
    );
    expect(init).toMatchObject({
      method: 'POST',
      body: file,
      headers: {
        accept: 'application/json',
        'content-type': 'text/markdown',
      },
    });
  });

  it('infers collector-supported text media types when the browser omits File.type', async () => {
    const fetchMock = vi.fn(async (
      _input: string | URL | Request,
      _init?: RequestInit,
    ) =>
      Response.json({
        correlationId: 'express-document-request-0001',
        idempotencyKey: 'collector:sha256:batch',
        scopeRef: 'workspace:workspace-1',
        receipts: [{
          item: { id: 'item-1' },
          correlationId: 'express-document-request-0001',
          idempotencyKey: 'collector:sha256:batch',
          documentIndex: 0,
          documentDigest: 'sha256:document',
        }],
      }));
    vi.stubGlobal('fetch', fetchMock);

    await uploadIdentityWorkspaceDocument(
      'workspace-1',
      new File(['# Graph'], 'README.MD'),
    );
    await uploadIdentityWorkspaceDocument(
      'workspace-1',
      new File(['plain text'], 'notes.txt'),
    );
    await uploadIdentityWorkspaceDocument(
      'workspace-1',
      new File(['unknown'], 'archive.bin'),
    );

    expect(fetchMock.mock.calls.map(([, init]) => init?.headers)).toEqual([
      expect.objectContaining({ 'content-type': 'text/markdown' }),
      expect.objectContaining({ 'content-type': 'text/plain' }),
      expect.objectContaining({ 'content-type': 'application/octet-stream' }),
    ]);
  });
});

describe('fork identity API key client', () => {
  it('creates a key through the same-origin workspace route', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        key: 'cpk_deadbeef_abcdefghijklmnopqrstuvwxyz0123456789ABC',
        record: {
          id: 'key-1',
          name: 'Agent and models',
          prefix: 'cpk_deadbeef',
          scopes: ['models:invoke', 'agent:bind'],
          createdAt: '2026-07-30T12:00:00.000Z',
          expiresAt: null,
        },
        revocationCacheSeconds: 60,
      }, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    const created = await createIdentityApiKey('workspace/one', {
      name: 'Agent and models',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/identity/workspaces/workspace%2Fone/api-keys',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Agent and models' }),
      }),
    );
    expect(created.record.scopes).toEqual(['models:invoke', 'agent:bind']);
    expect(created.revocationCacheSeconds).toBe(60);
  });

  it('revokes a key through the workspace-scoped route', async () => {
    const fetchMock = vi.fn(async () => Response.json({ revoked: true }));
    vi.stubGlobal('fetch', fetchMock);

    await revokeIdentityApiKey('workspace/one', 'key/two');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/identity/workspaces/workspace%2Fone/api-keys/key%2Ftwo',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
