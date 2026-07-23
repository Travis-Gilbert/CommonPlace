# CommonPlace browser-native (SPEC-COMMONPLACE-NATIVE-SHELL-1.0 B4–B6)

Own Cargo workspace for the GPUI shell. Default feature is **mock**: no GPUI /
gpui-component / gpui-wry link. Real GPUI wiring is behind the optional `gpui`
feature and pinned SHAs in `PINS.md` / `src/pins.rs`.

## Layout

| Module | Role |
|--------|------|
| `traits` | `Shell`, `DockHost`, `SurfaceHost` — GPUI types never cross this boundary |
| `dock` | DockArea layout persist / restore (center, left rail, right evidence, bottom) |
| `prompts` | Native permission / takeover prompts from BrowserCore grant requests |
| `rail` | Capability rail fed by extension-point contributions |
| `surfaces` | **B5** mock Servo host + **B6** mock CommonPlace wry host + z-order law |
| `pins` | Documented commit SHAs for gpui / gpui-component / gpui-wry |
| `lib` | `NativeShell` composing `browser-core` + `interaction-arbiter` |

## B5 / B6 status (Codex handoff)

Shell-side contracts and mock acceptance tests live in `src/surfaces/`. Still
needed on the backend (Theorem pane-host / browser-shell):

1. **B5** — Parent Servo via `RawWindowHandle`; bounds track DockArea; SceneOS
   display-list presence overlay; real IME/focus through the arbiter.
2. **B6** — Enable `gpui` feature; link `gpui-wry` (`gpui-component/crates/webview`
   at pin `2eed542…`); load the console React bundle; typed loopback IPC for
   `GpuiHostAdapter`; screenshot assertion for z-order.

## Build / test

```bash
cargo test --manifest-path apps/browser-native/Cargo.toml
```

Default features run the mock shell acceptance tests without pulling GPUI.

## Pins

See `PINS.md`. Do not bump without updating both `PINS.md` and `pins.rs`.
