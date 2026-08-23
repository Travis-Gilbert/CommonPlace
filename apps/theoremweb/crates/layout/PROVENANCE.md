# TheoremWeb layout provenance

The wire contract mirrors `theorem-surface-registry` from the paired Theorem backend worktree. The CommonPlace crate does not create a second persistence authority: every committed mutation emits a `layout_write` MCP call carrying the same `LayoutObject` shape.

`dioxus-dnd` is pinned to 3.0.1, matching the read-only `UI/ecosystem-probe/probes/dnd` donor. The implementation uses `SortEvent` and `apply_sort`; the crate's callback fires only when a drop commits, which is the persistence boundary required by LY2. Current Dioxus 0.7 signal and event syntax was checked against the official 0.7.10 documentation.

Twenty Frontend layout code was not copied. Record-page and dashboard behavior is an independent Rust implementation from the specification and versioned graph contracts.
