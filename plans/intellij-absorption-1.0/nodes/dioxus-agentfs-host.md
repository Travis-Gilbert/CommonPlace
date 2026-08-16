# dioxus-agentfs-host — AgentFS OS + Dioxus site on one Fly kernel (work)

- kind: work
- controller: agent
- gist: Deploy Theorem `UI/canvas-gallery` on Fly on the same machine as a live AgentFS FUSE mount and its own volume. Not CommonPlace `/IDE`. Not `travis-dsh-workspace`.
- provenance: d12-agentfs-dioxus-host; d11 first-class FUSE; user continue 2026-08-16 after fold resync.
- depends on: d12-agentfs-dioxus-host (done), d11-agentfs-os (done)
- state: done (2026-08-16; verify sibling GATE PASSED)

## Blueprint

One Fly app (`travis-theorem-dioxus`): nginx serves the Dioxus canvas-gallery wasm; `theorem-workspace serve` mounts AgentFS at `/workspace`; volume at `/data`; same VM (same-kernel law). Do not remote-FUSE `travis-theorem-personal-store`. Do not hang this hostname on the dsh store. Do not re-home UI into CommonPlace.

Reuse `apps/theorem-workspace` (already the hosted AgentFS binary) and `UI/canvas-gallery` (already the Dioxus site). Runtime image is Debian nginx + fuse3 so the glibc `theorem-workspace` binary runs. Gallery wasm is built locally (`UI/canvas-gallery/build.sh`) and copied into the image, same pattern as `travis-theorem-ide`.

This node does not retoken stories or add ide-proxy to the gallery. Proof is: gallery HTTP 200 + AgentFS `live_mount` on the same machine.

## Obligations

- O-DAH.1: deploy files exist (`infra/fly/dioxus-agentfs/{fly.toml,Dockerfile,start.sh,nginx.conf,deploy.sh}`). Proof: paths in the tree. **DISCHARGED** 2026-08-16.
- O-DAH.2: Dioxus site served. Proof: `GET /` returns the canvas-gallery document (`<title>canvas-gallery</title>`); `GET /canvas-gallery.js` is 200. oracle_class: deployed product. substitution_allowed: false. **DISCHARGED** 2026-08-16 live HTTP `https://travis-theorem-dioxus.fly.dev/`.
- O-DAH.3: AgentFS live on that kernel. Proof: `/readyz` JSON has `live_mount: true` and `mount` matching `THEOREM_WORKSPACE_MOUNT`. oracle_class: live substrate. substitution_allowed: false. **DISCHARGED** 2026-08-16 (`{"ok":true,"live_mount":true,"mount":"/workspace"}`; SSH `/proc/mounts`: `rustyred-agentfs /workspace fuse`).
- O-DAH.4: own volume, not personal-store / dsh volume. Proof: fly.toml `[[mounts]]` source is this app's volume name. **DISCHARGED** (`dioxus_agentfs` → `/data`; `vol_rnz6qz1wk5zg21er` attached to machine `8d067dbed54478`).
- O-DAH.5: same-kernel. Proof: one process group in one fly.toml; start.sh mounts then nginx; no remote FUSE. **DISCHARGED**.

## Scope

Writes: `Theorem/infra/fly/dioxus-agentfs/`, `UI/canvas-gallery/dist` (wasm rebuild), this node + verify sibling + manifest/replay. Do not touch CommonPlace `apps/console`, `travis-dsh-workspace` runtime, or `ide-proxy-fold` crates.

## Environment

- `CARGO_TARGET_DIR=/Volumes/SSD Samsung/cargo-targets/canvas-gallery` for wasm.
- `cargo +1.96.1`, `CARGO_BUILD_JOBS=4` max.
- Fly: `iad`, app `travis-theorem-dioxus`. Public HTTP (this is a site). Volume `dioxus_agentfs` → `/data`.
- No `git add -A`. No commits unless asked.

## Acceptance

O-DAH.1–5 discharged against the live app, or parked with a named Fly/weather trigger.

## Occupancy (2026-08-16)

- Occupant: cursor-grok-4.6
- Binding: portable (`plan` answers other plans; this board is file-native `intellij-absorption-1.0`)
- Scope: `infra/fly/dioxus-agentfs/` + `UI/canvas-gallery/dist` + board records
- Occupancy released on traverse to `v-dioxus-agentfs-host`

## Receipts (2026-08-16)

- Gallery wasm rebuilt: `UI/canvas-gallery/dist/canvas-gallery_bg.wasm` 2.5M, `canvas-gallery.js` 72K, title canvas-gallery.
- Fly app created: `travis-theorem-dioxus` (org personal). Volume `dioxus_agentfs` 10GB iad `vol_rnz6qz1wk5zg21er`.
- Deploy: `bash infra/fly/dioxus-agentfs/deploy.sh` exit 0, 298s. Image `deployment-01M05R1RSNFXNMXWF8HHDCS8GH` 63MB. Machine `8d067dbed54478` started, health check passing.
- Live origin: `https://travis-theorem-dioxus.fly.dev/`
- Runtime: Debian `nginx:stable-bookworm` + glibc `theorem-workspace`. start.sh stays PID 1 (nginx not exec'd) so FUSE cleanup trap holds.

## Seal (portable)

- Proposed lessons: none (file board). Authored: CapabilityFact + ArtifactFact in `lessons.md`.
- Authored None not used (lessons present).
- Handoff on edge `dioxus-agentfs-host -> v-dioxus-agentfs-host`.
