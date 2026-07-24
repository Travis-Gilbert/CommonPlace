// SOURCING: none. Pure logic, no upstream component applies.
// Validates a JSON Canvas document for agent authorship (D4/D6 edge).

import { NextResponse } from 'next/server';
import { CanvasParseError, parseCanvasValue } from '@commonplace/json-canvas';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON Canvas: body must be JSON' }, { status: 400 });
  }

  try {
    const document = parseCanvasValue(body);
    return NextResponse.json({
      ok: true,
      nodeCount: document.nodes.length,
      edgeCount: document.edges.length,
    });
  } catch (error) {
    const message = error instanceof CanvasParseError || error instanceof Error
      ? error.message
      : 'JSON Canvas: invalid document';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
