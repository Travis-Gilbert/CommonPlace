// SOURCING: none. Chat thread list / create API (CH1 / CH9).

import { createThread, readCatalog } from '@/lib/chat/server-catalog';
import type { ChatThreadRecord } from '@/lib/chat/project-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  const catalog = readCatalog();
  return Response.json({ threads: catalog.threads });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json().catch(() => null)) as {
      projectId?: string;
      title?: string;
      capability?: ChatThreadRecord['capability'];
    } | null;
    const thread = createThread({
      projectId: body?.projectId,
      title: body?.title,
      capability: body?.capability ?? null,
    });
    return Response.json(thread);
  } catch (error) {
    return Response.json(
      { error: 'thread_create_failed', message: error instanceof Error ? error.message : 'failed' },
      { status: 400 },
    );
  }
}
