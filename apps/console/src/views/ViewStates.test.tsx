// SOURCING: none. Pure logic, no upstream component applies.
// G6 acceptance: all five states render from fixtures. Rendered to static
// markup so the assertion runs without a browser.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ViewState } from './ViewStates';

describe('ViewState', () => {
  it('renders loading', () => {
    expect(renderToStaticMarkup(<ViewState state="loading" />)).toContain('Loading');
  });

  it('renders empty', () => {
    expect(renderToStaticMarkup(<ViewState state="empty" />)).toContain('No records match');
  });

  it('renders unavailable naming the missing capability', () => {
    const markup = renderToStaticMarkup(<ViewState state="unavailable" capability="the harness chat endpoint" />);
    expect(markup).toContain('Unavailable');
    expect(markup).toContain('the harness chat endpoint');
  });

  it('renders error with retry', () => {
    const markup = renderToStaticMarkup(
      <ViewState state="error" errorMessage="Query failed." onRetry={() => {}} />,
    );
    expect(markup).toContain('Query failed.');
    expect(markup).toContain('Retry');
  });

  it('renders stale as dimmed content', () => {
    const markup = renderToStaticMarkup(
      <ViewState state="stale">
        <span>rows</span>
      </ViewState>,
    );
    expect(markup).toContain('data-view-state="stale"');
    expect(markup).toContain('rows');
  });

  it('renders populated content plainly', () => {
    const markup = renderToStaticMarkup(
      <ViewState state="populated">
        <span>rows</span>
      </ViewState>,
    );
    expect(markup).toContain('data-view-state="populated"');
    expect(markup).toContain('rows');
  });
});
