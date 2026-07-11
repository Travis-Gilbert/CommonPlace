import type { Metadata } from 'next';
import { V2Shell } from '@/components/v2/V2Shell';
import '@/styles/porcelain-theme.css';
import '@/styles/porcelain-surfaces.css';

export const metadata: Metadata = {
  title: {
    absolute: 'CommonPlace',
    default: 'CommonPlace',
    template: '%s | CommonPlace',
  },
  description: 'The CommonPlace porcelain workspace for Theorem and its connected agents.',
  metadataBase: new URL('https://app.theoremharness.com'),
  openGraph: {
    siteName: 'CommonPlace',
    title: 'CommonPlace',
    description: 'The CommonPlace porcelain workspace for Theorem and its connected agents.',
    type: 'website',
  },
};

/* The v2 shell. Strangler route: imports only the porcelain stylesheets.
   It inherits the root layout (fonts provider, theme provider) but every
   visual value inside resolves through porcelain tokens, so the legacy
   cascade cannot restyle it. React 19 hoists the link tags below into head. */
export default function V2Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="porcelain p-ground">
      <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        precedence="default"
        href="https://api.fontshare.com/css?f[]=cabinet-grotesk@500,700,800&display=swap"
      />
      <link
        rel="stylesheet"
        precedence="default"
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Condensed:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
      />
      <V2Shell>{children}</V2Shell>
    </div>
  );
}
