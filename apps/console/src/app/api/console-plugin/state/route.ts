import {
  mutateConsolePlugin,
  readConsolePluginStatus,
  type ConsolePluginMutation,
} from '@/lib/console-plugin/server';

export const dynamic = 'force-dynamic';

function errorResponse(status: number, detail: string): Response {
  return Response.json({ error: 'console_plugin_unavailable', detail }, { status });
}

export async function GET(): Promise<Response> {
  const result = await readConsolePluginStatus();
  return result.ok
    ? Response.json(result.plugin)
    : errorResponse(result.status, result.error);
}

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: 'cross_origin_plugin_mutation_refused' }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
  const action = body?.action;
  if (action !== 'consent' && action !== 'deny' && action !== 'uninstall') {
    return Response.json({ error: 'invalid_console_plugin_action' }, { status: 400 });
  }
  const result = await mutateConsolePlugin(action as ConsolePluginMutation);
  return result.ok
    ? Response.json(result.plugin)
    : errorResponse(result.status, result.error);
}
