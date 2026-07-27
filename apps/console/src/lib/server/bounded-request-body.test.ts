// SOURCING: vitest; bounded request stream acceptance.

import { describe, expect, it, vi } from 'vitest';
import {
  BoundedRequestBodyError,
  readBoundedRequestBody,
} from './bounded-request-body';

describe('readBoundedRequestBody', () => {
  it('retains an admitted body byte-for-byte', async () => {
    const request = new Request('http://localhost/upload', {
      method: 'POST',
      body: new Uint8Array([1, 2, 3, 4]),
    });

    expect(
      Array.from(new Uint8Array(await readBoundedRequestBody(request, 4))),
    ).toEqual([1, 2, 3, 4]);
  });

  it('refuses a declared oversized body before reading the stream', async () => {
    const request = new Request('http://localhost/upload', {
      method: 'POST',
      headers: { 'content-length': '5' },
      body: new ReadableStream<Uint8Array>(),
      duplex: 'half',
    } as RequestInit);

    await expect(readBoundedRequestBody(request, 4)).rejects.toMatchObject({
      code: 'request_body_too_large',
    } satisfies Partial<BoundedRequestBodyError>);
    expect(request.bodyUsed).toBe(false);
  });

  it('cancels an undeclared stream as soon as actual bytes exceed the limit', async () => {
    const cancel = vi.fn();
    let index = 0;
    const chunks = [
      new Uint8Array([1, 2, 3]),
      new Uint8Array([4, 5]),
      new Uint8Array([6]),
    ];
    const request = new Request('http://localhost/upload', {
      method: 'POST',
      body: new ReadableStream<Uint8Array>({
        pull(controller) {
          const chunk = chunks[index++];
          if (chunk) controller.enqueue(chunk);
          else controller.close();
        },
        cancel,
      }),
      duplex: 'half',
    } as RequestInit);

    await expect(readBoundedRequestBody(request, 4)).rejects.toMatchObject({
      code: 'request_body_too_large',
    } satisfies Partial<BoundedRequestBodyError>);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('refuses a malformed declared length', async () => {
    const request = new Request('http://localhost/upload', {
      method: 'POST',
      headers: { 'content-length': '-1' },
      body: new Uint8Array([1]),
    });

    await expect(readBoundedRequestBody(request, 4)).rejects.toMatchObject({
      code: 'request_body_length_invalid',
    } satisfies Partial<BoundedRequestBodyError>);
  });
});
