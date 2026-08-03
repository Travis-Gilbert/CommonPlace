// SOURCING: hand-roll — redaction keyed on what a name *means*, over config
// shapes nobody declared in advance. The workspace ships no redaction library
// (checked apps/chat-server/package.json). The obvious upstream candidate,
// fast-redact, models a different concept: it compiles a fixed list of known
// paths ("a.b.*") and cannot answer "is this arbitrary key a credential",
// which is the whole question here, since MCP environment records name their
// variables whatever the upstream server chose. The fork's own
// redactMcpConfig (extensions-export.ts) is the MCP-shaped sibling of this
// rule and stays separate: it redacts by position in a known MCP entry, this
// redacts by name anywhere in an undeclared tree.

const REDACTED = "[REDACTED]";

// Words that mean "credential" wherever they appear in a key. An exact-key set
// cannot work here: the same secret is spelled GITHUB_TOKEN in an MCP
// environment record, accessToken in an OAuth blob, and client_secret in a
// provider config. Matching on segments rather than whole keys is what makes
// those three the same rule instead of three misses.
const SENSITIVE_SEGMENTS = new Set([
  "authorization",
  "token",
  "secret",
  "password",
  "passwd",
  "passphrase",
  "cookie",
  "apikey",
  "credential",
  "credentials",
]);

// Weaker words, matched only as the final segment. "key" anywhere would redact
// keyPath and keyBindings, and "auth" anywhere would redact authUrl — all of
// which a diagnostic exists to show.
const SENSITIVE_TAIL_SEGMENTS = new Set(["key", "auth"]);

// Records whose *values* are credentials regardless of what the individual
// keys are called. An MCP entry's environment map is the canonical case: the
// key is whatever the upstream server chose to name its variable.
const CREDENTIAL_RECORD_KEYS = new Set(["headers", "environment", "env"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizedKey(key: string): string {
  return key.trim().toLowerCase();
}

/** Split a key into lowercase words across separators and camelCase humps. */
function keySegments(key: string): string[] {
  return key
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment.toLowerCase());
}

function isSensitiveKey(key: string): boolean {
  const segments = keySegments(key);
  if (segments.length === 0) return false;
  if (segments.some((segment) => SENSITIVE_SEGMENTS.has(segment))) return true;
  // The whole key with separators stripped, so "api_key" and "apikey" agree.
  if (SENSITIVE_SEGMENTS.has(segments.join(""))) return true;
  return SENSITIVE_TAIL_SEGMENTS.has(segments[segments.length - 1]!);
}

function isCredentialRecordKey(key: string): boolean {
  return CREDENTIAL_RECORD_KEYS.has(normalizedKey(key));
}

/** Every value redacted, keys preserved so the shape stays diagnosable. */
function redactRecordValues(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.keys(value).map((key) => [key, REDACTED]));
}

export function sanitizeDiagnosticString(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi, `Bearer ${REDACTED}`)
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, REDACTED)
    .replace(/\bow[thc]_[A-Za-z0-9_-]+\b/g, REDACTED);
}

export function sanitizeDiagnosticValue(value: unknown): unknown {
  if (typeof value === "string") return sanitizeDiagnosticString(value);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeDiagnosticValue(item));
  if (!isRecord(value)) return String(value);

  const sanitized: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (isSensitiveKey(key)) {
      sanitized[key] = REDACTED;
      continue;
    }
    // headers/environment/env: the values are secrets whatever they are named,
    // so redact the whole record rather than testing each key against a
    // vocabulary the upstream server never agreed to.
    if (isCredentialRecordKey(key) && isRecord(nested)) {
      sanitized[key] = redactRecordValues(nested);
      continue;
    }
    sanitized[key] = sanitizeDiagnosticValue(nested);
  }
  return sanitized;
}
