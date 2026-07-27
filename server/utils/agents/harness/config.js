"use strict";

const { harnessError } = require("./errors");

const DEFAULT_PROTOCOL_VERSION = "2025-06-18";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_CATALOG_PAGE_SIZE = 10;
const DEFAULT_CATALOG_WINDOW = 100;
const MAX_TIMEOUT_MS = 60_000;
const MAX_CATALOG_PAGE_SIZE = 20;
const MAX_CATALOG_WINDOW = 100;

function resolveHarnessConfig(environment = process.env) {
  const rawEndpoint = firstText(
    environment.COMMONPLACE_HARNESS_URL,
    environment.CONSOLE_HARNESS_URL
  );
  if (!rawEndpoint) {
    throw harnessError(
      "HARNESS_CONFIGURATION_INVALID",
      "COMMONPLACE_HARNESS_URL must be configured explicitly."
    );
  }

  const endpoint = normalizeEndpoint(rawEndpoint, environment);
  const token = firstText(
    environment.COMMONPLACE_HARNESS_TOKEN,
    environment.CONSOLE_HARNESS_TOKEN
  );
  const tokenTenant = firstText(
    environment.COMMONPLACE_HARNESS_TOKEN_TENANT,
    environment.CONSOLE_HARNESS_TOKEN_TENANT
  );
  const tokenPrincipal = firstText(
    environment.COMMONPLACE_HARNESS_TOKEN_PRINCIPAL,
    environment.CONSOLE_HARNESS_TOKEN_PRINCIPAL
  );
  const tokenBinding = firstText(
    environment.COMMONPLACE_HARNESS_TOKEN_BINDING,
    environment.CONSOLE_HARNESS_TOKEN_BINDING
  );
  const tokenActor = firstText(
    environment.COMMONPLACE_HARNESS_TOKEN_ACTOR,
    environment.CONSOLE_HARNESS_TOKEN_ACTOR
  );
  const allowUnauthenticatedLocal =
    environment.COMMONPLACE_HARNESS_ALLOW_UNAUTHENTICATED_LOCAL === "1";
  if (!token && !(allowUnauthenticatedLocal && isLocalEndpoint(endpoint))) {
    throw harnessError(
      "HARNESS_CONFIGURATION_INVALID",
      "COMMONPLACE_HARNESS_TOKEN must be configured explicitly."
    );
  }
  if (!token && environment.NODE_ENV === "production") {
    throw harnessError(
      "HARNESS_CONFIGURATION_INVALID",
      "Unauthenticated Harness access is refused in production."
    );
  }
  if (token && !tokenTenant) {
    throw harnessError(
      "HARNESS_CONFIGURATION_INVALID",
      "COMMONPLACE_HARNESS_TOKEN_TENANT must name the exact tenant admitted by the bearer token."
    );
  }
  if (token && (!tokenPrincipal || !tokenBinding || !tokenActor)) {
    throw harnessError(
      "HARNESS_CONFIGURATION_INVALID",
      "Harness bearer configuration must name the exact principal, binding, and actor returned by Theorem identity receipts."
    );
  }

  const allowedTenants = parseAllowedTenants(
    firstText(
      environment.COMMONPLACE_HARNESS_ALLOWED_TENANTS,
      environment.CONSOLE_HARNESS_TENANT
    )
  );
  if (allowedTenants.length === 0) {
    throw harnessError(
      "HARNESS_CONFIGURATION_INVALID",
      "COMMONPLACE_HARNESS_ALLOWED_TENANTS must admit at least one exact tenant."
    );
  }
  if (tokenTenant && !allowedTenants.includes(tokenTenant)) {
    throw harnessError(
      "HARNESS_CONFIGURATION_INVALID",
      "COMMONPLACE_HARNESS_TOKEN_TENANT must also appear in COMMONPLACE_HARNESS_ALLOWED_TENANTS."
    );
  }

  const timeoutMs = parseBoundedInteger(
    environment.COMMONPLACE_HARNESS_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
    1,
    MAX_TIMEOUT_MS,
    "COMMONPLACE_HARNESS_TIMEOUT_MS"
  );
  const maxCatalogPageSize = parseBoundedInteger(
    environment.COMMONPLACE_HARNESS_CATALOG_PAGE_SIZE,
    DEFAULT_CATALOG_PAGE_SIZE,
    1,
    MAX_CATALOG_PAGE_SIZE,
    "COMMONPLACE_HARNESS_CATALOG_PAGE_SIZE"
  );
  const maxCatalogWindow = parseBoundedInteger(
    environment.COMMONPLACE_HARNESS_CATALOG_WINDOW,
    DEFAULT_CATALOG_WINDOW,
    maxCatalogPageSize,
    MAX_CATALOG_WINDOW,
    "COMMONPLACE_HARNESS_CATALOG_WINDOW"
  );

  return Object.freeze({
    endpoint,
    token: token ?? null,
    tokenTenant: tokenTenant ?? null,
    tokenPrincipal: tokenPrincipal ?? null,
    tokenBinding: tokenBinding ?? null,
    tokenActor: tokenActor ?? null,
    allowedTenants: Object.freeze(allowedTenants),
    timeoutMs,
    maxCatalogPageSize,
    maxCatalogWindow,
    protocolVersion:
      firstText(environment.COMMONPLACE_HARNESS_MCP_PROTOCOL_VERSION) ??
      DEFAULT_PROTOCOL_VERSION,
  });
}

function normalizeEndpoint(rawEndpoint, environment) {
  let url;
  try {
    url = new URL(rawEndpoint);
  } catch {
    throw harnessError(
      "HARNESS_CONFIGURATION_INVALID",
      "COMMONPLACE_HARNESS_URL must be an absolute URL."
    );
  }

  if (url.username || url.password || url.search || url.hash) {
    throw harnessError(
      "HARNESS_CONFIGURATION_INVALID",
      "Harness endpoint credentials, query parameters, and fragments are refused."
    );
  }

  const insecureLocalAllowed =
    environment.COMMONPLACE_HARNESS_ALLOW_INSECURE_LOCAL === "1" &&
    environment.NODE_ENV !== "production" &&
    isLocalHostname(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && insecureLocalAllowed)) {
    throw harnessError(
      "HARNESS_CONFIGURATION_INVALID",
      "Harness endpoint must use HTTPS unless insecure local access is explicitly enabled."
    );
  }

  url.pathname = `${url.pathname.replace(/\/(?:mcp)?\/?$/, "").replace(/\/+$/, "")}/mcp`;
  return url.toString();
}

function parseAllowedTenants(value) {
  if (!value) return [];
  const tenants = value
    .split(",")
    .map((tenant) => tenant.trim())
    .filter(Boolean);
  return [...new Set(tenants)];
}

function parseBoundedInteger(raw, fallback, minimum, maximum, name) {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw harnessError(
      "HARNESS_CONFIGURATION_INVALID",
      `${name} must be an integer between ${minimum} and ${maximum}.`
    );
  }
  return value;
}

function firstText(...values) {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const text = value.trim();
    if (text) return text;
  }
  return null;
}

function isLocalEndpoint(endpoint) {
  return isLocalHostname(new URL(endpoint).hostname);
}

function isLocalHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

module.exports = {
  DEFAULT_PROTOCOL_VERSION,
  MAX_CATALOG_PAGE_SIZE,
  MAX_CATALOG_WINDOW,
  resolveHarnessConfig,
};
