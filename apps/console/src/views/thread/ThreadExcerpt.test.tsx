// SOURCING: none. Multibuffer excerpt collapse contract.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThreadExcerpt } from './ThreadExcerpt';

describe('ThreadExcerpt', () => {
  it('collapses tool receipts to header plus summary by default', () => {
    const markup = renderToStaticMarkup(
      <ThreadExcerpt
        kind="tool"
        excerptId="tool-1"
        speaker="tool · recall"
        summary="query: chat surface"
        defaultCollapsed
      >
        <pre>full args</pre>
      </ThreadExcerpt>,
    );
    expect(markup).toContain('data-thread-excerpt="tool"');
    expect(markup).toContain('data-excerpt-collapsed="true"');
    expect(markup).toContain('query: chat surface');
    expect(markup).not.toContain('full args');
  });

  it('renders the body when expanded', () => {
    const markup = renderToStaticMarkup(
      <ThreadExcerpt kind="agent" excerptId="agent-1" speaker="agent" defaultCollapsed={false}>
        <p>agent reply</p>
      </ThreadExcerpt>,
    );
    expect(markup).toContain('data-excerpt-collapsed="false"');
    expect(markup).toContain('data-speaker="agent"');
    expect(markup).toContain('agent reply');
  });
});
