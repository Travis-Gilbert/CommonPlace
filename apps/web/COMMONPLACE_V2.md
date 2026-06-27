# CommonPlace v2

A fork of the CommonPlace surface (`src/components/commonplace`, `src/app/(commonplace)`)
that connects to **Theorem's `commonplace-api` GraphQL** as its single backend,
instead of the (disconnected) Django `research_api` REST.

Branch: `commonplace-v2`. The original frontend deploy target was a Vercel
project at `https://v2.travisgilbert.me/commonplace`; the current direction is
to keep the backend on Railway and evaluate moving the web service there too so
CommonPlace and Theorem share one deploy/control plane.

## Architecture: one GraphQL front door

```
browser ──POST /api/theorem/graphql (same-origin, no key)──▶ Next route handler
                                                              │ attaches x-api-key (server-side)
                                                              ▼
                                              Theorem commonplace-api (GraphQL)
                                                              │ (later) gRPC
                                                              ▼
                                                          Theseus (canonical)
```

- The browser never holds the Theorem key and never makes a cross-origin call.
  `src/app/api/theorem/graphql/route.ts` is the proxy; it forwards to Theorem with
  the server-side key. (SSR callers dial Theorem directly via the server env.)
- The consumer surfaces read/write through the existing `commonplace-api.ts` mapper
  seam — `src/lib/commonplace-graphql.ts` adapts the Theorem `Item`/`Collection`
  model into the existing frontend shapes (`MockNode`, `ObjectListItem`,
  `ApiObjectDetail`, `ObjectSearchResult`, `ApiCaptureResponse`), so the view
  components are unchanged.

## What is connected to GraphQL

| Surface | Function repointed | Theorem op |
|---|---|---|
| Library / Grid / Timeline | `fetchFeed` | `items` |
| Command palette / search | `searchObjects` | `search` |
| Object drawer / reader | `fetchObjectDetail` | `item(id)` |
| Capture (write) | `captureToApi` (via `syncCapture`) | `ingest` |
| Ask omnibar (agent reads + writes) | `submitQuestion` → `askViaGraph` | `ask` + `ingest` |
| Files (new) | `FilesView` builds a tree from `item.path` | `items` |

**Agents write to the UI:** an omnibar ask runs grounded retrieval over the graph
and writes its answer back as a durable `[ask, agent]` item, which appears live
across surfaces (RECENT / Library / Files) via the `captureVersion` poke.

**Still on the old REST path (honest empty/error until Theorem grows them over
gRPC→Theseus):** Notebooks, Projects, Map (graph), Engine, Models, Resurface.
These map naturally to `collections` / `briefing` / `discover` next.

## Environment

Server-only (set on the hosting service; never `NEXT_PUBLIC_`):

| Var | Local default | Production |
|---|---|---|
| `THEOREM_GRAPHQL_URL` | `http://127.0.0.1:50090` | the Railway `commonplace-api` URL |
| `THEOREM_API_KEY` | `dev-key` | the instance key (`COMMONPLACE_API_KEY` on the Railway service) |
| `AUTH_SECRET` | (set any value) | a rotated secret (next-auth) |
| `COMMONPLACE_ALLOW_CLIENT_INSTANCE_OVERRIDE` | `1` | unset unless trusted clients may select localhost/private-LAN instances |
| `COMMONPLACE_CLIENT_INSTANCE_DEFAULT_API_KEY` | `dev-key` | optional default for local/self-hosted proxy requests |

Public:

| Var | Value |
|---|---|
| `NEXT_PUBLIC_COMMONPLACE_BACKEND` | `graphql` (default) — set `rest` to fall back to Django |

`.env.local` (gitignored) holds the local-dev values. `.env.local.example`
contains a non-secret template.

## Mobile backend picker

The mobile PWA can switch between the hosted backend and a self-hosted backend
from Settings -> Backend. For local/dev use, the URL is enough:

- `http://127.0.0.1:50090`
- `http://localhost:50090`

The route proxy accepts client-selected backends only in development or when
`COMMONPLACE_ALLOW_CLIENT_INSTANCE_OVERRIDE=1`, and only for loopback, private
LAN, or `.local` hosts. The browser never receives the production
`THEOREM_API_KEY`; the proxy attaches that server-side.

