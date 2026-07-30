import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchProgramSpill } from './programClient';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchProgramSpill', () => {
  it('follows every continuation and returns the complete UTF-8 result', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        fetch_handle: 'spill:one',
        offset: 0,
        next_offset: 3,
        total_bytes: 6,
        text: 'abc',
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        fetch_handle: 'spill:one',
        offset: 3,
        next_offset: null,
        total_bytes: 6,
        text: 'def',
      })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchProgramSpill('spill:one')).resolves.toEqual({
      fetch_handle: 'spill:one',
      offset: 0,
      next_offset: null,
      total_bytes: 6,
      text: 'abcdef',
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/harness/tool-result', expect.objectContaining({
      body: JSON.stringify({ fetchHandle: 'spill:one', offset: 3 }),
    }));
  });

  it('refuses a non-advancing continuation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      fetch_handle: 'spill:loop',
      offset: 0,
      next_offset: 0,
      total_bytes: 3,
      text: '',
    }))));

    await expect(fetchProgramSpill('spill:loop')).rejects.toThrow(
      'tool_result_fetch_invalid_continuation',
    );
  });
});
