# CommonPlace browser-native (SPEC-COMMONPLACE-NATIVE-SHELL-1.0 B4-B6)

Own Cargo workspace for the GPUI shell. The default `mock` feature keeps the
contract tests cheap. The real executable is behind `gpui`, with gpui,
gpui-component, and gpui-wry locked to the SHAs in `PINS.md` and `Cargo.lock`.

## Layout

| Module | Role |
|--------|------|
| `traits` | `Shell`, `DockHost`, `SurfaceHost`: GPUI types never cross this boundary |
| `dock` | DockArea layout persist / restore (center, left rail, right evidence, bottom) |
| `prompts` | Native permission / takeover prompts from BrowserCore grant requests |
| `rail` | Capability rail fed by extension-point contributions |
| `surfaces` | **B5** mock Servo + sidecar supervision + **B6** mock CommonPlace wry + z-order |
| `surfaces/sidecar` | GPUI-edition pane-host supervisor (spawn / restart / reseed) |
| `loopback` | Authenticated typed WebSocket IPC on `127.0.0.1` |
| `native` | Real GPUI window, gpui-wry child, optional `PANE_HOST_BIN` sidecar |
| `proof` | Scripted F3 ten-point proof window + B2 registration report |
| `pins` | Documented commit SHAs for gpui / gpui-component / gpui-wry |
| `lib` | `NativeShell` composing `browser-core` + `interaction-arbiter` |

## B5 / B6 status

**B4 chrome** — `native.rs` now composes TitleBar, omnibox (go/ask/find),
permission strip, left rail, wry content hole, bottom dock, and a presence chip.
Full DockArea multi-tab Servo layout is follow-on; flex chrome is the first
honest control plane (z-order law: strips are siblings, not overlays).

**B5 — supervision + build-graph seams.**
`PaneHostSupervisor` mirrors the Tauri plugin contract: spawn the out-of-process
host, notice death, restart, and reseed open panes. Proven by
`tests/sidecar_supervision.rs` against `fake-pane-host`. The GPUI process starts
the sidecar when `PANE_HOST_BIN` is set (or after `scripts/fetch-pane-host.sh`
installs the pinned binary from `browser-sidecar.pin`).

Theorem `browser-embed` seams (SPEC-THEOREM-BUILD-GRAPH-1.0 / SR-008):

1. Parent panel x/y via child NSView (`position.rs`).
2. Focus / keyboard / IME injection (`input.rs` + pane-protocol 0.2).
3. SceneOS-shaped overlay producer (`overlay.rs` + `SetOverlay`).

Default builds do not compile libservo; `pane-host-servo --features servo-from-source`
is the escape hatch. Hash-verified fetch still needs published `browser-v*` sha256.

**B6 — substrate + live kill UI; screenshot capture deferred.**
Kill/restart state, loopback reconnect, and z-order law are covered by unit
tests. The gpui build exposes Kill surface / Restart in the bottom dock.
Screenshot proof uses `COMMONPLACE_F3_CAPTURE_*` env slots (see `--proof`).

## Build / test

```bash
cargo test --manifest-path apps/browser-native/Cargo.toml
cargo test --manifest-path apps/browser-native/Cargo.toml --features servo-pane
cargo run --manifest-path apps/browser-native/Cargo.toml -- --proof
cargo check --manifest-path apps/browser-native/Cargo.toml \
  --locked --no-default-features --features gpui,servo-pane
```

Default features run the mock shell acceptance tests without pulling GPUI.

## Run the real CommonPlace surface

Build and serve the console on its configured port, then launch the native
shell from a second terminal:

```bash
corepack pnpm --filter @commonplace/console run build
corepack pnpm --dir apps/console exec next start --port 3010
```

For a production-mode local server, put `AUTH_TRUST_HOST=true` and a development
`AUTH_SECRET` in an ignored environment file or process environment. Do not
commit the secret.

```bash
COMMONPLACE_CONSOLE_URL=http://127.0.0.1:3010/ \
  PANE_HOST_BIN=/path/to/pane-host \
  cargo run --manifest-path apps/browser-native/Cargo.toml \
  --locked --no-default-features --features gpui,servo-pane
```

The bridge handshake rejects any page origin other than the exact origin of
`COMMONPLACE_CONSOLE_URL`, and every request must also present the injected
per-process token.

## Pins

See `PINS.md`. Do not bump without updating both `PINS.md` and `pins.rs`.