The URL Travis shared, `https://rustyredcore-theorem-production.up.railway.app/`,
is the Theorem/RustyRed service edge, not the CommonPlace GraphQL endpoint. The
cloud mobile URL should be the public domain for the dedicated
`commonplace-api` Railway service, where `GET /healthz` returns `ok` and
`/graphql` serves GraphQL.

## Mobile app shell and Capacitor

`/commonplace/mobile` is the deterministic mobile entrypoint. It always renders
the Plane-style CommonPlace mobile shell, while `/commonplace` can still respond
to viewport size. The CommonPlace PWA manifest starts at `/commonplace/mobile`
so installing from mobile does not fall back to the older Daily layout.

The first native wrapper lives in `apps/web/ios` and is driven by Capacitor:

```bash
cd apps/web
npm run build:desktop
npm run cap:sync:ios
npm run cap:open:ios
```

For local iOS WebView testing against a running dev server, set
`CAPACITOR_SERVER_URL`, for example:

```bash
CAPACITOR_SERVER_URL=http://localhost:3040 npm run cap:sync:ios
```

Leave `CAPACITOR_SERVER_URL` unset for a bundled build; Capacitor will use the
static export in `out`.

## Auth0 and tenant linking

Auth0 should authenticate humans; CommonPlace should still decide tenancy and
authorization from its own database. The bridge should map an Auth0 identity
(`sub`) and, later, Auth0 organization/workspace claims onto CommonPlace tenant
records and principals. The web layer then resolves the signed-in user to the
tenant/principal before issuing CommonPlace GraphQL requests.

Auth0's Next.js SDK requires:

| Var | Purpose |
|---|---|
| `AUTH0_DOMAIN` | Auth0 tenant domain |
| `AUTH0_CLIENT_ID` | Regular Web App client id |
| `AUTH0_CLIENT_SECRET` | Regular Web App client secret |
| `AUTH0_SECRET` | SDK session encryption secret |
| `APP_BASE_URL` | App origin, e.g. `http://localhost:3040` locally |

Production tenant linkage should not trust a user-submitted tenant id. It should
resolve from the Auth0 session and CommonPlace tenant membership rows.

## Run locally

```bash
# 1. CommonPlace GraphQL API
COMMONPLACE_API_KEY=dev-key PORT=50090 cargo run --manifest-path apps/commonplace-api/Cargo.toml

# 2. Next app
cd apps/web
npm run dev   # http://localhost:3040/commonplace in the current local setup
```

## Deploy

1. **Backend:** deploy `apps/commonplace-api` to Railway; note its URL
   and `COMMONPLACE_API_KEY`. (Durable RedCore backing is the named follow-up; the
   slice ships on the in-memory store.)
2. **Frontend on Railway:** now has `apps/web/railway.toml`. Create a second
   Railway service from the same repo. The intended root directory is `apps/web`,
   but the config also tolerates Railway executing from the repository root. It
   runs `npm run build:railway`, which enables Next standalone output and copies
   `public` plus `.next/static` into the standalone server bundle, then starts
   with `npm run start:railway`. The root package scripts delegate those commands
   to `apps/web`; the app package exposes the same command names for an app-root
   service. Pin the service build variables to `RAILPACK_NODE_VERSION=22` and
   `RAILPACK_INSTALL_CMD=true`; the root `build:railway` script runs the app
   install before invoking the app build. Keep build CLIs such as `tsx` and
   `pagefind` declared in `apps/web/package.json`; Railway's clean builder will
   not have locally cached binaries.
3. **Frontend on Vercel:** still a reasonable fallback while proving Railway.
   The main drawback to leaving Vercel is losing Vercel-managed Next.js platform
   conveniences such as image optimization, CDN/function integration, and Vercel
   env tooling. This app already has `images.unoptimized: true`, which reduces
   that cost.
4. **Cutover:** keep Vercel live until the Railway web deployment, Auth0 callback
   URLs, `THEOREM_GRAPHQL_URL`, and the public CommonPlace API domain are all
   verified.
