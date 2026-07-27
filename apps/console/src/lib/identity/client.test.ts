// SOURCING: vitest; same-origin fork client boundary tests.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadIdentityWorkspaceDocument } from './client';

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
