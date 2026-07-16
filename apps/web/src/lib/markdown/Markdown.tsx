// SOURCING: @travis-gilbert/markdown-theory (wrap) — canonical markdown render (HANDOFF-CANON C3)
'use client';

import { Galley } from '@travis-gilbert/markdown-theory/react';

/** Drop-in replacement for react-markdown. */
export default function Markdown({ children }: { children?: string | null }) {
  const doc = typeof children === 'string' ? children : '';
  if (!doc.trim()) return null;
  return <Galley doc={doc} />;
}
