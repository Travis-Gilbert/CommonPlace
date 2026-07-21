// SOURCING: none. IslandShell anatomy and error-once rule.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ViewDescriptor } from '@commonplace/block-view/types';
import { IslandShell } from './IslandShell';

const DESCRIPTOR: ViewDescriptor = {
  id: 'record.table',
  name: 'Records',
  accepts: {},
  emits: ['select'],
  renderer: 'record.table',
  source: {
    package: '@tanstack/react-table',
    component: 'useReactTable',
    mode: 'wrap',
    regime: 'css-vars',
  },
  block: {
    usage: 'browse records',
    mounts: ['island', 'surface'],
    sizes: ['m', 'w'],
    density: 'compact',
    surfaceClass: 'tool',
  },
  render: () => null,
};

describe('IslandShell', () => {
  it('registers tool surface class and header anatomy', () => {
    const markup = renderToStaticMarkup(
      <IslandShell descriptor={DESCRIPTOR} viewInstanceId="vi-1" count={3} draggable={false}>
        <span>body</span>
      </IslandShell>,
    );
    expect(markup).toContain('data-island="tool"');
    expect(markup).toContain('data-island-header');
    expect(markup).toContain('data-island-title');
    expect(markup).toContain('Records');
    expect(markup).toContain('data-island-count');
    expect(markup).toContain('body');
  });

  it('hides the footer when there is no status', () => {
    const markup = renderToStaticMarkup(
      <IslandShell descriptor={DESCRIPTOR} viewInstanceId="vi-1" draggable={false}>
        <span>body</span>
      </IslandShell>,
    );
    expect(markup).not.toContain('data-island-footer');
  });

  it('shows error once: body notice plus footer summary, no duplicated message', () => {
    const markup = renderToStaticMarkup(
      <IslandShell
        descriptor={DESCRIPTOR}
        viewInstanceId="vi-1"
        state="error"
        errorMessage="Query failed."
        onRetry={() => {}}
        draggable={false}
      />,
    );
    expect(markup).toContain('data-error-placement="body"');
    expect(markup).toContain('Something went wrong');
    expect(markup).toContain('data-island-footer-text');
    expect(markup).toContain('Query failed.');
    // The raw error string appears only in the footer, not twice in the body.
    expect(markup.split('Query failed.').length - 1).toBe(1);
  });

  it('uses editor surface class when declared', () => {
    const editor: ViewDescriptor = {
      ...DESCRIPTOR,
      id: 'cards.grid',
      name: 'Cards',
      block: {
        usage: 'browse record cards',
        mounts: ['island'],
        sizes: ['m'],
        density: 'cozy',
        surfaceClass: 'editor',
        kindGlyph: 'cards',
      },
    };
    const markup = renderToStaticMarkup(
      <IslandShell descriptor={editor} viewInstanceId="vi-2" draggable={false} />,
    );
    expect(markup).toContain('data-island="editor"');
  });

  it('uses flush body bleed when declared', () => {
    const flush: ViewDescriptor = {
      ...DESCRIPTOR,
      block: {
        ...DESCRIPTOR.block!,
        bodyBleed: 'flush',
        kindGlyph: 'records',
      },
    };
    const markup = renderToStaticMarkup(
      <IslandShell descriptor={flush} viewInstanceId="vi-3" draggable={false}>
        <span>table</span>
      </IslandShell>,
    );
    expect(markup).toContain('data-island-bleed="flush"');
  });
});
