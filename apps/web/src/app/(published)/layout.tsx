import type { ReactNode } from 'react';

import '@/styles/commonplace-tokens.css';
import '@/styles/commonplace.css';
import '@travis-gilbert/markdown-theory/css';
import styles from './published.module.css';

/**
 * Public projection host (HANDOFF-PUBLISH D2).
 *
 * Standalone experience outside the authenticated product shell: shared
 * CommonPlace tokens, no TopNav, no Footer, no product chrome. This is the
 * marketing-page precedent applied to published blocks. A published page is on
 * brand by construction because it renders through the same token system as the
 * product, just without the app around it.
 */
export default function PublishedLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`commonplace-theme ${styles.host}`}>
      {children}
    </div>
  );
}
