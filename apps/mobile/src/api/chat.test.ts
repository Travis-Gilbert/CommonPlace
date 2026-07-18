import { describe, expect, it, vi } from 'vitest';
import { __chatTest, isAbortError } from './chat';

vi.mock('react-native-sse', () => ({ default: class MockEventSource {} }));
vi.mock('./instance', () => ({ readInstanceSettings: vi.fn(), resolveHostedChatUrl: vi.fn() }));

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

  it('puts an exact selected capability on the hosted ACP request', () => {
    expect(__chatTest.requestBody('Review this', {
      capability: { kind: 'skill', id: 'skill-review', name: 'Review' },
    })).toEqual({
      content: [{ type: 'text', text: 'Review this' }],
      mode: 'agent',
      capability: { kind: 'skill', id: 'skill-review', name: 'Review' },
    });
  });

  it('drops malformed capability data instead of sending an ambiguous name', () => {
    expect(__chatTest.requestBody('Review this', {
      capability: { kind: 'plugin', id: '', name: 'Review' },
    })).toEqual({
      content: [{ type: 'text', text: 'Review this' }],
      mode: 'agent',
    });
  });
});
