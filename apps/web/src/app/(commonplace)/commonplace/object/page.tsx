// SOURCING: next/navigation (App Router) and React Suspense. The object
// surface itself is the shell's existing ObjectDrawer, reached through
// ObjectAddressView; this file is only the route.

import { Suspense } from 'react';
import type { Metadata } from 'next';
import ObjectAddressView from '@/components/commonplace/deeplink/ObjectAddressView';

export const metadata: Metadata = {
  title: 'Object',
  description: 'Resolve a theorem:// address into the object it names.',
};

/**
 * `/commonplace/object?address=theorem://...`
 *
 * The acceptor route for the canonical address scheme (DESIGN-THEOREM-URI
 * section 3). A `theorem://` link opened anywhere on the machine reaches the
 * desktop shell, TheoremDeepLink pushes it here, and the object opens.
 *
 * It lives inside the (commonplace) group deliberately: scripts/desktop-export.mjs
 * parks every other route group for the packaged Tauri build, so a route
 * anywhere else would not exist in the shell the deep link opens. The address
 * travels as one query value rather than a path segment for the same reason:
 * the packaged build is a static export, where a dynamic `[id]` segment would
 * need generateStaticParams and could not name an arbitrary graph id.
 *
 * The Suspense boundary is required because the view reads useSearchParams.
 */
export default function ObjectAddressPage() {
  return (
    <Suspense fallback={null}>
      <ObjectAddressView />
    </Suspense>
  );
}
