// SOURCING: none. Regression coverage for shared notice live regions.

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ForkNotice } from './ForkPageFrame';

describe('ForkNotice', () => {
  it('announces errors as alerts', () => {
    expect(
      renderToStaticMarkup(<ForkNotice tone="error">Request failed</ForkNotice>),
    ).toContain('role="alert"');
  });

  it('announces informational outcomes as statuses', () => {
    expect(
      renderToStaticMarkup(<ForkNotice tone="success">Request saved</ForkNotice>),
    ).toContain('role="status"');
  });
});
