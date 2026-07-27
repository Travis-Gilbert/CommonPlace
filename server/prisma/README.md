# FK3 identity Prisma bulkhead

This schema is the Postgres identity tier for the first CommonPlace fork
slice. It is adapted from the pinned AnythingLLM Prisma 5.3.1 source, but it is
not a copy of AnythingLLM's mixed identity-and-content schema.

Prisma owns only these prefixed tables:

- users and hashed local credentials
- sessions with hashed bearer tokens
- API keys with a display prefix, hash, and identity scopes
- workspace identity records with an exact tenant and admitted graph scope
- workspace memberships
- workspace roles and permissions
- single-workspace invites with hashed claim tokens
- workspace billing accounts

The schema intentionally has no document, extracted-text, embedding, vector,
chat, memory, graph, run, operational plan, or receipt storage. Those are
RustyRed content-tier responsibilities. A workspace record persists the exact
tenant identifier and admitted `ScopeRef`; Prisma does not own the scoped
content. Tenant identifiers are case-sensitive at this boundary. In particular,
`Travis-Gilbert` must not be normalized on write or lookup.

## Runtime connection contract

- `IDENTITY_DATABASE_URL` is a real PostgreSQL URL routed through PgBouncer for
  runtime Prisma Client traffic. It must never target RustyRed, RustyRed
  pg-wire, or a content-tier compatibility endpoint.
- PgBouncer must use transaction pooling. Confirm its deployed version and
  prepared-statement configuration before rollout. Prisma's current guidance
  requires `max_prepared_statements` greater than zero and only calls for the
  `pgbouncer=true` URL parameter on PgBouncer versions older than 1.21.
- Create one long-lived Prisma Client per server process. Do not create a
  client per request, and do not fall back to RustyRed when identity Postgres is
  unavailable.
- Application code must acquire the bounded singleton from
  `server/utils/identity/index.js`. The raw Prisma Client and raw SQL methods
  are not part of the FK3 access contract. Endpoint adoption remains a separate
  integration gate in this fork slice.

## Migration contract

The pinned service uses Prisma 5.3.1, so this schema keeps the Prisma 5
`directUrl` form:

- `IDENTITY_DIRECT_DATABASE_URL` connects directly to the same PostgreSQL
  database and bypasses PgBouncer. It is for Prisma validation, diff, and
  migration commands only.
- Production migration jobs use `npm run prisma:migrate:deploy` from the
  `server` directory. The wrapper validates the pooled and direct boundaries
  before the pinned Prisma CLI reads this schema's `directUrl`.
- The static preflight rejects a direct URL that resolves textually to the same
  host, port, and database path as the runtime URL. DNS aliases and deployed
  routing still require a live audit.
- Migrations run as a single controlled deployment job, never during
  application startup and never through the pooled runtime URL.
- Before generating or applying the initial migration, perform a read-only
  live schema collision and ownership audit. Compare every `cp_identity_*`
  table with the deployed catalog migrations, then verify that no content-tier
  table is in the identity database.
- The prefix prevents exact object-name collisions; it does not resolve the
  semantic overlap with existing catalog tenant, project, billing, or principal
  rows. Define and rehearse that ID mapping before rollout. Do not introduce
  dual writes as an implicit migration strategy.
- Review generated SQL, backup or establish a restore point, and rehearse
  rollback before deployment. Do not use `db push` against production.

No live database, PgBouncer instance, migration, outage state, or data residency
was inspected by this static slice. Those remain acceptance gates.
