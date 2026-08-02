/** @jsxImportSource react */
// SOURCING: none. Pure logic over the daemon's own session route; no upstream
// component applies.
//
// SPEC-COMMONPLACE-OPENWORK-FORK-1.0 OW4, named choice 4.
//
// Replaces upstream's DenSigninGate. That gate held the UI at /signin until
// the user authenticated with Den, and bounced between /signin, /onboarding,
// and /session on every navigation while it worked out whether a cached token
// was still good. There is nothing left for it to hold: the console owns
// sign-in, and its session cookie is HttpOnly, so this register never sees a
// credential and has no sign-in of its own to offer.
//
// The gate renders children in every case except one: the console is in front
// of this workspace and the browser is not signed in to it. That case cannot
// be resolved here, so it says where to go rather than pretending to a
// sign-in this register does not own.

import { useEffect, useState, type ReactNode } from "react";

import { t } from "../../i18n";

type ConsoleSession =
  | { state: "checking" }
  | { state: "ready"; authenticated: boolean; configured: boolean }
  // A daemon too old to serve /session/console, or unreachable. Treated as
  // "no console", because the alternative is blocking a working standalone
  // workspace behind a sign-in notice it can never satisfy.
  | { state: "unknown" };

/**
 * The origin the session route is asked on.
 *
 * Same-origin by construction: OW4 serves this register under the console's
 * domain, which is what lets the browser attach the console's cookie at all.
 * A workspace reached directly (dev loopback, standalone container) has no
 * console secret configured, so the route answers `configured: false` and the
 * gate renders normally.
 */
function sessionOrigin(): string {
  return typeof window === "undefined" ? "http://localhost" : window.location.origin;
}

export function useConsoleSession(serverBaseUrl: string = sessionOrigin()): ConsoleSession {
  const [session, setSession] = useState<ConsoleSession>({ state: "checking" });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch(new URL("/session/console", serverBaseUrl), {
          // The cookie is the whole point; without this it is never sent.
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`session/console ${response.status}`);
        const body = await response.json() as { authenticated?: unknown; configured?: unknown };
        if (cancelled) return;
        setSession({
          state: "ready",
          authenticated: body.authenticated === true,
          configured: body.configured === true,
        });
      } catch {
        if (!cancelled) setSession({ state: "unknown" });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [serverBaseUrl]);

  return session;
}

export function ConsoleSessionGate({ children }: { children: ReactNode }) {
  const session = useConsoleSession();

  // Children render while the check is in flight. Upstream rendered its
  // sign-in page during this window, which meant every cold load flashed a
  // sign-in the user had already completed.
  const signedOutOfConsole =
    session.state === "ready" && session.configured && !session.authenticated;

  if (!signedOutOfConsole) return <>{children}</>;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="max-w-md rounded-xl border border-border bg-card p-6 text-center">
        <h1 className="text-base font-semibold">{t("console.signin_required_title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("console.signin_required_body")}
        </p>
        <a
          className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          href="/"
        >
          {t("console.signin_required_action")}
        </a>
      </div>
    </main>
  );
}
