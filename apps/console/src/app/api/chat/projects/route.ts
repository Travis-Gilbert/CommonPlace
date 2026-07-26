// SOURCING: none. Chat project catalog API (CH3 / CH9).

import {
  readCatalog,
  setActiveProject,
  upsertProject,
} from '@/lib/chat/server-catalog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  return Response.json(readCatalog());
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
      return Response.json({ error: 'invalid_body' }, { status: 400 });
    }
    const project = upsertProject({
      id: typeof body.id === 'string' ? body.id : undefined,
      name: typeof body.name === 'string' ? body.name : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
      documentIds: Array.isArray(body.documentIds)
        ? body.documentIds.filter((value): value is string => typeof value === 'string')
        : undefined,
      objectTypes: Array.isArray(body.objectTypes)
        ? body.objectTypes.filter((value): value is string => typeof value === 'string')
        : undefined,
    });
    return Response.json(project);
  } catch (error) {
    return Response.json(
      { error: 'project_write_failed', message: error instanceof Error ? error.message : 'failed' },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const body = (await request.json().catch(() => null)) as { activeProjectId?: string } | null;
    if (!body?.activeProjectId) {
      return Response.json({ error: 'activeProjectId_required' }, { status: 400 });
    }
    return Response.json(setActiveProject(body.activeProjectId));
  } catch (error) {
    return Response.json(
      { error: 'project_select_failed', message: error instanceof Error ? error.message : 'failed' },
      { status: 404 },
    );
  }
}
