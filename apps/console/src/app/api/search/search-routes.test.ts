import { beforeEach, describe, expect, it, vi } from 'vitest';

const upstream = vi.hoisted(() => ({
  forward: vi.fn(),
}));

vi.mock('../objects/_upstream', () => upstream);

import { POST as find } from './find/route';
import { POST as scatter } from './scatter/route';
import { POST as expand } from './expand/route';
import { POST as save } from './save/route';

function request(path: string, body: unknown): Request {
  return new Request(`http://console.local/api/search/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  upstream.forward.mockReset();
  upstream.forward.mockImplementation(
    async (_path: string, init: RequestInit) => {
      const operation = JSON.parse(String(init.body)) as {
        readonly query: string;
      };
      const field = operation.query.includes('mutation')
        ? 'saveUrl'
        : operation.query.match(/\{\s*(find|scatter|expand)\(/)?.[1] ?? 'find';
      return Response.json({
        data: {
          [field]: field === 'saveUrl'
            ? {
                itemId: 'item-1',
                collectionId: 'collection-1',
                collectionName: 'Reading',
                title: 'Example',
                url: 'https://example.com',
              }
            : { query: 'q' },
        },
      });
    },
  );
});

describe('search same-origin routes', () => {
  it('rejects an empty find query before reaching the upstream', async () => {
    const response = await find(request('find', {
      query: '',
      scopes: [],
      lanes: [],
    }));
    expect(response.status).toBe(400);
    expect(upstream.forward).not.toHaveBeenCalled();
  });

  it('forwards find through the authenticated object seam', async () => {
    const response = await find(request('find', {
      query: 'budget',
      scopes: [{ kind: 'CORPUS' }],
      lanes: ['EXACT'],
      k: 20,
      lambda: 0.8,
    }));
    expect(response.status).toBe(200);
    expect(upstream.forward).toHaveBeenCalledTimes(1);
    expect(upstream.forward.mock.calls[0][0]).toBe('/graphql');
    await expect(response.json()).resolves.toEqual({ data: { query: 'q' } });
  });

  it('forwards scatter', async () => {
    const response = await scatter(request('scatter', {
      query: 'membrane',
      k: 8,
      lambda: 0.5,
    }));
    expect(response.status).toBe(200);
    expect(upstream.forward).toHaveBeenCalledTimes(1);
    const operation = JSON.parse(String(
      upstream.forward.mock.calls[0][1].body,
    )) as { query: string };
    expect(operation.query).toContain('degraded');
    expect(operation.query).toContain('missingIndexes');
  });

  it('requires an aspect for expand', async () => {
    const response = await expand(request('expand', {
      query: 'membrane',
    }));
    expect(response.status).toBe(400);
    expect(upstream.forward).not.toHaveBeenCalled();
  });

  it('forwards a valid expand', async () => {
    const response = await expand(request('expand', {
      query: 'membrane',
      aspectId: 'aspect-budget',
      k: 8,
      lambda: 0.5,
    }));
    expect(response.status).toBe(200);
    expect(upstream.forward).toHaveBeenCalledTimes(1);
  });

  it('returns the real save receipt', async () => {
    const response = await save(request('save', {
      url: 'https://example.com',
    }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: expect.objectContaining({ collectionName: 'Reading' }),
    });
  });

  it('surfaces a GraphQL error as a named gateway failure', async () => {
    upstream.forward.mockResolvedValueOnce(
      Response.json({ errors: [{ message: 'find is not registered' }] }),
    );
    const response = await find(request('find', {
      query: 'budget',
      scopes: [{ kind: 'CORPUS' }],
      lanes: ['EXACT'],
    }));
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: 'search_graphql_error',
      message: 'find is not registered',
    });
  });
});
