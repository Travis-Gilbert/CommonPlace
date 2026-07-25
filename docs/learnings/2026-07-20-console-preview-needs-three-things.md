---
title: The console preview needs an auth secret and an object seam, and launch.json supplies neither
kind: gotcha
date: 2026-07-20
scope: apps/console (preview_start, .claude/launch.json)
---

## trigger_case (the real scar)

`preview_start({name: 'console'})` reported success. The page loaded, the stripe
rendered, and clicking the Index surface set `aria-checked="true"` on the right
radio. But the center screen stayed empty and every filing selector returned
zero:

```
{"clicked":true,"index":false,"shelves":0,"ribbon":0,"destinations":0}
```

I lost time treating this as a Browser-pane rendering quirk. It was two missing
backends, and the server said so plainly once I asked it directly instead of
asking the DOM:

```bash
$ curl -s -X POST localhost:3010/api/objects/query -d '{"types":["surface"]}'
502 {"error":"console_data_api_unreachable","upstream":"http://localhost:50090"}

$ preview_logs --level error
[auth][error] MissingSecret: Please define a `secret`.
```

The `console` entry in `.claude/launch.json` is `runtimeExecutable` +
`runtimeArgs` + `port` only. It has no `env` block, so:

1. **No `AUTH_SECRET`** -> Auth.js throws `MissingSecret` on every request ->
   `resolveHarnessPrincipal()` never resolves -> every `/api/*` route 401s.
2. **No object seam** -> `/api/objects/query` 502s -> the shell has no surface
   objects to render -> the stripe has nothing to switch *to*. The radio still
   checks, because the stripe is driven by the seed list, not by the fetch.

That second failure mode is the nasty one: the shell looks alive and the
navigation looks responsive while there is nothing behind it.

## rule_short

A working console preview needs three things, and `preview_start` only supplies
the first:

```bash
# 1. the dev server            preview_start({name: 'console'})
# 2. an auth secret + identity apps/console/.env.local  (gitignored by .env.*)
# 3. an object seam on 50591   node apps/console/e2e/stub-data-api.mjs
#    ...or the real one:       npm run api:dev            (serves 50090)
```

Verify with curl, not with the DOM. Two 200s mean it actually works:

```bash
curl -o /dev/null -w "%{http_code}\n" -X POST localhost:3010/api/objects/query \
  -H 'content-type: application/json' -d '{"types":["surface"]}'
curl -o /dev/null -w "%{http_code}\n" localhost:3010/api/filing
```

`apps/console/.env.local` is the right home for the secret: the repo root
`.gitignore` has `.env.*` with `!.env.example`, so it cannot be committed, and
Next.js loads it automatically without depending on whether the preview tool
supports an `env` key.

## why

The Playwright config has carried all of this since it was written
(`playwright.config.ts` starts the stub on 50591 *and* passes `AUTH_SECRET`,
`CONSOLE_DATA_API_URL`, and the identity fixtures to its own webServer). Nothing
propagated that to `launch.json`, so the e2e path worked and the human preview
path did not, and the gap was invisible because both start "the console on 3010".

Related defect found the same way: `npm run api:dev` ran
`cargo run --manifest-path apps/commonplace-api/Cargo.toml` against a crate that
builds **two** binaries (`commonplace-api`, `commonplace-mcp`) with no
`default-run`, so cargo refused to choose and the `api` preview config failed
outright. Fixed in `87489a4` by naming `--bin commonplace-api`.

## corollary: the Browser pane is not the oracle for this app

The pane never switched surfaces even when the server was healthy. Playwright,
driving a real browser against the same server, switched every time and passed
8/8. When the pane and Playwright disagree about this console, believe
Playwright and move on rather than debugging the pane.
