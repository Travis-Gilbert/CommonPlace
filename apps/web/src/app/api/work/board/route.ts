/**
 * Load/save API for JSON Canvas board files (WS4). See
 * lib/work-surface/board-store.ts for the on-disk scope/limitations this
 * route inherits (local filesystem only; not durable on a serverless web
 * deployment).
 */
import { DEFAULT_BOARD_ID, loadBoard, saveBoard, InvalidBoardIdError } from '@/lib/work-surface/board-store';
import { CanvasParseError, parseCanvasValue } from '@/lib/work-surface/json-canvas';

export const dynamic = 'force-dynamic';

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function GET(req: Request): Promise<Response> {
  const boardId = new URL(req.url).searchParams.get('id')?.trim() || DEFAULT_BOARD_ID;
  try {
    const canvas = await loadBoard(boardId);
    return Response.json({ boardId, canvas });
  } catch (err) {
    if (err instanceof InvalidBoardIdError) return jsonError(400, err.message);
    return jsonError(500, `Failed to load board "${boardId}".`);
  }
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'Request body must be JSON.');
  }
  if (typeof body !== 'object' || body === null) return jsonError(400, 'Request body must be a JSON object.');

  const { id, canvas: rawCanvas } = body as { id?: unknown; canvas?: unknown };
  const boardId = typeof id === 'string' && id.trim() ? id.trim() : DEFAULT_BOARD_ID;

  try {
    const canvas = parseCanvasValue(rawCanvas);
    await saveBoard(boardId, canvas);
    return Response.json({ boardId, saved: true });
  } catch (err) {
    if (err instanceof CanvasParseError) return jsonError(422, err.message);
    if (err instanceof InvalidBoardIdError) return jsonError(400, err.message);
    return jsonError(500, `Failed to save board "${boardId}".`);
  }
}
