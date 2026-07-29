// SOURCING: none. Pure logic, no upstream component applies.
//
// Live / stateful oracle for canvas.inspector.rail durability (spec-review F2).
// Unit DurableObjectSeam tests are not a substitute for this row.
//
// Run:
//   CONSOLE_LIVE_CANVAS_SMOKE=1 \
//   CONSOLE_LIVE_CANVAS_BASE=https://v2.theoremharness.com/api \
//   CONSOLE_LIVE_CANVAS_COOKIE='...' \
//   npx vitest run src/lib/canvas/store.live.test.ts
//
// Manual v2 smoke (logout / Railway restart):
//   1. Open inspector rail, double-click canvas, place a note, wait ~1s.
//   2. Hard refresh; note still present.
//   3. Log out, log in next day (or after Railway redeploy); note still present.

import { describe, expect, it } from 'vitest';
import type {
  ObjectAction,
  ObjectActionReceipt,
  ObjectQuery,
  ObjectRef,
  ObjectSet,
  Result,
} from '@commonplace/block-view/types';
import { parseCanvasValue } from '@commonplace/json-canvas';
import { CanvasStore, INSPECTOR_CANVAS_ID } from './store';

const LIVE = process.env.CONSOLE_LIVE_CANVAS_SMOKE === '1';
const BASE = (process.env.CONSOLE_LIVE_CANVAS_BASE ?? '').replace(/\/$/, '');
const COOKIE = process.env.CONSOLE_LIVE_CANVAS_COOKIE ?? '';

class LiveHttpSeam {
  async query(query: ObjectQuery): Promise<ObjectSet> {
    const response = await fetch(`${BASE}/objects/query`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(COOKIE ? { cookie: COOKIE } : {}),
      },
      body: JSON.stringify(query),
    });
    if (!response.ok) {
      throw new Error(`live query HTTP ${response.status}`);
    }
    const body = (await response.json()) as { objects?: ObjectRef[] };
    const objects = body.objects ?? [];
    return {
      objects,
      shape: {
        types: [...query.types],
        fields: [],
        relations: [],
        axes: {},
        cardinality: objects.length === 0 ? 'empty' : objects.length === 1 ? 'one' : 'many',
      },
      subscribe: () => () => {},
    };
  }

  async emit(action: ObjectAction): Promise<Result<ObjectActionReceipt>> {
    const response = await fetch(`${BASE}/objects/action`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(COOKIE ? { cookie: COOKIE } : {}),
      },
      body: JSON.stringify(action),
    });
    if (!response.ok) {
      return { ok: false, error: `live emit HTTP ${response.status}` };
    }
    const body = (await response.json()) as ObjectActionReceipt;
    return { ok: true, value: body };
  }
}

describe.skipIf(!LIVE || !BASE)('CanvasStore live seam (canvas.inspector.rail)', () => {
  it('persists a text node across a fresh store ready()', async () => {
    const noteId = `live-note:${Date.now()}`;
    const document = parseCanvasValue({
      nodes: [
        {
          id: noteId,
          type: 'text',
          x: 64,
          y: 96,
          width: 200,
          height: 100,
          text: 'Live durability probe',
        },
      ],
      edges: [],
    });

    const writer = new CanvasStore(new LiveHttpSeam());
    await writer.ready();
    const applied = await writer.applyJsonCanvas(INSPECTOR_CANVAS_ID, document);
    expect(applied.ok).toBe(true);

    const reader = new CanvasStore(new LiveHttpSeam());
    await reader.ready();
    const exported = reader.exportDocument(INSPECTOR_CANVAS_ID);
    expect(exported?.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: noteId,
        type: 'text',
        text: 'Live durability probe',
        x: 64,
        y: 96,
      }),
    ]));
  }, 60_000);
});
