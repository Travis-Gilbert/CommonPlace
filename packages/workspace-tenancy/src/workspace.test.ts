// SOURCING: none. Path helper tests.
import { describe, expect, it } from 'vitest';
import { workspacePath } from './workspace';

describe('workspacePath', () => {
  it('builds /workspace/{id}', () => {
    expect(workspacePath('ws_abc')).toBe('/workspace/ws_abc');
  });
  it('refuses path traversal', () => {
    expect(() => workspacePath('../etc')).toThrow(/invalid/);
    expect(() => workspacePath('a/b')).toThrow(/invalid/);
  });
});
