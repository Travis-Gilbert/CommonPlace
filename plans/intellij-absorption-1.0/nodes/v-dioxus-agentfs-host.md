# v-dioxus-agentfs-host: verify sibling of dioxus-agentfs-host

- kind: verify
- controller: agent
- verifies: `dioxus-agentfs-host`
- state: done (GATE PASSED 2026-08-16)

## Fixed oracle

| Obligation | Proof | Acceptance | oracle_class | implementation_mode | evidence_class | substitution_allowed | live_oracle_required |
|---|---|---|---|---|---|---|---|
| O-DAH.1 | Paths exist under `Theorem/infra/fly/dioxus-agentfs/` | fly.toml, Dockerfile, start.sh, nginx.conf, deploy.sh | source | production | path audit | false | false |
| O-DAH.2 | HTTP GET of the public (or fly.dev) origin | `/` contains `canvas-gallery`; `/canvas-gallery.js` 200 | deployed product | production | live HTTP receipt | false | true |
| O-DAH.3 | HTTP GET `/readyz` | JSON `live_mount` true | live substrate | production | live HTTP receipt | false | true |
| O-DAH.4 | fly.toml mounts | source ≠ `dsh_workspace` and ≠ personal-store | source | production | fly.toml | false | false |
| O-DAH.5 | start.sh + fly.toml | one app, mount then nginx, no remote FUSE | source | production | file receipt | false | false |

Mocks, local `python3 -m http.server`, and the dsh-workspace app cannot discharge O-DAH.2 or O-DAH.3.

## Occupancy (2026-08-16)

- Occupant: cursor-grok-4.6
- Binding: portable
- Scope: re-run live HTTP + path audit; no product source edits

## Gate record (2026-08-16) — PASSED

Independent re-probe of `https://travis-theorem-dioxus.fly.dev`:

- O-DAH.1: `infra/fly/dioxus-agentfs/{fly.toml,Dockerfile,start.sh,nginx.conf,deploy.sh,theorem-wrapper.sh}` present.
- O-DAH.2: `GET /` HTTP 200, body contains `<title>canvas-gallery</title>`; `GET /canvas-gallery.js` 200 size 73679.
- O-DAH.3: `GET /readyz` `{"ok":true,"live_mount":true,"mount":"/workspace"}`. SSH `/proc/mounts`: `rustyred-agentfs /workspace fuse rw,nosuid,nodev,relatime,user_id=0,group_id=0`.
- O-DAH.4: fly.toml `[[mounts]] source = "dioxus_agentfs"`; volume `vol_rnz6qz1wk5zg21er` attached to machine `8d067dbed54478`. Not `dsh_workspace`, not personal-store.
- O-DAH.5: one fly.toml, one machine group `app`; start.sh mounts AgentFS then nginx; no remote FUSE.

Substitution not used. GATE: PASS.

## Occupancy released

Verify sibling accepted. Destination path `d11 → d12 → dioxus-agentfs-host → v-dioxus-agentfs-host` is at this branch's fixpoint. Remaining board weather: `ide-proxy-fold` (wasmtime E0310). Do not occupy `console-host` (parked-superseded by d12).
