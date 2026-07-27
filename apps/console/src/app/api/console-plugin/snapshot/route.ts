import { readConsoleSnapshot } from '@/lib/console-plugin/server';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const result = await readConsoleSnapshot();
  if (!result.ok) {
    return Response.json(
      {
        error: 'console_door_unavailable',
        detail: result.error,
      },
      { status: result.status },
    );
  }
  return Response.json(result.snapshot);
}
