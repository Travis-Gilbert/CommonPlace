/**
 * Live-reload SSE stream for a JSON Canvas board file (WS4). Watches the
 * board's directory with Node's `fs.watch` (no chokidar dependency needed;
 * `fs.watch` is sufficient for a single local directory and this repo has
 * no existing file-watch dependency to reuse instead) and pushes a
 * `changed` event whenever the board's specific file is touched, so any
 * other tab/window with the same board open can refetch it.
 *
 * Disclosed cut: this is directory-local `fs.watch`, not an AgentFS-backed
 * multi-writer live-collab layer — see board-store.ts for the same scope
 * note applied to load/save.
 */
import { mkdir, watch } from 'node:fs/promises';
import path from 'node:path';
import { boardFilePath, DEFAULT_BOARD_ID, InvalidBoardIdError } from '@/lib/work-surface/board-store';

export const dynamic = 'force-dynamic';

const KEEPALIVE_MS = 20_000;

export async function GET(req: Request): Promise<Response> {
  const boardId = new URL(req.url).searchParams.get('id')?.trim() || DEFAULT_BOARD_ID;

  let filePath: string;
  try {
    filePath = boardFilePath(boardId);
  } catch (err) {
    if (err instanceof InvalidBoardIdError) {
      return new Response(err.message, { status: 400 });
    }
    throw err;
  }
  const dir = path.dirname(filePath);
  const fileName = path.basename(filePath);
  await mkdir(dir, { recursive: true });

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: string) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      };

      send('ready', boardId);
      const keepalive = setInterval(() => send('keepalive', String(Date.now())), KEEPALIVE_MS);

      const abortController = new AbortController();
      req.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(keepalive);
        abortController.abort();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });

      try {
        const watcher = watch(dir, { signal: abortController.signal });
        for await (const event of watcher) {
          if (event.filename === fileName) send('changed', boardId);
        }
      } catch (err) {
        if (!(err instanceof Error) || err.name !== 'AbortError') {
          send('error', 'watch-failed');
        }
      } finally {
        clearInterval(keepalive);
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
