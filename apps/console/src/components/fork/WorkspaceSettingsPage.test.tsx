// SOURCING: none. Scoped document ingestion remains unavailable in the
// workspace UI until the graph consumer enforces admitted scope headers.

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WorkspaceDocumentsPanel } from './WorkspaceSettingsPage';

describe('WorkspaceDocumentsPanel', () => {
  it('does not expose an upload control to a content writer', () => {
    const markup = renderToStaticMarkup(
      <WorkspaceDocumentsPanel canWriteContent />,
    );

    expect(markup).toContain('Document upload is disabled');
    expect(markup).not.toContain('type="file"');
    expect(markup).not.toContain('Upload document');
  });

  it('preserves the role refusal for a non-writer', () => {
    const markup = renderToStaticMarkup(
      <WorkspaceDocumentsPanel canWriteContent={false} />,
    );

    expect(markup).toContain('Your role cannot add workspace content.');
    expect(markup).not.toContain('type="file"');
  });
});
