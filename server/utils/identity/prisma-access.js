"use strict";

const IDENTITY_DATABASE_ENV = "IDENTITY_DATABASE_URL";
const IDENTITY_DIRECT_DATABASE_ENV = "IDENTITY_DIRECT_DATABASE_URL";

const IDENTITY_DELEGATES = Object.freeze([
  "user",
  "session",
  "apiKey",
  "workspace",
  "workspaceMembership",
  "role",
  "invite",
  "billingAccount",
]);

class IdentityAccessViolation extends Error {
  constructor(member) {
    super(`Prisma member "${String(member)}" is outside the FK3 identity bulkhead`);
    this.name = "IdentityAccessViolation";
  }
}

function requirePostgresUrl(value, environmentName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${environmentName} is required`);
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${environmentName} must be a valid PostgreSQL URL`);
  }

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error(`${environmentName} must use postgres:// or postgresql://`);
  }

  if (parsed.hostname.toLowerCase().includes("rustyred")) {
    throw new Error(`${environmentName} must not target RustyRed`);
  }

  return value;
}

function databaseEndpoint(value) {
  const parsed = new URL(value);
  const protocol =
    parsed.protocol === "postgres:" ? "postgresql:" : parsed.protocol;
  const port = parsed.port || "5432";
  return `${protocol}//${parsed.hostname.toLowerCase()}:${port}${parsed.pathname}`;
}

/**
 * Checks configuration without returning or logging credentials.
 *
 * This guard cannot prove what service exists behind a hostname. Deployment
 * acceptance must still audit PgBouncer and the direct PostgreSQL endpoint.
 */
function assertIdentityDatabaseBoundary(
  environment = process.env,
  { forMigration = false } = {}
) {
  const runtimeUrl = requirePostgresUrl(
    environment[IDENTITY_DATABASE_ENV],
    IDENTITY_DATABASE_ENV
  );
  const directUrl = forMigration
    ? requirePostgresUrl(
        environment[IDENTITY_DIRECT_DATABASE_ENV],
        IDENTITY_DIRECT_DATABASE_ENV
      )
    : null;

  if (
    directUrl &&
    databaseEndpoint(runtimeUrl) === databaseEndpoint(directUrl)
  ) {
    throw new Error(
      "IDENTITY_DIRECT_DATABASE_URL must bypass the runtime PgBouncer endpoint"
    );
  }

  const identityUrls = new Set([runtimeUrl, directUrl].filter(Boolean));
  for (const [key, value] of Object.entries(environment)) {
    if (!/^RUSTYRED.*_URL$/i.test(key) || typeof value !== "string") continue;
    if (identityUrls.has(value)) {
      throw new Error("Identity Prisma URLs must not reuse a RustyRed URL");
    }
  }

  return true;
}

function bindDelegate(delegate, name) {
  if (!delegate || (typeof delegate !== "object" && typeof delegate !== "function")) {
    throw new TypeError(`Prisma identity delegate "${name}" is unavailable`);
  }

  return new Proxy(delegate, {
    get(target, member, receiver) {
      const value = Reflect.get(target, member, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
    set() {
      throw new TypeError("Prisma identity delegates are read-only bindings");
    },
    deleteProperty() {
      throw new TypeError("Prisma identity delegates are read-only bindings");
    },
  });
}

function makeAccessProxy(prisma, { lifecycle, transactions }) {
  const target = Object.create(null);

  for (const name of IDENTITY_DELEGATES) {
    Object.defineProperty(target, name, {
      enumerable: true,
      value: bindDelegate(prisma[name], name),
    });
  }

  if (lifecycle) {
    for (const [publicName, prismaName] of [
      ["connect", "$connect"],
      ["disconnect", "$disconnect"],
    ]) {
      if (typeof prisma[prismaName] !== "function") {
        throw new TypeError(`Prisma client method "${prismaName}" is unavailable`);
      }
      Object.defineProperty(target, publicName, {
        enumerable: true,
        value: prisma[prismaName].bind(prisma),
      });
    }
  }

  if (transactions) {
    if (typeof prisma.$transaction !== "function") {
      throw new TypeError('Prisma client method "$transaction" is unavailable');
    }
    Object.defineProperty(target, "withTransaction", {
      enumerable: true,
      value: async (callback, options) => {
        if (typeof callback !== "function") {
          throw new TypeError("withTransaction requires a callback");
        }
        return prisma.$transaction(
          (transactionClient) =>
            callback(
              makeAccessProxy(transactionClient, {
                lifecycle: false,
                transactions: false,
              })
            ),
          options
        );
      },
    });
  }

  Object.freeze(target);

  return new Proxy(target, {
    get(bounded, member, receiver) {
      if (member === Symbol.toStringTag) return "IdentityPrismaAccess";
      if (typeof member === "symbol") return Reflect.get(bounded, member, receiver);
      if (member === "then" || member === "toJSON") return undefined;
      if (Object.prototype.hasOwnProperty.call(bounded, member)) {
        return Reflect.get(bounded, member, receiver);
      }
      throw new IdentityAccessViolation(member);
    },
    set(_bounded, member) {
      throw new IdentityAccessViolation(member);
    },
    deleteProperty(_bounded, member) {
      throw new IdentityAccessViolation(member);
    },
  });
}

/**
 * Exposes only FK3 identity delegates. Raw SQL and every content-tier Prisma
 * delegate are absent. Interactive transactions receive this same bounded
 * surface instead of the raw transaction client.
 */
function createIdentityPrismaAccess(prisma) {
  if (!prisma || (typeof prisma !== "object" && typeof prisma !== "function")) {
    throw new TypeError("A Prisma client is required");
  }
  return makeAccessProxy(prisma, { lifecycle: true, transactions: true });
}

module.exports = {
  IDENTITY_DATABASE_ENV,
  IDENTITY_DIRECT_DATABASE_ENV,
  IDENTITY_DELEGATES,
  IdentityAccessViolation,
  assertIdentityDatabaseBoundary,
  createIdentityPrismaAccess,
};
