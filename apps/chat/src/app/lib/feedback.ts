// SOURCING: none — pure logic over WHATWG URL, which is a platform built-in.
// Query-string assembly needs no dependency, and the OS sniffing below is
// vendored upstream code this fork has not touched.

const ENV_FEEDBACK_URL = String(import.meta.env.VITE_OPENWORK_FEEDBACK_URL ?? "").trim();
const ENV_APP_VERSION = String(import.meta.env.VITE_OPENWORK_APP_VERSION ?? "").trim();

// OW1: upstream defaulted to https://openworklabs.com/feedback. A CommonPlace
// build must not route user feedback to the donor. Feedback is opt-in via
// VITE_OPENWORK_FEEDBACK_URL; unset means no feedback destination.
export const DEFAULT_FEEDBACK_URL = ENV_FEEDBACK_URL;

type FeedbackUrlOptions = {
  entrypoint: string;
  deployment?: string | null;
  appVersion?: string | null;
  openworkServerVersion?: string | null;
  opencodeVersion?: string | null;
};

type ClientOsContext = {
  osName?: string;
  osVersion?: string;
  platform?: string;
};

function parseClientOsContext(): ClientOsContext {
  if (typeof navigator === "undefined") return {};

  const platform =
    typeof (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
      ?.platform === "string"
      ? (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform?.trim() ?? ""
      : typeof navigator.platform === "string"
        ? navigator.platform.trim()
        : "";
  const userAgent =
    typeof navigator.userAgent === "string" ? navigator.userAgent : "";

  const macMatch = userAgent.match(/Mac OS X ([0-9_]+)/i);
  if (macMatch) {
    return {
      osName: "macOS",
      osVersion: macMatch[1]?.replace(/_/g, "."),
      platform,
    };
  }

  const windowsMatch = userAgent.match(/Windows NT ([0-9.]+)/i);
  if (windowsMatch) {
    const rawVersion = windowsMatch[1] ?? "";
    const mappedVersion =
      rawVersion === "10.0" ? "10/11" : rawVersion || undefined;
    return {
      osName: "Windows",
      osVersion: mappedVersion,
      platform,
    };
  }

  const iosMatch = userAgent.match(/(?:iPhone|iPad|iPod).*OS ([0-9_]+)/i);
  if (iosMatch) {
    return {
      osName: "iOS",
      osVersion: iosMatch[1]?.replace(/_/g, "."),
      platform,
    };
  }

  const androidMatch = userAgent.match(/Android ([0-9.]+)/i);
  if (androidMatch) {
    return {
      osName: "Android",
      osVersion: androidMatch[1],
      platform,
    };
  }

  if (/Linux/i.test(userAgent) || /Linux/i.test(platform)) {
    return {
      osName: "Linux",
      platform,
    };
  }

  return platform ? { platform } : {};
}

/**
 * True when this build has somewhere to send feedback.
 *
 * Callers check this before rendering a feedback action: OW1 removed the
 * donor's endpoint and made the destination opt-in, so "unconfigured" is the
 * default state of a CommonPlace build rather than an error.
 */
export const isFeedbackConfigured = DEFAULT_FEEDBACK_URL.length > 0;

// OW1, named choice 4: every outbound destination the UI can send a user to
// lives here, so a donor URL cannot reappear in a component without showing up
// in this file. Upstream hardcoded three — a feedback form, a Discord invite,
// and github.com/different-ai/openwork issues. All three pointed at the donor
// project, which means a CommonPlace user's bug report reached maintainers who
// cannot act on it.
//
// The issue tracker has a real CommonPlace home, so it is a default. The
// community link has none, so it is opt-in and hidden when unset rather than
// pointed somewhere plausible.
export const ISSUE_TRACKER_URL = String(
  import.meta.env.VITE_COMMONPLACE_ISSUES_URL ?? "https://github.com/Travis-Gilbert/CommonPlace/issues/new",
).trim();

export const COMMUNITY_URL = String(import.meta.env.VITE_COMMONPLACE_COMMUNITY_URL ?? "").trim();

/**
 * The feedback URL, or null when no destination is configured.
 *
 * Nullable rather than throwing. `new URL("")` raises a TypeError, so the
 * unconfigured default turned every feedback click into an uncaught throw
 * behind a button that still looked live.
 */
export function buildFeedbackUrl(options: FeedbackUrlOptions): string | null {
  if (!isFeedbackConfigured) return null;
  const url = new URL(DEFAULT_FEEDBACK_URL);
  const osContext = parseClientOsContext();

  url.searchParams.set("source", "openwork-app");
  url.searchParams.set("entrypoint", options.entrypoint);

  const entries = {
    deployment: options.deployment?.trim() ?? "",
    appVersion: options.appVersion?.trim() || ENV_APP_VERSION,
    openworkServerVersion: options.openworkServerVersion?.trim() ?? "",
    opencodeVersion: options.opencodeVersion?.trim() ?? "",
    osName: osContext.osName?.trim() ?? "",
    osVersion: osContext.osVersion?.trim() ?? "",
    platform: osContext.platform?.trim() ?? "",
  };

  for (const [key, value] of Object.entries(entries)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}
