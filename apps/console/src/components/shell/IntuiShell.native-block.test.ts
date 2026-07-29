import { describe, expect, it } from 'vitest';
import { paletteItemForHostBlock } from './IntuiShell';

describe('paletteItemForHostBlock', () => {
  it('maps native browser receipts to the measured browser pane descriptor', () => {
    expect(
      paletteItemForHostBlock({
        id: 'block_browser',
        workspaceId: 'default',
        kind: 'browser',
        attrs: { url: 'https://example.com/' },
        grants: [],
      }),
    ).toMatchObject({
      descriptorId: 'browser.pane',
      label: 'Browser',
    });
  });
});
