// SOURCING: none. Same-origin consumer data door for OKF model profiles.

import { executeConsumerGraphql } from '@/lib/server/consumer-graphql-client';

const OKF_MODEL_QUERY = `
  query ConsoleOkfModel($action: String!, $bundleId: String, $files: JSON) {
    okfModel(action: $action, bundleId: $bundleId, files: $files)
  }
`;

const OKF_MODEL_APPLY_MUTATION = `
  mutation ConsoleOkfModelApply($bundleId: String!, $files: JSON!) {
    okfModelApply(bundleId: $bundleId, files: $files)
  }
`;

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

  const result = await executeConsumerGraphql(
    action === 'import' ? OKF_MODEL_APPLY_MUTATION : OKF_MODEL_QUERY,
    action === 'import'
      ? {
          bundleId,
          files: body?.files as Record<string, unknown>,
        }
      : {
          action,
          bundleId,
          ...(action === 'export'
            ? {}
            : { files: body?.files as Record<string, unknown> }),
        },
    'okf_model',
    [action === 'import' ? 'okfModelApply' : 'okfModel'],
  );
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json(
    action === 'import' ? result.data.okfModelApply : result.data.okfModel,
  );
}
