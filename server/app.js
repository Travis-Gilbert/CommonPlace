"use strict";

// SOURCING: mode=fork; repository=Mintplex-Labs/anything-llm;
// commit=633fc1960914298009134b40c25007cb422c7884;
// paths=server/index.js,server/endpoints/{invite,admin,api}.js.
// The route behavior is adapted under MIT. Express remains a peer service.

const { randomUUID, timingSafeEqual } = require("node:crypto");
const express = require("express");
const { IdentityOperationError } = require("./utils/identity/operations");

const DOCUMENT_UPLOAD_LIMIT = "50mb";

function validServiceSecret(value, name) {
  if (
    typeof value !== "string" ||
    value.length < 32 ||
    /^(?:change-me|example|test)$/i.test(value)
  ) {
    throw new Error(`${name} must be a non-placeholder value of at least 32 characters`);
  }
  return value;
}

function secretMatches(candidate, expected) {
  if (typeof candidate !== "string") return false;
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function bearerToken(header) {
  if (typeof header !== "string") return null;
  const match = /^Bearer ([^\s]+)$/.exec(header);
  return match?.[1] ?? null;
}

function decodeJsonHeader(value, name, maxBytes = 4096) {
  if (typeof value !== "string" || value.length === 0 || value.length > maxBytes * 2) {
    throw new IdentityOperationError(
      400,
      "identity_peer_header_invalid",
      `${name} is missing or invalid`
    );
  }
  let bytes;
  try {
    bytes = Buffer.from(value, "base64url");
  } catch {
    bytes = null;
  }
  if (!bytes || bytes.length === 0 || bytes.length > maxBytes) {
    throw new IdentityOperationError(
      400,
      "identity_peer_header_invalid",
      `${name} is missing or invalid`
    );
  }
  try {
    const parsed = JSON.parse(bytes.toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("header JSON must be an object");
    }
    return parsed;
  } catch {
    throw new IdentityOperationError(
      400,
      "identity_peer_header_invalid",
      `${name} is missing or invalid`
    );
  }
}

function createApp({
  operations,
  internalKey,
  adminLogins = [],
  documentIngest = null,
  requestIdFactory = randomUUID,
  logger = console,
}) {
  if (!operations) throw new TypeError("identity operations are required");
  if (typeof requestIdFactory !== "function") {
    throw new TypeError("requestIdFactory must be a function");
  }
  const admittedInternalKey = validServiceSecret(
    internalKey,
    "COMMONPLACE_FORK_SERVER_INTERNAL_KEY"
  );
  const admittedAdminLogins = [...new Set(adminLogins)].filter(
    (login) => typeof login === "string" && login.length > 0
  );
  const app = express();

  app.disable("x-powered-by");
  app.use((request, _response, next) => {
    request.id = requestIdFactory();
    next();
  });

  function requireInternal(request, response, next) {
    if (
      !secretMatches(
        bearerToken(request.headers.authorization),
        admittedInternalKey
      )
    ) {
      response.status(401).json({
        error: "internal_auth_refused",
        message: "The internal service credential was refused",
      });
      return;
    }
    next();
  }

  app.get("/healthz", (_request, response) => {
    response.json({ ok: true, service: "commonplace-fork-server" });
  });

  app.post(
    "/v1/workspaces/:workspaceId/documents",
    requireInternal,
    express.raw({ type: () => true, limit: DOCUMENT_UPLOAD_LIMIT }),
    async (request, response) => {
      if (!documentIngest || typeof documentIngest.ingestUpload !== "function") {
        response.status(503).json({
          error: "content_ingest_unconfigured",
          message: "Document ingestion is not configured",
        });
        return;
      }
      const principal = decodeJsonHeader(
        request.headers["x-commonplace-principal"],
        "x-commonplace-principal"
      );
      const tagEnvelope = request.headers["x-commonplace-tags"]
        ? decodeJsonHeader(
            request.headers["x-commonplace-tags"],
            "x-commonplace-tags"
          )
        : { tags: [] };
      const tags =
        tagEnvelope.tags === undefined ? [] : tagEnvelope.tags;
      const filename =
        typeof request.query.filename === "string"
          ? request.query.filename
          : "";
      const result = await documentIngest.ingestUpload({
        request,
        workspaceId: request.params.workspaceId,
        bytes: request.body,
        filename,
        mediaType: request.headers["content-type"],
        tags,
        principal,
      });
      response.status(201).json(result);
    }
  );

  app.use(express.json({ limit: "64kb", type: "application/json" }));

  app.get("/v1/invites/:code", async (request, response) => {
    response.json({ invite: await operations.inspectInvite(request.params.code) });
  });

  app.use("/v1", requireInternal);

  app.post("/v1/principals/reconcile", async (request, response) => {
    response.json(await operations.reconcilePrincipal(request.body?.principal));
  });

  app.post("/v1/workspaces/list", async (request, response) => {
    response.json(await operations.listWorkspaces(request.body?.principal));
  });

  app.post("/v1/workspaces", async (request, response) => {
    const workspace = await operations.createWorkspace(
      request.body?.principal,
      request.body?.workspace
    );
    response.status(201).json({ workspace });
  });

  app.patch("/v1/workspaces/:workspaceId", async (request, response) => {
    const workspace = await operations.updateWorkspace(
      request.body?.principal,
      request.params.workspaceId,
      request.body?.workspace
    );
    response.json({ workspace });
  });

  app.post("/v1/workspaces/:workspaceId/invites", async (request, response) => {
    const result = await operations.createInvite(
      request.body?.principal,
      request.params.workspaceId,
      request.body?.invite
    );
    response.status(201).json(result);
  });

  app.post("/v1/invites/:code/accept", async (request, response) => {
    const workspace = await operations.acceptInvite(
      request.body?.principal,
      request.params.code
    );
    response.json({ workspace });
  });

  app.post("/v1/workspaces/:workspaceId/api-keys", async (request, response) => {
    const result = await operations.createApiKey(
      request.body?.principal,
      request.params.workspaceId,
      request.body?.apiKey
    );
    response.status(201).json(result);
  });

  app.post(
    "/v1/workspaces/:workspaceId/api-keys/list",
    async (request, response) => {
      const apiKeys = await operations.listApiKeys(
        request.body?.principal,
        request.params.workspaceId
      );
      response.json({ apiKeys });
    }
  );

  app.delete("/v1/api-keys/:keyId", async (request, response) => {
    response.json(
      await operations.revokeApiKey(
        request.body?.principal,
        request.params.keyId
      )
    );
  });

  app.post("/v1/api-keys/authenticate", async (request, response) => {
    response.json(await operations.authenticateApiKey(request.body?.apiKey));
  });

  app.post("/v1/admin/overview", async (request, response) => {
    response.json(
      await operations.adminOverview(
        request.body?.principal,
        admittedAdminLogins
      )
    );
  });

  app.use((error, _request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }
    if (error instanceof IdentityOperationError) {
      response.status(error.status).json({
        error: error.code,
        message: error.message,
      });
      return;
    }
    if (error?.type === "entity.too.large") {
      response.status(413).json({
        error: "request_too_large",
        message: "The request body exceeds its configured limit",
      });
      return;
    }
    if (
      typeof error?.code === "string" &&
      /^(?:COLLECTOR|CONTENT|INGEST)_/.test(error.code)
    ) {
      const unavailable =
        error.retryable === true ||
        /(?:UNAVAILABLE|TIMEOUT|NETWORK|ENDPOINT|SCOPE_ENFORCEMENT|TRANSPORT)/.test(
          error.code
        );
      response.status(unavailable ? 503 : error.status ?? 400).json({
        error: error.code.toLowerCase(),
        message: unavailable
          ? "Document ingestion is temporarily unavailable"
          : "The document upload was refused",
      });
      return;
    }
    logger.error?.({
      name: error?.name ?? "Error",
      code: error?.code ?? "identity_server_error",
      message: error?.message ?? "Identity server error",
    });
    response.status(500).json({
      error: "identity_server_error",
      message: "The identity service could not complete the request",
    });
  });

  return app;
}

module.exports = { createApp, decodeJsonHeader, secretMatches };
