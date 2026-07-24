// SOURCING: none. Pure logic, no upstream component applies.
// G6 / IS3: state grammar plus the single-rendering error rule for shell mode.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ViewState, viewStateFooterSummary } from './ViewStates';

describe('ViewState', () => {
  it('renders loading', () => {
    expect(renderToStaticMarkup(<ViewState state="loading" />)).toContain('Loading');
  });

  it('renders empty with a named no-results cause and clear action', () => {
    const markup = renderToStaticMarkup(<ViewState state="empty" onRetry={() => {}} />);
    expect(markup).toContain('No results.');
    expect(markup).toContain('data-empty-cause="no-results"');
    expect(markup).toContain('Clear query');
  });

  it('renders unavailable as not-connected with the missing capability', () => {
    const markup = renderToStaticMarkup(
      <ViewState state="unavailable" capability="the harness chat endpoint" onRetry={() => {}} />,
    );
    expect(markup).toContain('Not connected.');
    expect(markup).toContain('the harness chat endpoint');
    expect(markup).toContain('data-empty-cause="not-connected"');
    expect(markup).toContain('Reconnect');
  });

  it('renders error with retry in standalone mode', () => {
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

  it('shell error renders the body notice once and keeps the message out of content flow', () => {
    const markup = renderToStaticMarkup(
      <ViewState state="error" mode="shell" errorMessage="Query failed." onRetry={() => {}} />,
    );
    expect(markup).toContain('data-error-placement="body"');
    expect(markup).toContain('Something went wrong');
    expect(markup).not.toContain('Query failed.');
    expect(markup).not.toContain('Retry');
    expect(viewStateFooterSummary('error', 'Query failed.')).toBe('Query failed.');
  });

  it('footer summary is empty for populated and empty states', () => {
    expect(viewStateFooterSummary('populated')).toBe('');
    expect(viewStateFooterSummary('empty')).toBe('');
    expect(viewStateFooterSummary('stale')).toBe('Stale');
  });
});
