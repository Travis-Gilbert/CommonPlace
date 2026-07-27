# CommonPlace fork server

This is the Express peer retained from the AnythingLLM hard fork. It owns two
boundaries:

1. identity administration against real PostgreSQL through Prisma
2. authenticated document admission from Console to the collector and then to
   the commonplace `IngestPipeline`

It does not store documents, extracted text, chat, memory, embeddings, plans,
or receipts in PostgreSQL.

## Storage bulkhead

`GET /healthz` proves only that the Express identity process is available.
Collector and RustyRed clients initialize on the first document request. A
collector or graph outage therefore returns a degraded upload response without
blocking login, invitations, workspace membership, or API-key administration.

Runtime Prisma traffic uses `IDENTITY_DATABASE_URL` through PgBouncer.
Migration tooling uses `IDENTITY_DIRECT_DATABASE_URL` and must bypass
PgBouncer. Read [prisma/README.md](prisma/README.md) before generating or
applying a migration.

## Document path

```text
Console form
  -> same-origin Next route
  -> internal Express raw-byte route
  -> membership and ScopeRef resolution
  -> parse-only collector
  -> HTTP content transport
  -> commonplace IngestPipeline
  -> RustyRed
```

The browser and collector never choose the tenant or graph scope. The Express
route derives both from the authenticated principal and workspace membership.
A content-derived source reference makes retries update one graph item.

The current CommonPlace GraphQL API is one store per process and does not yet
enforce the forwarded scope headers. The transport refuses this fallback by
default. `COMMONPLACE_UNSAFE_ALLOW_UNSCOPED_GRAPHQL=1` exists only for an
isolated local single-scope fixture and must not be set on a shared production
store.

## Commands

```sh
npm ci
npm run prisma:validate
npm test
npm start
```
