# TheoremWeb license ledger

All commits below are immutable source pins. No source from `packages/twenty-front` is adapted.

| Local file | Upstream source | Commit | License | Adaptation |
|---|---|---|---|---|
| `crates/chrome/vendor/twenty-ui-theme-light.css` | `twentyhq/twenty/packages/twenty-ui/src/theme-constants/theme-light.css` | `9ee817f414db033454d273a0e371d27934a93af3` | MIT, Copyright (c) 2023-present Twenty.com, PBC | Exact CSS with an attribution header. |
| `crates/chrome/vendor/twenty-ui-theme-dark.css` | `twentyhq/twenty/packages/twenty-ui/src/theme-constants/theme-dark.css` | `9ee817f414db033454d273a0e371d27934a93af3` | MIT, Copyright (c) 2023-present Twenty.com, PBC | Exact CSS with an attribution header. |
| `crates/chrome/src/lib.rs` | twenty-ui theme variables and `rust-ui/dioxus-ui` shadcn/data-grid variable names | Twenty `9ee817f414db033454d273a0e371d27934a93af3`; dioxus-ui `2f87a8d0531d483d5b32df6f89b7979ceb4beb74` | MIT | Rust accessors, density contract, and one CSS-variable emitter. No React or `twenty-front` source. |

The full third-party license texts are retained in the repository root `THIRD_PARTY_NOTICES.md`.
# Record table

- `crates/record-table/src/grid/mod.rs` adapts the runtime component names,
  virtualization, drag selection, copy, grid state, and edit-state mechanics
  from `rust-ui/dioxus-ui` `app_crates/registry/src/ui/data_grid.rs` at commit
  `2f87a8d0531d483d5b32df6f89b7979ceb4beb74` (Copyright (c) 2026 Max
  Wells, MIT). Its compile-time traits, `strum` enumeration, 36px row height,
  60px checkbox width, and client sorting were replaced by runtime
  `ColumnSet`, the Twenty theme metrics, and generated server-tool calls.
