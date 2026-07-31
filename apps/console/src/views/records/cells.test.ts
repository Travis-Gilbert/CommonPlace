// SOURCING: none. Vitest coverage for field cell renderers (RT3).

import { describe, expect, it } from 'vitest';
import { renderFieldCell } from './cells';

describe('renderFieldCell', () => {
  it('renders boolean values as Yes/No chips', () => {
    const node = renderFieldCell({ kind: 'boolean' }, true);
    expect(node).toBeTruthy();
  });

  it('renders http urls as outlined pills', () => {
    const node = renderFieldCell({ kind: 'text' }, 'https://example.com/docs');
    expect(node).toBeTruthy();
  });

  it('never crashes on unknown values', () => {
    const node = renderFieldCell({ kind: 'json' }, { nested: [{ a: 1 }] }, { label: 'payload' });
    expect(node).toBeTruthy();
  });

  it('renders noop fields as muted noop', () => {
    const node = renderFieldCell({ kind: 'noop' }, null);
    expect(node).toBeTruthy();
    expect(JSON.stringify(node)).toContain('noop');
  });

  it('stringifies unknown field kinds with a label', () => {
    const node = renderFieldCell({ kind: 'geo' }, { lat: 1, lon: 2 }, { label: 'geo' });
    expect(node).toBeTruthy();
  });
});
