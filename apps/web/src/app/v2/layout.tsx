import type { Metadata } from 'next';
import { V2Shell } from '@/components/v2/V2Shell';
// The console register (--cr-* + Tailwind @theme) loads globally via global.css
// so utilities and vars resolve app-wide. These porcelain sheets stay per-v2.
import '@/styles/porcelain-theme.css';
import '@/styles/porcelain-surfaces.css';
// CR3: the console shell — flips the frame onto --cr-* (sidebar=ground,
// content=elevated sheet). Loaded last so it overrides the porcelain frame.
import '@/styles/console-shell.css';

export const metadata: Metadata = {
  title: 'Index',
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
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Sans+Condensed:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap"
      />
      <V2Shell>{children}</V2Shell>
    </div>
  );
}
