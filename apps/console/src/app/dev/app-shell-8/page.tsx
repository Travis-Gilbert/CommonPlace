'use client';

// Dev preview surface for the recreated ReUI app-shell-8 block
// (keenthemes/reui app-shell-8), register-skinned. Not a registered surface:
// previews live under /dev and never reach the palette.

import { AppShell8 } from '@/components/ui/app-shell-8';

export default function AppShell8PreviewPage() {
  return (
    <div className="h-dvh w-full overflow-hidden" data-app-shell-8-preview>
      <AppShell8 />
    </div>
  );
}
