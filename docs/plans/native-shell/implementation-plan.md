# SPEC-COMMONPLACE-NATIVE-SHELL-1.0 implementation plan

Source: `docs/specs/SPEC-COMMONPLACE-NATIVE-SHELL-1.0.md`

## Capability mix

observe → plan → execute (B1 first) → validate → coordinate → report.

Peer note: Codex presence is on Theorem (`repo:theorem:branch:main`), not CommonPlace.
Cursor owns CommonPlace native-shell paths below. Avoid editing Theorem `apps/browser`
or `browser-embed` unless the peer announces intent to stop.

## Order

1. **B1 host-bridge** (`packages/host-bridge`): durable asset; unlocks B6/F1/F2.
2. **B3 interaction-arbiter** (`crates/interaction-arbiter`): GPUI-free; palace walk law.
3. **B2 browser-core** (`crates/browser-core`): GPUI-free tabs/session/permissions/single-instance.
4. **B4 apps/browser-native**: own Cargo workspace; GPUI behind traits; pinned SHAs.
5. **B5/B6**: Shell-side mock hosts + z-order in `apps/browser-native/src/surfaces/` (partial). Real Servo RawWindowHandle + gpui-wry link = Codex/backend on Theorem pane-host.
6. **F1–F3**: React presence (textmode.js), rail placement (F2 complete for v1), ten-point proof window.

## Pinned SHAs (B4)

| Dep | SHA |
|-----|-----|
| `longbridge/gpui-component` | `2eed542ccd9e1e9700f366b5991b6fce1ef90e45` |
| `zed-industries/zed` (gpui) | `1a246efd7e1b83ab568ec5e3e6c1a43a42e1abba` (from gpui-component Cargo.lock) |

`gpui-wry` is the published name of `gpui-component/crates/webview`.

## Design (Paper)

Paper Desktop is running. File **Island Shells**, page **Native Shell** (`5-0`),
artboard **Native window 1440** created. MCP **writes** hit the weekly quota
("Weekly MCP limit reached… Upgrade to Paper Pro"). Brief + paste HTML live in
`chrome-design-brief.md` and `paper-chrome-paste.html`. Re-run writes after
quota reset or Pro upgrade.

## Checklist

See `.harness/checklists/commonplace-native-shell-1.0.json`.
