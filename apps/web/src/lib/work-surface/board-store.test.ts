import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { boardFilePath, DEFAULT_BOARD_ID, InvalidBoardIdError, loadBoard, saveBoard } from './board-store';
import { serializeCanvas, type JSONCanvas } from './json-canvas';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'cp-board-store-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('boardFilePath', () => {
  it('resolves a board id to <root>/<id>.canvas', () => {
    expect(boardFilePath('default', root)).toBe(path.join(root, 'default.canvas'));
  });

  it.each(['../escape', 'a/b', 'a b', 'a.b', '', 'a;rm -rf'])(
    'rejects an unsafe board id %j',
    (id) => {
      expect(() => boardFilePath(id, root)).toThrow(InvalidBoardIdError);
    },
  );

  it('accepts letters, digits, hyphen, underscore', () => {
    expect(() => boardFilePath('Board_1-alpha', root)).not.toThrow();
  });
});

describe('loadBoard / saveBoard', () => {
  it('returns EMPTY_CANVAS when the file does not exist yet', async () => {
    const canvas = await loadBoard(DEFAULT_BOARD_ID, root);
    expect(canvas).toEqual({ nodes: [], edges: [] });
  });

  it('round-trips a saved canvas through loadBoard', async () => {
    const canvas: JSONCanvas = {
      nodes: [{ id: 'a', type: 'text', x: 0, y: 0, width: 100, height: 60, text: 'hello board' }],
      edges: [],
    };
    await saveBoard(DEFAULT_BOARD_ID, canvas, root);
    const loaded = await loadBoard(DEFAULT_BOARD_ID, root);
    expect(loaded).toEqual(canvas);
  });

  it('creates the boards directory recursively on first save', async () => {
    const nestedRoot = path.join(root, 'nested', 'boards');
    const canvas: JSONCanvas = { nodes: [], edges: [] };
    await saveBoard('b1', canvas, nestedRoot);
    const raw = await readFile(path.join(nestedRoot, 'b1.canvas'), 'utf8');
    expect(raw).toBe(serializeCanvas(canvas));
  });

  it('overwrites an existing board file on save', async () => {
    await saveBoard(DEFAULT_BOARD_ID, { nodes: [], edges: [] }, root);
    const updated: JSONCanvas = {
      nodes: [{ id: 'x', type: 'link', x: 0, y: 0, width: 1, height: 1, url: 'https://example.com' }],
      edges: [],
    };
    await saveBoard(DEFAULT_BOARD_ID, updated, root);
    expect(await loadBoard(DEFAULT_BOARD_ID, root)).toEqual(updated);
  });

  it('propagates a real read error other than ENOENT', async () => {
    // A directory where a file is expected triggers EISDIR, not ENOENT.
    const dirPath = boardFilePath('imadir', root);
    await import('node:fs/promises').then((fs) => fs.mkdir(dirPath, { recursive: true }));
    await expect(loadBoard('imadir', root)).rejects.toThrow();
  });
});
