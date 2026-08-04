# Follow-up: Commonplace Studio `code serve-web` (D1 / V7)

Parent plan: [`PLAN.md`](./PLAN.md) · Execute: [`EXECUTE-REPORT.md`](./EXECUTE-REPORT.md)  
Canonical decision: [`docs/records/013-vscode-surface.md`](../../records/013-vscode-surface.md) · Pipeline: [`packaging/commonplace-studio/`](../../../packaging/commonplace-studio/)

## Status

**Unparked, building.** The image and entrypoint now carry Studio as the default
IDE host (CS-003..CS-006, spec amendment A14). Stock code-server remains the
rollback behind `--build-arg IDE_HOST=code-server` and is still what the live
deploy runs until CS-007. The door and pack were always live; this follow-up
swaps the **workbench binary**.

Three blockers the plan did not anticipate, all now fixed in `build.sh`:

1. **`web` is not a deployable target.** `compile-web` emits a development tree
   that only `scripts/code-server.sh` runs (`VSCODE_DEV=1`). The artifact a
   container needs is upstream's reh-web server, so `build.sh` gained `server`.
2. **Node 24.** Upstream 1.131.0 pins `.nvmrc` to `24.18.0` and
   `build/npm/preinstall.ts` throws on another major. `build.sh` checks this
   right after checkout instead of letting `npm ci` discover it minutes later.
3. **No whitespace in the build path.** node-gyp writes include paths unquoted,
   so a tree under `/Volumes/SSD Samsung` dies inside `npm ci` with a missing
   directory named `Samsung/...`. `build.sh` refuses such a path up front;
   `STUDIO_BUILD_DIR` relocates the tree off the boot volume.

| What is already true | What this follow-up changes |
|---|---|
| Console `/IDE` edge proxy + register (`code-server.ide`) | Upstream of that proxy becomes Studio `code serve-web` |
| Co-located editor substrate on workspace `:50090` | Keep; host swap must not move GraphQL/SSE/ACP |
| Pack `theorem-vscode` seeded into the workspace image | Prefer Studio’s preinstalled pack from the V7 tree |
| Doctor probes substrate healthz + readiness | Add Studio workbench smoke; HTML stamp still needs a session |

## Why wait

1. **V7 compile/smoke is the oracle.** `packaging/commonplace-studio/scripts/build.sh web` has not completed a real `compile-web` + `code serve-web` boot. Until that passes, OW5 stays on stock code-server by decision (`README.md` “The web output”).
2. **Disk.** `RUNBOOK.md` budgets ~15GiB build + ~8GiB npm cache for `web`. Local prepare already refuses when free space is too low; do not start without a volume that clears those floors.
3. **One patch queue.** Studio owns identity, proposed-API grants, and the pack. Carrying code-server long-term means a second queue against the same upstream plus a second auth/TLS layer that duplicates console session auth.

## Goal

Authenticated `/IDE` serves Commonplace Studio’s web workbench (`code serve-web` from the fork tree), with `theorem-vscode` active, same checkout as `/chat`, same `THEOREM_EDITOR_*` / `THEOREM_ACP_*` substrate, no Microsoft marks, no second login wall inside the workbench.

## Non-goals

- Replacing the console edge auth model (cookie → workspace token stays).
- Moving the co-located editor API off the workspace container.
- Landing an OW5 amendment before web smoke passes.
- Desktop Studio distribution (V7 desktop is a sibling smoke, not the `/IDE` cutover).

## Checklist

| ID | Task | Grounding | Proof | Status |
|---|---|---|---|---|
| CS-000 | Durable follow-up (this file) + link from parent plan | `FOLLOW-UP-CODE-SERVE-WEB.md`, checklist note | file exists | done |
| CS-001 | Clear disk floors; run `build.sh prepare` then the deployable target on pinned `UPSTREAM_TAG` | `packaging/commonplace-studio/scripts/build.sh`, `RUNBOOK.md` | server artifact; ledger-gate pass | doing |
| CS-002 | Local smoke: the server boots; pack activates; OpenVSX/telemetry/identity checks | Studio RUNBOOK §5 web bullets | written smoke receipt | pending (CS-001) |
| CS-003 | OW5 amendment: workspace image replaces `code-server` install with Studio server output | `packaging/workspace/{Dockerfile,entrypoint.sh}`, Studio README | amendment text + image builds | **done** (A14; `studio-server` stage on `node:24`, gated by `IDE_HOST`) |
| CS-004 | Entrypoint: start the Studio server (host/port, user-data, extensions, proposed APIs) without stealing `$PORT` from OpenWork | today’s `env -u PORT` pattern for code-server | `/health` + IDE port respond; chat still on 8787 | **done** (host branch; `env -u PORT` kept; shellcheck clean) |
| CS-005 | Edge proxy / register: keep `/IDE` path strip; rename or note register impl if product id changes | `edge-proxy.mjs`, `.commonplace-canonical`, `IdeRegister` | register-manifest + proxy tests | **done** (proxy unchanged by design; manifest notes the selectable host and defers the rename to CS-008) |
| CS-006 | Preserve substrate env: bootstrap `editor.env`, `CONSOLE_EDITOR_SUBSTRATE_URL`, ACP vars | `bootstrap-editor-substrate.mjs`, Railway vars | doctor substrate green; pack GraphQL + SSE | **done** (one `ide_env` array both hosts pass identically) |
| CS-007 | Live cutover + authenticated `/IDE` smoke (session cookie) | Railway workspace + console | pack providers + one ACP prompt | pending (CS-002) |
| CS-008 | Retire stock code-server from workspace image once Studio is proven; update EXECUTE-REPORT; rename `manifest_impl` and `REGISTER_IMPL` to `commonplace-studio.ide` | Dockerfile, EXECUTE-REPORT, `.commonplace-canonical`, `edge-proxy.mjs` | image no longer ships code-server binary as host | pending (CS-007) |

## Sequence

```
1. Disk + prepare + web compile     → verify: build.sh web exits 0
2. Local code serve-web smoke       → verify: pack activates in browser host
3. Draft OW5 amendment              → verify: named Dockerfile/entrypoint deltas
4. Workspace image cutover          → verify: IDE port + chat port both healthy
5. Proxy/register notes             → verify: gate:register-manifest
6. Deploy + authenticated /IDE      → verify: live session, substrate doctor
7. Drop stock code-server host      → verify: CS-008
```

## Validation commands

```bash
# Studio pipeline (needs disk)
cd packaging/commonplace-studio
./scripts/build.sh prepare
./scripts/build.sh web
./scripts/ledger-gate.sh

# Product door (after image swap)
node --test apps/console/scripts/edge-proxy.test.mjs
node scripts/check-register-manifest.mjs
pnpm --filter theorem-vscode test
node scripts/doctor.mjs   # substrate.* green; /IDE HTML stamp needs session
```

## Rollback

Keep shipping stock code-server on the workspace `:8080` path. `/IDE` edge proxy and the co-located substrate stay valid under that host. Studio web artifacts can remain offline until CS-002 passes.

## Pointers

- Parent deferral D1: `.harness/checklists/ide-substrate-wire--plan-ide-substrate-wire-20260803a.json`
- V7 product pipeline: `packaging/commonplace-studio/README.md`
- Rebase + smoke: `packaging/commonplace-studio/RUNBOOK.md`
- Record of “serve-web, not code-server”: `docs/records/013-vscode-surface.md`
- Live IDE wire PR: https://github.com/Travis-Gilbert/CommonPlace/pull/173
