# Co-browse presence + Presence mark: remaining items

Everything in `implementation-plan.md` is shipped and validated (vitest 171/171, tsc clean, eslint clean on touched files, Rust server test passes, dev server renders `/commonplace` with no console errors). The items below are the only ones still open. All are gated on infrastructure that is not this feature's code.

## 1. Live end-to-end co-browse demonstration

- **Blocked on:** the local rustyred-thg node being up AND the CommonPlace Tauri desktop shell being built/run. Neither is available in the current environment.
- **What is NOT yet live-verified:** a recorded Watch session (D3), the interrupt-to-pause on real page focus (D4), a real Keep writing to the graph with a gold-register receipt (D8), and the three `PresenceMark` mounts rendering in a running shell (they render behind the `DesktopOnly` empty state in a plain browser, so browser coverage is unit tests, not a live screenshot).
- **How to close it:** start the local node, `npm run desktop:dev` from `CommonPlace/`, drive a real browse-with-me session against a real page, and capture the D2 screenshot / D3 recording / D8 Keep receipt.
- **Deployment note:** the product deploys at https://app.theoremharness.com/ . Live acceptance should ultimately be demonstrated there (or against the same backend the deployed app talks to), not only on `localhost:3000`.

## 2. Desktop-runtime `cargo check` (cross-repo lockfile collision)

- **Blocked on:** `commonplace v0.1.0` exists in both `CommonPlace/crates` and `Theorem/rustyredcore_THG/crates`, and the two `Cargo.lock` files drifted. `cargo check` of `commonplace-desktop-runtime` fails identically with `--locked`; it predates this feature and touches no manifests here.
- **What IS verified instead:** the runtime's Tauri API usage (`on_navigation`, `WebviewWindow.eval`, `Emitter::emit`, `WindowEvent::Focused(true)`) against vendored tauri 2.11.5 source. The engine-side change (server intent line + fixture emitter in `rustyred-thg-server/router.rs`) compiles and its test passes.
- **How to close it:** run `npm run sync:rustyred` (`scripts/update-rustyred-source.mjs`) to reconcile the vendored RustyRed source, or a dedicated lockfile-reconciliation pass, then `cargo check -p commonplace-desktop-runtime`.

## 3. `POST /api/theorem/graphql` 502 in dev

- Not a defect in this feature: it is the local node being down (same root as item 1). The co-browse surface renders its honest empty state regardless.

## Cross-repo state (for whoever pushes)

- **CommonPlace** commits `1abb8a0` (feature), `128a4a9` (lockfile sync), `f6eb618` (turbopack root fix) — as of writing these were stacked on a base ~54 commits behind `origin/commonplace-v2-porcelain-surface`; rebase onto current origin before opening a PR.
- **Theorem** commit `e3ddb8656` (server intent line + fixture emitter) on `Codex-Claude/joint-session`, plus the earlier docs commit `4512c7a4d` (sourcing addendum). The router.rs file is co-owned with another agent's in-flight work, which was left uncommitted in the working tree.
