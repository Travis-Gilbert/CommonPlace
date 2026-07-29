// SOURCING: none. Surviving settings must link to page-owned destinations.

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GeneralSettingsPage } from './GeneralSettingsPage';

describe('GeneralSettingsPage', () => {
  it('opens Appearance through its dedicated Console route', () => {
    const markup = renderToStaticMarkup(
      <GeneralSettingsPage workspaceId="workspace-1" />,
    );

    expect(markup).toContain('href="/appearance"');
    expect(markup.match(/href="\/appearance"/g)).toHaveLength(1);
    expect(markup).toContain('Desktop PET');
    expect(markup).toContain(
      'PET controls appear here when this exact v2 page runs inside CommonPlace desktop.',
    );
  });
});
