// SOURCING: none. Regression coverage for bounded admin results.

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AdminOverview } from '@/lib/identity/contracts';
import { AdminOverviewPanels } from './AdminPage';

const overview: AdminOverview = {
  users: [
    {
      id: 'user-1',
      username: 'Travis-Gilbert',
      displayName: 'Travis Gilbert',
      email: null,
      status: 'ACTIVE',
    },
  ],
  workspaces: [],
  pendingInvites: [],
  truncated: {
    users: true,
    workspaces: false,
    pendingInvites: false,
  },
};

describe('AdminOverviewPanels', () => {
  it('labels bounded collections as partial', () => {
    const markup = renderToStaticMarkup(
      <AdminOverviewPanels overview={overview} />,
    );

    expect(markup).toContain('Users (1 shown, partial)');
    expect(markup).toContain(
      'Sections marked partial have additional records that are not shown.',
    );
    expect(markup).toContain('Workspaces (0)');
  });

  it('does not claim a complete response is partial', () => {
    const markup = renderToStaticMarkup(
      <AdminOverviewPanels
        overview={{
          ...overview,
          truncated: {
            users: false,
            workspaces: false,
            pendingInvites: false,
          },
        }}
      />,
    );

    expect(markup).toContain('Users (1)');
    expect(markup).not.toContain('partial');
  });
});
