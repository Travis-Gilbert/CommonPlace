'use client';

import { Galley } from '@travis-gilbert/markdown-theory/react';

/**
 * Render a published block's markdown body through the markdown-theory Galley
 * renderer (HANDOFF-PUBLISH D2). The block content is stored as markdown text;
 * Galley applies the on-brand galley styling (see galley.css imported by the
 * layout), so a published page reads like the rest of the system rather than as
 * raw text. The register is inherited from the surrounding commonplace-theme.
 */
function templateFor(kind: string): string {
  switch (kind) {
    case 'note':
      return 'note';
    case 'link':
    case 'source':
      return 'reference';
    case 'log':
    case 'worklog':
      return 'log';
    default:
      return 'article';
  }
}

export function GalleyContent({ markdown, kind }: { markdown: string; kind: string }) {
  return <Galley doc={markdown} template={templateFor(kind)} />;
}
