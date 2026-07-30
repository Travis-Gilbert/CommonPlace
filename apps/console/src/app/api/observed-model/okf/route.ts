// SOURCING: none. Same-origin serving door for rustyred-thg-okf model profiles.

import { callHarnessMcp } from '@/lib/server/harness-mcp';

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null) as {
    bundleId?: unknown;
    files?: unknown;
    action?: unknown;
    apply?: unknown;
  } | null;
  const bundleId = typeof body?.bundleId === 'string' ? body.bundleId.trim() : '';
  const action = body?.action === 'export'
    ? 'export'
    : body?.action === 'import' || body?.apply === true
      ? 'import'
      : 'preview';
  if (
    !bundleId
    || (
      action !== 'export'
      && (
        !body?.files
        || typeof body.files !== 'object'
        || Array.isArray(body.files)
      )
    )
  ) {
    return Response.json({
      error: action === 'export'
        ? 'bundleId is required'
        : 'bundleId and files are required',
    }, { status: 400 });
  }
  const result = await callHarnessMcp(action === 'import' ? 'okf_model_apply' : 'okf_model', {
    action,
    bundle_id: bundleId,
    ...(action === 'export' ? {} : { files: body?.files as Record<string, unknown> }),
  });
  if (!result.ok) return result.response;
  return Response.json(result.data);
}
