// SOURCING: none. Single thread read / update for reload persistence (CH9).

import { getThread, updateThread } from '@/lib/chat/server-catalog';
import type { ChatPersistedMessage } from '@/lib/chat/project-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ threadId: string }> };

export async function GET(_request: Request, context: Params): Promise<Response> {
  const { threadId } = await context.params;
  try {
    const thread = await getThread(threadId);
    if (!thread) return Response.json({ error: 'thread_not_found' }, { status: 404 });
    return Response.json(thread);
  } catch (error) {
    return Response.json(
      { error: 'thread_read_failed', message: error instanceof Error ? error.message : 'failed' },
      { status: 502 },
    );
  }
}

export async function PUT(request: Request, context: Params): Promise<Response> {
  const { threadId } = await context.params;
  try {
    if (!await getThread(threadId)) {
      return Response.json({ error: 'thread_not_found' }, { status: 404 });
    }
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return Response.json({ error: 'invalid_body' }, { status: 400 });
    const messages = Array.isArray(body.messages)
      ? (body.messages as ChatPersistedMessage[])
      : undefined;
    const thread = await updateThread(threadId, {
      title: typeof body.title === 'string' ? body.title : undefined,
      sessionId: typeof body.sessionId === 'string' || body.sessionId === null
        ? (body.sessionId as string | null)
        : undefined,
      railCollapsed: typeof body.railCollapsed === 'boolean' ? body.railCollapsed : undefined,
      scrollTop: typeof body.scrollTop === 'number' ? body.scrollTop : undefined,
      projectId: typeof body.projectId === 'string' ? body.projectId : undefined,
      messages,
    });
    return Response.json(thread);
  } catch (error) {
    return Response.json(
      { error: 'thread_update_failed', message: error instanceof Error ? error.message : 'failed' },
      { status: 502 },
    );
  }
}
