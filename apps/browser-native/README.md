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
| `surfaces` | **B5** mock Servo host + **B6** mock CommonPlace wry host + z-order law |
| `loopback` | Authenticated typed WebSocket IPC on `127.0.0.1`; native block/layout state and subscription replay |
| `native` | Real GPUI window, gpui-wry child surface, console bootstrap, exact-origin bridge policy |
| `surfaces/native_parent` | `RawWindowHandle` to pane-protocol parent translation behind `servo-pane` |
| `pins` | Documented commit SHAs for gpui / gpui-component / gpui-wry |
| `lib` | `NativeShell` composing `browser-core` + `interaction-arbiter` |

## B5 / B6 status

**B6 is wired through the native process boundary.** The gpui-wry child is
configured to load `COMMONPLACE_CONSOLE_URL` (default `http://127.0.0.1:3010/`).
Before page code runs, Wry injects a process-random bridge token and loopback
endpoint. The token never appears in the console URL or WebSocket URL. The Rust
integration test proves that a canonical block survives a socket-surface
reconnect, and the `gpui` feature graph compiles under `cargo check`.

**B5 remains partial.** The native handle translation compiles under
`servo-pane`, and `pane-host-servo` now resolves `browser-embed` from the
canonical Theorem repo instead of a machine-local sibling path. Three upstream
seams still prevent an honest runtime acceptance:

1. The GPUI edition does not yet supervise and reseed the pane-host process.
2. The pinned `browser-embed::set_bounds` consumes width and height but ignores
   the panel x/y origin, so side-by-side DockArea placement is not expressible.
3. `browser-embed` exposes no focus/keyboard/IME injection, and the named
   SceneOS display-list producer patches are not present. No alternate Servo
   patch was added.

## Build / test

```bash
cargo test --manifest-path apps/browser-native/Cargo.toml
cargo test --manifest-path apps/browser-native/Cargo.toml --features servo-pane
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
  cargo run --manifest-path apps/browser-native/Cargo.toml \
  --locked --no-default-features --features gpui,servo-pane
```

The bridge handshake rejects any page origin other than the exact origin of
`COMMONPLACE_CONSOLE_URL`, and every request must also present the injected
per-process token.

## Pins

See `PINS.md`. Do not bump without updating both `PINS.md` and `pins.rs`.
