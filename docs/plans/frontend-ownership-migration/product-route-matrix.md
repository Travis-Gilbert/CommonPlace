# FO-003 Product Route Matrix

## Contract

The product host converges on CommonPlace porcelain without changing the
standalone marketing host:

| Request | Required candidate behavior | Disposition |
|---|---|---|
| `app.theoremharness.com/` | `308` to `/v2`, preserving the raw query string and request method | Canonical redirect |
| `/v2` | `200`, CommonPlace metadata, porcelain Index | Canonical product entry |
| `/v2/*` | Product route or product-owned not-found state | Canonical deep links |
| `/commonplace` | `200` through the migration | Compatibility entry |
| `/commonplace/mobile` | `200` through the migration | Compatibility entry |
| `/commonplace/notebooks` | `308` to `/v2/files`, preserving query | Replaced legacy deep link |
| `/commonplace/projects` | `308` to `/v2/objects`, preserving query | Replaced legacy deep link |
| `/commonplace/search` | `308` to `/v2/graph`, preserving query | Replaced legacy deep link |
| `/v2/account` | `308` to `/v2/account/agents`, preserving query | Canonical account subpage |
| `/api/auth/*` | NextAuth handlers respond without configuration errors; callback methods, cookies, and query parameters survive | Preserve auth contract |
| `/api/*` | Local handlers retain their methods; an upstream fallback must not disguise a missing required product handler | Preserve API contract |
| `theoremharness.com/` | `200` standalone marketing; no product shell | Separate host, unchanged in FO-003 |

The executable redirect and probe manifest is
`apps/web/src/lib/product-route-matrix.ts`. Next config consumes its redirect
entries directly. The root redirect is scoped to `PRODUCT_HOST`, which defaults
to `app.theoremharness.com`; candidate deployments set it to their direct host.
This preserves the personal-site root on any other hostname. The candidate
checker does not follow redirects, so it can assert exact status and `Location`
values:

```bash
PRODUCT_HOST=candidate.example \
  ROUTE_MATRIX_BASE_URL=https://candidate.example \
  ROUTE_MATRIX_REPEAT=100 \
  ROUTE_MATRIX_REPORT_PATH=route-matrix-report.json \
  npm --prefix apps/web run routes:check
```

## July 11 Production Baseline

Read-only probes against `https://app.theoremharness.com` found:

- `/` returned `200` personal-site content for GET, HEAD, and POST instead of
  redirecting to `/v2`;
- `/v2` and `/commonplace` returned `200`;
- `/commonplace/notebooks`, `/commonplace/projects`, and
  `/commonplace/search` returned `404` despite in-repo links;
- `/v2/db`, `/v2/db/movie_database`, `/v2/db/plant_database`, `/v2/objects`,
  and `/api/v2/db/*` existed at the audited source revision but returned `404`
  in production;
- NextAuth provider, session, CSRF, and callback probes returned `500
  Configuration`, and sign-in pointed at `0.0.0.0:8080`;
- `/v2/account` dropped its incoming query when redirecting to
  `/v2/account/agents`;
- the fallback `/api/:path*` rewrite returned an upstream Railway
  `Application not found` response for missing local handlers; and
- `/api/theorem/operator` returned deterministic fixture data. FO-010 owns the
  live-only correction, but FO-003 records it as a candidate blocker.

## Candidate Closure Gate

FO-003 is complete only when a non-production candidate revision passes:

1. the executable matrix for anonymous and opaque-cookie requests;
2. browser navigation checks with redirects enabled;
3. authenticated session and disposable OAuth callback checks with candidate
   credentials;
4. API method, query, cookie, and `Set-Cookie` preservation checks;
5. 100 repeated samples with JSON or JUnit evidence containing revision,
   status, `Location`, latency, and request id; and
6. a read-only repeat of the production baseline, without DNS or domain changes.

Production routing, DNS, and domain attachments do not change in FO-003.

## Local Candidate Evidence

The July 11 local candidate passed all 23 manifest probes with a host-scoped
`PRODUCT_HOST`, disposable NextAuth credentials, and no production secrets. A
separate Host-header check proved that the configured product host returned the
query-preserving `308` while `travisgilbert.me` still returned its personal-site
root with `200`.

The web production build also passed after setting Turbopack's root to the
CommonPlace monorepo root. The prior `apps/web`-only root prevented the app from
resolving the checked-in `packages/block-view-contracts` sources and was a
candidate deployment blocker. The build retains one pre-existing NFT tracing
warning for the Anytype filesystem importer.

This local evidence does not satisfy the candidate-host, real callback, or
100-sample closure gates.
