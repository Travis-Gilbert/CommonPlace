# CommonPlace Desktop

The packaged CommonPlace desktop app combines the Tauri backend in `src-tauri/`
with two deliberately separate webview realms. The main window loads the
canonical hosted CommonPlace Console at `https://v2.theoremharness.com`; the
local Vite build contains only `pet.html`, the chrome-free PET and composer
extension owned by the same `CommonPlace.app` process.

The deprecated local desktop renderer remains available only as a source-level
development harness. It is not a configured Tauri launch target and is not
included in the packaged Vite entry graph.

The native command layer is implemented in
`../../crates/commonplace-desktop-runtime`. It starts the local RustyRed node,
starts the durable `commonplace-api` loopback server, and owns the Theorem
receiver loop while the underlying Theorem/RustyRed crates are still sourced
from the sibling Theorem checkout. The PET Rust plugin is pinned to the merged
Theorem revision in Cargo; the Swift helper preparation script verifies the
same revision and accepts an alternate checkout through `THEOREM_SOURCE_ROOT`.

## Commands

- `npm run dev` starts the Tauri app and its Vite frontend.
- `npm run frontend:dev` starts the local PET/development harness.
- `npm run frontend:build` compiles the PET-only packaged frontend assets.
- `npm run tauri -- build` builds the native package.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
