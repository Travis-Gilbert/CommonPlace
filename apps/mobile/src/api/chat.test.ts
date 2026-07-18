import { describe, expect, it, vi } from 'vitest';
import { __chatTest, isAbortError } from './chat';

vi.mock('react-native-sse', () => ({ default: class MockEventSource {} }));
vi.mock('./instance', () => ({ readInstanceSettings: vi.fn() }));

describe('hosted chat stream helpers', () => {
  it('reads text from each supported hosted ACP payload shape', () => {
    expect(__chatTest.textOf('{"delta":"The"}')).toBe('The');
    expect(__chatTest.textOf('{"text":"answer"}')).toBe('answer');
    expect(__chatTest.textOf('{"message":"unavailable"}')).toBe('unavailable');
    expect(__chatTest.textOf('plain text')).toBe('plain text');
  });

  it('marks intentional cancellation as an AbortError', () => {
    const error = __chatTest.abortError();

    expect(error.name).toBe('AbortError');
    expect(isAbortError(error)).toBe(true);
    expect(isAbortError(new Error('backend failed'))).toBe(false);
  });
});
