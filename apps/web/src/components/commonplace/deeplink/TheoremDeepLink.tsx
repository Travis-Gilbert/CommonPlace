'use client';

// SOURCING: tauri-plugin-deep-link for the OS scheme handoff, reached through
// the existing dependency-free bridge in src/lib/desktop.ts (deepLinkGetCurrent
// / onDeepLinkOpenUrl mirror the plugin's own guest bindings), and
// @commonplace/block-view/addressing for the grammar. Nothing here
// re-implements either: the plugin owns the handoff, the shared helper owns the
// parse.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  extractTheoremAddress,
  parseTheoremUri,
  type TheoremAddress,
} from '@commonplace/block-view/addressing';
import { deepLinkGetCurrent, isTauri, onDeepLinkOpenUrl } from '@/lib/desktop';
import { objectRouteHref } from '@/lib/theorem-address-route';

/**
 * `theorem://` deep links, desktop side (DESIGN-THEOREM-URI section 3).
 *
 * The scheme is registered by the shell (tauri.conf.json plugins.deep-link plus
 * `register_all()` in crates/commonplace-desktop-runtime/src/lib.rs). This is
 * the acceptor: a `theorem://` link opened anywhere on the machine arrives here
 * and opens the addressed object in the console shell.
 *
 * Two arrival paths, both required:
 *
 *   - cold start: the OS launched the app with the URL, so the plugin already
 *     holds it and `deepLinkGetCurrent()` returns it once the webview mounts.
 *   - warm: the app was already running, and the plugin emits
 *     `deep-link://new-url` per link.
 *
 * Renders nothing and does nothing outside the Tauri runtime: apps/web also
 * serves the plain web app, where no shell delivers URLs. The guard is
 * `isTauri()`, the same runtime probe every other desktop-only surface uses.
 *
 * Refusals surface as a toast rather than a console line: a link naming a
 * malformed address is a real user-facing outcome, and the shell already mounts
 * the Toaster.
 */
export default function TheoremDeepLink() {
  const router = useRouter();

  useEffect(() => {
    if (!isTauri()) return;

    let cancelled = false;
    let unlisten: (() => void) | undefined;

    const open = (address: TheoremAddress) => {
      if (cancelled) return;
      router.push(objectRouteHref(address));
    };

    const accept = (url: string) => {
      // Share sheets wrap an address in a title line, so try the tolerant
      // extractor first and fall back to the strict parse for its refusal.
      const extracted = extractTheoremAddress(url);
      if (extracted) {
        open(extracted);
        return;
      }
      const parsed = parseTheoremUri(url.trim());
      if (parsed.ok) {
        open(parsed.address);
        return;
      }
      toast.error(parsed.refusal.message);
    };

    void (async () => {
      try {
        const launched = await deepLinkGetCurrent();
        if (cancelled) return;
        launched?.forEach(accept);
        const stop = await onDeepLinkOpenUrl((urls) => urls.forEach(accept));
        if (cancelled) {
          stop();
          return;
        }
        unlisten = stop;
      } catch (error) {
        // A shell without the plugin (an older build) must not take the surface
        // down; the link simply does not resolve there.
        toast.error(
          `theorem:// links are unavailable in this shell: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [router]);

  return null;
}
