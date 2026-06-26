# CommonPlace Desktop Backend Shell

The packaged CommonPlace desktop app is the Tauri backend in `src-tauri/`
wrapping the local Next.js CommonPlace app in `../web`. `tauri.conf.json`
points the main window at `http://localhost:3000/commonplace` in development
and at `../web/out` for packaged builds.

The Vite/React files under `src/` are not the primary product surface anymore.
Keep them only as a typed command-contract/reference harness for Tauri invoke
commands while the CommonPlace panels live in the Next.js app.

The native command layer is implemented in
`../../crates/commonplace-desktop-runtime`. It starts the local RustyRed node,
starts the durable `commonplace-api` loopback server, and owns the Theorem
receiver loop while the underlying Theorem/RustyRed crates are still sourced
from the sibling Theorem checkout.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
