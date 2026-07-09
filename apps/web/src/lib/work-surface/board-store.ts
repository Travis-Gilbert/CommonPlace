/**
 * Local filesystem persistence for JSON Canvas board files (WS4).
 *
 * Scope, disclosed plainly: this reads/writes real files on the disk the
 * Next.js server process runs on. That's exactly right for `next dev` and
 * for the desktop app's bundled Next.js server (Tauri ships a real local
 * filesystem). It is *not* durable on a serverless web deployment (Vercel /
 * Railway functions have ephemeral, often read-only, filesystems) — a
 * production web deployment of this surface needs a real backing store
 * (e.g. routed through the same commonplace-api instance the /objects
 * proxy already talks to, or Tauri's `#[tauri::command]` fs bridge for the
 * desktop shell) before board saves can be trusted to survive a redeploy.
 * That swap is out of scope here; this module is the honest, working local
 * implementation the rest of WS4 builds on, not a stand-in for it.
 *
 * A "sidecar theorem.json" was mentioned as an optional future extension
 * when this work-stream was scoped. No existing convention for that file
 * was found anywhere in this repo, so it is not implemented here rather
 * than invented from nothing — genuinely deferred, not silently dropped.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_BOARD_ID } from './board-flow';
import { EMPTY_CANVAS, parseCanvasText, serializeCanvas, type JSONCanvas } from './json-canvas';

export { DEFAULT_BOARD_ID };

const VALID_BOARD_ID = /^[a-zA-Z0-9_-]+$/;

export class InvalidBoardIdError extends Error {
  constructor(boardId: string) {
    super(`Invalid board id ${JSON.stringify(boardId)}: only letters, digits, "-", "_" are allowed.`);
    this.name = 'InvalidBoardIdError';
  }
}

function defaultRoot(): string {
  const override = process.env.WORK_SURFACE_BOARDS_DIR?.trim();
  if (override) return override;
  return path.join(process.cwd(), '.data', 'work-surface', 'boards');
}

/** Resolves the on-disk path for a board id, rejecting anything that isn't a bare filename-safe token. */
export function boardFilePath(boardId: string, root: string = defaultRoot()): string {
  if (!VALID_BOARD_ID.test(boardId)) throw new InvalidBoardIdError(boardId);
  return path.join(root, `${boardId}.canvas`);
}

/** Loads a board's canvas, returning EMPTY_CANVAS if the file doesn't exist yet. */
export async function loadBoard(boardId: string, root: string = defaultRoot()): Promise<JSONCanvas> {
  const filePath = boardFilePath(boardId, root);
  try {
    const raw = await readFile(filePath, 'utf8');
    return parseCanvasText(raw);
  } catch (err) {
    if (isEnoent(err)) return EMPTY_CANVAS;
    throw err;
  }
}

/** Persists a board's canvas, creating the boards directory if needed. */
export async function saveBoard(boardId: string, canvas: JSONCanvas, root: string = defaultRoot()): Promise<void> {
  const filePath = boardFilePath(boardId, root);
  await mkdir(path.dirname(filePath), { recursive: true });
  // Write to a temp file first, then rename atomically so watchers
  // and concurrent readers never see a partial write.
  const tmpPath = `${filePath}.tmp-${Date.now()}`;
  await writeFile(tmpPath, serializeCanvas(canvas), 'utf8');
  await rename(tmpPath, filePath);
}

function isEnoent(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: unknown }).code === 'ENOENT';
}
