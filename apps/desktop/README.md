# CommonPlace Desktop

The packaged CommonPlace desktop app combines the Vite/React shell in `src/`
with the Tauri backend in `src-tauri/`. `tauri.conf.json` points the main window
at the local Vite server in development and packages the generated `dist`
directory for release builds.

The canonical hosted product is `apps/console` at
`https://v2.theoremharness.com`. The desktop shell remains a separate native
host for local browsing and Tauri commands; it does not compile, import, or
package the retired web application.

The native command layer is implemented in
`../../crates/commonplace-desktop-runtime`. It starts the local RustyRed node,
starts the durable `commonplace-api` loopback server, and owns the Theorem
receiver loop while the underlying Theorem/RustyRed crates are still sourced
from the sibling Theorem checkout.

## Commands

- `npm run dev` starts the Tauri app and its Vite frontend.
- `npm run frontend:dev` starts the browser-only frontend harness.
- `npm run frontend:build` compiles the packaged frontend assets.
- `npm run tauri -- build` builds the native package.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
