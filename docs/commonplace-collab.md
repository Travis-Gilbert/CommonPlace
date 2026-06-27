# CommonPlace Collaboration Service

CommonPlace uses a self-hosted Hocuspocus server for network collaboration over
Yjs documents. Hocuspocus is the live transport. RustyRed is the first-class
persistence owner: page CRDT snapshots are stored through `commonplace-api` as
content-addressed `File` blobs attached to the page `Doc` item.

## Run locally

```sh
npm run collab:dev
```

Useful environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `COMMONPLACE_COLLAB_HOST` | `127.0.0.1` | Bind host. |
| `COMMONPLACE_COLLAB_PORT` / `PORT` | `1234` | Bind port. |
| `COMMONPLACE_COLLAB_DATA_DIR` | `.commonplace/collab` | Durable collab state directory. |
| `COMMONPLACE_COLLAB_API_URL` | `http://127.0.0.1:50090/graphql` | CommonPlace GraphQL endpoint used for RustyRed persistence. |
| `COMMONPLACE_COLLAB_API_KEY` | `THEOREM_API_KEY`, `COMMONPLACE_API_KEY`, or `dev-key` | API key used server-side by Hocuspocus. |
| `COMMONPLACE_COLLAB_TOKEN_SECRET` | `THEOREM_API_KEY`, `COMMONPLACE_API_KEY`, `AUTH_SECRET`, or `dev-key` | Secret used to verify short-lived signed browser tokens. Set explicitly in production. |
| `COMMONPLACE_COLLAB_TOKEN` | unset | Optional legacy shared token for local/dev auth. Do not use in production. |
| `COMMONPLACE_COLLAB_AUTH_DISABLED` | unset | Set to `1` only for isolated local debugging. |
| `COMMONPLACE_COLLAB_COMPACT_ON_STORE` | unset | Set to `1` to call Rust-side `compactPageCrdtSnapshot` after each Hocuspocus store. |
| `COMMONPLACE_COLLAB_SQLITE_FALLBACK` | unset | Set to `1` to also enable Hocuspocus SQLite fallback. |
| `COMMONPLACE_COLLAB_SQLITE` | `<data-dir>/hocuspocus.sqlite` | SQLite fallback path when enabled. |
| `COMMONPLACE_COLLAB_DEBUG_SNAPSHOT_DIR` | unset | Optional local mirror of stored Yjs update bytes for debugging. |

## Frontend opt-in

The Pages editor keeps local IndexedDB Yjs persistence always on. Network
collaboration is enabled only when the browser has:

```sh
NEXT_PUBLIC_COMMONPLACE_COLLAB_URL=ws://127.0.0.1:1234
```

The browser asks the same-origin route `/api/commonplace/collab-token` for a
short-lived token scoped to the exact Hocuspocus document name. Before minting,
the route checks `commonplace-api` to confirm the page exists and is a `Doc`.
The route signs:

```json
{
  "sub": "commonplace-collab",
  "documentName": "commonplace-page:<page-id>",
  "pageId": "<page-id>",
  "exp": 1234567890
}
```

Hocuspocus verifies the signature, expiry, subject, and document name before
accepting the socket. `NEXT_PUBLIC_COMMONPLACE_COLLAB_TOKEN` remains as a legacy
local fallback only; hosted production should set `COMMONPLACE_COLLAB_TOKEN_SECRET`
on both the web app and collab service instead. In production, the token route
and collab service fail closed when `COMMONPLACE_COLLAB_TOKEN_SECRET` is absent.

## Document naming

Project Pages use:

```txt
commonplace-page:<page-id>
```

That name is the room id in Hocuspocus, the IndexedDB key suffix in the browser,
and the snapshot filename stem after sanitization.

## RustyRed and YRS persistence

Project Pages use `commonplace-api`:

```graphql
query pageCrdtSnapshot(pageId: String!)
mutation storePageCrdtSnapshot(input: StorePageCrdtSnapshotInputGql!)
mutation compactPageCrdtSnapshot(pageId: String!)
```

The mutation decodes base64 Yjs update bytes, stores them in RustyRed's
content-addressed blob store, writes or updates a hidden `File` item with:

```json
{
  "content_role": "page_crdt_snapshot",
  "page_id": "<page-id>",
  "encoding": "yjs-update-v1",
  "path": ".commonplace/pages/<page-id>/content.yjs",
  "folder_path": ".commonplace/pages/<page-id>",
  "hidden": true
}
```

The file item is attached back to the page `Doc` item. The query reads that
RustyRed-owned blob and returns the update as base64 so Hocuspocus can bootstrap
the room.

`compactPageCrdtSnapshot` is the Rust-side `yrs` compaction path. It decodes the
current Yjs update, applies it to a `yrs::Doc`, emits one canonical full-state
update, and writes that update back through the same RustyRed File/blob slot. It
can be called manually, by a future scheduled worker, or by the collab service
after every store with `COMMONPLACE_COLLAB_COMPACT_ON_STORE=1`.
