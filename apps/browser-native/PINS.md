# Pinned dependencies (SPEC-COMMONPLACE-NATIVE-SHELL-1.0 B4)

These SHAs are the named choices for the GPUI edition. The default `mock`
feature does **not** fetch them; the optional `gpui` feature will.

| Crate / path | Upstream | SHA |
|--------------|----------|-----|
| `gpui-component` | `longbridge/gpui-component` | `2eed542ccd9e1e9700f366b5991b6fce1ef90e45` |
| `gpui` (zed) | `zed-industries/zed` (crate `gpui`, from gpui-component `Cargo.lock`) | `1a246efd7e1b83ab568ec5e3e6c1a43a42e1abba` |
| `gpui-wry` | `longbridge/gpui-component` `crates/webview` (published name of the webview crate) | same tree as `gpui-component` above (`2eed542…`) |

`gpui-wry` is experimental; bounds-and-visibility behavior is accepted as-is per
the spec. A committed `Cargo.lock` for the `gpui` feature is deferred until that
feature is enabled and exercised.

Keep `src/pins.rs` constants in sync with this table.
