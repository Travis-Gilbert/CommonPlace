import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let root: string;
const originalEnv = process.env.WORK_SURFACE_BOARDS_DIR;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'cp-board-route-'));
  process.env.WORK_SURFACE_BOARDS_DIR = root;
});

afterEach(async () => {
  if (originalEnv === undefined) delete process.env.WORK_SURFACE_BOARDS_DIR;
  else process.env.WORK_SURFACE_BOARDS_DIR = originalEnv;
  await rm(root, { recursive: true, force: true });
});

describe('GET/POST /api/work/board', () => {
  it('GET returns an empty canvas for a board that has never been saved', async () => {
    const { GET } = await import('./route');
    const res = await GET(new Request('http://localhost/api/work/board?id=fresh'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ boardId: 'fresh', canvas: { nodes: [], edges: [] } });
  });

  it('GET defaults to the "default" board id when none is given', async () => {
    const { GET } = await import('./route');
    const res = await GET(new Request('http://localhost/api/work/board'));
    const body = await res.json();
    expect(body.boardId).toBe('default');
  });

  it('POST saves a canvas and a subsequent GET returns it', async () => {
    const { GET, POST } = await import('./route');
    const canvas = {
      nodes: [{ id: 'a', type: 'text', x: 0, y: 0, width: 100, height: 60, text: 'hi' }],
      edges: [],
    };
    const postRes = await POST(
      new Request('http://localhost/api/work/board', {
        method: 'POST',
        body: JSON.stringify({ id: 'b1', canvas }),
      }),
    );
    expect(postRes.status).toBe(200);
    expect(await postRes.json()).toEqual({ boardId: 'b1', saved: true });

    const getRes = await GET(new Request('http://localhost/api/work/board?id=b1'));
    expect(await getRes.json()).toEqual({ boardId: 'b1', canvas });
  });

  it('POST returns 422 for a structurally invalid canvas', async () => {
    const { POST } = await import('./route');
    const res = await POST(
      new Request('http://localhost/api/work/board', {
        method: 'POST',
        body: JSON.stringify({ id: 'bad', canvas: { nodes: [{ id: 'a', type: 'text' }] } }),
      }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/nodes\[0\]/);
  });

  it('POST returns 400 for a non-JSON body', async () => {
    const { POST } = await import('./route');
    const res = await POST(new Request('http://localhost/api/work/board', { method: 'POST', body: 'not json' }));
    expect(res.status).toBe(400);
  });

  it('GET returns 400 for an unsafe board id', async () => {
    const { GET } = await import('./route');
    const res = await GET(new Request('http://localhost/api/work/board?id=../escape'));
    expect(res.status).toBe(400);
  });
});
