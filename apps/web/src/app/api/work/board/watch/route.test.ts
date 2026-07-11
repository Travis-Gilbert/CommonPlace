import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let root: string;
const originalEnv = process.env.WORK_SURFACE_BOARDS_DIR;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'cp-board-watch-'));
  process.env.WORK_SURFACE_BOARDS_DIR = root;
});

afterEach(async () => {
  if (originalEnv === undefined) delete process.env.WORK_SURFACE_BOARDS_DIR;
  else process.env.WORK_SURFACE_BOARDS_DIR = originalEnv;
  await rm(root, { recursive: true, force: true });
});

/** Reads and decodes SSE "event: <name>" lines from the stream until `match` returns true, or times out. */
async function readUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  match: (chunk: string) => boolean,
  timeoutMs = 4000,
): Promise<string> {
  const decoder = new TextDecoder();
  let buffer = '';
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { value, done } = await Promise.race([
      reader.read(),
      new Promise<{ value: undefined; done: false }>((resolve) => setTimeout(() => resolve({ value: undefined, done: false }), 100)),
    ]);
    if (done) break;
    if (value) buffer += decoder.decode(value, { stream: true });
    if (match(buffer)) return buffer;
  }
  throw new Error(`timed out waiting for stream match; buffer so far: ${JSON.stringify(buffer)}`);
}

describe('GET /api/work/board/watch', () => {
  it('streams SSE with the expected headers and an initial "ready" event', async () => {
    const { GET } = await import('./route');
    const controller = new AbortController();
    const req = new Request('http://localhost/api/work/board/watch?id=live', { signal: controller.signal });
    const res = await GET(req);

    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.status).toBe(200);

    const reader = res.body!.getReader();
    const chunk = await readUntil(reader, (buf) => buf.includes('event: ready'));
    expect(chunk).toContain('data: live');

    controller.abort();
    await reader.cancel().catch(() => {});
  });

  it('emits a "changed" event when the watched board file is written', async () => {
    const { GET } = await import('./route');
    const { boardFilePath } = await import('@/lib/work-surface/board-store');
    const controller = new AbortController();
    const req = new Request('http://localhost/api/work/board/watch?id=live2', { signal: controller.signal });
    const res = await GET(req);
    const reader = res.body!.getReader();

    // Wait for the stream to be ready (directory created + watcher attached) before writing.
    await readUntil(reader, (buf) => buf.includes('event: ready'));

    const filePath = boardFilePath('live2');
    await writeFile(filePath, JSON.stringify({ nodes: [], edges: [] }), 'utf8');

    const chunk = await readUntil(reader, (buf) => buf.includes('event: changed'));
    expect(chunk).toContain('data: live2');

    controller.abort();
    await reader.cancel().catch(() => {});
  });

  it('returns 400 for an unsafe board id', async () => {
    const { GET } = await import('./route');
    const res = await GET(new Request('http://localhost/api/work/board/watch?id=../escape'));
    expect(res.status).toBe(400);
  });
});
