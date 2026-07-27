// SOURCING: mode=fork; repository=Mintplex-Labs/anything-llm;
// commit=633fc1960914298009134b40c25007cb422c7884;
// path=frontend/src/models/workspace.js. Retyped as a same-origin collector
// upload whose tenant and graph scope are resolved by the identity peer.

import {
  assertSameOriginIdentityMutation,
  ForkIdentityProxyError,
  forkIdentityErrorResponse,
  forkIdentityResponse,
  requestForkDocumentIngest,
  resolveForkIdentityPrincipal,
} from '@/lib/server/fork-identity';
import {
  BoundedRequestBodyError,
  readBoundedRequestBody,
} from '@/lib/server/bounded-request-body';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    assertSameOriginIdentityMutation(request);
    const [{ workspaceId }, principal] = await Promise.all([
      params,
      resolveForkIdentityPrincipal(),
    ]);
    const url = new URL(request.url);
    const filename = url.searchParams.get('filename') ?? '';
    if (
      filename.length === 0
      || filename.length > 255
      || filename.includes('/')
      || filename.includes('\\')
      || filename.includes('\0')
      || filename === '.'
      || filename === '..'
    ) {
      throw new ForkIdentityProxyError(
        400,
        'document_filename_invalid',
        'The document filename is invalid',
      );
    }
    let bytes: ArrayBuffer;
    try {
      bytes = await readBoundedRequestBody(request, MAX_UPLOAD_BYTES);
    } catch (error) {
      if (!(error instanceof BoundedRequestBodyError)) throw error;
      throw new ForkIdentityProxyError(
        error.code === 'request_body_too_large' ? 413 : 400,
        error.code === 'request_body_too_large'
          ? 'document_upload_too_large'
          : 'document_upload_length_invalid',
        error.code === 'request_body_too_large'
          ? 'Documents may be at most 50 MB'
          : 'The document upload length is invalid',
      );
    }
    if (bytes.byteLength === 0) {
      throw new ForkIdentityProxyError(
        400,
        'document_file_required',
        'A document file is required',
      );
    }
    return forkIdentityResponse(
      await requestForkDocumentIngest({
        workspaceId,
        principal,
        filename,
        mediaType: request.headers.get('content-type') || 'application/octet-stream',
        bytes,
        tags: url.searchParams.getAll('tag'),
      }),
    );
  } catch (error) {
    return forkIdentityErrorResponse(error);
  }
}
