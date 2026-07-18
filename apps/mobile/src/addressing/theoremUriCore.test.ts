import { describe, expect, it } from 'vitest';

import { routeForTheoremUri, theoremUri } from './theoremUriCore';

describe('theorem URI', () => {
  it('emits the exact tenant, kind, id, graph version, and span address', () => {
    expect(theoremUri({
      tenant: 'Travis-Gilbert',
      kind: 'doc',
      id: 'memory/one',
      graphVersion: 42,
      span: 'paragraph 2',
    })).toBe('theorem://Travis-Gilbert/doc/memory%2Fone?v=42#paragraph%202');
  });

  it('routes proposals to deliberate review and other objects to the object drawer', () => {
    expect(routeForTheoremUri('theorem://tenant/agency.proposal/proposal-1')).toBe('/proposal/proposal-1');
    expect(routeForTheoremUri('theorem://tenant/doc/memory%2Fone?v=42')).toBe('/object/memory%2Fone');
  });

  it('routes shared thread addresses to the assistant-ui thread surface', () => {
    expect(routeForTheoremUri('theorem://tenant/chat.thread/thread%2Fone')).toBe('/thread/thread%2Fone');
  });

  it('does not rewrite ordinary application routes', () => {
    expect(routeForTheoremUri('/reader/doc-1')).toBe('/reader/doc-1');
  });
});
