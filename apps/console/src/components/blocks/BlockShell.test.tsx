// SOURCING: none. BlockShell anatomy and error-once rule.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ViewDescriptor } from '@commonplace/block-view/types';
import { BlockShell } from './BlockShell';

const DESCRIPTOR: ViewDescriptor = {
  id: 'record.table',
  name: 'Records',
  accepts: {},
  emits: ['select'],
  renderer: 'record.table',
  sourcing: {
    mode: 'wrap',
    upstream: '@tanstack/react-table/useReactTable',
  },
  block: {
    usage: 'browse records',
    placements: ['ground', 'full'],
    defaultSize: 'm',
    density: 'compact',
    surfaceClass: 'tool',
  },
  render: () => null,
};

describe('BlockShell', () => {
  it('omits the title header when showHeader is false', () => {
    const markup = renderToStaticMarkup(
      <BlockShell
        descriptor={DESCRIPTOR}
        viewInstanceId="vi-1"
        showHeader={false}
        draggable={false}
      >
        <span>body</span>
      </BlockShell>,
    );
    expect(markup).toContain('data-block-chrome="bare"');
    expect(markup).not.toContain('data-island-header');
    expect(markup).not.toContain('data-block-title');
    expect(markup).toContain('body');
  });

  it('registers tool surface class and header anatomy', () => {
    const markup = renderToStaticMarkup(
      <BlockShell descriptor={DESCRIPTOR} viewInstanceId="vi-1" count={3} draggable={false}>
        <span>body</span>
      </BlockShell>,
    );
    expect(markup).toContain('data-island="tool"');
    expect(markup).toContain('data-island-header');
    expect(markup).toContain('data-block-title');
    expect(markup).toContain('Records');
    expect(markup).toContain('data-block-count');
    expect(markup).toContain('body');
  });

  it('hides the footer when there is no status', () => {
    const markup = renderToStaticMarkup(
      <BlockShell descriptor={DESCRIPTOR} viewInstanceId="vi-1" draggable={false}>
        <span>body</span>
      </BlockShell>,
    );
    expect(markup).not.toContain('data-block-footer');
  });

  it('shows error once: body notice plus footer summary, no duplicated message', () => {
    const markup = renderToStaticMarkup(
      <BlockShell
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
    expect(markup).toContain('data-block-footer-text');
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
        placements: ['ground'],
        defaultSize: 'm',
        density: 'cozy',
        surfaceClass: 'editor',
        kindGlyph: 'cards',
      },
    };
    const markup = renderToStaticMarkup(
      <BlockShell descriptor={editor} viewInstanceId="vi-2" draggable={false} />,
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
      <BlockShell descriptor={flush} viewInstanceId="vi-3" draggable={false}>
        <span>table</span>
      </BlockShell>,
    );
    expect(markup).toContain('data-block-bleed="flush"');
  });
});
