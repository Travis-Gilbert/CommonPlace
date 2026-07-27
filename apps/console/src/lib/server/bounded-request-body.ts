// SOURCING: none. Counts streamed request bytes before retaining an upload.

export type BoundedRequestBodyErrorCode =
  | 'request_body_length_invalid'
  | 'request_body_too_large';

export class BoundedRequestBodyError extends Error {
  readonly code: BoundedRequestBodyErrorCode;

  constructor(code: BoundedRequestBodyErrorCode, message: string) {
    super(message);
    this.name = 'BoundedRequestBodyError';
    this.code = code;
  }
}

function declaredBodyLength(request: Request): number | null {
  const rawLength = request.headers.get('content-length');
  if (rawLength === null) return null;
  if (!/^\d+$/.test(rawLength)) {
    throw new BoundedRequestBodyError(
      'request_body_length_invalid',
      'The request body length is invalid',
    );
  }
  const length = Number(rawLength);
  if (!Number.isSafeInteger(length)) {
    throw new BoundedRequestBodyError(
      'request_body_length_invalid',
      'The request body length is invalid',
    );
  }
  return length;
}

export async function readBoundedRequestBody(
  request: Request,
  maxBytes: number,
): Promise<ArrayBuffer> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new TypeError('maxBytes must be a positive safe integer');
  }
  const declaredLength = declaredBodyLength(request);
  if (declaredLength !== null && declaredLength > maxBytes) {
    throw new BoundedRequestBodyError(
      'request_body_too_large',
      'The request body exceeds the byte limit',
    );
  }
  return readBoundedByteStream(request.body, maxBytes);
}

export async function readBoundedByteStream(
  stream: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<ArrayBuffer> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new TypeError('maxBytes must be a positive safe integer');
  }
  if (!stream) return new ArrayBuffer(0);

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new BoundedRequestBodyError(
          'request_body_too_large',
          'The request body exceeds the byte limit',
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer as ArrayBuffer;
}
